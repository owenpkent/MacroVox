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

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| **pywinpty** | 2.x+ | Windows PTY for real terminal | ✅ Implemented |
| **deepgram-sdk** | 5.x | File-based speech-to-text | ✅ Implemented |
| **keyring** | 25.x | Secure API key storage (Windows Credential Manager) | ✅ Implemented |
| **anthropic** | 0.40.x | Claude API (tool use) | ✅ Implemented |

---

## Updated requirements.txt

```
PySide6>=6.6.0
sounddevice>=0.4.6
soundfile>=0.12.1
numpy>=1.24.0
pywinpty>=2.0.0

# Voice transcription (pinned to v5.x for API stability)
deepgram-sdk>=5.0.0,<6.0.0

# LLM for command interpretation
anthropic>=0.40.0

# Secure API key storage
keyring>=25.0.0
```

---

## Why These Choices

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
│  TerminalPanel  │ ──────────────▶ │ CommandExecutor │
│   (display)     │   connect to    │ (subprocess)    │
└─────────────────┘                 └─────────────────┘

        NEW                         ┌─────────────────┐
                                    │  ClaudeService  │
                                    │  (tool calling) │
                                    └─────────────────┘
```

---

## API Key Storage

API keys are stored securely using `keyring` (Windows Credential Manager).

**No `.env` file needed** - keys are entered via Settings UI and stored in the OS credential store.

| Key | Storage Location |
|-----|------------------|
| `macrovox_deepgram_api_key` | Windows Credential Manager |
| `macrovox_anthropic_api_key` | Windows Credential Manager |

See `docs/DEEPGRAM_SDK_NOTES.md` for SDK-specific implementation notes.
