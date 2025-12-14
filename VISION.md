# MacroVox Vision Document

## Overview

MacroVox is the **best, fastest, most accurate voice-to-text workstation**. Built with an IDE-inspired multi-panel interface, it combines low-latency transcription (DeepGram), flexible output modes, and powerful file management for voice-driven productivity.

**Core Value Proposition**: Turn speech into clean text fast, reliably, and export it where you need it.

> **Decision**: On December 13, 2024, we chose to focus on being the best voice recorder/transcription tool rather than a voice-controlled IDE. See `designs/phase-1-prototype/decision-point-ide-vs-vtt.md` for rationale.

---

## Interface Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▼ MACROVOX                                                    ─ □ ✕       │
├───────────────┬───────────────────────────────────────┬─────────────────────┤
│               │                                       │                     │
│   FILE        │   TERMINAL / AI CONSOLE               │   OUTPUT            │
│   BROWSER     │   ─────────────────────────────────   │   ─────────────     │
│               │   > claude-code analyze...            │                     │
│   📁 Recordings│   Processing voice input...          │   Transcribed text  │
│   ├── 2024-12 │   ✓ DeepGram connected               │   appears here.     │
│   │   └── ... │   > _                                 │                     │
│   ├── 2024-11 │                                       │   Ready for editing │
│   └── ...     ├───────────────────────────────────────┤   and copying.      │
│               │                                       │                     │
│   Tags:       │   RECORDER                            │   ┌───────────────┐ │
│   • IDEA      │   ─────────────────────────────────   │   │ [ COPY ALL ]  │ │
│   • TODO      │                                       │   └───────────────┘ │
│   • NOTE      │   ● RECORDING    03:42                │                     │
│               │   ◉ Shure MV7+                        │                     │
│               │                                       │                     │
│               │   [IDEA] [TODO] [NOTE] [URGENT]       │                     │
│               │                                       │                     │
│               │   [ ● REC ]  [◫] [⚙]                  │                     │
│               │                                       │                     │
└───────────────┴───────────────────────────────────────┴─────────────────────┘
```

---

## Panel Specifications

### Left Panel: File Browser
- **Purpose**: Navigate recordings organized by date and tags
- **Features**:
  - Tree view of recordings folder
  - Sort by date, name, tag, or duration
  - Quick preview on hover
  - Drag-and-drop support
  - Tag filtering sidebar
  - Search/filter bar

### Middle Top Panel: Terminal / AI Console
- **Purpose**: Interact with AI tools and view processing status
- **Features**:
  - DeepGram connection status indicator
  - Real-time transcription streaming display
  - Command input for Claude Code integration
  - Processing logs and status messages
  - Keyboard input for AI prompts

### Middle Bottom Panel: Recorder (Existing)
- **Purpose**: Core voice recording functionality
- **Features** (existing):
  - Record/Stop button with visual feedback
  - Duration display
  - Microphone selection
  - Tag selection
  - Settings access

### Right Panel: Output / Editor
- **Purpose**: Display and edit transcribed text
- **Features**:
  - Real-time transcription display
  - Editable text area (keyboard input)
  - One-click copy to clipboard
  - Clear/reset button
  - Text formatting preservation
  - Character/word count

---

## DeepGram Integration

### Capabilities
- **Live Transcription**: Real-time voice-to-text during recording
- **Batch Processing**: Transcribe existing audio files
- **Language Support**: Multi-language detection and transcription
- **Punctuation**: Smart capitalization and punctuation

### Implementation
```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Audio Input    │ ──▶  │  DeepGram API   │ ──▶  │  Output Panel   │
│  (Mic/File)     │      │  (Streaming)    │      │  (Editable)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### API Configuration
- API Key stored securely in settings
- Configurable model (nova-2, nova, base)
- Adjustable endpointing for latency tuning
- Confidence threshold for filtering

---

## AI Tool Integration

### Claude Code Integration
- Terminal panel accepts natural language commands
- Process transcriptions with AI assistance
- Generate summaries, extract action items
- Code generation from voice descriptions

### Workflow Example
1. User records voice memo
2. DeepGram transcribes in real-time → Output panel
3. User types command in terminal: "summarize this"
4. Claude processes and returns summary
5. Result appended or replaces output

---

## Technical Architecture

### Dependencies (Additions)
```
deepgram-sdk>=3.0.0    # DeepGram Python SDK
websockets>=12.0       # WebSocket support for streaming
```

### New Modules
- `src/transcription.py` - DeepGram integration
- `src/terminal.py` - Terminal widget and command handling
- `src/file_browser.py` - File tree and navigation
- `src/output_panel.py` - Editable output text area

### Window Dimensions
- **Minimum**: 1200 × 700 px
- **Default**: 1400 × 800 px
- **Panels**: Resizable with splitters

---

## Design Principles

1. **IDE Familiarity**: Users comfortable with VS Code/IDEs feel at home
2. **Voice-First**: Optimize for voice input workflows
3. **Minimal Friction**: One-click copy, auto-transcription
4. **MCRN Aesthetic**: Maintain Expanse-inspired dark theme
5. **Accessibility**: Full keyboard navigation, screen reader support

---

## Phase Roadmap

### Phase 1: Layout Foundation ← CURRENT
- [ ] Implement three-column splitter layout
- [ ] Create placeholder panels with proper styling
- [ ] Migrate existing recorder to middle-bottom panel
- [ ] Add resizable panel dividers

### Phase 2: File Browser
- [ ] Tree widget for recordings folder
- [ ] Date/tag grouping
- [ ] File selection and preview
- [ ] Context menu (delete, rename, re-tag)

### Phase 3: Output Panel
- [ ] Editable QTextEdit with styling
- [ ] Copy All button
- [ ] Clear button
- [ ] Word/character count

### Phase 4: DeepGram Integration
- [ ] API key configuration in settings
- [ ] Live streaming transcription
- [ ] Batch file transcription
- [ ] Connection status indicator

### Phase 5: Output Mode Selection
- [ ] Simple Transcription mode (current behavior)
- [ ] Conversation Mode toggle (ChatGPT-like AI interaction)
- [ ] Context window management for conversation history
- [ ] LLM provider configuration (Claude/GPT)
- [ ] Export conversation as markdown

### Phase 6: MCP Client Integration & Content Creation
- [ ] Integrate Python MCP client SDK
- [ ] Connect to GitHub MCP server (repos, branches, commits)
- [ ] Connect to Filesystem MCP server (file trees, read/write)
- [ ] Project panel with file tree from connected servers
- [ ] Editor panel for markdown with voice-driven insertions
- [ ] Voice command router (AI interprets intent → MCP tool calls)
- [ ] Primary use case: Voice-driven book writing with GitHub

---

## Success Metrics

- **Transcription latency**: < 500ms from speech to text
- **Copy-to-use time**: < 2 seconds from recording end
- **UI responsiveness**: No frame drops during recording
- **Accuracy**: DeepGram nova-2 baseline (industry-leading)
