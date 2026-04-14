# STT Provider Selection — Design Document

## Overview

Allow users to choose their speech-to-text provider from the settings menu. Candidate providers: **Deepgram**, **OpenAI Whisper**, **ElevenLabs Scribe**, and optionally **local Whisper** (already partially implemented behind the `local-stt` feature flag).

---

## Current Architecture

Today, Deepgram is hardcoded throughout the stack:

- **Audio capture** (`src-tauri/src/audio.rs`) — captures PCM from the mic via cpal, converts f32 to i16 LE bytes, and sends them through an `mpsc` channel
- **WebSocket streaming** (`src-tauri/src/deepgram_ws.rs`) — connects to `wss://api.deepgram.com/v1/listen`, sends PCM frames, parses Deepgram-specific JSON responses
- **Batch transcription** (`src-tauri/src/commands.rs:271-343`) — encodes audio as WAV, POSTs to `https://api.deepgram.com/v1/listen`, parses response
- **IPC layer** (`src/renderer/lib/tauri-ipc.ts`) — exposes `startDeepgram`, `stopDeepgram`, `startRecording`, `stopRecording`
- **Settings** (`SettingsPanel.tsx`) — Deepgram-specific keyword boosts, no provider selector
- **State** (`src-tauri/src/state.rs`) — stores `deepgram_keywords`, `dg_sender`

---

## What Needs to Change

### 1. Rust: Provider Trait

Create `src-tauri/src/stt/mod.rs` with a trait that abstracts the two transcription modes:

```rust
pub trait SttProvider: Send + Sync {
    /// Start a streaming WebSocket session. Returns a sender for audio frames.
    async fn start_stream(
        &self,
        api_key: &str,
        sample_rate: u32,
        channels: u16,
        app: AppHandle,
    ) -> Result<mpsc::Sender<SttMessage>, String>;

    /// Transcribe a complete WAV buffer (batch mode).
    async fn transcribe_batch(
        &self,
        api_key: &str,
        wav_bytes: Vec<u8>,
    ) -> Result<TranscriptResult, String>;
}
```

Each provider implements this trait. The existing `deepgram_ws.rs` and batch code in `commands.rs` get refactored into a `DeepgramProvider` struct.

### 2. Rust: Provider Implementations

| Provider | Streaming | Batch | Audio Format | Auth | Notes |
|----------|-----------|-------|-------------|------|-------|
| **Deepgram** | WebSocket (`wss://api.deepgram.com/v1/listen`) | REST POST | PCM i16 LE (streaming), WAV (batch) | API key in URL | Current implementation — extract and wrap |
| **OpenAI Whisper** | Not supported | REST POST to `https://api.openai.com/v1/audio/transcriptions` | WAV, mp3, webm | Bearer token | Batch-only; no streaming API. Could poll at intervals for pseudo-streaming |
| **ElevenLabs Scribe** | WebSocket (`wss://api.elevenlabs.io/v1/speech-to-text/stream`) | REST POST to `https://api.elevenlabs.io/v1/speech-to-text` | PCM i16 LE (streaming), various (batch) | `xi-api-key` header | Similar WebSocket model to Deepgram |
| **Local Whisper** | Not practical | In-process via whisper-rs | f32 PCM (direct) | None | Already partially exists behind `local-stt` flag |

### 3. Rust: State Changes

In `state.rs`, replace Deepgram-specific fields with provider-generic ones:

```rust
pub struct AppState {
    pub stt_provider: Mutex<SttProviderType>,    // enum { Deepgram, OpenAi, ElevenLabs, LocalWhisper }
    pub stream_sender: Arc<Mutex<Option<mpsc::Sender<SttMessage>>>>,  // was dg_sender
    pub provider_keywords: Mutex<Vec<String>>,    // was deepgram_keywords (only used by Deepgram)
    // ... rest unchanged
}
```

### 4. Rust: Command Changes

The IPC commands in `commands.rs` would become provider-agnostic:

- `stt_start` (replaces `deepgram_start`) — reads selected provider from state, delegates to its `start_stream()`
- `stt_stop` (replaces `deepgram_stop`) — sends Stop message through the generic channel
- `recording_stop` — delegates to the selected provider's `transcribe_batch()`
- New: `stt_set_provider` — updates the active provider in AppState

The frontend event name `"deepgram:transcript"` would change to `"stt:transcript"`.

### 5. Frontend: IPC Layer

In `tauri-ipc.ts`, rename/generalize:

```typescript
export const startStt = (apiKey: string) => invoke('stt_start', { apiKey })
export const stopStt = () => invoke('stt_stop')
export const onTranscript = (cb) => listen('stt:transcript', cb)  // was deepgram:transcript
export const setSttProvider = (provider: string) => invoke('stt_set_provider', { provider })
```

### 6. Frontend: Settings UI

Add a provider selector to `SettingsPanel.tsx`:

- Dropdown: Deepgram / OpenAI Whisper / ElevenLabs / Local Whisper
- Conditionally show provider-specific settings:
  - **Deepgram**: keyword boosts, model selection (nova-3, nova-2, etc.)
  - **OpenAI**: model (whisper-1), language hint, response format
  - **ElevenLabs**: language code, model selection
  - **Local Whisper**: model file path picker
- Store selection in localStorage key `stt_provider`
- Broadcast to backend via `settings_broadcast`

### 7. Frontend: API Key Management

Currently the app stores one API key. With multiple providers, the settings panel needs per-provider API key fields, or a single "active provider key" field that changes label based on selection.

Recommended: separate keys per provider in localStorage (`deepgram_api_key`, `openai_api_key`, `elevenlabs_api_key`), since users may switch between providers.

---

## Effort Estimate

| Area | Scope |
|------|-------|
| Provider trait + Deepgram extraction | Refactor existing code into trait impl (~200 lines moved, ~50 new) |
| OpenAI Whisper provider | New impl, batch-only (~100 lines) |
| ElevenLabs provider | New impl, streaming + batch (~200 lines) |
| State + command refactor | Rename fields, generalize routing (~100 lines changed) |
| Frontend settings UI | Provider dropdown + conditional sections (~80 lines) |
| IPC rename/generalize | Straightforward rename (~20 lines) |
| Testing | Each provider needs streaming + batch test coverage |

The biggest risk is **provider-specific quirks** — different JSON response shapes, different error formats, different audio format requirements. The trait abstraction handles the happy path, but error handling and edge cases will vary.

---

## Migration Path

1. Create the trait and wrap existing Deepgram code as the first impl (no behavior change)
2. Rename IPC commands and events (breaking change, do in one pass)
3. Add provider selector to settings (defaults to Deepgram)
4. Implement OpenAI and ElevenLabs providers one at a time
5. Wire up local Whisper behind the existing feature flag

Step 1-3 can ship together as the foundation. Steps 4-5 are additive.
