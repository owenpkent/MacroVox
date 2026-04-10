# MacroVox — Status & Roadmap

**Last Updated**: April 5, 2026 — Phase 7: Netlify + Supabase Edge Functions  
**Repository**: https://github.com/owenpkent/MacroVox

---

## Project Overview

**MacroVox** is a managed voice dictation app for Windows — speak into your microphone, get text. Powered by Deepgram speech-to-text with automatic AI transcript cleanup via Claude. Both are required services provisioned for all Pro subscribers.

### Vision

A premium, managed voice dictation experience — no API keys to configure, no setup friction. Users sign in, subscribe via Stripe, and start dictating immediately. All infrastructure (Deepgram, Claude, auth) is managed server-side.

**Core Features**:
- Real-time and batch voice transcription (Deepgram nova-2)
- AI post-processing transcript cleanup (Claude) — always on for Pro subscribers
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
| **Windows App** | ✅ Released — v1.0.6 (EV code signed) |
| **Auth (Supabase)** | ✅ Complete — email/password |
| **Stripe Billing** | 🔧 In Progress — functions written, pending deployment |
| **Managed API Keys** | ✅ Complete — Deepgram + Claude both required, provisioned for Pro users |
| **Netlify Functions** | ✅ Complete — claude-proxy + deepgram-proxy written |
| **Supabase Edge Functions** | ✅ Complete — create-checkout, billing-portal, stripe-webhook written |
| **macOS / Linux** | 🔜 Planned |

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

### App Features
- [x] Batch transcription (record → transcribe with Deepgram)
- [x] Streaming transcription (real-time WebSocket)
- [x] AI post-processing (Claude transcript cleanup via proxy) — required for all Pro subscribers
- [x] Global hotkey `Ctrl+Space` to toggle recording
- [x] Auto-copy on stop, auto-paste into previous app
- [x] Keyword boosting for domain-specific terms
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
- [x] Bearer token auth in `usePostProcessing` and `useAgentiveWriting` hooks

---

## 🔧 In Progress

### Stripe Deployment (Phase 7 functions written — needs wiring)
- [ ] Deploy Supabase Edge Functions (`supabase functions deploy create-checkout billing-portal stripe-webhook`)
- [ ] Deploy Netlify site + functions (`git push` to Netlify-linked repo)
- [ ] Create Stripe product + price for MacroVox ($6.99/month)
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

---

## 📋 Next Steps

### Step 1: Stripe Product Setup
1. Create MacroVox product in Stripe Dashboard ($6.99/month)
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
- [ ] **Google OAuth** — sign in with Google via Supabase Auth
- [ ] **Facebook OAuth** — sign in with Facebook via Supabase Auth
- [ ] **Onboarding flow** — guided first-run experience after sign-up
- [ ] **Usage tracking** — voice minutes + AI requests per billing period
- [ ] **Usage limits** — enforce Pro tier quotas

### Medium-term
- [ ] **macOS support** — ffmpeg audio capture on macOS
- [ ] **Linux support** — PulseAudio/PipeWire capture
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

---

## Architecture

```
MacroVox/
├── docs/                    # Documentation
│   ├── SETUP.md             # Backend setup guide
│   ├── STATUS_AND_ROADMAP.md # Status & roadmap
│   └── CHANGELOG.md         # Release history
├── src-tauri/               # Tauri 2 Rust backend
│   ├── src/
│   │   ├── lib.rs           # App setup, global shortcut, window events
│   │   ├── commands.rs      # IPC commands (audio, recording, clipboard, paste)
│   │   ├── audio.rs         # cpal WASAPI native audio capture
│   │   ├── deepgram_ws.rs   # Deepgram WebSocket streaming
│   │   └── state.rs         # Shared app state (Mutex-wrapped)
│   ├── capabilities/        # Tauri 2 permission capabilities
│   ├── Cargo.toml
│   └── tauri.conf.json      # Tauri config (windows, build, plugins)
├── src/
│   └── renderer/            # React UI (Vite + Tailwind)
│       ├── components/      # DictationMode, SettingsPanel, AgentiveWriting
│       ├── hooks/           # usePostProcessing
│       ├── lib/             # tauri-ipc, auth (Supabase JS), supabase client
│       ├── themes.ts        # 6 themed color schemes
│       ├── ThemeContext.tsx  # Theme provider + CSS variable injection
│       ├── dictation.html   # Dictation window entry point
│       ├── dictation.tsx    # Dictation window React root
│       ├── settings.html    # Settings window entry point
│       └── settings.tsx     # Settings window React root
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
| **Speech-to-Text** | Deepgram nova-2 (batch + WebSocket streaming) |
| **AI Post-Processing** | Claude (Anthropic) via proxy |
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
