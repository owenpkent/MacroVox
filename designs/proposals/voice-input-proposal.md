# MacroVox Voice Input: Speak to Your AI Coding Assistant

## Overview

A **voice-to-text input layer** for AI coding assistants. Instead of typing prompts to Cursor, Copilot, or Claude, users speak naturally. The transcript becomes the prompt—the LLM handles interpretation and executes agentic actions.

**Not**: "Voice controls the editor"  
**Yes**: "Voice is how you talk to the AI"

---

## The Problem

Typing prompts to AI assistants interrupts flow:
- Context-switching from code to chat
- Describing code locations is tedious ("on line 47, in the function that...")
- Long prompts take time to type
- RSI concerns for heavy users

ChatGPT and Cursor have voice input, but it's basic—no optimization for code contexts, developer vocabulary, or low-latency streaming.

---

## The Solution

A high-quality voice input system optimized for developer workflows:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Microphone │────▶│  Deepgram   │────▶│  Transcript │
│  (Browser)  │     │  Streaming  │     │  (Text)     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  LLM Agent  │
                                        │  (Existing) │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Editor    │
                                        │   Actions   │
                                        └─────────────┘
```

The voice layer is **just the input**—transcription flows into whatever AI system already exists.

---

## User Experience

### Flow
1. User clicks mic button (or hotkey)
2. Speaks naturally: "Can you refactor this function to use async await instead of promises and add error handling"
3. Real-time transcript appears in chat input
4. User releases mic (or pauses)
5. Transcript submitted as prompt
6. LLM interprets and executes (existing behavior)

### What It Looks Like

```
┌─────────────────────────────────────────────────────────┐
│  AI Chat                                            [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎤 "refactor this function to use async await   │   │
│  │    instead of promises and add error handling"  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────┐  ┌────┐  │
│  │ refactor this function to use async awai │  │ 🎙️ │  │
│  │ t instead of promises and add error hand │  │    │  │
│  │ ling|                                    │  └────┘  │
│  └──────────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Real-time streaming transcript (words appear as spoken)
- Visual indicator when listening
- Easy cancel/retry

---

## Key Features

### 1. Streaming Transcription
- Words appear in real-time (< 300ms latency)
- No waiting for full utterance to complete
- User can see and correct before submitting

### 2. Developer Vocabulary
Fine-tuned/prompted for:
- Programming terms ("useState", "async", "middleware")
- Code symbols ("camelCase", "snake_case")
- File paths ("src slash components slash button dot tsx")
- Punctuation verbalization ("open paren", "semicolon", "arrow")

### 3. Smart Punctuation
Auto-formatting:
- "new line" → `\n`
- "open curly brace" → `{`
- "triple backtick javascript" → ` ```javascript `
- Natural sentence punctuation inferred

### 4. Hands-Free Mode (Optional)
- Wake word: "Hey Code" or configurable
- Auto-submit after pause detection
- Continuous conversation without clicking

### 5. Context Awareness
Voice input can reference editor state:
- "this function" → current function at cursor
- "this file" → active file
- "the selected code" → current selection
- "line 42" → specific line reference

The AI already understands these—voice just makes them easier to say.

---

## Technical Implementation

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Browser / Extension                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │  Web Audio   │───▶│  WebSocket   │───▶│  UI State   │  │
│  │  API         │    │  Client      │    │  Manager    │  │
│  └──────────────┘    └──────────────┘    └─────────────┘  │
│         │                   │                    │         │
└─────────┼───────────────────┼────────────────────┼─────────┘
          │                   │                    │
          ▼                   ▼                    ▼
   ┌────────────┐     ┌─────────────┐      ┌────────────┐
   │ Mic Access │     │  Deepgram   │      │ Chat Input │
   │ Permission │     │  API        │      │ Injection  │
   └────────────┘     └─────────────┘      └────────────┘
```

### Components

| Component | Responsibility |
|-----------|----------------|
| **AudioCapture** | Mic access, audio chunking, VAD (voice activity detection) |
| **TranscriptionClient** | WebSocket to Deepgram, streaming results |
| **TranscriptBuffer** | Accumulates words, handles corrections, interim vs final |
| **UIController** | Mic button state, transcript display, submission |
| **SettingsManager** | Hotkeys, wake word, auto-submit preferences |

### Integration Points

**Option A: Browser Extension**
- Injects into Cursor, ChatGPT, Claude web UIs
- Adds mic button to chat inputs
- Types transcript into existing input field
- Works with any web-based AI chat

**Option B: Desktop App (Electron)**
- Standalone window, always-on-top
- Clipboard integration (copy transcript)
- Global hotkey to activate
- Works with any application

**Option C: VS Code Extension**
- Native integration with Copilot Chat / Cursor
- Access to editor context
- Deepest integration, narrowest reach

**Recommended: Start with Option A** (browser extension)—widest compatibility, fastest to build.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Audio Capture | Web Audio API |
| Speech-to-Text | Deepgram Nova-2 (streaming) |
| Extension | Chrome Extension Manifest V3 |
| UI | Preact (lightweight) |
| State | Zustand |
| Build | Vite |

### Why Deepgram?
- **Streaming**: Real-time partial results
- **Speed**: ~300ms latency
- **Accuracy**: Top-tier for technical speech
- **Developer vocabulary**: Better than Whisper for code terms
- **Affordable**: $0.0043/min (Nova-2)

---

## Configuration

```json
{
  "transcription": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en-US",
    "punctuate": true,
    "smartFormat": true
  },
  "behavior": {
    "hotkey": "Ctrl+Shift+V",
    "autoSubmit": false,
    "autoSubmitDelay": 1500,
    "wakeWord": null,
    "showInterimResults": true
  },
  "vocabulary": {
    "boost": ["useState", "async", "await", "middleware", "GraphQL"],
    "replacements": {
      "open paren": "(",
      "close paren": ")",
      "new line": "\n",
      "triple backtick": "```"
    }
  }
}
```

---

## Development Roadmap

### Phase 1: MVP (2-3 weeks)
- [ ] Chrome extension scaffold
- [ ] Mic capture + Deepgram WebSocket
- [ ] Basic UI (mic button, transcript display)
- [ ] Inject into ChatGPT web UI
- [ ] Manual submit (Enter key)

### Phase 2: Polish (2-3 weeks)
- [ ] Cursor / Claude web support
- [ ] Hotkey activation
- [ ] Auto-submit on pause
- [ ] Interim results display
- [ ] Settings page

### Phase 3: Intelligence (2-3 weeks)
- [ ] Vocabulary boosting
- [ ] Smart punctuation/formatting
- [ ] Voice commands ("cancel", "clear", "submit")
- [ ] Usage analytics (local only)

### Phase 4: Distribution (1-2 weeks)
- [ ] Chrome Web Store listing
- [ ] Firefox port
- [ ] Landing page
- [ ] Documentation

**Total: ~8-10 weeks to public release**

---

## Cost Analysis

### Per-User Costs

| Usage Level | Minutes/Month | Deepgram Cost |
|-------------|---------------|---------------|
| Light | 60 min | $0.26 |
| Medium | 300 min | $1.29 |
| Heavy | 1000 min | $4.30 |

### Business Model Options

**Option 1: Freemium**
- Free: 60 min/month
- Pro: $5/month for 500 min
- Unlimited: $15/month

**Option 2: BYOK (Bring Your Own Key)**
- Free extension
- User provides Deepgram API key
- Premium features for supporters

**Option 3: Open Source + Hosted**
- Extension is open source
- Hosted proxy for convenience ($5/month)
- Self-host for free

**Recommendation**: Start with Option 2 (BYOK) for zero infrastructure cost, add hosted option later.

---

## Competitive Analysis

| Product | Voice Input | Streaming | Developer Optimized | Open |
|---------|-------------|-----------|---------------------|------|
| ChatGPT Voice | ✅ | ❌ (batch) | ❌ | ❌ |
| Cursor Voice | ✅ | ⚠️ | ⚠️ | ❌ |
| Whisper (local) | ✅ | ❌ | ❌ | ✅ |
| **MacroVox Voice** | ✅ | ✅ | ✅ | ✅ |

### Our Advantages
1. **Streaming**: See words as you speak, not after
2. **Developer vocabulary**: Trained on code terminology
3. **Universal**: Works with any AI chat, not locked to one
4. **Configurable**: Hotkeys, auto-submit, wake word
5. **Open source**: Trustworthy, extensible

---

## Privacy & Security

- **No audio storage**: Processed in real-time, discarded
- **No transcript storage**: Stays in browser, never hits our servers
- **BYOK model**: User's API key, user's data
- **Open source**: Auditable code
- **Minimal permissions**: Only mic + active tab

---

## Success Metrics

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| Chrome Web Store installs | 5,000 |
| Weekly active users | 1,000 |
| Avg. voice inputs/user/day | 10 |
| User rating | 4.5+ stars |
| Latency (speech → text visible) | < 400ms |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deepgram pricing changes | Abstract provider, add Whisper fallback |
| Browser API changes | Follow Manifest V3 best practices |
| Low adoption | Focus on RSI community, accessibility advocates |
| Competition from Cursor/ChatGPT | Stay universal, stay open, move fast |

---

## Next Steps

1. **Validate**: Post concept on Twitter/Reddit, gauge interest
2. **Prototype**: Build minimal extension for ChatGPT in 1 week
3. **Dogfood**: Use daily for 2 weeks, iterate
4. **Beta**: Share with 50 users, collect feedback
5. **Launch**: Chrome Web Store + Product Hunt

---

## Appendix: Example Voice Inputs

| Spoken | Transcribed | AI Interprets As |
|--------|-------------|------------------|
| "refactor this to use async await" | "refactor this to use async await" | Refactor current selection/function |
| "add error handling to the fetch call" | "add error handling to the fetch call" | Wrap fetch in try/catch |
| "explain what this code does" | "explain what this code does" | Explain selected/visible code |
| "create a new file called utils dot ts with a debounce function" | "create a new file called utils.ts with a debounce function" | Create file + generate code |
| "find all usages of get user" | "find all usages of getUser" | Search for references |
| "run the tests" | "run the tests" | Execute test command |

The key insight: **the AI already knows how to do these things**—voice just makes asking easier.

---

*Document Version: 1.0*  
*Date: December 2024*
