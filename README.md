# MacroVox — Voice Dictation for Windows

A managed Electron desktop app for voice dictation powered by [Deepgram](https://deepgram.com) and [Claude](https://anthropic.com). Speak into your microphone, get text. Sign in, subscribe, and start dictating — all API keys are managed server-side.

> **Managed service** — MacroVox handles all API keys (Deepgram, Claude) for Pro subscribers. No setup friction. See [docs/SETUP.md](docs/SETUP.md) for backend infrastructure guide.

---

## Features

- **Voice-to-text dictation** — Deepgram nova-2 with batch or streaming modes
- **Global hotkey** — `Ctrl+Space` to toggle recording from any app
- **AI post-processing** — Claude cleans up every transcript automatically (required for Pro)
- **Auto-copy & auto-paste** — transcript goes straight to your clipboard and active app
- **Keyword boosting** — improve recognition of custom terms (e.g. "MacroVox", "OAuth")
- **Themed UI** — 6 built-in themes (MCRN, Mars, Belter, Earth, Protomolecule, Laconia)
- **System tray** — runs in background, toggles with tray icon
- **Email, Google, Facebook login** — Supabase Auth with multiple sign-in options
- **Stripe billing** — subscribe to Pro for managed Deepgram + Claude access
- **Settings panel** — separate window for all configuration
- **Always-on-top** — dictation window stays above other apps

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 20+ LTS | [nodejs.org](https://nodejs.org) |
| **npm** | 10+ | Comes with Node.js |
| **ffmpeg** | Any recent | Required for microphone capture |
| **Git** | Any | For cloning |

### ffmpeg Installation (Windows)

1. Download from [ffmpeg.org](https://ffmpeg.org/download.html) or install via `winget install ffmpeg`
2. Ensure `ffmpeg` is on your `PATH`
3. Verify: `ffmpeg -version`

---

## Quick Start

### 1. Clone and install

```powershell
git clone https://github.com/owenpkent/MacroVox.git
cd MacroVox
npm install
```

### 2. Run in development mode

```powershell
python run.py
```

Or directly with npm:

```powershell
npm run dev
```

`run.py` checks prerequisites (Node 20+, ffmpeg) before launching. It compiles the main process TypeScript and starts Vite + Electron.

### 3. Use the app

- The **dictation window** opens on launch
- Press `Ctrl+Space` from any app to toggle recording
- Open **Settings** (gear icon) to sign in and manage your subscription
- **Pro subscribers** get automatic API key provisioning — no configuration needed

---

## Documentation

- **[Status & Roadmap](docs/STATUS_AND_ROADMAP.md)** — Current status and future plans
- **[Setup Guide](docs/SETUP.md)** — Backend infrastructure setup (Supabase + Netlify + Stripe)
- **[Changelog](docs/CHANGELOG.md)** — Detailed release history

---

## Project Structure

```
MacroVox/
├── run.py                    # Dev runner script (prerequisites check + npm run dev)
├── docs/                     # Documentation
│   ├── STATUS_AND_ROADMAP.md # Status & roadmap
│   ├── SETUP.md              # Backend setup guide
│   └── CHANGELOG.md          # Release history
├── build/                    # Electron Builder configs
│   ├── electron-builder.json # Production build config
│   ├── electron-builder.dev.json
│   ├── installer.nsh         # NSIS installer script
│   └── sign.js               # Code signing helper
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # App lifecycle, windows, IPC, tray
│   │   ├── preload.ts        # Context bridge (renderer ↔ main)
│   │   ├── audio.ts          # ffmpeg audio capture + device mgmt
│   │   ├── deepgram.ts       # Deepgram SDK (streaming + batch)
│   │   └── auth/             # Authentication module
│   │       ├── index.ts      # Re-exports
│   │       ├── types.ts      # Provider-agnostic auth interfaces
│   │       ├── auth-manager.ts  # Session lifecycle + encrypted storage
│   │       ├── supabase-client.ts  # Supabase client singleton
│   │       └── subscription.ts     # Pro subscription + managed keys
│   └── renderer/             # React UI (Vite + Tailwind)
│       ├── dictation.html    # Dictation window entry
│       ├── dictation.tsx     # Dictation React mount
│       ├── settings.html     # Settings window entry
│       ├── settings.tsx      # Settings React mount
│       ├── index.css         # Tailwind + CSS variables
│       ├── config.ts         # API endpoints
│       ├── themes.ts         # Theme definitions (6 themes)
│       ├── ThemeContext.tsx   # React theme provider
│       ├── components/
│       │   ├── DictationMode.tsx   # Main dictation UI
│       │   └── SettingsPanel.tsx   # Settings UI
│       ├── hooks/
│       │   ├── useDeepgram.ts      # Deepgram recording hook
│       │   └── usePostProcessing.ts # Claude AI cleanup hook
│       └── types/
│           └── electron.d.ts       # window.electronAPI types
├── package.json
├── tsconfig.json             # Renderer TypeScript config
├── tsconfig.main.json        # Main process TypeScript config
├── vite.config.ts            # Vite + Vitest config (merged)
├── tailwind.config.js        # Tailwind CSS config
└── postcss.config.js         # PostCSS config
```

---

## Development

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode (Vite + Electron) |
| `npm run build` | Build renderer (Vite) + compile main (tsc) |
| `npm run build:main` | Compile main process only |
| `npm run build:renderer` | Build renderer only |
| `npm run start` | Launch Electron (after build) |
| `npm run package:win` | Build + create signed installer |
| `npm run package:dev` | Build portable dev version (unsigned) |
| `npm test` | Run tests (vitest — config in vite.config.ts) |

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron Main                   │
│  main.ts → manages windows, tray, IPC handlers  │
│  audio.ts → ffmpeg subprocess for mic capture    │
│  deepgram.ts → SDK streaming + batch transcribe  │
│  auth/ → Supabase Auth + encrypted session store │
└───────────────┬─────────────────┬───────────────┘
                │ IPC (preload)   │
┌───────────────▼─────────────────▼───────────────┐
│              Electron Renderer                   │
│  DictationMode.tsx — recording UI + transcript   │
│  SettingsPanel.tsx — all user preferences        │
│  ThemeContext.tsx  — 6 themed color schemes       │
│  useDeepgram.ts   — recording state machine      │
│  usePostProcessing.ts — Claude AI cleanup        │
└─────────────────────────────────────────────────┘
```

---

## Building for Distribution

### Portable (unsigned, for testing)

```powershell
npm run package:dev
```

Output: `release/MacroVox-<version>-portable.exe`

### Production Installer (signed)

```powershell
npm run package:win
```

Output: `release/MacroVox-Setup-<version>.exe` (NSIS installer)

Requires:
- Code signing certificate (SHA1 in `build/electron-builder.json`)
- `CSC_LINK` / `CSC_KEY_PASSWORD` env vars for signing

---

## Configuration Reference

All settings are stored in `localStorage` and synced across windows via IPC.

| Setting | Key | Default | Description |
|---|---|---|---|
| Auto-copy on stop | `dictation_auto_copy` | `false` | Copy transcript to clipboard when recording stops |
| Clear on new recording | `dictation_clear_on_new` | `false` | Delete previous transcript on new recording |
| Auto-paste | `dictation_auto_paste` | `false` | Paste into previously focused app after copy |
| Auto-cutoff | `dictation_auto_cutoff` | `30` | Stop recording after N seconds |
| Transcription mode | `transcription_mode` | `batch` | `batch` or `streaming` |
| Dictation commands | `deepgram_dictation` | `true` | Voice punctuation ("period", "comma") |
| Post-processing | *(always on)* | — | Claude cleans every transcript for Pro subscribers |
| Accessibility context | `post_processing_context` | `""` | Speech pattern hints for Claude |
| Keyword boosting | `deepgram_keywords` | `""` | Newline-separated terms to boost |
| Always on top | `dictation_always_on_top` | `true` | Keep dictation window above others |
| Theme | `app_theme` | `mcrn` | UI theme ID |

---

## License

MIT — © 2026 OK Studio
