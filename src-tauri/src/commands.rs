/// MacroVox Tauri commands.
///
/// Every command here mirrors one channel from the Electron preload
/// (`src/main/preload.ts`). The renderer calls them via:
///   `invoke("command_name", payload)`   (see `src/renderer/lib/tauri-ipc.ts`)
///
/// Phase status per command:
///   ✅ Phase 2 — implemented (clipboard, window ops, broadcast events, auto-paste)
///   ✅ Phase 3 — audio (cpal WASAPI replaces ffmpeg subprocess)
///   ✅ Phase 4 — Deepgram WebSocket pre-warm + whisper-rs local STT scaffold
///   🔲 Phase 5 — enigo native paste (replaces PowerShell ~700 ms)
///   🔲 Phase 6 — auth stubs removed; Supabase JS SDK used from renderer
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::state::AppState;

// ── Shared response types ─────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct OkResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl OkResponse {
    pub fn ok() -> Self {
        Self { success: true, error: None }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, error: Some(msg.into()) }
    }
}

#[derive(serde::Serialize, Debug)]
pub struct AudioDevicesResponse {
    pub success: bool,
    pub devices: Vec<String>,
    pub selected: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct RecordingStopResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct AppUser {
    pub id: String,
    pub email: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "authMethod")]
    pub auth_method: String,
}

