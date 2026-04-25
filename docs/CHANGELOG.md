# MacroVox Changelog

## Unreleased — Voice buffer playback fix

### Bug Fixes
- **Saved recordings no longer play back slowed down** — `encode_opus` in `voice_buffer.rs` was hardcoded to claim its input was 16 kHz mono via the `ogg_opus::encode::<16000, 1>` const generic, but cpal's `default_input_config()` is typically 48 kHz on Windows. The OGG file ended up with ~3× the audio duration claimed in its header, so HTML5 `<audio>` playback ran at roughly one-third speed. Fixed by downmixing to mono and linearly resampling to 16 kHz before handing samples to the Opus encoder, so the data inside the file matches its declared rate.
- **Auto-repair on launch for already-stretched recordings** — new `voice_buffer::repair_stretched_recordings`, spawned on a background thread from `lib.rs` setup, walks the manifest once per startup. For each `.ogg` whose decoded length at 16 kHz drifts more than 50 ms from `manifest.duration_secs` (the ground-truth original duration), it decodes, resamples to the correct length, and re-encodes. Idempotent — files already at the right speed are skipped.

---

## Unreleased — Linux release readiness

### New Features
- **Linux bundle metadata** — `bundle.linux` block in `tauri.conf.json` now sets `.deb` section/priority/depends (`libwebkit2gtk-4.1-0`, `libgtk-3-0`, `libasound2`, `libpulse0`) and `recommends` (`libayatana-appindicator3-1`), `.rpm` depends (`webkit2gtk4.1`, `gtk3`, `alsa-lib`, `pulseaudio-libs`), a shared desktop-file Handlebars template at `installer/linux/macrovox.desktop`, and app-wide `category`/`shortDescription`/`longDescription`/`copyright` that feed every bundle target.
- **Wayland detection + UI guard** — new `platform_info` IPC command and `platform::is_wayland` helper. On Wayland, `dictation_auto_paste` short-circuits (clipboard still succeeds so users can paste manually) and the Settings → Quick Dictation panel renders the "Auto-paste on stop" toggle disabled with an inline explanation. Both X11 sessions and Windows keep the previous behavior untouched.
- **Updater manifest generator** — `scripts/generate-latest.mjs` (wired as `npm run release:manifest`) scans `release/windows/` and `release/linux/` for `-setup.nsis.zip` / `*.AppImage.tar.gz` updater artifacts, reads their `.sig` sidecars, and emits a `latest.json` with both `windows-x86_64` and `linux-x86_64` platform keys. `release:linux`/`release:windows` npm scripts now also copy the updater artifacts and `.sig` files into `release/`.
- **Release documentation** — new `docs/RELEASE.md` covers version bump, per-platform bundle build, `latest.json` generation, updater-artifact requirements, and known Wayland limits. Linked from README.

