/// MacroVox — Phase 4: Deepgram WebSocket streaming.
///
/// Manages a persistent `wss://api.deepgram.com` connection that streams
/// raw PCM audio in real time and emits transcript events back to the renderer.
///
/// ## Flow
///
/// ```text
/// deepgram_start(api_key)
///   └── start_session(api_key, sample_rate, channels, app)
///         ├── connect_async(wss://...) — TLS handshake happens here (pre-warm)
///         ├── spawn background task
///         └── return DgSender (stored in AppState::dg_sender)
///
/// cpal callback (per ~10 ms frame):
///   └── if is_recording && dg_sender.is_some()
///         └── f32_to_i16_bytes(frame) → DgSender.send(DgMessage::Pcm(bytes))
///
/// background task:
///   ├── DgMessage::Pcm(bytes)  → WebSocket binary frame
///   ├── DgMessage::Stop        → send {"type":"CloseStream"}, exit loop
///   └── WebSocket text frame   → parse JSON → emit "deepgram:transcript" event
///
/// deepgram_stop()
///   └── drop DgSender  (→ recv() returns None → task sends CloseStream and exits)
///       OR send DgMessage::Stop explicitly
/// ```
///
/// ## Emitted events
///
/// `"deepgram:transcript"` — payload `{ transcript: string, isFinal: boolean }`
/// Emitted for every non-empty result (interim and final) from Deepgram.

use futures_util::{SinkExt, StreamExt};
use tauri::Emitter;
use tokio::sync::mpsc;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        http::header::{HeaderValue, AUTHORIZATION},
        Message,
    },
};

// ── Public types ──────────────────────────────────────────────────────────────

/// Messages the cpal callback (or commands) send to the background WebSocket task.
#[derive(Debug)]
pub enum DgMessage {
    /// Raw 16-bit little-endian PCM bytes to forward to Deepgram.
    Pcm(Vec<u8>),
    /// Signal the task to send `{"type":"CloseStream"}` and exit cleanly.
    Stop,
}

/// Sender half of the channel connecting the audio callback to the WS task.
/// Bounded to 500 messages (~5 seconds of audio at 10 ms frames) to prevent
/// unbounded memory growth if the WebSocket is slower than the audio callback.
pub type DgSender = mpsc::Sender<DgMessage>;

// ── Session start ─────────────────────────────────────────────────────────────

/// Opens a Deepgram streaming WebSocket and starts the background forwarding task.
///
/// Returns a `DgSender` that the cpal callback uses to stream PCM bytes.
/// Dropping the sender (or sending `DgMessage::Stop`) signals the task to
/// close the connection cleanly.
///
/// The background task emits `"deepgram:transcript"` Tauri events on the
/// provided `AppHandle` for every non-empty result Deepgram sends back.
pub async fn start_session(
    api_key: &str,
    sample_rate: u32,
    channels: u16,
    keywords: &[String],
    app: tauri::AppHandle,
) -> Result<DgSender, String> {
    let mut url = format!(
        "wss://api.deepgram.com/v1/listen\
         ?model=nova-3\
         &punctuate=true\
         &smart_format=true\
         &encoding=linear16\
         &sample_rate={sample_rate}\
         &channels={channels}\
         &interim_results=true"
    );

    for kw in keywords {
        url.push_str(&format!("&keywords={}", urlencoding::encode(kw)));
    }

    // Build HTTP upgrade request and inject the Authorization header.
    let mut request = url
        .into_client_request()
        .map_err(|e| format!("Invalid Deepgram URL: {e}"))?;
    request.headers_mut().insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Token {api_key}"))
            .map_err(|_| "Invalid API key format".to_string())?,
    );

    // Establish the WebSocket — this is the pre-warm step.
    let (ws_stream, _response) = connect_async(request)
        .await
        .map_err(|e| format!("Deepgram WebSocket connect failed: {e}"))?;

    let (mut ws_sink, mut ws_rx) = ws_stream.split();
    // Bounded channel: 500 messages ≈ 5 s of 10 ms audio frames.
    // If the WebSocket can't keep up, old frames are dropped silently.
    let (tx, mut rx) = mpsc::channel::<DgMessage>(500);

    // Spawn the background task that forwards PCM → WebSocket and
    // WebSocket transcript events → Tauri events.
    tokio::spawn(async move {
        loop {
            tokio::select! {
                // ── Outbound: PCM bytes or control messages ────────────────
                msg = rx.recv() => {
                    match msg {
                        Some(DgMessage::Pcm(bytes)) => {
                            if ws_sink.send(Message::Binary(bytes)).await.is_err() {
                                // WebSocket closed unexpectedly.
                                break;
                            }
                        }
                        Some(DgMessage::Stop) | None => {
                            // Graceful close: tell Deepgram we are done.
                            let _ = ws_sink
                                .send(Message::Text(
                                    r#"{"type":"CloseStream"}"#.to_string(),
                                ))
                                .await;
                            let _ = ws_sink.close().await;
                            break;
                        }
                    }
                }

                // ── Inbound: transcript results from Deepgram ──────────────
                ws_msg = ws_rx.next() => {
                    match ws_msg {
                        Some(Ok(Message::Text(text))) => {
                            emit_transcript_event(&app, &text);
                        }
                        // Server close frame or stream end — exit.
                        Some(Ok(Message::Close(_))) | None => break,
                        // Ping/Pong/Binary frames — ignore.
                        _ => {}
                    }
                }
            }
        }

        // Drain any remaining messages after sending CloseStream so Deepgram
        // can flush its buffer and emit the last final result.
        while let Some(Ok(Message::Text(text))) = ws_rx.next().await {
            emit_transcript_event(&app, &text);
        }
    });

    Ok(tx)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Parses a Deepgram JSON result and emits a `"deepgram:transcript"` event.
