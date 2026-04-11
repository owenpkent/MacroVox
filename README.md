# MacroVox — Voice Dictation for Windows

A managed voice dictation app for Windows powered by [Deepgram](https://deepgram.com) and [Claude](https://anthropic.com). Speak into your microphone, get text. Sign in, subscribe, and start dictating — all API keys are managed server-side.

> **Managed service** — MacroVox handles all API keys (Deepgram, Claude) for Pro subscribers. No setup friction. See [docs/SETUP.md](docs/SETUP.md) for backend infrastructure guide.

## Status

Active — Tauri 2 migration complete. Stripe/Netlify backend deployment in progress.

---

## Features

- **Voice-to-text dictation** — Deepgram nova-2, real-time streaming (default) or batch mode
- **Agentic writing** — speak a request ("write an email to Mike rescheduling Thursday") and Claude produces the finished content
- **Writing style profile** — describe your voice once; every generated piece matches your style
- **Global hotkey** — `Ctrl+Space` to toggle recording from any app
- **AI post-processing** — Claude Haiku cleans up every transcript automatically, non-blocking (Pro)
- **Auto-copy & auto-paste** — transcript goes straight to clipboard and active app instantly (native Windows input via enigo); AI cleanup updates in background
- **Keyword boosting** — improve recognition of custom terms
- **6 themed UI skins** — MCRN, Mars, Belter, Earth, Protomolecule, Laconia
- **System tray** — runs in background, toggles with tray icon
- **Email/password login** — Supabase Auth (Google & Facebook OAuth planned)
- **Stripe billing** — subscribe to Pro for managed Deepgram + Claude access

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
git clone https://github.com/owenpkent/MacroVox.git
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

## Documentation

- **[LLM Onboarding](LLM_ONBOARDING.md)** — Quick reference for AI assistants
- **[Status & Roadmap](docs/STATUS_AND_ROADMAP.md)** — Current status and next steps
- **[Setup Guide](docs/SETUP.md)** — Backend infrastructure (Supabase + Netlify + Stripe)
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
│       ├── lib.rs                # App setup, tray, global shortcut, close handler
│       ├── commands.rs           # All IPC commands (audio, Deepgram, clipboard, windows)
│       └── state.rs              # Shared AppState (Mutex-wrapped)
├── src/renderer/                 # React UI (Vite + Tailwind)
│   ├── dictation.html/tsx        # Main dictation window entry
│   ├── settings.html/tsx         # Settings window entry
│   ├── index.css                 # Tailwind + CSS custom properties (theme vars)
│   ├── themes.ts                 # 6 theme definitions
│   ├── ThemeContext.tsx          # Theme provider — applies CSS vars, syncs windows
│   ├── components/
│   │   ├── DictationMode.tsx     # Main dictation UI (Dictate + Write tabs)
│   │   ├── AgentiveWriting.tsx   # Write tab — speak → Claude generates
│   │   └── SettingsPanel.tsx     # Settings window UI
│   ├── hooks/
│   │   ├── usePostProcessing.ts  # Claude transcript cleanup hook
│   │   └── useAgentiveWriting.ts # Claude writing generation hook
│   └── lib/
│       ├── tauri-ipc.ts          # Typed invoke() / listen() wrappers
│       ├── auth.ts               # Supabase JS SDK auth functions
│       └── supabase.ts           # Supabase client singleton
├── docs/                         # Documentation
├── vite.config.ts                # Vite + Vitest config
└── package.json
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Rust / Tauri 2                  │
│  lib.rs       — app lifecycle, tray, hotkey       │
│  commands.rs  — audio, Deepgram, clipboard, paste │
│  state.rs     — AppState (audio buffer, settings) │
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