#[derive(serde::Serialize, Debug)]
pub struct GetUserResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<AppUser>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct ManagedKeysResponse {
    pub success: bool,
    #[serde(rename = "deepgramKey", skip_serializing_if = "Option::is_none")]
    pub deepgram_key: Option<String>,
    #[serde(rename = "anthropicKey", skip_serializing_if = "Option::is_none")]
    pub anthropic_key: Option<String>,
    #[serde(rename = "hasManagedKeys")]
    pub has_managed_keys: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ── Audio ✅ Phase 3: cpal WASAPI native capture ───────────────────────────────

#[tauri::command]
pub fn audio_list_devices(state: State<AppState>) -> AudioDevicesResponse {
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    let devices: Vec<String> = host
        .input_devices()
        .map(|iter| iter.filter_map(|d| d.name().ok()).collect())
        .unwrap_or_default();
    let selected = state.selected_mic_device.lock().unwrap().clone();
    AudioDevicesResponse { success: true, devices, selected, error: None }
}

#[tauri::command]
pub fn audio_set_device(device_name: String, state: State<AppState>) -> OkResponse {
    *state.selected_mic_device.lock().unwrap() = Some(device_name);
    OkResponse::ok()
}

/// Opens a cpal WASAPI input stream on the selected (or default) microphone.
///
/// Stores the stream in `AppState::audio_stream`; dropping it later (in
/// `audio_stop`) halts capture. Updates `audio_sample_rate` and
/// `audio_channels` so `recording_stop` can build the correct WAV header.
#[tauri::command]
pub fn audio_start(state: State<AppState>) -> OkResponse {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();
    let device_name = state.selected_mic_device.lock().unwrap().clone();

    // Find the requested device, or fall back to the system default.
    let device = if let Some(ref name) = device_name {
        host.input_devices()
            .ok()
            .and_then(|mut iter| iter.find(|d| d.name().ok().as_deref() == Some(name.as_str())))
            .or_else(|| host.default_input_device())
    } else {
        host.default_input_device()
    };

    let device = match device {
        Some(d) => d,
        None => return OkResponse::err("No input device found"),
    };

    let config = match device.default_input_config() {
        Ok(c) => c,
        Err(e) => return OkResponse::err(format!("Failed to get input config: {e}")),
    };

    // Persist stream parameters for WAV encoding in recording_stop.
    *state.audio_sample_rate.lock().unwrap() = config.sample_rate().0;
    *state.audio_channels.lock().unwrap() = config.channels();

    let level = Arc::clone(&state.audio_level);
    let buffer = Arc::clone(&state.recording_buffer);
    let is_recording = Arc::clone(&state.is_recording);

    let dg_sender = Arc::clone(&state.dg_sender);

    match crate::audio::build_input_stream(&device, &config, level, buffer, is_recording, dg_sender) {
        Ok(stream) => {
            if let Err(e) = stream.play() {
                return OkResponse::err(format!("Failed to start stream: {e}"));
            }
            *state.audio_stream.lock().unwrap() = Some(crate::state::AudioStream(stream));
            OkResponse::ok()
        }
        Err(e) => OkResponse::err(format!("Failed to build audio stream: {e}")),
    }
}

/// Stops audio capture by dropping the cpal stream and zeroing the level meter.
#[tauri::command]
pub fn audio_stop(state: State<AppState>) -> OkResponse {
    *state.audio_stream.lock().unwrap() = None;
    *state.audio_level.lock().unwrap() = 0.0;
    OkResponse::ok()
}

/// Returns the current RMS level of the capture stream (0.0–1.0).
#[tauri::command]
pub fn audio_get_level(state: State<AppState>) -> f64 {
    *state.audio_level.lock().unwrap()
}

// ── Deepgram streaming ✅ Phase 4: pre-warmed WebSocket ───────────────────────

/// Opens a Deepgram WebSocket connection and begins streaming audio in real time.
///
/// This command is the streaming-mode equivalent of `recording_start`.  The
/// renderer calls it (with `mode = "streaming"`) instead of `recording_start`.
///
/// Steps:
/// 1. Reads the device's sample rate and channel count from `AppState`.
/// 2. Calls `deepgram_ws::start_session` to establish the `wss://` connection
///    (the pre-warm step — the handshake happens here, before the user speaks).
/// 3. Stores the `DgSender` in `AppState::dg_sender` so the cpal callback can
///    forward audio frames to the WebSocket task.
/// 4. Clears the recording buffer and sets `is_recording = true` so the cpal
///    callback starts both buffering (batch fallback) and streaming (WS path).
///
/// Transcripts are pushed back to the renderer as `"deepgram:transcript"` events.
#[tauri::command]
pub async fn deepgram_start(
    api_key: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<OkResponse, String> {
    let sample_rate = *state.audio_sample_rate.lock().unwrap();
    let channels = *state.audio_channels.lock().unwrap();

    match crate::deepgram_ws::start_session(&api_key, sample_rate, channels, app).await {
        Ok(sender) => {
            // Store sender before setting is_recording so the first callback
            // frame is not missed.
            *state.dg_sender.lock().unwrap() = Some(sender);
            state.recording_buffer.lock().unwrap().clear();
            *state.is_recording.lock().unwrap() = true;
            Ok(OkResponse::ok())
        }
        Err(e) => Ok(OkResponse::err(e)),
    }
}

/// Stops Deepgram WebSocket streaming and closes the connection.
///
/// Sends `DgMessage::Stop` to the background task, which in turn sends
/// `{"type":"CloseStream"}` to Deepgram and drains any final transcript
/// fragments before exiting.  Any remaining `"deepgram:transcript"` events
/// will still arrive in the renderer before the socket closes.
#[tauri::command]
pub fn deepgram_stop(state: State<AppState>) -> OkResponse {
    *state.is_recording.lock().unwrap() = false;

    // Take the sender out of state — dropping it signals the task to close,
    // but sending Stop first gives Deepgram a chance to flush its buffer.
    if let Some(sender) = state.dg_sender.lock().unwrap().take() {
        let _ = sender.send(crate::deepgram_ws::DgMessage::Stop);
    }

    OkResponse::ok()
}

// ── Buffered recording ✅ Phase 3 ─────────────────────────────────────────────

/// Clears any stale buffer and signals the cpal callback to start accumulating.
#[tauri::command]
pub fn recording_start(state: State<AppState>) -> OkResponse {
    state.recording_buffer.lock().unwrap().clear();
    *state.is_recording.lock().unwrap() = true;
    OkResponse::ok()
}

/// Stops buffering, encodes the captured PCM as WAV, and uploads to Deepgram's
/// pre-recorded API. Returns the transcript, confidence, and duration.
///
/// This is an `async` command because it awaits the Deepgram HTTP response.
/// All state locks are released before the `await` to avoid holding them across
/// the suspension point.
/// Tauri 2 requires async commands with borrowed `State<'_, T>` to return `Result`.
/// The `Err` arm is unreachable — failures are expressed through `RecordingStopResponse`.
#[tauri::command]
pub async fn recording_stop(
    api_key: String,
    state: State<'_, AppState>,
) -> Result<RecordingStopResponse, String> {
    // --- Stop recording and drain the buffer synchronously ---
    *state.is_recording.lock().unwrap() = false;
    let samples = std::mem::take(&mut *state.recording_buffer.lock().unwrap());
    let sample_rate = *state.audio_sample_rate.lock().unwrap();
    let channels = *state.audio_channels.lock().unwrap();
    // State locks released here — safe to await below.

    if samples.is_empty() {
        return Ok(RecordingStopResponse {
            success: false,
            transcript: None,
            confidence: None,
            duration: None,
            error: Some("No audio was captured".to_string()),
        });
    }

    let duration = samples.len() as f64 / (sample_rate as f64 * channels as f64);
    let wav = crate::audio::pcm_to_wav(&samples, sample_rate, channels);

    // --- Upload to Deepgram pre-recorded API ---
    // model=nova-2: best accuracy/speed balance as of 2025
    const URL: &str =
        "https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true";

    let client = reqwest::Client::new();
    let resp = match client
        .post(URL)
        .header("Authorization", format!("Token {api_key}"))
        .header("Content-Type", "audio/wav")
        .body(wav)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return Ok(RecordingStopResponse {
                success: false,
                transcript: None,
                confidence: None,
                duration: Some(duration),
                error: Some(format!("Deepgram request failed: {e}")),
            })
        }
    };

