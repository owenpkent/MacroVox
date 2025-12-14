# MacroVox Voice Recorder Roadmap

**Created**: December 13, 2024  
**Direction**: Best Voice-to-Text Workstation (Option B)

---

## Vision

MacroVox is the **fastest, most accurate, most useful voice-to-text tool** for knowledge workers, developers, and creators. It combines low-latency transcription with a powerful editing workflow and flexible output modes.

---

## Core Principles

1. **Speed First** - Sub-500ms latency from speech to visible text
2. **Accuracy Matters** - Leverage DeepGram nova-2 for industry-leading accuracy
3. **Flexible Output** - Support both simple transcription and conversational AI refinement
4. **File Organization** - Make it trivial to find, browse, and manage recordings
5. **Extensibility** - Enable integrations via MCP server and webhooks

---

## Feature Roadmap

### Phase A: File Browser Improvements

**Goal**: Make navigating and managing recordings effortless.

| Feature | Description | Priority |
|---------|-------------|----------|
| **Tag Filtering Sidebar** | Filter tree view by tags (IDEA, TODO, NOTE, etc.) | High |
| **Context Menu** | Right-click to delete, rename, re-tag, or transcribe files | High |
| **Sort Options** | Sort by date, name, duration, or tag | Medium |
| **Search Bar** | Quick filter by filename or tag | Medium |
| **Drag & Drop** | Reorder or move files between folders | Low |
| **Quick Preview** | Hover to see duration, tags, and first line of transcript | Low |
| **Batch Operations** | Select multiple files for delete, re-tag, or bulk transcribe | Low |

### Phase B: Output Mode Selection

**Goal**: Support two distinct workflows in the output panel.

#### Mode 1: Simple Transcription (Default)

Current behavior—voice is transcribed to clean, editable text. User can copy, edit, and export.

```
┌─────────────────────────────────────┐
│  OUTPUT                             │
│  ─────────────────────────────────  │
│                                     │
│  The quick brown fox jumps over     │
│  the lazy dog. This is my voice     │
│  memo about the project status.     │
│                                     │
│  ┌─────────┐ ┌─────────┐            │
│  │ COPY ALL│ │  CLEAR  │            │
│  └─────────┘ └─────────┘            │
│  Words: 24  Characters: 142         │
└─────────────────────────────────────┘
```

#### Mode 2: Conversation Mode (ChatGPT-like)

A conversational AI interface where the user can refine, expand, or transform their transcription through back-and-forth dialogue.

