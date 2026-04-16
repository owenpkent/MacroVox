# LLM Onboarding — MacroVox

Quick reference for AI assistants working on this repository.

---

## Project Overview

**Name:** MacroVox  
**Purpose:** Managed voice dictation app for Windows — speak, get text, auto-paste into any app.  
**Status:** Active — Tauri migration complete, Stripe/Netlify deployment in progress

## About the Owner

Owen — wheelchair user with muscular dystrophy.

- **Typing is hard** — Be proactive. Make decisions. Don't ask for confirmation on small things.
- **Offer A/B/C choices** — He can type one letter instead of explaining.
- **Windows dev environment** — Use Unix shell syntax in Claude Code (bash), PowerShell only when suggesting manual commands.
- **Accessibility matters** — MacroVox is a tool Owen actually uses daily.

---

## Key Files

| File | Purpose |
|------|---------|
| `run.py` | Dev launcher — runs `npx tauri dev`, checks prerequisites |
| `src-tauri/tauri.conf.json` | Tauri app config — window declarations, devUrl, frontendDist |
| `src-tauri/capabilities/default.json` | Tauri IPC permissions for all windows |
| `src-tauri/src/commands.rs` | All Tauri IPC commands (audio, Deepgram, clipboard, windows) |
| `src-tauri/src/lib.rs` | App setup — plugins, global shortcut, tray, close handler |
| `src-tauri/src/state.rs` | Shared Rust app state (audio, recording, settings, hotkey, language) |
| `src-tauri/src/deepgram_ws.rs` | Deepgram WebSocket streaming (language, numerals, keywords) |
| `src-tauri/src/voice_buffer.rs` | Dictation history — OGG Opus buffer, manifest, eviction |
| `src/renderer/lib/tauri-ipc.ts` | Frontend IPC bridge — all `invoke()` calls |
| `src/renderer/lib/auth.ts` | Supabase JS SDK auth (sign in, sign up, subscription) |
| `src/renderer/lib/supabase.ts` | Supabase client singleton (reads VITE_SUPABASE_* from .env) |
| `src/renderer/components/DictationMode.tsx` | Main dictation UI — recording, transcript, tabs |
| `src/renderer/components/SettingsPanel.tsx` | Settings window UI |
| `src/renderer/components/AgentiveWriting.tsx` | Write tab — speak a request, Claude writes it |
| `src/renderer/ThemeContext.tsx` | Theme provider — applies CSS variables, syncs across windows |
| `src/renderer/themes.ts` | 6 theme definitions (MCRN, Mars, Belter, Earth, Protomolecule, Laconia) |
| `docs/STATUS_AND_ROADMAP.md` | Current status, known issues, next steps |
| `docs/CHANGELOG.md` | Detailed fix history |
| `docs/SETUP.md` | Backend infrastructure guide (Supabase + Netlify + Stripe) |
| `.env` | Local env vars — `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (not committed) |

---

## Tech Stack

- **Renderer:** TypeScript, React 18, Vite 6, Tailwind CSS
- **Backend:** Rust, Tauri 2
- **Audio:** cpal (WASAPI on Windows)
- **STT:** Deepgram nova-2 (WebSocket streaming default, batch fallback)
- **AI:** Claude Haiku (transcript cleanup) + Claude Sonnet (agentic writing), via Netlify proxy
- **Auth:** Supabase JS SDK (email/password, session in localStorage)
- **Billing:** Stripe (via Supabase Edge Functions)
- **Paste:** enigo (native Windows input simulation)

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Rust / Tauri 2                  │
│  lib.rs       — app setup, tray, global shortcut  │
│  commands.rs  — IPC commands (audio, windows, ...) │
│  state.rs     — shared AppState (Mutex-wrapped)   │
└───────────────────┬──────────────────────────────┘
                    │  invoke() / emit()
┌───────────────────▼──────────────────────────────┐
│              React Renderer (Vite)                │
│  dictation.html + dictation.tsx  — main window    │
│  settings.html + settings.tsx    — settings window│
│  tauri-ipc.ts  — typed invoke() wrappers          │
│  auth.ts       — Supabase JS SDK calls            │
└──────────────────────────────────────────────────┘
```

Both windows are declared in `tauri.conf.json` with `"visible": false`.  
`settings_open_window` just calls `show()` + `set_focus()` on the pre-created window.

**Critical Tauri 2 gotcha:** `WebviewUrl::App` on programmatically-created windows always uses `tauri://localhost` (frontendDist), never `devUrl`. Declare all windows in `tauri.conf.json` to get correct URL resolution in both dev and production.

---

## AI Collaboration (Sequential Handoffs)

Owen frequently switches between AI assistants on the same local repository. When picking up:

- Run `git status` and `git diff` immediately — the previous AI may have been cut off mid-task.
- If `.git/index.lock` exists and is stale, ask permission to delete it.
- If the git repo seems broken, run: `git config --local --unset extensions.worktreeConfig`
- Commit a `wip:` checkpoint before handing off or ending a session.

---

## Git Commits

Conventional commits, no `Co-Authored-By` trailers:

```
feat: add new feature
fix: correct bug
docs: update documentation
refactor: restructure code
chore: maintenance
```

---

## Quick Start

```powershell
# Prerequisites: Node 20+, Rust, cargo
python run.py        # starts Vite + compiles Rust + opens app window
```

Or directly:
```powershell
npx tauri dev
```

Tests:
```powershell
npm test             # Vitest (JS)
npm run test:rust    # cargo test
```

---

## Constellation

This repo is tracked by [Constellation](https://github.com/owenpkent/constellation).

Dashboard picks up:
1. `README.md` with a `## Status` section
2. `TODO.md` with `- [ ]` / `- [x]` checkboxes
3. Repo path in Constellation's `projects.yaml`
