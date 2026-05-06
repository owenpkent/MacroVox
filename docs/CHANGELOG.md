# MacroVox Changelog

## v1.0.7 — 2026-04-26

Major release: Linux beta, voice history with OGG Opus, Wayland support,
streaming-by-default with optimistic auto-paste, multi-language Deepgram
Nova-3, configurable hotkey, hardened security posture, signed
auto-update pipeline, and a working Tauri 2 release workflow.

### New Features

- **Streaming transcription by default** — words appear as you speak instead of after you stop recording. Perceived latency drops to near-zero for transcript display. Batch mode still selectable in Settings → Voice Recognition.
- **Optimistic auto-copy + auto-paste** — raw transcript is copied to clipboard and auto-pasted immediately when recording stops. AI cleanup runs in the background and silently updates the clipboard if the cleaned text differs. Users no longer wait for cleanup before the text lands in their target app.
- **Custom global hotkey** — configurable keyboard shortcut to toggle dictation (default `Ctrl+Space`). Change it in Settings → Dictation Window. The app dynamically registers/unregisters shortcuts at runtime.
- **Multi-language transcription** — 20 languages supported via Deepgram Nova-3 (English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, and more). Change in Settings → Voice Recognition. Claude cleanup prompt is language-aware.
- **Number formatting** — choose how numbers appear in transcripts: Smart (Deepgram decides), Always digits, or Always words. Applies to both Deepgram output and Claude cleanup.
- **Voice History buffer** — rolling buffer that saves dictation recordings as OGG Opus files (~10× smaller than WAV) for playback and future model training. Enabled by default. Configurable storage limit (50–500 MB, default 100 MB ≈ 14 hours of audio). FIFO eviction deletes oldest recordings when the limit is reached. Recordings are paired with their transcripts in a JSON manifest.
- **Voice History playback + reprocess** — click any recording to expand and view its full transcript; copy transcript to clipboard from the expanded view. Right-click → "Reprocess" re-runs the full pipeline (decode OGG Opus → re-transcribe through Deepgram → Claude AI cleanup → update manifest). Useful after changing keyword boosts or accessibility context.
- **History sort toggle** — sort voice buffer recordings by newest-first or oldest-first. Backend sorts by timestamp explicitly instead of relying on insertion order.
- **Linux support (beta)** — `.deb`, `.rpm`, and AppImage bundles. ALSA/PulseAudio capture via `cpal`. ALSA device-list filter so the mic dropdown shows real devices only (no `hw:` / `plughw:` / `dmix:` / `surround*:` entries). Mic pick persists across restarts. Bundle metadata (deb section/priority/depends, rpm depends, desktop file) configured under `bundle.linux` in `tauri.conf.json` with a Handlebars desktop template at `installer/linux/macrovox.desktop`.
- **Wayland detection + auto-paste fallback** — new `platform_info` IPC command and `platform::is_wayland` helper. On Wayland, `dictation_auto_paste` short-circuits (clipboard still succeeds so users can paste manually) and the Settings → Quick Dictation panel renders the "Auto-paste on stop" toggle disabled with an inline explanation. Both X11 sessions and Windows keep the previous behavior untouched.
- **7-day free trial** — website updated with free trial messaging, pricing, and CTAs. Implementation guide in `docs/FREE_TRIAL_IMPLEMENTATION.md`.
- **Branded NSIS installer** — custom header and sidebar images with MacroVox waveform branding. NSIS hooks handle process kill on upgrade, old version migration from different install directories, and shortcut creation. Per-machine install to Program Files with Start Menu folder.
- **Auto-updater** — checks for updates on launch via `tauri-plugin-updater`. When a new version is available, downloads the installer, applies it, and relaunches automatically. Endpoint: GitHub Releases `latest.json`.

### Release pipeline & signing