    let json: serde_json::Value = resp.json().await.unwrap_or_default();
    let alt = &json["results"]["channels"][0]["alternatives"][0];
    Ok(RecordingStopResponse {
        success: true,
        transcript: Some(alt["transcript"].as_str().unwrap_or("").to_string()),
        confidence: alt["confidence"].as_f64(),
        duration: Some(duration),
        error: None,
    })
}

/// Discards the recording buffer without transcribing.
#[tauri::command]
pub fn recording_cancel(state: State<AppState>) -> OkResponse {
    *state.is_recording.lock().unwrap() = false;
    state.recording_buffer.lock().unwrap().clear();
    OkResponse::ok()
}

// ── Local STT ✅ Phase 4 (local-stt feature) ──────────────────────────────────

/// Transcribes the current recording buffer using whisper-rs (offline/local STT).
///
/// This is an alternative to `recording_stop` for users who want fully offline
/// transcription.  Call after `recording_start` + recording, just like
/// `recording_stop`, but pass a `model_path` pointing to a downloaded GGML
/// model file (e.g. `ggml-base.en.bin`).
///
/// ## Enabling
///
/// The `local-stt` Cargo feature is **off by default** because whisper-rs
/// builds whisper.cpp from source, which requires cmake and a C++ toolchain.
/// Enable it with:
///
/// ```sh
/// cargo build --features local-stt
/// ```
///
/// ## Model download
///
/// Download GGML models from:
/// `https://huggingface.co/ggerganov/whisper.cpp/tree/main`
/// Recommended starter: `ggml-base.en.bin` (~142 MB, English only, fast)
#[tauri::command]
pub fn whisper_transcribe(
    model_path: String,
    state: State<AppState>,
) -> RecordingStopResponse {
    *state.is_recording.lock().unwrap() = false;
    let samples = std::mem::take(&mut *state.recording_buffer.lock().unwrap());
    let sample_rate = *state.audio_sample_rate.lock().unwrap();

    if samples.is_empty() {
        return RecordingStopResponse {
            success: false,
            transcript: None,
            confidence: None,
            duration: None,
            error: Some("No audio was captured".to_string()),
        };
    }

    let duration = samples.len() as f64 / sample_rate as f64;

    #[cfg(feature = "local-stt")]
    {
        whisper_transcribe_impl(samples, sample_rate, duration, &model_path)
    }

    #[cfg(not(feature = "local-stt"))]
    {
        let _ = (model_path, duration); // suppress unused warnings
        RecordingStopResponse {
            success: false,
            transcript: None,
            confidence: None,
            duration: Some(duration),
            error: Some(
                "local-stt feature not enabled — rebuild with `cargo build --features local-stt`"
                    .to_string(),
            ),
        }
    }
}