```
┌─────────────────────────────────────┐
│  OUTPUT  [Simple ▼] [Conversation]  │
│  ─────────────────────────────────  │
│                                     │
│  🎤 You (voice):                    │
│  "Here's my rough idea for the      │
│   feature. We need to add filters   │
│   to the file browser."             │
│                                     │
│  🤖 Assistant:                      │
│  I understand you want to add       │
│  filtering to the file browser.     │
│  Should I help you:                 │
│  1. Write a spec for this feature?  │
│  2. Create user stories?            │
│  3. Draft the implementation plan?  │
│                                     │
│  🎤 You (voice):                    │
│  "Option 1, please."                │
│                                     │
│  🤖 Assistant:                      │
│  Here's a draft specification...    │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 🎤 Speak or type...          │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Key Differences**:

| Aspect | Simple Transcription | Conversation Mode |
|--------|---------------------|-------------------|
| **Output** | Raw transcribed text | Chat-style messages |
| **AI Role** | None (just STT) | Interactive assistant |
| **Context** | Single recording | Full conversation history |
| **Use Case** | Meeting notes, dictation | Brainstorming, drafting, refinement |
| **API Usage** | DeepGram only | DeepGram + LLM (Claude/GPT) |

**Implementation Notes**:
- Mode toggle in output panel header
- Conversation mode maintains context window (configurable size)
- User can switch modes mid-session
- Conversation history can be exported as markdown
- Voice input and text input both supported in conversation mode

### Phase C: MCP Client Integration & Voice-Driven Content Creation

**Goal**: Connect MacroVox to external MCP servers for voice-driven content creation workflows—a simplified, voice-first alternative to full IDEs.

#### Vision: Voice-First Writing Workstation

MacroVox becomes a **simplified Claude Code for content creators**. Instead of a full IDE, it provides:

- Voice input → AI processing → file creation/editing
- Connect to GitHub repos for book projects
- Browse file trees, create/edit markdown files by voice
- Simplified workflow compared to IDE + terminal

```
┌─────────────────────────────────────────────────────────────┐
│  MacroVox (MCP Client)                                      │
│                                                             │
│  🎤 "Open my book repo and show me chapter 3"               │
│  🎤 "Add a new section about character development"         │
│  🎤 "Commit these changes with message 'draft chapter 3'"   │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  GitHub     │  │ Filesystem  │  │  Memory/    │
│  MCP Server │  │ MCP Server  │  │  Context    │
└─────────────┘  └─────────────┘  └─────────────┘
```

#### Primary Use Case: Book Writing with GitHub

| You Say | What Happens |
|---------|--------------|
| "Clone my book repo" | GitHub MCP → clones repo to local |
| "Show me the chapter list" | Filesystem MCP → returns tree view |
| "Open chapter-3.md" | Load file into editor panel |
| "Add a paragraph about the sunset" | AI drafts content, inserts at cursor |
| "Read back the last section" | TTS reads content aloud |
| "Commit with message 'added sunset scene'" | GitHub MCP → git commit + push |

#### MCP Servers to Connect

| Server | Purpose |
|--------|---------|
| **GitHub MCP** | Clone repos, branches, commits, PRs, file operations |
| **Filesystem MCP** | Local file read/write, directory trees, search |
| **Memory MCP** | Persistent context about projects, characters, plot notes |
| **Brave Search MCP** | Research while writing |

#### Architecture: Voice → AI → MCP → Action

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Microphone │────▶│   DeepGram   │────▶│   Claude    │
│   Input     │     │   (STT)      │     │   (LLM)     │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                         MCP Tool Calls ────────┤
                                                │
         ┌──────────────────────────────────────┼──────────────────┐
         │                                      │                  │
         ▼                                      ▼                  ▼
┌─────────────────┐              ┌─────────────────┐    ┌─────────────────┐
│  GitHub Server  │              │ Filesystem Srvr │    │  Editor Panel   │
│  (repos, git)   │              │  (files, tree)  │    │  (markdown)     │
└─────────────────┘              └─────────────────┘    └─────────────────┘
```

#### UI Concept: Simplified IDE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▼ MACROVOX                                              ─ □ ✕              │
├───────────────┬─────────────────────────────────────────────────────────────┤
│               │                                                             │
│   PROJECT     │   EDITOR                                                    │
│   ───────     │   ──────────────────────────────────────────────────────    │
│               │                                                             │
│   📁 my-book  │   # Chapter 3: The Journey                                  │
│   ├── ch1.md  │                                                             │
│   ├── ch2.md  │   The sun set over the mountains, casting long shadows     │
│   ├── ch3.md ◀│   across the valley. Sarah paused at the ridge, looking    │
│   ├── ch4.md  │   back at how far she had come.                            │
│   └── notes/  │                                                             │
│                │   |  ← cursor                                              │
├───────────────┤                                                             │
│               ├─────────────────────────────────────────────────────────────┤
│   RECORDINGS  │   VOICE / CHAT                                              │
│   ───────     │   ──────────────────────────────────────────────────────    │
│   📄 idea.wav │                                                             │
│   📄 ch3.wav  │   🎤 "Add a paragraph describing her exhaustion"            │
│               │                                                             │
│               │   🤖 Added: "Her legs ached from the climb, and..."         │
│               │                                                             │
│               │   ┌──────────────────────────────────────────────────────┐  │
│               │   │ 🎤 Speak or type...                                  │  │
│               │   └──────────────────────────────────────────────────────┘  │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

#### Implementation Steps

1. **MCP Client Library** - Integrate Python MCP client SDK
2. **Server Configuration UI** - Settings to add/configure MCP server connections
3. **Project Panel** - File tree from connected filesystem/GitHub
4. **Editor Panel** - Markdown editor with voice-driven insertions
5. **Voice Command Router** - AI interprets intent → calls appropriate MCP tools

#### Future: Optional MCP Server Mode

MacroVox could *also* expose itself as an MCP server (secondary priority):

- Other AI assistants trigger recordings
- Query transcription library
- Voice input as a tool for external agents

### Phase D: Mobile Companion App (Android/iOS)

**Goal**: Pick up your work on any device—seamless cross-platform experience.

#### Vision