- **Updater signing keypair wired in** — minisign keypair generated at `~/.tauri/macrovox.key{,.pub}` (key ID `9B91F23A49E0246D`) and the public key baked into `tauri.conf.json → plugins.updater.pubkey`. Builds with `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]` env vars set now emit `.exe.sig` / `.msi.sig` / `.AppImage.sig` minisign sidecars that auto-update verifies.
- **`bundle.createUpdaterArtifacts: true`** — explicit in `tauri.conf.json` so missing signing env vars fail the build loudly rather than silently skipping the updater artifacts.
- **EV Authenticode signing wrapper** — `scripts/sign-windows.ps1` invoked via `bundle.windows.signCommand`. Uses the OK Studio Inc. EV cert (SHA1 `fc22b522…`) on the SafeNet eToken, retries up to 5× with linear backoff to handle Windows Defender file locks (mirrors `alpha-osk/build/windows/sign.py`), and skips vendor DLLs (Wix UI/Util extensions, NSIS plugins) so only `.exe` / `.msi` get OK Studio's signature. Order is correct end-to-end: bundler EV-signs → minisign computes its sig over the EV-signed bytes.
- **Tag-triggered release workflow** — new `.github/workflows/release.yml` builds the Linux bundle on `ubuntu-22.04` with the minisign signing key injected from GitHub repo secrets, then opens a draft GitHub release. Windows is built locally because the EV cert is on a hardware token and split-host signing would invalidate either Authenticode or minisign.
- **Updater manifest generator** — `scripts/generate-latest.mjs` (wired as `npm run release:manifest`) scans `release/windows/` and `release/linux/` for `*-setup.exe` / `*.msi` / `*.AppImage` updater artifacts, reads their `.sig` sidecars, and emits `latest.json` with both `windows-x86_64` and `linux-x86_64` platform keys.

### UI / UX

- **Dictation History settings panel** — new section in settings with: enable toggle (on by default), storage limit selector with visual usage bar (turns red at 90%), recording count and total duration display, "Open folder" button to reveal storage in Explorer, "Clear all" button, and scrollable recording list with play/stop/expand/delete per item and right-click context menu.
- **Settings reordered** — Audio Input moved up (first-run priority), Subscription moved down, About and Shortcuts merged into one section.
- **Auto-copy defaults to ON for new users** — changed from opt-in to opt-out. New installs get clipboard copy behavior immediately without visiting settings.
- **Auto-copy and auto-paste settings surfaced more prominently** — reordered Quick Dictation toggles to put auto-copy and auto-paste first (above "Clear on new recording"). Descriptions rewritten to be clearer about what each toggle does.
- **Writing tab removed** — Agentic Writing tab and settings section removed from the UI for initial release. Source files kept in repo for potential re-addition later.
- **Processing ring removed** — removed the spinning cyan ring around the record button during transcript processing.

### Performance

- **AI cleanup model switched from Claude Sonnet to Claude Haiku** — 3–5× faster cleanup (~200–500 ms vs ~1–2 s). Haiku is more than capable for grammar and punctuation correction.
- **`encode_opus` resampling fix** — voice buffer recordings now play back at real-time speed; previously played back at ~⅓ speed due to a sample-rate mismatch (cpal captures at 48 kHz on Windows but `ogg_opus::encode::<16000, 1>` claimed 16 kHz in the file header).

### Bug Fixes