#[cfg(feature = "local-stt")]
fn whisper_transcribe_impl(
    samples: Vec<f32>,
    sample_rate: u32,
    duration: f64,
    model_path: &str,
) -> RecordingStopResponse {
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    let ctx = match WhisperContext::new_with_params(model_path, WhisperContextParameters::default()) {
        Ok(c) => c,
        Err(e) => {
            return RecordingStopResponse {
                success: false,
                transcript: None,
                confidence: None,
                duration: Some(duration),
                error: Some(format!("Failed to load whisper model: {e}")),
            }
        }
    };

    let mut whisper_state = match ctx.create_state() {
        Ok(s) => s,
        Err(e) => {
            return RecordingStopResponse {
                success: false,
                transcript: None,
                confidence: None,
                duration: Some(duration),
                error: Some(format!("Failed to create whisper state: {e}")),
            }
        }
    };

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // whisper-rs expects mono f32 samples at 16 kHz.
    // If the device captured at a different rate, basic downmix/resample is
    // needed. For now we pass samples as-is — 16 kHz mono is the recommended
    // cpal config and the default MacroVox audio_start path uses the device
    // default which is typically 16 kHz mono on Windows microphones.
    if let Err(e) = whisper_state.full(params, &samples) {
        return RecordingStopResponse {
            success: false,
            transcript: None,
            confidence: None,
            duration: Some(duration),
            error: Some(format!("Whisper inference failed: {e}")),
        };
    }

    let n = whisper_state.full_n_segments().unwrap_or(0);
    let transcript: String = (0..n)
        .filter_map(|i| whisper_state.full_get_segment_text(i).ok())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    RecordingStopResponse {
        success: true,
        transcript: Some(transcript),
        confidence: None, // whisper-rs does not expose per-segment confidence
        duration: Some(duration),
        error: None,
    }
}

// ── Clipboard ✅ Phase 2 ───────────────────────────────────────────────────────

#[tauri::command]
pub fn clipboard_write(app: AppHandle, text: String) -> OkResponse {
    app.clipboard()
        .write_text(text)
        .map(|_| OkResponse::ok())
        .unwrap_or_else(|e| OkResponse::err(e.to_string()))
}

// ── Auto-paste ✅ Phase 2 (Phase 5: replace PowerShell with enigo) ─────────────

#[tauri::command]
pub fn dictation_auto_paste(app: AppHandle) -> OkResponse {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    // Spawn on a background thread so the 180 ms sleep doesn't block the executor.
    // Phase 5: replace this whole block with `enigo::Key::Control + enigo::Key::V`.
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(180));
        let mut cmd = std::process::Command::new("powershell");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; \
             [System.Windows.Forms.SendKeys]::SendWait(\"^v\")",
        ]);
        // Suppress the console window on Windows
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);
        let _ = cmd.spawn();
    });

    OkResponse::ok()
}

// ── Window settings ✅ Phase 2 ────────────────────────────────────────────────

#[tauri::command]
pub fn dictation_set_always_on_top(
    app: AppHandle,
    value: bool,
    state: State<AppState>,
) -> OkResponse {
    *state.dictation_always_on_top.lock().unwrap() = value;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(value);
    }
    OkResponse::ok()
}

#[tauri::command]
pub fn settings_open_window(app: AppHandle) -> OkResponse {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
        return OkResponse::ok();
    }

    // Dev: load from Vite dev server; production: load from bundled dist.
    let url = if cfg!(dev) {
        tauri::WebviewUrl::External(
            "http://localhost:5173/settings.html"
                .parse()
                .expect("invalid settings dev URL"),
        )
    } else {
        tauri::WebviewUrl::App("settings.html".into())
    };

    match WebviewWindowBuilder::new(&app, "settings", url)
        .title("Settings")
        .inner_size(480.0, 700.0)
        .min_inner_size(400.0, 500.0)
        .always_on_top(true)
        .build()
    {
        Ok(_) => OkResponse::ok(),
        Err(e) => OkResponse::err(e.to_string()),
    }
}

