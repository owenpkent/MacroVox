# MacroVox — Tauri Backend Architecture

## Why Tauri?

The Electron build ships a ~150 MB installer and uses ~150–300 MB RAM at idle because it
bundles its own Chromium and Node.js runtimes. Tauri uses the OS WebView (WebView2 on Windows)
and a Rust backend, giving us a ~5 MB installer and ~30 MB RAM at idle.

Simultaneously, several latency problems in the Electron build all have natural Rust solutions:

| Problem | Electron workaround | Tauri solution |
|---|---|---|
| Audio capture via ffmpeg subprocess | spawn `ffmpeg`, parse stdout | `cpal` — WASAPI native (Phase 3) |
| Auto-paste via PowerShell SendKeys (~700 ms) | `spawn('powershell', ...)` | `enigo` — native key injection (Phase 5) |
| Deepgram cold connection per recording | none | pre-warm WebSocket on startup (Phase 4) |
| Local STT when offline | none (cloud only) | `whisper-rs` (Phase 4) |

The React/TypeScript renderer is kept intact across both builds. Only the IPC layer changes:
`window.electronAPI.foo(args)` → `invoke("foo", { args })` from `@tauri-apps/api`.

---

## Repository layout

```
src-tauri/
├── Cargo.toml          # Rust crate manifest; local-stt feature gates whisper-rs
├── build.rs            # tauri-build codegen (required)
├── tauri.conf.json     # Window dimensions, bundle config, dev URL
├── capabilities/
│   └── default.json    # Permission grants for the main window
├── icons/
│   ├── icon.png        # App icon (source PNG — run `npx tauri icon` to regenerate)
│   └── tray-icon.png   # System tray icon
└── src/
    ├── main.rs         # Entry point — calls lib::run()
    ├── lib.rs          # Builder: register plugins, state, command handlers
    ├── state.rs        # AppState (Mutex-wrapped fields shared across commands)
    ├── audio.rs        # Phase 3/4: cpal stream, WAV encoder, PCM→WS streaming
    ├── deepgram_ws.rs  # Phase 4: Deepgram WebSocket session + event emitter
    └── commands.rs     # IPC command implementations + unit tests
```

---

## IPC surface

Every `tauri::command` in `commands.rs` mirrors one channel from the Electron preload
(`src/main/preload.ts`). The renderer calls them via `invoke("command_name", payload)`.
Tauri converts snake_case command names to camelCase automatically.

### Audio

| Command | JS equivalent | Returns |
|---|---|---|
| `audio_list_devices` | `listAudioDevices()` | `AudioDevicesResponse` |
| `audio_set_device(device_name)` | `setAudioDevice(name)` | `OkResponse` |
| `audio_start` | `startAudio()` | `OkResponse` |
| `audio_stop` | `stopAudio()` | `OkResponse` |
| `audio_get_level` | `getAudioLevel()` | `f64` |

### Deepgram streaming

| Command | JS equivalent | Returns |
|---|---|---|
| `deepgram_start(api_key)` | `startDeepgram(key)` | `OkResponse` |
| `deepgram_stop` | `stopDeepgram()` | `OkResponse` |

Push event emitted by backend → renderer: `"deepgram:transcript"` `{ transcript: string, isFinal: boolean }`

### Local STT (whisper-rs)

| Command | JS equivalent | Returns |
|---|---|---|
| `whisper_transcribe(model_path)` | `whisperTranscribe(path)` | `RecordingStopResponse` |

Requires `--features local-stt` build flag and a downloaded GGML model file.
Returns `{ success: false, error: "local-stt feature not enabled" }` in default builds.

### Buffered recording

| Command | JS equivalent | Returns |
|---|---|---|
| `recording_start` | `startRecording()` | `OkResponse` |
| `recording_stop(api_key)` | `stopRecording(key)` | `RecordingStopResponse` |
| `recording_cancel` | `cancelRecording()` | `OkResponse` |