- **Saved recordings no longer play back slowed down** — `encode_opus` in `voice_buffer.rs` was hardcoded to claim its input was 16 kHz mono, but cpal's `default_input_config()` is typically 48 kHz on Windows. Fixed by downmixing to mono and linearly resampling to 16 kHz before handing samples to the Opus encoder.
- **Auto-repair on launch for already-stretched recordings** — new `voice_buffer::repair_stretched_recordings`, spawned on a background thread from `lib.rs` setup, walks the manifest once per startup. For each `.ogg` whose decoded length at 16 kHz drifts more than 50 ms from `manifest.duration_secs`, it decodes, resamples to the correct length, and re-encodes. Idempotent — files already at the right speed are skipped.
- **Settings window no longer pinned on top (Linux)** — removed `alwaysOnTop: true` from the settings window in `tauri.conf.json`. The main dictation HUD still defaults to always-on-top, and reapplies the user's saved toggle on startup via `DictationMode` mount.
- **Microphone selection now persists across restarts** — previously the selected mic lived only in the Rust `AppState` mutex (in-memory). `SettingsPanel` now writes `selected_mic_device` to `localStorage`, restores it on `loadDevices`, and `DictationMode` re-pushes it to the backend on window mount.
- **Linux microphone dropdown no longer lists ALSA noise** — new `filter_device_list` in `commands.rs` drops `hw:`, `plughw:`, `dmix:`, `dsnoop:`, `surround*:`, `iec958:`, `hdmi:`, `sysdefault:`, monitor taps on Linux only. Windows/macOS device lists are unchanged.
- **Dropdown contrast on Linux** — WebKitGTK was rendering `<select>` elements with the native GTK widget, ignoring our inline colors. Added global `select { appearance: none }` in `index.css` with a themed chevron and explicit `option` colors so closed-state text and the open menu both honor theme variables.
- **Auto-cutoff transcript disappearing** — the auto-cutoff timer was calling `setTranscript('')` immediately after `handleStopRecording()`, wiping the transcript from the UI before the user could see it. Removed the errant clear.
- **Keyword boosting was silently ignored** — keywords were parsed and stored in `AppState` but never appended to the Deepgram URLs. Both streaming WebSocket and batch REST paths now include `&keyterm=` parameters with proper URL encoding. (Nova-3 retired the legacy `&keywords=` param; sending it returned 400 Bad Request as soon as a user added a custom term.)
- **Auto-paste missing from batch and streaming stop paths** — `Ctrl+V` injection only fired from the `Ctrl+Space` toggle path. Now fires from button-click stop and streaming-mode stop too.
- **Settings window black screen** — root cause was two-fold: `devUrl` pointed to the full `dictation.html` URL instead of Vite root, and `WebviewUrl::App` for programmatically-created windows always uses `tauri://localhost`, never the dev server. Fix: declare the settings window in `tauri.conf.json` like the main window (hidden at startup); `settings_open_window` now just calls `show()` + `set_focus()` instead of constructing the window at runtime.
- **Minimize and close buttons unresponsive** — the entire titlebar `div` had `data-tauri-drag-region`, swallowing click events. Only the `MacroVox` label span carries the drag attribute now; the buttons sit in a sibling flex container outside the drag region.
- **Settings panel error boundary** — if the settings panel fails to render, an error message is shown instead of a blank page.
- **Dictation history list now refreshes live** — the recordings list and storage-usage bar in the settings panel only loaded on mount, so newly-saved dictations didn't appear until the next app launch. `DictationMode` now dispatches a `voice-buffer-updated` window event after `voiceBufferSave` resolves, and `VoiceHistory` + `SettingsPanel` listen for it to silently re-fetch (no spinner flash on the existing list).
- **"Open folder" button readability** — the dictation history "Open folder" action used `var(--text-muted)`, which rendered nearly invisible against the panel background. Bumped to `var(--text-secondary)` to match the rest of the panel's actionable text.

### Stability