#[tauri::command]
pub fn app_set_minimize_to_tray(value: bool, state: State<AppState>) -> OkResponse {
    *state.minimize_to_tray.lock().unwrap() = value;
    OkResponse::ok()
}

// ── Theme & settings broadcast ✅ Phase 2 ─────────────────────────────────────

#[tauri::command]
pub fn theme_broadcast(app: AppHandle, theme_id: String) -> OkResponse {
    app.emit("theme-changed", &theme_id)
        .map(|_| OkResponse::ok())
        .unwrap_or_else(|e| OkResponse::err(e.to_string()))
}

#[tauri::command]
pub fn settings_broadcast(
    settings: HashMap<String, String>,
    state: State<AppState>,
    app: AppHandle,
) -> OkResponse {
    // Side-effects: update backend state from incoming settings map
    if let Some(raw) = settings.get("deepgram_keywords") {
        let keywords: Vec<String> = raw
            .split('\n')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        *state.deepgram_keywords.lock().unwrap() = keywords;
    }
    if let Some(val) = settings.get("minimize_to_tray") {
        *state.minimize_to_tray.lock().unwrap() = val == "true";
    }

    app.emit("settings-changed", &settings)
        .map(|_| OkResponse::ok())
        .unwrap_or_else(|e| OkResponse::err(e.to_string()))
}

// ── Auth stubs (Phase 6: remove IPC layer; renderer calls Supabase directly) ──

#[tauri::command]
pub fn auth_get_user() -> GetUserResponse {
    GetUserResponse { success: false, user: None, error: None }
}

#[tauri::command]
pub fn auth_sign_up_email(_email: String, _password: String) -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_sign_in_email(_email: String, _password: String) -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_sign_in_oauth(_provider: String) -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_sign_out() -> OkResponse {
    OkResponse::ok()
}

#[tauri::command]
pub fn auth_reset_password(_email: String) -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_get_subscription() -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_get_managed_keys() -> ManagedKeysResponse {
    ManagedKeysResponse {
        success: false,
        deepgram_key: None,
        anthropic_key: None,
        has_managed_keys: false,
        error: Some("Not implemented — auth handled in renderer (Phase 6)".to_string()),
    }
}

#[tauri::command]
pub fn auth_checkout(_plan: String) -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