### Bug Fixes
- **Settings window no longer pinned on top (Linux)** — removed `alwaysOnTop: true` from the settings window in `tauri.conf.json`. The main dictation HUD still defaults to always-on-top (it's the floating mic), and now reapplies the user's saved toggle on startup via `DictationMode` mount, so the preference survives app restart instead of snapping back to the config default.
- **Microphone selection now persists across restarts** — previously the selected mic lived only in the Rust `AppState` mutex (in-memory), so restarting the app reverted to "Auto-detect". `SettingsPanel` now writes `selected_mic_device` to `localStorage`, restores it on `loadDevices`, and `DictationMode` re-pushes it to the backend on window mount.
- **Linux microphone dropdown no longer lists ALSA noise** — cpal's ALSA host enumerates dozens of virtual aliases (`hw:`, `plughw:`, `dmix:`, `dsnoop:`, `surround21:`–`surround71:`, `iec958:`, `hdmi:`, `sysdefault:`, monitor taps, etc.). New `filter_device_list` in `commands.rs` drops those on Linux only; Windows/macOS device lists are unchanged.
- **Dropdown contrast on Linux** — WebKitGTK was rendering `<select>` elements with the native GTK widget, which ignored our inline `color`/`background-color` and produced dark-on-dark text for "Auto-detect" and the storage-limit selector. Added global `select { appearance: none }` in `index.css` with a themed chevron and explicit `option` colors so closed-state text and the open menu both honor theme variables.

### Docs
- README title updated to "Voice Dictation for Windows & Linux"; added a **Linux notes** section covering runtime dependencies, display-server caveats (X11 full parity / Wayland limits), and the mic-picker filter.
- `docs/STATUS_AND_ROADMAP.md` — Linux App row moved from 🔜 Planned to 🧪 Beta; macOS split into its own row.

### Security
- **Delta audit, 2026-04-19** — focused review of all code changes in this batch via the `/security-review` workflow. No vulnerabilities introduced (0 Critical / 0 High / 0 Medium / 0 Low). Details: [SECURITY_AUDIT_2026-04-19.md](SECURITY_AUDIT_2026-04-19.md). The pre-existing empty `plugins.updater.pubkey` remains an owner-action item from the prior audit.

---

## Unreleased — Settings, Language, Hotkey, Cleanup

### New Features
- **Custom global hotkey** — configurable keyboard shortcut to toggle dictation (default Ctrl+Space). Change it in Settings → Dictation Window. The app dynamically registers/unregisters shortcuts at runtime.
- **Language selection** — 20 languages supported via Deepgram Nova-3 (English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, and more). Change in Settings → Voice Recognition. Claude cleanup prompt is language-aware.
- **Number formatting** — choose how numbers appear in transcripts: Smart (Deepgram decides), Always digits, or Always words. Applies to both Deepgram output and Claude cleanup.
- **History sort toggle** — sort voice buffer recordings by newest-first or oldest-first. Backend now sorts by timestamp explicitly instead of relying on insertion order.
- **7-day free trial** — website updated with free trial messaging, pricing, and CTAs. Implementation guide in `docs/FREE_TRIAL_IMPLEMENTATION.md`.

### Cleanup
- **Removed legacy Electron artifacts** — deleted `build/` directory (old Electron builder configs and PyInstaller outputs). Removed `electron` and `electron-builder` from devDependencies. Removed stale npm scripts (`start`, `package`, `package:win`, `package:dev`).
- **Removed stale design docs** — deleted 5 pre-implementation design documents for features already shipped.
- **Moved LLM_ONBOARDING.md** to `docs/` directory.
- **Updated README.md** — refreshed feature list, fixed model name (nova-2 → Nova-3), updated project structure, added new features.

---

## Unreleased — Launch Readiness Hardening + Voice Buffer

### New Features
- **Dictation history** — rolling buffer that saves dictation recordings as OGG Opus files (~10x smaller than WAV) for playback and future model training. Enabled by default. Configurable storage limit (50–500 MB, default 100 MB = ~14 hours of audio). FIFO eviction deletes oldest recordings when the limit is reached. Recordings are paired with their transcripts in a JSON manifest.
- **Opus compression** — voice buffer uses OGG Opus encoding via the `ogg-opus` crate (vendored libopus, no cmake needed). Falls back to WAV if Opus encoding fails. HTML5 `<audio>` plays OGG Opus natively in Chrome/Firefox/Edge.
- **Transcription history** — click any recording to expand and view its full transcript. Copy transcript to clipboard from the expanded view.
- **Reprocess recordings** — right-click any recording and select "Reprocess" to re-run the full pipeline: decode OGG Opus → re-transcribe through Deepgram → Claude AI cleanup → update manifest. Useful after changing keyword boosts or accessibility context.
- **Auto-updater** — checks for updates on launch via `tauri-plugin-updater`. When a new version is available, downloads the installer, applies it, and relaunches automatically. Endpoint: GitHub Releases `latest.json`. Requires update signing keypair to be generated before first use.
- **Branded NSIS installer** — custom header and sidebar images with MacroVox waveform branding. NSIS hooks handle process kill on upgrade, old version migration from different install directories, and shortcut creation. Per-machine install to Program Files with Start Menu folder.

### UI
- **Writing tab removed** — Agentic Writing tab and settings section removed from the UI for initial release. Source files kept in repo for potential re-addition later.
- **Processing ring removed** — Removed the spinning cyan ring around the record button during transcript processing.
- **Dictation History settings** — new section in settings with: enable toggle (on by default), storage limit selector with visual usage bar (turns red at 90%), recording count and total duration display, "Open folder" button to reveal storage in Explorer, "Clear all" button, and scrollable recording list with play/stop/expand/delete per item and right-click context menu.
- **Settings reordered** — Audio Input moved up (first-run priority), Subscription moved down, About and Shortcuts merged into one section.

### Bug Fixes
- **Auto-cutoff transcript disappearing** — the auto-cutoff timer was calling `setTranscript('')` immediately after `handleStopRecording()`, wiping the transcript from the UI before the user could see it. Clipboard had the text because copy runs inside `handleStopRecording`. Removed the errant clear.

### Stability
- **Race condition on rapid start/stop fixed** — Added `operationInProgressRef` guard to prevent concurrent `handleStartRecording`, `handleStopRecording`, and `handleStopAndCopy` calls from overlapping when the record button is clicked rapidly.
- **Mutex poison recovery** — All `.lock().unwrap()` calls in `audio.rs` and `commands.rs` replaced with `lock_or_recover()` helper that recovers from poisoned mutexes instead of panicking the app.
- **Audio level interval cleaned up on unmount** — `audioLevelIntervalRef` is now cleared when the dictation component unmounts, preventing leaked polling intervals.
- **AI cleanup fetch timeout** — `usePostProcessing` now uses an `AbortController` with a 15-second timeout. Previously could hang indefinitely if the proxy was slow or offline.
- **Global unhandled promise rejection handler** — Both `dictation.tsx` and `settings.tsx` entry points now catch unhandled rejections to prevent silent failures.
- **Streaming network failure surfaced to user** — WebSocket task now emits a `deepgram:error` event on unexpected disconnection. Frontend listens and shows error, stops recording state, cleans up intervals.

### Security
- **Dev bypass flags hardened for production** — Netlify proxy functions now check `process.env.CONTEXT !== 'production'` in addition to `DEV_BYPASS_AUTH`, preventing accidental bypass on production deploys.
- **API usage logging errors caught** — Fire-and-forget `.insert()` calls in both proxy functions now have `.catch()` handlers to log failures instead of silently swallowing them.
- **API key removed from debug logs** — `deepgram_start` no longer logs the first 8 characters of the API key.
- **Deepgram response validation** — `recording_stop` now checks HTTP status before parsing, validates JSON structure with `.get()` chains, and returns proper error messages on non-2xx or malformed responses. Previously treated error responses as empty successful transcriptions.

---

## Unreleased — Security Hardening + Pre-Launch Fixes

### Fixes
- **App icon made square** — Source PNG was 1326×1294 (not square), causing rendering issues. Padded to 1326×1326 and regenerated all sizes (32, 64, 128, 256, 512, ICO, ICNS) via `npx tauri icon`.
- **Tray icon converted to RGBA** — Was RGB (no transparency). Converted to RGBA PNG.

### Security
- **CORS: reject unknown origins** — Netlify proxy functions (`claude-proxy`, `deepgram-proxy`) previously fell back to the first allowed origin when the request origin didn't match the allowlist, effectively allowing any origin. Now returns 403 for unknown origins.
- **Payload size limits** — `claude-proxy` rejects request bodies over 512 KB. `deepgram-proxy` rejects audio over 25 MB. Prevents resource exhaustion and cost abuse.
- **Input validation on claude-proxy** — Messages array structure validated (role must be `user`/`assistant`, content must be string). System prompt capped at 10,000 chars. Individual messages capped at 100,000 chars.
- **Deepgram proxy parameter whitelisting** — Model and language parameters are whitelisted against known-good values. Content-Type validated against allowed audio formats.
- **Removed `shell:allow-execute` capability** — Unused but dangerous IPC permission removed from Tauri capabilities. `shell:allow-open` retained for OAuth URL opening.
- **CSP pinned to specific subdomains** — Replaced wildcard `https://*.supabase.co` and `https://*.netlify.app` with exact project URLs (`hlioqbizljywisvnbtat.supabase.co`, `macrovox.netlify.app`). Removed unnecessary `wasm-unsafe-eval`. Added `wss://api.deepgram.com` for WebSocket streaming.
- **Recording buffer capped at 5 minutes** — Prevents unbounded memory growth if recording is never stopped. At 16 kHz mono, cap is ~18 MB. New frames are silently dropped after the cap.
- **Keywords capped at 50 entries, 100 chars each** — Prevents URL length abuse and Deepgram API rejection from excessively long keyword lists.
- **API key error messages sanitized** — Deepgram WebSocket connection errors no longer include the API key value in error strings.
- **CORS origin comparison now case-insensitive** — Prevents bypass via case variation.
- **Per-user rate limiting on proxy functions** — Both `claude-proxy` (200/hour) and `deepgram-proxy` (300/hour) now track API calls per user via Supabase `api_usage` table. Returns 429 with `Retry-After` header when exceeded.
- **user_id body parameter validated against JWT** — `claude-proxy` now rejects requests where the `user_id` in the body doesn't match the authenticated JWT user, preventing impersonation.
- **Deepgram WebSocket channel bounded to 500 messages** — Prevents unbounded memory growth if the WebSocket connection is slower than audio capture. Frames are silently dropped when the channel is full.
- **Prompt injection mitigation** — User-controlled context fields (`post_processing_context`, `writing_style_profile`) are now wrapped in XML boundary tags with explicit instructions not to follow any instructions within them. Both fields capped at 1,000 chars.
- **Console log cleanup** — Removed API key confirmation logs, replaced `console.error` with `console.warn` for non-critical failures, stripped error objects from log output to prevent leaking internals. Server-side logs now only include error messages, not full stack traces.
- **Supabase Edge Functions hardened** — `create-checkout` and `billing-portal` now reject unknown CORS origins (was falling back to first allowed origin). Plan parameter validated against allowlist. Error logs sanitized to not leak stack traces or PII (user IDs removed from webhook logs). `stripe-webhook` signature verification error no longer logs the raw error.

---

## Unreleased — Pre-Launch Speed & Quality Pass

### Performance
- **Default transcription mode changed from batch to streaming** — Words now appear as you speak instead of after you stop recording. Perceived latency drops to near-zero for transcript display.
- **AI cleanup model switched from Claude Sonnet to Claude Haiku** — 3–5× faster cleanup (~200–500 ms vs ~1–2 s). Haiku is more than capable for grammar and punctuation correction.
- **Optimistic auto-copy** — Raw transcript is copied to clipboard and auto-pasted immediately when recording stops. AI cleanup runs in the background and silently updates the clipboard if the cleaned text differs. Users no longer wait for cleanup before the text lands in their target app.

### Bug Fixes
- **Fixed keyword boosting being silently ignored** — Keywords were parsed from settings and stored in `AppState` but never actually appended to either the Deepgram streaming WebSocket URL or the batch REST API URL. Both paths now include `&keywords=` parameters with proper URL encoding. This is MacroVox's key differentiator — custom vocabulary now actually works.
- **Fixed auto-paste missing from batch and streaming stop paths** — Auto-paste (`Ctrl+V` injection) only fired from the `Ctrl+Space` toggle path (`handleStopAndCopy`). Now fires from both the button-click stop handler and streaming mode stop handler too.

### UX
- **Auto-copy defaults to ON for new users** — Changed from opt-in to opt-out. New installs get clipboard copy behavior immediately without visiting settings.
- **Auto-copy and auto-paste settings surfaced more prominently** — Reordered Quick Dictation toggles to put auto-copy and auto-paste first (above "Clear on new recording"). Descriptions rewritten to be clearer about what each toggle does.

### Dependencies
- Added `urlencoding` crate (v2) for encoding keyword boost parameters in Deepgram API URLs.

---

## Unreleased — Settings Window Fix + Titlebar Controls

### Bug Fixes
- **Fixed settings window showing black screen** — Root cause was two-fold: (1) `devUrl` in `tauri.conf.json` pointed to the full `dictation.html` URL instead of the Vite root, so `WebviewUrl::App("settings.html")` resolved to an invalid path. (2) `WebviewUrl::App` for programmatically-created windows always uses the `tauri://localhost` custom protocol (serving from `frontendDist`), never the dev server — even in dev mode. Fix: declare the settings window in `tauri.conf.json` like the main window (hidden at startup); `settings_open_window` now just calls `show()` + `set_focus()` instead of constructing the window at runtime. Tauri handles URL resolution correctly for config-declared windows in both dev and production.
- **Fixed minimize and close buttons unresponsive** — The entire titlebar `div` had `data-tauri-drag-region`, which sets `-webkit-app-region: drag` on the element and swallows click events from all children. Fix: only the `MacroVox` label span carries the drag attribute; the buttons sit in a sibling flex container outside the drag region.
- **Added React error boundary to settings window** — If the settings panel fails to render, an error message is shown instead of a blank page.

---

## v1.0.6 (2026-03-17) — Transcript Disappears After Second Recording Fix

### Bug Fixes
- **Fixed transcript not appearing on subsequent recordings** — `handleStopRecording` and `handleStopAndCopy` closed over a stale `transcript` state variable. When AI post-processing (Claude) resolved after a second recording had already updated the transcript, the `.then()` callback overwrote the current transcript with a value computed from the stale closure. The second recording's text was silently replaced.
- **Fix**: All `setTranscript` calls in async callbacks now use React functional updaters (`prev => ...`) so they always operate on the latest state. The `postProcess().then()` callback uses `prev.replace(rawSegment, cleaned)` to surgically swap only the raw segment with the cleaned version, regardless of what other recordings have appended in the meantime.

---

## v1.0.5 (2026-03-17) — Program Files Install + Upgrade Reliability

### Changes
- **MacroVox now installs to `C:\Program Files\MacroVox`** — switched from per-user (`AppData\Local\Programs`) to per-machine install. Registers in HKLM. Requires admin elevation (UAC prompt shown once during install).
- **Desktop shortcut now appears on all user desktops** — `C:\Users\Public\Desktop`, matching Windows conventions for machine-wide installs.
- **Start Menu shortcut in `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\MacroVox`** — visible to all users on the machine.

### Bug Fixes
- **Fixed "Failed to uninstall old application files" error during upgrades** — `taskkill` ran but only waited 1.5 s before the upgrade uninstaller fired. If Electron hadn't released all file handles yet, the uninstaller exited with code 2. Fix: poll for process exit in a loop (up to 8 s) before handing control back to the installer.
- **Migration from v1.0.4 and earlier** — old per-user installs (`AppData\Local\Programs\macrovox`) are detected during `customInstall` and the user is offered a silent uninstall before the new Program Files install proceeds.

---

## v1.0.4 (2026-03-17) — Desktop Shortcut Fix

### Bug Fixes
- **Fixed Desktop shortcut not created during install** — The NSIS `$DESKTOP` variable resolves to the All Users desktop (`C:\Users\Public\Desktop`) when the installer runs elevated via UAC, even for per-user installs. The shortcut was created in the wrong location and never appeared on the user's Desktop.
- **Fix**: `customInstall` and `customUnInstall` now read the correct desktop path directly from `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders\Desktop`, with `$PROFILE\Desktop` as fallback. Start Menu shortcut was unaffected.

---

## v1.0.3 (2026-03-17) — Transcription Works More Than Once Fix

### Bug Fixes
- **Fixed transcription only working once per launch (batch mode)** — `DictationMode.tsx` called `setIsProcessing(false)` *inside* the `if (result.transcript)` branch. When Deepgram returned an empty transcript (e.g. silence or very short audio), `isProcessing` was never cleared, permanently disabling the record button for the rest of the session.
- **Fix**: Moved `setIsProcessing(false)` to execute unconditionally immediately after `stopRecording()` returns, in both `handleStopRecording` and `handleStopAndCopy`.
- **Fixed dead-process recovery in batch recording** — If the pre-warmed ffmpeg process had exited (e.g. device error, system sleep), `recording:start` would call `startBuffering()` on the dead `AudioCapture` instance and silently capture nothing. No audio would be buffered and every subsequent recording would return an empty transcript.
- **Fix**: `recording:start` now checks `isRunning()` and, if false, explicitly stops and replaces the stale `AudioCapture` instance before starting a fresh ffmpeg process.

---

## v1.0.2 (2026-03-09) — Auth Token Path Fix

### Bug Fixes
- **Fixed "No API key" shown after v1.0.1's IPC bridge fix** — `main-dictation.ts` was reading token files from `app.getPath('userData')` which resolves to `%APPDATA%\macrovox` (MacroVox's own userData directory). GitConnect Pro writes its tokens to `%APPDATA%\gitconnect-desktop`. These are separate directories so MacroVox found no token files and returned `{ success: false }` on every `auth:getToken` call.
- **Fix**: Now uses Supabase Auth with its own session storage — no longer depends on any external app's credential store.