- **Race condition on rapid start/stop** — added `operationInProgressRef` guard to prevent concurrent `handleStartRecording`, `handleStopRecording`, and `handleStopAndCopy` calls from overlapping when the record button is clicked rapidly.
- **Mutex poison recovery** — all `.lock().unwrap()` calls in `audio.rs` and `commands.rs` replaced with `lock_or_recover()` helper that recovers from poisoned mutexes instead of panicking the app.
- **Audio level interval cleaned up on unmount** — `audioLevelIntervalRef` is now cleared when the dictation component unmounts, preventing leaked polling intervals.
- **AI cleanup fetch timeout** — `usePostProcessing` now uses an `AbortController` with a 15-second timeout. Previously could hang indefinitely if the proxy was slow or offline.
- **Global unhandled promise rejection handler** — both `dictation.tsx` and `settings.tsx` entry points now catch unhandled rejections to prevent silent failures.
- **Streaming network failure surfaced to user** — WebSocket task now emits a `deepgram:error` event on unexpected disconnection. Frontend listens, shows error, stops recording state, cleans up intervals.
- **Recording buffer capped at 5 minutes** — prevents unbounded memory growth if recording is never stopped (~18 MB at 16 kHz mono). New frames silently dropped after the cap.
- **Deepgram WebSocket channel bounded to 500 messages** — prevents unbounded memory growth if the WebSocket is slower than audio capture. Frames silently dropped when the channel is full.

### Security

- **Delta audit, 2026-04-19** — focused review of all code changes via the `/security-review` workflow. No vulnerabilities introduced (0 Critical / 0 High / 0 Medium / 0 Low). Details: [SECURITY_AUDIT_2026-04-19.md](SECURITY_AUDIT_2026-04-19.md).
- **CORS: reject unknown origins** — Netlify proxy functions (`claude-proxy`, `deepgram-proxy`) previously fell back to the first allowed origin when the request origin didn't match the allowlist, effectively allowing any origin. Now returns 403 for unknown origins. Comparison is also case-insensitive now.
- **Per-user rate limiting on proxy functions** — `claude-proxy` (200/hour) and `deepgram-proxy` (300/hour) now track API calls per user via Supabase `api_usage` table. Returns 429 with `Retry-After` header when exceeded.
- **`user_id` body parameter validated against JWT** — `claude-proxy` rejects requests where the `user_id` in the body doesn't match the authenticated JWT user, preventing impersonation.
- **Payload size limits** — `claude-proxy` rejects request bodies over 512 KB. `deepgram-proxy` rejects audio over 25 MB. Prevents resource exhaustion and cost abuse.
- **Input validation on `claude-proxy`** — messages array structure validated (role must be `user`/`assistant`, content must be string). System prompt capped at 10,000 chars; individual messages capped at 100,000 chars.
- **Deepgram proxy parameter whitelisting** — model and language parameters are whitelisted against known-good values. Content-Type validated against allowed audio formats.
- **Removed `shell:allow-execute` capability** — unused but dangerous IPC permission removed from Tauri capabilities. `shell:allow-open` retained for OAuth URL opening.
- **CSP pinned to specific subdomains** — replaced wildcard `https://*.supabase.co` and `https://*.netlify.app` with exact project URLs. Removed unnecessary `wasm-unsafe-eval`. Added `wss://api.deepgram.com` for WebSocket streaming.
- **Keywords capped at 50 entries, 100 chars each** — prevents URL length abuse and Deepgram API rejection.
- **API key error messages sanitized** — Deepgram WebSocket connection errors no longer include the API key value in error strings. Console logs no longer print API key prefixes.
- **Prompt injection mitigation** — user-controlled context fields (`post_processing_context`, `writing_style_profile`) are wrapped in XML boundary tags with explicit instructions not to follow any embedded instructions. Both fields capped at 1,000 chars.
- **Deepgram response validation** — `recording_stop` now checks HTTP status before parsing, validates JSON structure with `.get()` chains, and returns proper error messages on non-2xx or malformed responses. Previously treated error responses as empty successful transcriptions.
- **Console log cleanup** — removed API key confirmation logs, replaced `console.error` with `console.warn` for non-critical failures, stripped error objects from log output. Server-side logs include error messages only, not full stack traces.
- **Supabase Edge Functions hardened** — `create-checkout` and `billing-portal` reject unknown CORS origins. Plan parameter validated against allowlist. Error logs sanitized to not leak stack traces or PII (user IDs removed from webhook logs). `stripe-webhook` signature verification error no longer logs the raw error.
- **Dev bypass flags hardened for production** — Netlify proxy functions now check `process.env.CONTEXT !== 'production'` in addition to `DEV_BYPASS_AUTH`, preventing accidental bypass on production deploys.
- **API usage logging errors caught** — fire-and-forget `.insert()` calls in both proxy functions now have `.catch()` handlers to log failures instead of silently swallowing them.
- **`.gitignore`** — added `*.key`, `*.key.pub`, `.tauri/` patterns as defense-in-depth so a stray copy of the signing key inside the repo tree can't accidentally be committed.