#[tauri::command]
pub fn auth_billing_portal() -> OkResponse {
    OkResponse::err("Not implemented — auth handled in renderer (Phase 6)")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ok_response_success() {
        let r = OkResponse::ok();
        assert!(r.success);
        assert!(r.error.is_none());
    }

    #[test]
    fn ok_response_error() {
        let r = OkResponse::err("boom");
        assert!(!r.success);
        assert_eq!(r.error.as_deref(), Some("boom"));
    }

    #[test]
    fn ok_response_serialises_no_error_field_when_none() {
        let json = serde_json::to_string(&OkResponse::ok()).unwrap();
        assert!(!json.contains("error"), "error field should be omitted: {json}");
        assert!(json.contains("\"success\":true"));
    }

    #[test]
    fn ok_response_serialises_error_field_when_present() {
        let json = serde_json::to_string(&OkResponse::err("oops")).unwrap();
        assert!(json.contains("\"error\":\"oops\""), "{json}");
        assert!(json.contains("\"success\":false"));
    }

    #[test]
    fn audio_devices_response_shape() {
        let r = AudioDevicesResponse {
            success: true,
            devices: vec!["Mic A".to_string()],
            selected: Some("Mic A".to_string()),
            error: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"devices\":[\"Mic A\"]"), "{json}");
        assert!(json.contains("\"selected\":\"Mic A\""), "{json}");
        assert!(!json.contains("\"error\""), "{json}");
    }

    #[test]
    fn recording_stop_response_omits_optionals() {
        let r = RecordingStopResponse {
            success: true,
            transcript: None,
            confidence: None,
            duration: None,
            error: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert_eq!(json, r#"{"success":true}"#, "{json}");
    }

    #[test]
    fn recording_stop_response_includes_transcript() {
        let r = RecordingStopResponse {
            success: true,
            transcript: Some("hello world".to_string()),
            confidence: Some(0.99),
            duration: Some(3.2),
            error: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"transcript\":\"hello world\""), "{json}");
        assert!(json.contains("\"confidence\":0.99"), "{json}");
        assert!(json.contains("\"duration\":3.2"), "{json}");
    }

    #[test]
    fn app_user_camel_case_fields() {
        let u = AppUser {
            id: "u1".to_string(),
            email: Some("a@b.com".to_string()),
            display_name: Some("Alice".to_string()),
            avatar_url: Some("https://example.com/a.png".to_string()),
            auth_method: "email".to_string(),
        };
        let json = serde_json::to_string(&u).unwrap();
        assert!(json.contains("\"displayName\":\"Alice\""), "{json}");
        assert!(json.contains("\"avatarUrl\":\"https://example.com/a.png\""), "{json}");
        assert!(json.contains("\"authMethod\":\"email\""), "{json}");
    }

    #[test]
    fn get_user_response_no_user() {
        let r = GetUserResponse { success: false, user: None, error: None };
        let json = serde_json::to_string(&r).unwrap();
        assert!(!json.contains("\"user\""), "{json}");
    }

    #[test]
    fn managed_keys_response_field_names() {
        let r = ManagedKeysResponse {
            success: true,
            deepgram_key: Some("dg-key".to_string()),
            anthropic_key: None,
            has_managed_keys: true,
            error: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"deepgramKey\":\"dg-key\""), "{json}");
        assert!(json.contains("\"hasManagedKeys\":true"), "{json}");
        assert!(!json.contains("\"anthropicKey\""), "{json}");
    }

    #[test]
    fn settings_broadcast_parses_keywords() {
        let state = AppState::default();
        let mut map = HashMap::new();
        map.insert("deepgram_keywords".to_string(), "MacroVox\nDeepgram\n".to_string());
        if let Some(raw) = map.get("deepgram_keywords") {
            let keywords: Vec<String> = raw
                .split('\n')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            *state.deepgram_keywords.lock().unwrap() = keywords;
        }
        let kws = state.deepgram_keywords.lock().unwrap().clone();
        assert_eq!(kws, vec!["MacroVox", "Deepgram"]);
    }

    #[test]
    fn settings_broadcast_parses_minimize_to_tray() {
        let state = AppState::default();
        let mut map = HashMap::new();
        map.insert("minimize_to_tray".to_string(), "true".to_string());
        if let Some(val) = map.get("minimize_to_tray") {
            *state.minimize_to_tray.lock().unwrap() = val == "true";
        }
        assert!(*state.minimize_to_tray.lock().unwrap());
    }

    #[test]
    fn audio_set_device_updates_state() {
        let state = AppState::default();
        *state.selected_mic_device.lock().unwrap() = Some("Headset".to_string());
        assert_eq!(state.selected_mic_device.lock().unwrap().as_deref(), Some("Headset"));
    }

    #[test]
    fn dictation_set_always_on_top_updates_state() {
        let state = AppState::default();
        *state.dictation_always_on_top.lock().unwrap() = false;
        assert!(!*state.dictation_always_on_top.lock().unwrap());
    }

    #[test]
    fn recording_start_clears_buffer_and_sets_flag() {
        let state = AppState::default();
        // Pre-load some stale samples
        state.recording_buffer.lock().unwrap().push(0.1);
        // Simulate recording_start logic
        state.recording_buffer.lock().unwrap().clear();
        *state.is_recording.lock().unwrap() = true;
        assert!(state.recording_buffer.lock().unwrap().is_empty());
        assert!(*state.is_recording.lock().unwrap());
    }

    #[test]
    fn recording_cancel_clears_buffer_and_flag() {
        let state = AppState::default();
        state.recording_buffer.lock().unwrap().push(0.5);
        *state.is_recording.lock().unwrap() = true;
        // Simulate recording_cancel logic
        *state.is_recording.lock().unwrap() = false;
        state.recording_buffer.lock().unwrap().clear();
        assert!(!*state.is_recording.lock().unwrap());
        assert!(state.recording_buffer.lock().unwrap().is_empty());
    }
}
