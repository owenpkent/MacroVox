# MacroVox — Standalone Voice Dictation for Desktop

A standalone Electron desktop app for real-time voice dictation powered by [Deepgram](https://deepgram.com). Speak into your microphone, get text. Includes AI-powered transcript cleanup via Claude, system tray integration, global hotkeys, themed UI, and Supabase authentication (email, Google, Facebook) for Pro features.

> **Backend**: Uses [Supabase](https://supabase.com) for auth + database and [Netlify](https://netlify.com) for serverless functions. See [STANDALONE.md](STANDALONE.md) for setup guide.

---

## Features

- **Voice-to-text dictation** — Deepgram nova-2 with batch or streaming modes
- **Global hotkey** — `Ctrl+Space` to toggle recording from any app
- **AI post-processing** — Claude cleans up transcripts automatically (optional)
- **Auto-copy & auto-paste** — transcript goes straight to your clipboard and active app
- **Keyword boosting** — improve recognition of custom terms (e.g. "MacroVox", "OAuth")
- **Themed UI** — 6 built-in themes (MCRN, Mars, Belter, Earth, Protomolecule, Laconia)
- **System tray** — runs in background, toggles with tray icon
- **Email, Google, Facebook login** — Supabase Auth with multiple sign-in options
- **Pro managed keys** — subscribers get Deepgram + Claude API keys managed for them
- **Settings panel** — separate window for all configuration
- **Always-on-top** — dictation window stays above other apps
- **Cross-platform audio** — ffmpeg-based capture (Windows primary, macOS/Linux supported)

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

### 1. Clone the repo

```powershell
git clone https://github.com/owenpkent/MacroVox.git
cd MacroVox
```

### 2. Install the standalone package

The standalone configuration lives in `package.standalone.json`. Copy it over the old `package.json`:

```powershell
Copy-Item package.standalone.json package.json -Force
```

### 3. Install dependencies

```powershell
npm install
```

### 4. Run in development mode

```powershell
npm run dev
```

This will:
1. Compile the main process TypeScript (`src/main/`) → `dist/main/`
2. Start the Vite dev server for the renderer (`src/renderer/`)
3. Launch Electron pointing at the Vite dev server

### 5. Use the app

- The **dictation window** opens on launch
- Press `Ctrl+Space` from any app to toggle recording
- Open **Settings** (gear icon) to configure your Deepgram API key, theme, dictation options, etc.

---

## API Keys

MacroVox needs a **Deepgram API key** for speech-to-text. You have two options:

### Option A: Bring Your Own Key (free tier)

1. Sign up at [console.deepgram.com](https://console.deepgram.com)
2. Create an API key
3. Paste it into the Settings panel under "Voice Recognition"

### Option B: Pro Subscription (managed keys)

1. Sign up or log in with email, Google, or Facebook
2. Subscribe to Pro from the Settings panel
3. Deepgram + Claude keys are automatically provisioned — no setup needed

---

## Project Structure

```
MacroVox/
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
├── package.standalone.json   # Standalone package.json
├── tsconfig.json             # Renderer TypeScript config
├── tsconfig.main.json        # Main process TypeScript config
├── vite.config.ts            # Vite build config
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
├── vitest.config.ts          # Test config
└── STANDALONE.md             # Migration notes from GitConnect
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
| `npm run start:electron` | Launch Electron (after build) |
| `npm run pack` | Package with electron-builder (no installer) |
| `npm run dist` | Build + create installer |
| `npm run dist:dev` | Build portable dev version (unsigned) |
| `npm test` | Run tests (vitest) |

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
npm run dist:dev
```

Output: `release/MacroVox-<version>-portable.exe`

### Production Installer (signed)

```powershell
npm run dist
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
| Post-processing | `post_processing_enabled` | `false` | Clean up transcripts with Claude |
| Accessibility context | `post_processing_context` | `""` | Speech pattern hints for Claude |
| Keyword boosting | `deepgram_keywords` | `""` | Newline-separated terms to boost |
| Always on top | `dictation_always_on_top` | `true` | Keep dictation window above others |
| Theme | `app_theme` | `mcrn` | UI theme ID |

---

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