---

## v1.0.1 (2026-03-09) — Auth IPC Bridge Fix

### Bug Fixes
- **Fixed "No API key" warning on first launch when already logged in** — `preload.ts` was missing `getToken`, `fetchGitHubUser`, `getManagedKeys`, and `onTokenReady`. The IPC bridge was incomplete, so `DictationMode` could never read the stored token or fetch managed API keys.
- **Fix**: Added the missing IPC methods to `preload.ts` with corresponding handlers in `main.ts`.

---

## v1.0.0 (2026-03-09) — Initial Release

### New Features
- Standalone MacroVox dictation app
- NSIS installer + portable executable, both code-signed with EV certificate
- **Batch mode**: Record audio, then transcribe all at once (higher accuracy)
- **Streaming mode**: Real-time word-by-word transcription via WebSocket
- **Smart Clipboard**: Auto-copy on stop, optional auto-paste into previous app
- **AI Post-Processing**: Optional Claude-powered cleanup of speech-to-text errors
- **6 themes**: MCRN, Mars, Belter, Earth, Protomolecule, Laconia
- **System tray**: Minimize to tray, context menu, `Ctrl+Space` global shortcut
- **Single-instance lock**: Prevents duplicate processes

### Architecture
- `main.ts` — Standalone main process
- `preload.ts` — Restricted IPC surface (audio, clipboard, settings, auth)
- Shared renderer: `DictationMode.tsx`, `SettingsPanel.tsx`, themes
- Separate build config: `build/electron-builder.json`
- NSIS installer: `build/installer.nsh` with previous-version detection