### Clipboard & auto-paste

| Command | JS equivalent | Returns |
|---|---|---|
| `clipboard_write(text)` | `copyToClipboard(text)` | `OkResponse` |
| `dictation_auto_paste` | `autoPaste()` | `OkResponse` |

### Window / app settings

| Command | JS equivalent | Returns |
|---|---|---|
| `dictation_set_always_on_top(value)` | `setDictationAlwaysOnTop(v)` | `OkResponse` |
| `settings_open_window` | `openSettingsWindow()` | `OkResponse` |
| `app_set_minimize_to_tray(value)` | `setMinimizeToTray(v)` | `OkResponse` |

### Theme & settings broadcast

| Command | JS equivalent | Returns |
|---|---|---|
| `theme_broadcast(theme_id)` | `broadcastThemeChange(id)` | `OkResponse` |
| `settings_broadcast(settings)` | `broadcastSettings(map)` | `OkResponse` |

Push events: `"theme-changed"` (string), `"settings-changed"` (object)

### Auth (Phase 6 stubs — renderer will call Supabase JS SDK directly)

`auth_get_user`, `auth_sign_up_email`, `auth_sign_in_email`, `auth_sign_in_oauth`,
`auth_sign_out`, `auth_reset_password`, `auth_get_subscription`, `auth_get_managed_keys`,
`auth_checkout`, `auth_billing_portal`

These return `{ success: false, error: "Not implemented" }` and will be removed in Phase 6
once the renderer talks to Supabase directly.

---

## AppState

`state::AppState` holds all mutable backend globals. Tauri injects it into commands via
`State<AppState>`. Fields that must be shared with the cpal callback closure are
`Arc<Mutex<T>>`; the rest are plain `Mutex<T>`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `selected_mic_device` | `Mutex<Option<String>>` | `None` | Name of the selected input device |
| `dictation_always_on_top` | `Mutex<bool>` | `true` | Window always-on-top setting |
| `minimize_to_tray` | `Mutex<bool>` | `false` | Close-to-tray setting |
| `audio_stream` | `Mutex<Option<cpal::Stream>>` | `None` | Live capture stream; dropping stops it |
| `audio_level` | `Arc<Mutex<f64>>` | `0.0` | RMS level updated by cpal callback |
| `recording_buffer` | `Arc<Mutex<Vec<f32>>>` | `[]` | PCM samples accumulated during recording |
| `is_recording` | `Arc<Mutex<bool>>` | `false` | Toggle between `recording_start`/`stop` or `deepgram_start`/`stop` |
| `audio_sample_rate` | `Mutex<u32>` | `16000` | Updated by `audio_start` from device config |
| `audio_channels` | `Mutex<u16>` | `1` | Updated by `audio_start` from device config |
| `deepgram_keywords` | `Mutex<Vec<String>>` | `[]` | Parsed by `settings_broadcast` |
| `dg_sender` | `Arc<Mutex<Option<DgSender>>>` | `None` | WebSocket PCM channel; set by `deepgram_start`, cleared by `deepgram_stop` |

---

## Audio subsystem (Phase 3 / 4)

### Batch path (Phase 3 — pre-recorded REST API)

```
audio_start  →  cpal::default_host()
             →  find device by name (or system default)
             →  device.default_input_config()
             →  audio::build_input_stream(device, config, level, buffer, is_recording, dg_sender)
             →  stream.play()
             →  state.audio_stream = Some(stream)

cpal callback (per ~10 ms frame):
    audio::process_audio_frame(data, level, buffer, is_recording, dg_sender)
    ├── compute RMS → state.audio_level
    ├── if is_recording → append to state.recording_buffer   (batch path)
    └── if is_recording && dg_sender.is_some()
            → f32_to_i16_bytes(frame) → dg_sender.send(Pcm(bytes))  (streaming path)

recording_start  →  clear buffer, set is_recording = true
recording_stop   →  set is_recording = false
                 →  drain buffer
                 →  audio::pcm_to_wav(samples, sample_rate, channels)
                 →  POST wav to https://api.deepgram.com/v1/listen
                 →  return transcript + confidence + duration
recording_cancel →  set is_recording = false, clear buffer

audio_stop   →  state.audio_stream = None  (drops stream → stops WASAPI)
             →  state.audio_level = 0.0
```