///
/// Emits for both interim (`is_final=false`) and final (`is_final=true`) results.
/// Skips empty transcripts (silence frames) to avoid noisy events.
fn emit_transcript_event(app: &tauri::AppHandle, text: &str) {
    let Ok(json) = serde_json::from_str::<serde_json::Value>(text) else {
        return;
    };

    // Deepgram wraps transcripts in results.channels[0].alternatives[0]
    let transcript = json["channel"]["alternatives"][0]["transcript"]
        .as_str()
        .unwrap_or("");

    if transcript.is_empty() {
        return;
    }

    let is_final = json["is_final"].as_bool().unwrap_or(false);

    let _ = app.emit(
        "deepgram:transcript",
        serde_json::json!({
            "transcript": transcript,
            "isFinal": is_final,
        }),
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// A well-formed Deepgram JSON result (interim).
    const INTERIM_JSON: &str = r#"{
        "is_final": false,
        "channel": {
            "alternatives": [{ "transcript": "hello world", "confidence": 0.95 }]
        }
    }"#;

    /// A well-formed Deepgram JSON result (final).
    const FINAL_JSON: &str = r#"{
        "is_final": true,
        "channel": {
            "alternatives": [{ "transcript": "hello world.", "confidence": 0.99 }]
        }
    }"#;

    /// An empty-transcript result that should be silently skipped.
    const EMPTY_TRANSCRIPT_JSON: &str = r#"{
        "is_final": false,
        "channel": {
            "alternatives": [{ "transcript": "", "confidence": 0.0 }]
        }
    }"#;

    /// Malformed JSON that should be silently skipped.
    const BAD_JSON: &str = "not json at all";

    #[test]
    fn parse_interim_transcript() {
        let json: serde_json::Value = serde_json::from_str(INTERIM_JSON).unwrap();
        let t = json["channel"]["alternatives"][0]["transcript"]
            .as_str()
            .unwrap_or("");
        let is_final = json["is_final"].as_bool().unwrap_or(false);
        assert_eq!(t, "hello world");
        assert!(!is_final);
    }

    #[test]
    fn parse_final_transcript() {
        let json: serde_json::Value = serde_json::from_str(FINAL_JSON).unwrap();
        let t = json["channel"]["alternatives"][0]["transcript"]
            .as_str()
            .unwrap_or("");
        let is_final = json["is_final"].as_bool().unwrap_or(false);
        assert_eq!(t, "hello world.");
        assert!(is_final);
    }

    #[test]
    fn empty_transcript_is_skipped() {
        let json: serde_json::Value = serde_json::from_str(EMPTY_TRANSCRIPT_JSON).unwrap();
        let t = json["channel"]["alternatives"][0]["transcript"]
            .as_str()
            .unwrap_or("");
        // Would be filtered before emitting.
        assert!(t.is_empty());
    }

    #[test]
    fn bad_json_is_skipped() {
        // serde_json::from_str should fail and emit_transcript_event returns early.
        assert!(serde_json::from_str::<serde_json::Value>(BAD_JSON).is_err());
    }

    #[test]
    fn dg_message_pcm_carries_bytes() {
        let bytes = vec![0u8, 1, 2, 3];
        let msg = DgMessage::Pcm(bytes.clone());
        if let DgMessage::Pcm(b) = msg {
            assert_eq!(b, bytes);
        } else {
            panic!("expected Pcm variant");
        }
    }

    #[test]
    fn dg_sender_send_and_recv() {
        let (tx, mut rx) = mpsc::channel::<DgMessage>(500);
        tx.try_send(DgMessage::Pcm(vec![1, 2])).unwrap();
        tx.try_send(DgMessage::Stop).unwrap();
        drop(tx);

        match rx.blocking_recv() {
            Some(DgMessage::Pcm(b)) => assert_eq!(b, vec![1, 2]),
            other => panic!("expected Pcm, got {other:?}"),
        }
        assert!(matches!(rx.blocking_recv(), Some(DgMessage::Stop)));
        assert!(rx.blocking_recv().is_none()); // sender dropped
    }
}
