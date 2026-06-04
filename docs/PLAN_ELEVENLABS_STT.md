# Plan: ElevenLabs Scribe as an Alternative STT Engine

Implementation plan for adding ElevenLabs Scribe (v2 Realtime) as a
user-selectable speech-to-text engine alongside Deepgram. Scope for this
plan: **bring-your-own-key only** (no managed proxy, no server cost),
mirroring the existing BYO Deepgram/Anthropic key pattern.

Not yet scheduled to a release. This is a scoping document, not in-flight work.

## Goal

MacroVox is hardcoded to Deepgram in four places. This plan introduces a
provider seam and a second engine so a user can paste their own ElevenLabs
key in Settings and switch the dictation engine to Scribe. ElevenLabs Scribe
v2 Realtime is a WebSocket streaming model at ~150 ms latency, so it fits
MacroVox's streaming-by-default UX directly (it is not batch-only).

## Why this is feasible without touching the renderer's transcript path

The renderer holds the API key and calls `deepgram_start({ apiKey })` /
`recording_stop({ apiKey })`. The Rust backend receives a key string, owns
the WebSocket, and emits `deepgram:transcript` events shaped
`{ transcript: string, isFinal: boolean }`. ElevenLabs maps onto that shape
cleanly:

- `partial_transcript`   -> `{ transcript, isFinal: false }`
- `committed_transcript` -> `{ transcript, isFinal: true }`

So the renderer's transcript listener does not change. The work is a provider
selector plus one new Rust module.

## Architecture

### Today

```
renderer (holds key) ──deepgram_start({apiKey})──▶ Tauri command
                                                      │
                                                      └─ deepgram_ws::start_session
                                                           │
                                                           └─ wss://api.deepgram.com/v1/listen
                                                                (Authorization: Token <key>)
                                                                raw binary PCM frames
                                                                ◀─ interim / final JSON
```

Deepgram is hardcoded in:
- `src-tauri/src/deepgram_ws.rs` — streaming WebSocket
- `src-tauri/src/commands.rs` — two batch REST paths (`recording_stop`, reprocess)
- `netlify/functions/deepgram-proxy.ts` — managed proxy (out of scope here; BYO only)

### After

```
renderer (holds key + provider) ──deepgram_start({apiKey, provider})──▶ Tauri command
                                                                          │
                                            ┌─ provider == "deepgram"  ───┤
                                            │                             │
                                            ▼                             ▼
                              deepgram_ws::start_session    elevenlabs_ws::start_session
                                            │                             │
                                            ▼                             ▼
                              wss://api.deepgram.com         wss://api.elevenlabs.io
                              Authorization: Token           xi-api-key header
                              raw binary PCM frames          JSON input_audio_chunk (base64 PCM)
                                            │                             │
                                            └────── deepgram:transcript ──┘
                                                   { transcript, isFinal }
```

## ElevenLabs realtime protocol (verified)

Source: ElevenLabs realtime STT API reference (see References).

- **Endpoint:** `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
  (US residency variant: `wss://api.us.elevenlabs.io/...`)
- **Auth:** `xi-api-key: <key>` request header. (The single-use `token` query
  param is for browser clients only; a desktop app already holds the key
  locally, so the header is the right choice and mirrors Deepgram's
  `Authorization` header injection.)
- **Query params:**
  - `model_id=scribe_v2_realtime`
  - `audio_format=pcm_16000` (app captures 16 kHz mono linear16; Scribe
    accepts pcm_8000/16000/22050/24000/44100/48000 + ulaw_8000)
  - `language_code={lang}`
  - `commit_strategy=vad` — auto-commits transcript segments on detected
    silence, the analogue of Deepgram's interim/final flow
  - `keyterms=<...>` — keyword biasing, the analogue of Deepgram's `keyterm`
  - optionally `no_verbatim=true` to drop filler words
- **Client -> server:** JSON, not raw binary:
  ```json
  { "message_type": "input_audio_chunk", "audio_base_64": "<base64 PCM>" }
  ```
  This is the one real difference in the audio hot path: the forwarding task
  base64-encodes each PCM frame and wraps it in JSON instead of sending a
  binary frame.