### Streaming path (Phase 4 — pre-warmed WebSocket)

```
deepgram_start(api_key)
    ├── read sample_rate, channels from AppState
    ├── deepgram_ws::start_session(api_key, sample_rate, channels, app)
    │     ├── connect_async(wss://api.deepgram.com/v1/listen?...)  ← pre-warm
    │     └── spawn background task:
    │           ├── DgMessage::Pcm(bytes) → WebSocket binary frame
    │           ├── DgMessage::Stop       → {"type":"CloseStream"} → exit
    │           └── WebSocket text frame  → emit "deepgram:transcript" event
    ├── state.dg_sender = Some(sender)
    ├── clear recording_buffer
    └── is_recording = true

cpal callback (as above — sends PCM bytes via dg_sender when is_recording)

deepgram_stop()
    ├── is_recording = false
    └── dg_sender.take() → sender.send(DgMessage::Stop)
          → task sends CloseStream, drains final results, exits
```

`audio::build_input_stream` dispatches on `cpal::SampleFormat` and converts
I16, I32, U16 frames to f32 before calling `process_audio_frame`. Unsupported
formats return `BuildStreamError::StreamTypeNotSupported`.

`audio::pcm_to_wav` writes a minimal 44-byte RIFF/WAV header followed by 16-bit
signed PCM. This format is accepted directly by Deepgram's pre-recorded API
(`Content-Type: audio/wav`).

`audio::f32_to_i16_bytes` converts f32 samples to interleaved i16 LE bytes.
This is the `encoding=linear16` format Deepgram's streaming API expects.

### Local STT path (Phase 4 — whisper-rs, `local-stt` feature)

```
recording_start  →  (same as batch path — buffers raw f32 samples)

whisper_transcribe(model_path)
    ├── is_recording = false
    ├── drain recording_buffer
    ├── WhisperContext::new_with_params(model_path)
    ├── whisper_state.full(params, &samples)
    └── collect segment text → return transcript
```

Build with `cargo build --features local-stt`.  Requires cmake + MSVC.
Model files: download `ggml-*.bin` from
`https://huggingface.co/ggerganov/whisper.cpp/tree/main`.

---

## Migration phases

| Phase | Status | Scope |
|---|---|---|
| **1** | **Complete** | Scaffold `src-tauri/`, stub all commands, 17 unit tests |
| **2** | **Complete** | Port renderer IPC — `window.electronAPI.*` → `invoke()` |
| **3** | **Complete** | `cpal` WASAPI native audio + Deepgram pre-recorded API |
| **4** | **Complete** | Deepgram WebSocket pre-warm + `whisper-rs` local STT (`local-stt` feature) |
| **5** | Not started | `enigo` native paste (replace PowerShell ~700 ms) |
| **6** | Not started | Supabase JS SDK from renderer; remove auth IPC stubs |
| **7** | Not started | Tauri bundler, code signing, remove electron-builder |

---

## Known issues

- `icons/icon.png` is not square (source PNG is 1326×1294). Run `npx tauri icon <square-png>`
  before shipping to regenerate all required icon sizes.
- `icons/tray-icon.png` is not RGBA — must be converted before wiring up the system tray in Phase 7.
- Auth commands return `{ success: false }` — Supabase JS SDK moves to renderer in Phase 6.
- `whisper_transcribe` requires the `local-stt` Cargo feature and a downloaded GGML model.
  Without the feature it returns a clear error; the build always succeeds.
- `auto_paste` still uses PowerShell (~700 ms delay) — replaced by `enigo` in Phase 5.