### Dependencies

- **`openssl` 0.10.76 → 0.10.78** — patches 4 advisories: PSK/cookie trampolines leaking adjacent memory (high), `MdCtxRef::digest_final` writing past caller buffer (high), incorrect bounds assertion in AES key wrap (high), and oversized PEM password-callback length (low). Transitive via `native-tls`.
- **`rustls-webpki` 0.103.12 → 0.103.13** — patches a high-severity DoS via panic on a malformed CRL `BIT STRING`. Transitive via `rustls`.
- **`rand` 0.8.5 → 0.8.6** — patches a low-severity unsoundness with custom loggers using `rand::rng()`.
- **`postcss` 8.5.8 → 8.5.12** — patches a medium-severity XSS via unescaped `</style>` in PostCSS's CSS stringify output (GHSA-qx2v-qp2m-jg93). devDependency only (Tailwind/autoprefixer build chain).
- **`urlencoding`** crate added — for encoding keyword boost parameters in Deepgram API URLs.

Two upstream-pinned advisories remain open and are not patchable from our `Cargo.toml`:
- **`glib` 0.18.5** (medium, unsoundness in `VariantStrIter`) — pulled in by `gtk` 0.18 via Tauri 2.10's GTK stack. Linux-only build path; we don't construct `VariantStrIter` ourselves. Will clear when Tauri upgrades to gtk-rs 0.20+.
- **`rand` 0.7.3** (low) — build-only dep of `phf_codegen` via `tauri-utils`; never compiled into the runtime binary.

### Cleanup

- **Removed legacy Electron artifacts** — deleted `build/` directory (old Electron builder configs and PyInstaller outputs). Removed `electron` and `electron-builder` from devDependencies. Removed stale npm scripts (`start`, `package`, `package:win`, `package:dev`).
- **Removed stale design docs** — deleted 5 pre-implementation design documents for features already shipped.
- **Moved `LLM_ONBOARDING.md`** to `docs/` directory.
- **Updated `README.md`** — refreshed feature list, fixed model name (`nova-2` → Nova-3), updated project structure, added new features.
- **App icon made square** — source PNG was 1326×1294 (not square), causing rendering issues. Padded to 1326×1326 and regenerated all sizes (32, 64, 128, 256, 512, ICO, ICNS) via `npx tauri icon`.
- **Tray icon converted to RGBA** — was RGB (no transparency).

### Docs

- **`docs/RELEASE.md`** — covers version bump, per-platform bundle build, `latest.json` generation, updater-artifact requirements, signing-wrapper notes, and known Wayland limits.
- **`docs/RELEASE_CHECKLIST.md`** — preflight gate for releases (tests, smoke tests, signing, Dependabot status, doc updates).
- **`docs/LAUNCH_PLAN.md`** — go-to-market plan; Phase 1 keypair + workflow tasks ticked.
- **README** title updated to "Voice Dictation for Windows & Linux"; added a **Linux notes** section covering runtime dependencies, display-server caveats (X11 full parity / Wayland limits), and the mic-picker filter.
- **`docs/STATUS_AND_ROADMAP.md`** — Linux App row moved from 🔜 Planned to 🧪 Beta; macOS split into its own row.

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