- **Server -> client:**
  - `{ "message_type": "session_started", ... }`
  - `{ "message_type": "partial_transcript", "text": "..." }`
  - `{ "message_type": "committed_transcript", "text": "..." }`
  - errors share `{ "message_type": "<error_type>", "error": "..." }` with
    types incl. `auth_error`, `quota_exceeded`, `rate_limited`,
    `session_time_limit_exceeded`.

### Batch (reprocess + `recording_stop` fallback)

`POST https://api.elevenlabs.io/v1/speech-to-text`, multipart form with
`model_id` + `file` (the WAV/audio blob). Mirrors the Deepgram pre-recorded
upload in `commands.rs`.

## Implementation

### Rust (new module + dispatch)

1. **New `src-tauri/src/elevenlabs_ws.rs`**, mirroring `deepgram_ws.rs`:
   reuses the existing `DgSender` / `DgMessage` channel type, base64-JSON
   framing on send, parses `partial_transcript` / `committed_transcript` and
   emits the same `deepgram:transcript` event. Auth via `xi-api-key` header;
   the error path must not echo the key (same guard as `deepgram_ws.rs`).
2. **Provider dispatch.** Add a `provider: String` param to `deepgram_start`
   (`commands.rs:340`) and `recording_stop` (`commands.rs:435`); `match` on it
   to call the Deepgram or ElevenLabs module. `dg_sender` in `AppState` is
   just a PCM channel, reusable unchanged.
3. **ElevenLabs batch path** in `recording_stop` + the reprocess command
   (`commands.rs:1122` area): multipart upload to `/v1/speech-to-text`.

### Renderer (TS)

4. **New `user_elevenlabs_key` field** in the Keys tab, mirroring the
   Deepgram key field (`SettingsPanel.tsx:131` / `:346`) with a show/hide
   toggle.
5. **New `stt_provider` selector** (`deepgram` | `elevenlabs`) in Voice
   Recognition, default `deepgram`.
6. **Register both keys** in the allowlists: `main.ts:106`
   (`ALLOWED_SETTINGS_KEYS`), `tauri-ipc.ts:290`, and the reset list at
   `SettingsPanel.tsx:258`.
7. **Pass the provider through.** `DictationMode.tsx:137` resolves the
   provider, picks the matching key (ElevenLabs is BYO-only, so a missing
   key surfaces an error rather than falling back to managed), and threads
   `provider` through `tauri-ipc.ts:112` / `:131`.

## Open decisions

1. **Number-format parity gap.** ElevenLabs realtime exposes no `numerals`
   knob (Deepgram does). In `digits` mode the engine-level digit forcing
   won't apply on ElevenLabs; it relies entirely on the Claude cleanup prompt
   (which now handles item-label digits well after the 2026-06-03 change).
   Decision needed: accept the gap, or hide/disable the `digits` engine hint
   when the ElevenLabs provider is active.
2. **Event name.** `deepgram:transcript` becomes a misnomer with two
   providers. Either rename to `stt:transcript` (cleaner; touches
   `preload.ts`, `main.ts`, `tauri-ipc.ts`) or leave it to minimize blast
   radius. Default recommendation: leave it for the first pass, rename later.
3. **Phasing.** Land streaming first (the daily-driver path), then batch +
   reprocess as a follow-up; or do all three in one pass.
4. **CSP.** The WebSocket is opened from Rust (tokio-tungstenite), not the
   webview, so `connect-src` likely needs no change. Confirm during
   implementation that no renderer-side ElevenLabs call requires a CSP entry.

## Effort estimate

Roughly one day of focused work:

- `elevenlabs_ws.rs` (new, ~150 lines mirroring `deepgram_ws.rs`): 2-3 h
- ElevenLabs batch path: ~1 h
- Provider dispatch + state wiring: ~1 h
- Renderer settings, key field, provider plumbing: ~2 h
- Tests + docs: 1-2 h

Verify the realtime handshake against a real key early; that is where
surprises hide (header vs token auth, base64 framing, commit strategy).

## References

- ElevenLabs realtime STT API reference:
  https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
- Scribe v2 Realtime overview: https://elevenlabs.io/realtime-speech-to-text
- Existing provider code: `src-tauri/src/deepgram_ws.rs`,
  `src-tauri/src/commands.rs`
- Prior plan-doc precedent: `docs/PLAN_DEEPGRAM_PROXY_MIGRATION.md`
