# Tech Stack

## Existing (Already Built)

| Technology | Purpose | Status |
|------------|---------|--------|
| **PySide6** | Desktop UI framework | ✅ Built |
| **sounddevice** | Audio capture | ✅ Built |
| **soundfile** | Audio file writing | ✅ Built |
| **FileBrowserPanel** | File tree UI | ✅ Built |
| **TerminalPanel** | Terminal emulator | ✅ Built |
| **OutputPanel** | Text output display | ✅ Built |
| **VoiceRecorder** | Mic recording | ✅ Built |
| **Themes** | Dark/light mode | ✅ Built |

## New Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| **PyGithub** | 2.x | GitHub API client |
| **deepgram-sdk** | 3.x | Streaming speech-to-text |
| **anthropic** | 0.40.x | Claude API (tool use) |
| **websockets** | 12.x | For Deepgram streaming |

---

## Updated requirements.txt

```
PySide6>=6.6.0
sounddevice>=0.4.6
soundfile>=0.12.1
numpy>=1.24.0

# New for GitHub + Voice + LLM
PyGithub>=2.1.0
deepgram-sdk>=3.0.0
anthropic>=0.40.0
websockets>=12.0
python-dotenv>=1.0.0
```

---

## Why These Choices

### PyGithub
- Mature, well-documented
- Handles auth, pagination, rate limits
- Simple file CRUD operations

### Deepgram SDK (Python)
- Official SDK with streaming support
- WebSocket-based real-time transcription
- Nova-2 model for accuracy

### Anthropic SDK
- Native tool-use support
- Structured JSON responses
- Best code understanding

---

## Architecture Fit

```
Existing MacroVox                    New Components
─────────────────                    ──────────────

┌─────────────────┐                 ┌─────────────────┐
│   VoiceRecorder │ ──────────────▶ │ DeepgramStream  │
│   (sounddevice) │   replace with  │ (real-time STT) │
└─────────────────┘                 └─────────────────┘

┌─────────────────┐                 ┌─────────────────┐
│ FileBrowserPanel│ ──────────────▶ │ GitHubBrowser   │
│   (local files) │   extend for    │ (repo files)    │
└─────────────────┘                 └─────────────────┘

┌─────────────────┐                 ┌─────────────────┐
│   OutputPanel   │ ──────────────▶ │   EditorPanel   │
│   (read-only)   │   replace with  │ (edit + save)   │
└─────────────────┘                 └─────────────────┘

        NEW                         ┌─────────────────┐
                                    │  ClaudeService  │
                                    │  (tool calling) │
                                    └─────────────────┘

        NEW                         ┌─────────────────┐
                                    │  GitHubService  │
                                    │  (PyGithub)     │
                                    └─────────────────┘
```

---

## Authentication

### Phase 1: Personal Access Token (Simple)
1. User creates PAT on GitHub (Settings → Developer → Tokens)
2. Paste into MacroVox settings
3. Store in config.json (gitignored) or system keyring

### Phase 2 (Later): Device Flow
1. App shows code + URL
2. User visits URL, enters code
3. App polls for token
4. No redirect needed (desktop-friendly)

---

## Environment Variables

```bash
# .env (gitignored)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

Load with `python-dotenv` or store in config.json.
