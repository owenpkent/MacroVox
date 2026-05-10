# MacroVox — Status & Roadmap

**Last Updated**: May 10, 2026  
**Repository**: https://github.com/okstudio1/MacroVox

---

## Project Overview

**MacroVox** is a managed voice dictation app for Windows — speak into your microphone, get text. Powered by Deepgram speech-to-text with automatic AI transcript cleanup via Claude. Both are required services provisioned for all Pro subscribers.

### Vision

A premium, managed voice dictation experience — no API keys to configure, no setup friction. Users sign in, subscribe via Stripe, and start dictating immediately. All infrastructure (Deepgram, Claude, auth) is managed server-side.

**Core Features**:
- Real-time voice transcription (Deepgram nova-3, streaming default) with batch fallback
- AI post-processing transcript cleanup (Claude Haiku — fast, non-blocking) — always on for Pro subscribers
- Global hotkey (`Ctrl+Space`) for instant dictation from any app
- Auto-copy, auto-paste, keyword boosting
- 6 themed UI skins (Expanse-inspired)
- System tray integration
- Supabase auth (email/password)
- Stripe subscription billing

---

## Status Summary

| Category | Status |
|----------|--------|
| **Windows App** | ✅ Released v1.0.6 (EV code signed); v1.0.7 staged — pending rebuild + smoke tests, then ship |
| **Linux App** | 🧪 Beta — `.deb` / `.rpm` / AppImage bundles build cleanly; X11 full-parity, Wayland has auto-paste + global-hotkey limitations (see [README Linux notes](../README.md#linux-notes)) |
| **macOS App** | 🔜 Planned |
| **Auth (Supabase)** | ✅ Complete — email/password |
| **Stripe Billing** | ✅ Complete — product, webhook, portal audited and verified end-of-2026-04-26 (see [LAUNCH_PLAN.md](LAUNCH_PLAN.md#where-we-actually-are-updated-2026-05-05)) |
| **Managed API Keys** | ✅ Complete — Deepgram + Claude both required, provisioned for Pro users |
| **Netlify Functions** | ✅ Complete — claude-proxy + deepgram-proxy written |
| **Supabase Edge Functions** | ✅ Complete — create-checkout, billing-portal, stripe-webhook written |

---

## ✅ What's Done

### Infrastructure
- [x] Tauri 2 app with React/Vite/Tailwind renderer + Rust backend
- [x] Migrated from Electron to Tauri (cpal WASAPI audio, enigo paste, Deepgram WebSocket)
- [x] Supabase project for auth + database
- [x] Supabase Auth (email/password) — JS SDK in renderer (replaced Electron main-process client)
- [x] Session persistence via Supabase JS SDK localStorage (replaced Electron safeStorage)
- [x] Subscription + managed_api_keys tables in Supabase (with RLS)
- [x] EV code-signed NSIS installer + portable executable
- [x] Branded NSIS installer with custom header/sidebar images and install hooks
- [x] Auto-updater via tauri-plugin-updater (checks GitHub Releases on launch)
- [x] Security audit + hardening — CORS, CSP, payload limits, input validation, capabilities lockdown

### App Features
- [x] Batch transcription (record → transcribe with Deepgram)
- [x] Streaming transcription (real-time WebSocket)
- [x] AI post-processing (Claude transcript cleanup via proxy) — required for all Pro subscribers
- [x] Global hotkey `Ctrl+Space` to toggle recording
- [x] Auto-copy on stop (default ON), auto-paste into previous app
- [x] Keyword boosting for domain-specific terms (sent to Deepgram API in both streaming and batch modes)
- [x] Optimistic auto-copy — raw transcript copied instantly, AI cleanup updates clipboard in background
- [x] Dictation commands ("period", "comma", "new line")
- [x] Accessibility context for AI cleanup
- [x] 6 themed UI skins with live switching
- [x] Settings panel (separate window)
- [x] System tray with context menu
- [x] Always-on-top dictation window
- [x] Minimize-to-tray on close
- [x] Auto-cutoff (15/30/45/60 seconds)
- [x] Voice-reactive animation rings + waveform visualizer
- [x] Single-instance lock
- [x] Launch readiness hardening (race conditions, mutex poison recovery, fetch timeouts, streaming error handling)
- [x] Dictation history — rolling OGG Opus buffer (enabled by default), transcription history with expand/copy, reprocess through full Deepgram+Claude pipeline
- [x] Opus compression — ~10x storage savings over WAV via vendored libopus

### Auth & Billing
- [x] Supabase Auth integration (email/password)
- [x] Subscription status check from Supabase
- [x] Managed API key retrieval for Pro users
- [x] Stripe checkout session creation (via Netlify function)
- [x] Stripe billing portal (via Netlify function)
- [x] Managed-only model — no user-provided API keys

### Serverless Functions (Phase 7)
- [x] `supabase/functions/create-checkout` — Stripe checkout session (Supabase Edge Function)
- [x] `supabase/functions/billing-portal` — Stripe billing portal (Supabase Edge Function)
- [x] `supabase/functions/stripe-webhook` — provision/deprovision keys on subscription events (Supabase Edge Function)
- [x] `netlify/functions/claude-proxy` — authenticated Claude AI proxy for Pro subscribers
- [x] `netlify/functions/deepgram-proxy` — authenticated Deepgram proxy (future use)
- [x] Bearer token auth in `usePostProcessing` hook

---

## 🔧 In Progress

### Stripe Deployment (Phase 7 functions written — needs wiring)
- [ ] Run SQL migration for `api_usage` table (`supabase/migrations/20260411_create_api_usage.sql`)
- [ ] Deploy Supabase Edge Functions (`supabase functions deploy create-checkout billing-portal stripe-webhook`)
- [ ] Deploy Netlify site + functions (`git push` to Netlify-linked repo)
- [ ] Create Stripe product + price for MacroVox (\$6.99/month)
- [ ] Add env vars to Netlify: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_MANAGED_KEY`, `DEEPGRAM_MANAGED_KEY`
- [ ] Add env vars to Supabase Edge Functions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `DEEPGRAM_MANAGED_KEY`, `ANTHROPIC_MANAGED_KEY`, `SITE_URL`
- [ ] Create Stripe webhook endpoint pointing to Supabase Edge Function URL
- [ ] Test end-to-end: sign up → subscribe → dictate → cancel

---

## 🐛 Known Issues

| Issue | Status |
|-------|--------|
| Settings window shows black screen | ✅ Fixed — declared in tauri.conf.json; `WebviewUrl::App` for programmatic windows never uses devUrl |
| Minimize / close buttons unresponsive | ✅ Fixed — `data-tauri-drag-region` swallows clicks; buttons moved outside drag region + `core:window:allow-minimize/close` added to capabilities |
| Transcript disappears after second recording | ✅ Fixed in v1.0.6 — React functional updaters |
| Install to wrong directory (AppData vs Program Files) | ✅ Fixed in v1.0.5 — per-machine HKLM install |
| Desktop shortcut not created | ✅ Fixed in v1.0.4 — reads correct path from registry |
| Transcription only works once per launch | ✅ Fixed in v1.0.3 — isProcessing cleared unconditionally |
| Auth token path mismatch | ✅ Fixed in v1.0.2 — hardcoded cross-app path (now replaced by Supabase) |
| App icon not square (1326×1294) | ✅ Fixed — padded to 1326×1326 and regenerated all sizes via `npx tauri icon` |
| Tray icon not RGBA | ✅ Fixed — converted to RGBA PNG |
| Keyword boosting silently ignored | ✅ Fixed — keywords now sent to Deepgram in both streaming and batch modes |
| CORS allows any origin via fallback | ✅ Fixed — all proxy functions reject unknown origins with 403 |
| No rate limiting on API proxies | ✅ Fixed — per-user hourly limits via `api_usage` table |
| Supabase Edge Functions CORS fallback | ✅ Fixed — `create-checkout` and `billing-portal` reject unknown origins |

---

## 📋 Next Steps

### Step 1: Stripe Product Setup
1. Create MacroVox product in Stripe Dashboard (\$6.99/month)
2. Save Price ID for Netlify environment variable
3. Create webhook endpoint pointing to Netlify function

### Step 2: Deploy Netlify Functions
1. `create-checkout` — creates Stripe checkout session
2. `stripe-webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. `billing-portal` — opens Stripe billing portal
4. `claude-proxy` — proxies AI post-processing requests for Pro users
5. `deepgram-proxy` — proxies transcription requests for Pro users

### Step 3: End-to-End Testing
1. Sign up with email
2. Subscribe to Pro via Stripe checkout
3. Verify managed keys are provisioned
4. Test dictation with managed Deepgram key
5. Test AI post-processing with managed Claude key
6. Test billing portal (cancel, resubscribe)

---

## 📋 Future Roadmap

### Near-term
- [ ] **Complete Stripe integration** — end-to-end checkout + webhook + billing portal
- [ ] **v1.0.8: Deepgram ephemeral tokens (C5)** — migrate from managed-key fetch to `POST /v1/auth/grant` short-lived JWTs so the renderer never sees a Deepgram master key. Full plan at [PLAN_DEEPGRAM_PROXY_MIGRATION.md](PLAN_DEEPGRAM_PROXY_MIGRATION.md). Estimated ~4.5 h. Closes the last open finding from the 2026-04-16 audit.
- [ ] **Rotate Anthropic + Deepgram managed keys** — owner action per [KEY_ROTATION.md](KEY_ROTATION.md); compromised dev mirrors are still verified live by trufflehog.
- [ ] **Google OAuth** — sign in with Google via Supabase Auth
- [ ] **Facebook OAuth** — sign in with Facebook via Supabase Auth
- [ ] **Onboarding flow** — guided first-run experience after sign-up
- [ ] **Usage tracking** — voice minutes + AI requests per billing period
- [ ] **Usage limits** — enforce Pro tier quotas

### Medium-term
- [ ] **Multi-provider STT** — selectable dictation provider (Deepgram, OpenAI Whisper, ElevenLabs Scribe)
- [x] **Voice memo buffer** — rolling OGG Opus buffer with playback, reprocessing, and manifest
- [ ] **Agentic Writing tab** — speak a request, Claude generates the content (deferred from v1 launch)
- [ ] **macOS support** — cpal audio capture on macOS
- [x] **Linux support (beta)** — ALSA/PulseAudio capture via cpal, `.deb` / `.rpm` / AppImage bundles, ALSA device-list filter, persisted mic pick. Remaining: full Wayland parity (auto-paste + global hotkey), signed `.deb`, Linux keys in updater manifest.
- [ ] **Team tier** — shared billing for organizations
- [ ] **Custom vocabulary training** — domain-specific term recognition
- [ ] **Voice profile adaptation** — improve accuracy for non-standard speech patterns
- [ ] **Phonetic hints** — user-defined pronunciation guides

### Long-term
- [ ] **Mobile companion app** — quick dictation from phone
- [ ] **VS Code extension** — dictation directly into editor
- [ ] **Local STT fallback** — Whisper for offline use
- [ ] **Gaming mode** — ultra-low latency voice macros
- [ ] **Ambiance generator** — built-in atmospheric sounds

---

## 🎉 Release History

### v1.0.6 (2026-03-17) — Transcript Fix
- ✅ Fixed transcript not appearing after second recording (React stale closure in `postProcess().then()`)

### v1.0.5 (2026-03-17) — Program Files Install
- ✅ Installs to `C:\Program Files\MacroVox` (per-machine, HKLM)
- ✅ Reliable upgrade: kill-and-poll loop prevents "Failed to uninstall" errors
- ✅ Desktop + Start Menu shortcuts for all users

### v1.0.4 (2026-03-17) — Desktop Shortcut Fix
- ✅ Fixed Desktop shortcut not created during install

### v1.0.3 (2026-03-17) — Recording Fix
- ✅ Fixed transcription only working once per launch (batch mode)
- ✅ Dead-process recovery for pre-warmed ffmpeg

### v1.0.2 (2026-03-09) — Auth Token Path Fix
- ✅ Fixed "No API key" shown after IPC bridge fix

### v1.0.1 (2026-03-09) — Auth IPC Bridge Fix
- ✅ Fixed missing IPC methods in preload

### v1.0.0 (2026-03-09) — Initial Release
- ✅ Standalone MacroVox dictation app
- ✅ NSIS installer + portable, both EV code-signed
- ✅ Batch + streaming modes, AI post-processing, auto-paste
- ✅ 6 themes, system tray, `Ctrl+Space` global shortcut

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP.md](SETUP.md) | Backend setup guide (Supabase + Netlify + Stripe) |
| [STATUS_AND_ROADMAP.md](STATUS_AND_ROADMAP.md) | This document — status and roadmap |
| [CHANGELOG.md](CHANGELOG.md) | Detailed release history |
| [LLM_ONBOARDING.md](LLM_ONBOARDING.md) | Quick reference for AI assistants |
| [RELEASE.md](RELEASE.md) | Build, sign, release, and auto-update pipeline |
| [SETTINGS_ROADMAP.md](SETTINGS_ROADMAP.md) | Settings panel feature roadmap |
| [FREE_TRIAL_IMPLEMENTATION.md](FREE_TRIAL_IMPLEMENTATION.md) | Free trial + Stripe billing implementation |
| [SECURITY_AUDIT_2026-04-16.md](SECURITY_AUDIT_2026-04-16.md) | Full security audit (includes 2026-05-10 addendum dispositioning third-party audit findings) |
| [SECURITY_AUDIT_2026-04-19.md](SECURITY_AUDIT_2026-04-19.md) | Follow-up security audit |
| [../SECURITY.md](../SECURITY.md) | Vulnerability disclosure policy (private advisory channel + email fallback) |
| [KEY_ROTATION.md](KEY_ROTATION.md) | Runbook for rotating the Anthropic + Deepgram managed keys |
| [PLAN_DEEPGRAM_PROXY_MIGRATION.md](PLAN_DEEPGRAM_PROXY_MIGRATION.md) | v1.0.8 plan: move Deepgram auth off the renderer using ephemeral tokens (C5) |
| [src-tauri/ARCHITECTURE.md](../src-tauri/ARCHITECTURE.md) | Tauri/Rust backend architecture |

---

## Architecture

```
MacroVox/
├── docs/                    # Documentation
│   ├── SETUP.md             # Backend setup guide
│   ├── STATUS_AND_ROADMAP.md # Status & roadmap
│   ├── CHANGELOG.md         # Release history
│   ├── LLM_ONBOARDING.md   # AI assistant quick reference
│   └── RELEASE.md           # Build + release pipeline
├── src-tauri/               # Tauri 2 Rust backend
│   ├── src/
│   │   ├── main.rs          # Entry point — calls lib::run()
│   │   ├── lib.rs           # App setup, global shortcut, window events
│   │   ├── commands.rs      # IPC commands (audio, recording, clipboard, paste)
│   │   ├── audio.rs         # cpal WASAPI native audio capture
│   │   ├── deepgram_ws.rs   # Deepgram WebSocket streaming
│   │   ├── voice_buffer.rs  # Dictation history (OGG Opus buffer + manifest)
│   │   ├── platform.rs      # Platform detection (OS, Wayland)
│   │   └── state.rs         # Shared app state (Mutex-wrapped)
│   ├── capabilities/        # Tauri 2 permission capabilities
│   ├── Cargo.toml
│   └── tauri.conf.json      # Tauri config (windows, build, plugins)
├── src/
│   └── renderer/            # React UI (Vite + Tailwind)
│       ├── components/      # DictationMode, SettingsPanel, AgentiveWriting, VoiceHistory
│       ├── hooks/           # usePostProcessing, useDeepgram, useAgentiveWriting, useUpdater
│       ├── lib/             # tauri-ipc, auth (Supabase JS), supabase client
│       ├── types/           # Shared TypeScript type definitions
│       ├── config.ts        # App configuration constants
│       ├── themes.ts        # 6 themed color schemes
│       ├── ThemeContext.tsx  # Theme provider + CSS variable injection
│       ├── dictation.html   # Dictation window entry point
│       ├── dictation.tsx    # Dictation window React root
│       ├── settings.html    # Settings window entry point
│       └── settings.tsx     # Settings window React root
├── netlify/functions/       # Netlify serverless (claude-proxy, deepgram-proxy)
├── supabase/functions/      # Supabase Edge Functions (checkout, billing, webhook)
├── package.json
├── vite.config.ts           # Vite config (multi-page: dictation + settings)
└── run.py                   # Dev launcher (python run.py)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **App** | Tauri 2, React 18, Vite 6, Tailwind 3 |
| **Backend** | Rust (cpal WASAPI audio, enigo paste, reqwest HTTP) |
| **Speech-to-Text** | Deepgram nova-3 (WebSocket streaming default, batch fallback) |
| **AI Post-Processing** | Claude Haiku (transcript cleanup), via Netlify proxy |
| **Auth** | Supabase Auth JS SDK (email/password; OAuth planned) |
| **Database** | Supabase (PostgreSQL) |
| **Billing** | Stripe (subscriptions) |
| **Functions** | Netlify Functions (serverless) |
| **Audio** | cpal (WASAPI native capture on Windows) |
| **Local STT** | whisper-rs (optional, `--features local-stt`) |
| **Signing** | Sectigo EV code signing certificate |
| **Installer** | Tauri bundler (NSIS) |

---

## License

MIT — © 2026 OK Studio