A lightweight mobile app that syncs with the desktop MacroVox and connected services:

```
┌─────────────────────────────────────────────────────────────┐
│  Desktop (MacroVox)          ◄──── Sync ────►   Mobile App  │
│  - Full editing               │                - Quick capture│
│  - MCP integrations           │                - Voice memos  │
│  - Project management         │                - Review/edit  │
│                               │                - Push commits │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  GitHub / Cloud Sync  │
                    │  (source of truth)    │
                    └───────────────────────┘
```

#### Mobile App Features

| Feature | Description |
|---------|-------------|
| **Voice Capture** | Quick voice memos that sync to desktop recordings folder |
| **Transcription** | On-device or cloud transcription via DeepGram |
| **Project Browser** | View GitHub repo file trees, open markdown files |
| **Editor** | Simple markdown editor for quick edits |
| **Voice Dictation** | Speak to add content to current file |
| **Git Operations** | Commit, push, pull from mobile |
| **Sync Status** | See what's changed since last desktop session |

#### Sync Architecture

| Approach | Pros | Cons |
|----------|------|------|
| **GitHub as sync layer** | Already using GitHub, no extra infra | Requires commits for every change |
| **Cloud storage (OneDrive/Dropbox)** | Real-time sync, familiar | Conflict resolution complexity |
| **Custom sync server** | Full control, real-time | Hosting cost, maintenance |
| **Local network sync** | No cloud dependency | Only works on same network |

**Recommendation**: Use **GitHub as primary sync** (commits are natural save points for book writing), with optional cloud storage for recordings.

#### Technology Options

| Platform | Stack | Notes |
|----------|-------|-------|
| **Cross-platform** | React Native, Flutter, .NET MAUI | One codebase, both platforms |
| **Native Android** | Kotlin + Jetpack Compose | Best Android experience |
| **Native iOS** | Swift + SwiftUI | Best iOS experience |
| **PWA** | Web app with offline support | Easiest, limited native features |

**Recommendation**: Start with **React Native** or **Flutter** for cross-platform reach, then consider native if needed.

#### Mobile-Specific Considerations

- **Offline Mode**: Queue voice memos and edits for sync when online
- **Battery**: Efficient audio recording, minimize background processing
- **Permissions**: Microphone, file access, notifications
- **Quick Actions**: Widget for instant voice capture
- **Watch Integration**: Apple Watch / Wear OS for ultra-quick memos

#### MVP Scope (Mobile v1)

1. Voice memo capture → sync to desktop/GitHub
2. View project file tree (read-only)
3. Simple markdown viewer
4. Git status and pull

#### Future Mobile Features

- Full markdown editing with voice dictation
- Commit and push from mobile
- Conversation mode (AI chat)
- Offline transcription

---

## Technical Considerations

### Conversation Mode Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Microphone │────▶│   DeepGram   │────▶│   Context   │
│   Input     │     │   (STT)      │     │   Manager   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌──────────────┐            │
                    │   LLM API    │◀───────────┘
                    │ (Claude/GPT) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Output    │
                    │    Panel     │
                    └──────────────┘
```

- **Context Manager**: Maintains conversation history, handles context window limits
- **LLM API**: Anthropic Claude or OpenAI GPT (user-configurable)
- **Streaming**: Both transcription and LLM responses stream to UI

### MCP Server Stack

- Python `mcp` library for server implementation
- JSON-RPC over stdio or HTTP transport
- Integration with existing MacroVox services

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Transcription Latency** | < 500ms speech-to-text |
| **File Browser Load Time** | < 100ms for 1000 files |
| **Conversation Response** | < 2s for LLM reply |
| **MCP Command Latency** | < 500ms for tool execution |
| **Daily Active Usage** | User opens app 5+ days/week |

---

## Open Questions

1. **LLM Provider**: Default to Claude API? Support multiple providers?
2. **Context Persistence**: Save conversation history across sessions?
3. **MCP Security**: How to authenticate MCP clients?
4. **Pricing Model**: Conversation mode uses LLM tokens—pass through cost or bundle?

---

## Next Actions

1. [ ] Implement tag filtering sidebar in file browser
2. [ ] Add right-click context menu for files
3. [ ] Design conversation mode UI mockup
4. [ ] Prototype MCP server with basic tools
5. [ ] Update `VISION.md` to reflect Option B focus
