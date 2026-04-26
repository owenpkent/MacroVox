# MacroVox — Voice Dictation for Windows & Linux

A managed voice dictation app powered by [Deepgram](https://deepgram.com) and [Claude](https://anthropic.com). Speak into your microphone, get text. Sign in, subscribe, and start dictating — all API keys are managed server-side. Windows is the primary release target; Linux (`.deb`, `.rpm`, AppImage) is supported in beta — see [Linux notes](#linux-notes) below.

> **Managed service** — MacroVox handles all API keys (Deepgram, Claude) for Pro subscribers. No setup friction. See [docs/SETUP.md](docs/SETUP.md) for backend infrastructure guide.

## Status

Active — Tauri 2 production app. Stripe billing, free trial, auto-updater deployed.

---

## Features

- **Voice-to-text dictation** — Deepgram Nova-3, real-time streaming or batch mode
- **20 languages** — English, Spanish, French, German, Portuguese, Japanese, Korean, Chinese, and more
- **Custom global hotkey** — configurable shortcut to toggle recording from any app (default Ctrl+Space)
- **AI post-processing** — Claude Haiku cleans up every transcript automatically, non-blocking (Pro)
- **Number formatting** — choose digits, words, or smart mode for how numbers appear
- **Auto-copy & auto-paste** — transcript goes straight to clipboard and active app instantly (native key-injection via `enigo`); AI cleanup updates in background. Works on Windows and X11-based Linux; auto-paste is disabled on Wayland (see [Linux notes](#linux-notes))
- **Keyword boosting** — improve recognition of custom terms
- **Dictation history** — rolling voice buffer saves recordings as OGG Opus for playback and reprocessing
- **6 themed UI skins** — MCRN, Mars, Belter, Earth, Protomolecule, Laconia
- **System tray** — runs in background, toggles with tray icon
- **Email/password login** — Supabase Auth (Google & Facebook OAuth planned)
- **Stripe billing** — subscribe to Pro for managed Deepgram + Claude access, 7-day free trial

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 20+ LTS | [nodejs.org](https://nodejs.org) |
| **Rust** | stable | [rustup.rs](https://rustup.rs) |
| **Git** | Any | For cloning |

---

## Quick Start

```powershell
git clone https://github.com/okstudio1/MacroVox.git
cd MacroVox
python run.py
```

`run.py` checks prerequisites, runs `npm install`, and launches `npx tauri dev`. The first run compiles the Rust backend — takes a few minutes.

### Environment

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
```

---

## Linux notes

MacroVox builds `.deb`, `.rpm`, and AppImage bundles on Linux. Install the bundle that matches your distro (produced by `npx tauri build` into `src-tauri/target/release/bundle/`; copy-aggregated by `npm run release:linux` into `release/linux/`).

**Runtime dependencies** (Debian/Ubuntu names; see your distro for equivalents):
- `libwebkit2gtk-4.1-0` — Tauri WebView
- `libasound2` + `libpulse0` — audio capture (cpal via ALSA/PulseAudio; PipeWire works through its PulseAudio shim)
- `libayatana-appindicator3-1` — tray icon support (when enabled)

**Display-server caveats:**
- **X11** — fully supported: global hotkey, auto-paste (`enigo`), clipboard all work as on Windows.
- **Wayland** — partial support. Global hotkeys depend on the compositor's XDG portal; on some compositors `Ctrl+Space` may not register. Auto-paste via `enigo` is not reliable on Wayland and is disabled automatically — copy your transcript and paste manually, or launch the app from an X11 session for full parity. MacroVox detects the session type at startup (via `XDG_SESSION_TYPE` / `WAYLAND_DISPLAY`) and surfaces the restriction in Settings.

**Microphone picker** — on Linux the settings dropdown filters out ALSA's virtual aliases (`hw:`, `plughw:`, `dmix:`, `surround*:`, `iec958:`, `hdmi:`, monitor taps) so you see only user-meaningful devices (`default`, `pulse`, and named inputs). Your selection is persisted across restarts.

---

## Documentation

- **[LLM Onboarding](docs/LLM_ONBOARDING.md)** — Quick reference for AI assistants
- **[Status & Roadmap](docs/STATUS_AND_ROADMAP.md)** — Current status and next steps
- **[Setup Guide](docs/SETUP.md)** — Backend infrastructure (Supabase + Netlify + Stripe)
- **[Release Process](docs/RELEASE.md)** — How to cut a release, build bundles, and generate `latest.json`
- **[Release Checklist](docs/RELEASE_CHECKLIST.md)** — Preflight gates (tests, smoke tests, signing) before tagging
- **[Marketing Strategy](docs/MARKETING.md)** — Positioning, pricing, launch playbook, SEO content plan, demo video specs
- **[Changelog](docs/CHANGELOG.md)** — Release history

---

## Project Structure

```
MacroVox/
├── run.py                        # Dev launcher (prerequisites + npx tauri dev)
├── src-tauri/                    # Rust / Tauri 2 backend
│   ├── tauri.conf.json           # App config — windows, devUrl, frontendDist
│   ├── capabilities/default.json # IPC permissions for all windows
│   └── src/
│       ├── main.rs               # Entry point — calls lib::run()
│       ├── lib.rs                # App setup, tray, global shortcut, close handler
│       ├── commands.rs           # All IPC commands (audio, Deepgram, clipboard, windows)
│       ├── state.rs              # Shared AppState (Mutex-wrapped)
│       ├── audio.rs              # cpal WASAPI native audio capture
│       ├── deepgram_ws.rs        # Deepgram WebSocket streaming
│       ├── voice_buffer.rs       # Dictation history (OGG Opus buffer + manifest)
│       └── platform.rs           # Platform detection (OS, Wayland)
├── src/renderer/                 # React UI (Vite + Tailwind)
│   ├── dictation.html/tsx        # Main dictation window entry
│   ├── settings.html/tsx         # Settings window entry
│   ├── index.css                 # Tailwind + CSS custom properties (theme vars)
│   ├── config.ts                 # App configuration constants
│   ├── themes.ts                 # 6 theme definitions
│   ├── ThemeContext.tsx          # Theme provider — applies CSS vars, syncs windows
│   ├── components/
│   │   ├── DictationMode.tsx     # Main dictation UI (Dictate + Write tabs)
│   │   ├── AgentiveWriting.tsx   # Write tab — speak → Claude generates
│   │   ├── VoiceHistory.tsx      # Dictation history — playback, expand, reprocess
│   │   └── SettingsPanel.tsx     # Settings window UI
│   ├── hooks/
│   │   ├── usePostProcessing.ts  # Claude transcript cleanup hook
│   │   ├── useAgentiveWriting.ts # Claude writing generation hook
│   │   ├── useDeepgram.ts        # Deepgram streaming hook
│   │   └── useUpdater.ts         # Auto-updater hook
│   ├── lib/
│   │   ├── tauri-ipc.ts          # Typed invoke() / listen() wrappers
│   │   ├── auth.ts               # Supabase JS SDK auth functions
│   │   └── supabase.ts           # Supabase client singleton
│   └── types/                    # Shared TypeScript type definitions
├── netlify/functions/            # Netlify serverless (claude-proxy, deepgram-proxy)
├── supabase/functions/           # Supabase Edge Functions (checkout, billing, webhook)
├── docs/                         # Documentation
├── vite.config.ts                # Vite + Vitest config
└── package.json
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Rust / Tauri 2                  │
│  lib.rs       — app lifecycle, tray, hotkey        │
│  commands.rs  — audio, Deepgram, clipboard, paste  │
│  audio.rs     — cpal WASAPI capture, WAV encoder   │
│  state.rs     — AppState (audio buffer, settings)  │
└───────────────────┬──────────────────────────────┘
                    │  invoke() / emit()
┌───────────────────▼──────────────────────────────┐
│              React Renderer (Vite)                │
│  DictationMode   — recording UI, tabs             │
│  SettingsPanel   — all user preferences           │
│  tauri-ipc.ts    — IPC bridge                     │
│  auth.ts         — Supabase auth + billing        │
└──────────────────────────────────────────────────┘
```

---

## Development Scripts

| Command | Description |
|---|---|
| `python run.py` | Start dev environment (recommended) |
| `npx tauri dev` | Start Tauri dev directly |
| `npm run build:renderer` | Build renderer only (Vite) |
| `npx tauri build` | Production build + installer |
| `npm test` | Run JS tests (Vitest) |
| `npm run test:rust` | Run Rust unit tests |

---

## License

MIT — © 2026 OK Studio
