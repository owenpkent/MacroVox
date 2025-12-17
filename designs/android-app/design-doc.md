# MacroVox Android App Design Document

**Created**: December 16, 2024  
**Status**: Planning  
**Vision**: Cursor/Obsidian for Android — a mobile Markdown editor with AI chat

---

## Overview

MacroVox Android is a **voice-first Markdown editor** with integrated AI chat. It's designed for:

- Writing and editing Markdown documents on mobile
- AI-assisted content creation via voice or text
- Syncing with GitHub repos for book/documentation projects
- Quick voice memos that transcribe and integrate into documents

**Core Philosophy**: Simple, fast, accessible. Not a full IDE — a focused writing tool.

---

## Target Users

1. **Writers** — Drafting books, articles, notes on the go
2. **Developers** — Editing docs, READMEs, taking voice notes
3. **Knowledge workers** — Meeting notes, brainstorming, idea capture
4. **Owen** — Accessibility-focused, voice-driven workflows

---

## Feature Specifications

### 1. Markdown Editor

**Purpose**: Edit Markdown files with syntax highlighting and preview.

| Feature | Priority | Description |
|---------|----------|-------------|
| Syntax highlighting | P0 | Code, headers, links, bold/italic |
| Live preview | P0 | Toggle between edit/preview/split |
| Voice dictation | P0 | Insert text via Android STT or DeepGram |
| Keyboard shortcuts | P1 | Bold, italic, heading, link insertion |
| Find/replace | P1 | Search within document |
| Undo/redo | P0 | Standard editing controls |
| Auto-save | P0 | Save on pause, background save |
| Word/character count | P1 | Status bar display |

**UI Concept**:
```
┌─────────────────────────────────────────┐
│ ← ch3.md                    👁 ⋮        │
├─────────────────────────────────────────┤
│                                         │
│  # Chapter 3: The Journey               │
│                                         │
│  The sun set over the mountains,        │
│  casting long shadows across the        │
│  valley. Sarah paused at the ridge.     │
│                                         │
│  |                                      │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  [B] [I] [H] [🔗] [📝] [🎤]             │
└─────────────────────────────────────────┘
```

### 2. AI Chat Panel

**Purpose**: ChatGPT/Claude-like interface for AI-assisted writing.

| Feature | Priority | Description |
|---------|----------|-------------|
| Text input | P0 | Type messages to AI |
| Voice input | P0 | Speak messages via mic button |
| Streaming responses | P0 | Real-time token streaming |
| Context awareness | P1 | AI knows current document content |
| Insert to editor | P0 | One-tap to insert AI response into doc |
| Conversation history | P1 | Persist chat across sessions |
| Model selection | P2 | Claude, GPT-4, etc. |

**UI Concept**:
```
┌─────────────────────────────────────────┐
│ ← AI Assistant                    ⋮     │
├─────────────────────────────────────────┤
│                                         │
│  🧑 You:                                │
│  Help me make this paragraph clearer    │
│                                         │
│  🤖 Claude:                             │
│  Here's a revised version:              │
│                                         │
│  "The mountain sunset painted long      │
│  shadows across the valley below.       │
│  Sarah stopped at the ridge, turning    │
│  to measure how far she'd climbed."     │
│                                         │
│  [📋 Copy] [📝 Insert at Cursor]        │
│                                         │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────┐ [🎤][➤]│
│ │ Type a message...           │         │
│ └─────────────────────────────┘         │
└─────────────────────────────────────────┘
```

**Interaction Modes**:

| Mode | Use Case |
|------|----------|
| **Freeform chat** | General AI conversation |
| **Document context** | "Improve this section" — AI sees current doc |
| **Selection context** | Select text → "Rewrite this" |

### 3. File Browser

**Purpose**: Navigate local files and GitHub repos.

| Feature | Priority | Description |
|---------|----------|-------------|
| Local storage | P0 | Browse device storage |
| GitHub integration | P1 | Clone, pull, view repo trees |
| Recent files | P0 | Quick access to recent docs |
| Create file/folder | P0 | New .md files |
| Delete/rename | P1 | File management |
| Search | P2 | Find files by name |

**UI Concept**:
```
┌─────────────────────────────────────────┐
│ ← Files                           ⋮     │
├─────────────────────────────────────────┤
│                                         │
│  📁 Local                               │
│  └── 📁 Notes                           │
│      ├── 📄 ideas.md                    │
│      └── 📄 meeting-notes.md            │
│                                         │
│  📁 GitHub: my-book                     │
│  ├── 📄 README.md                       │
│  ├── 📁 chapters                        │
│  │   ├── 📄 ch1.md                      │
│  │   ├── 📄 ch2.md                      │
│  │   └── 📄 ch3.md                      │
│  └── 📁 notes                           │
│                                         │
├─────────────────────────────────────────┤
│  [+ New File]  [🔄 Sync]                │
└─────────────────────────────────────────┘
```

### 4. Voice Recording & Transcription

**Purpose**: Quick voice capture with automatic transcription.

| Feature | Priority | Description |
|---------|----------|-------------|
| Quick record | P0 | FAB or widget for instant capture |
| Transcription | P0 | DeepGram or Android STT |
| Insert transcript | P0 | Add to current doc or new file |
| Recording list | P1 | Browse past recordings |
| Tag recordings | P2 | IDEA, TODO, NOTE labels |

### 5. Git Operations

**Purpose**: Sync work with GitHub.

| Feature | Priority | Description |
|---------|----------|-------------|
| Clone repo | P1 | Clone GitHub repos to device |
| Pull | P1 | Fetch latest changes |
| Commit | P1 | Commit local changes |
| Push | P1 | Push to remote |
| Status | P1 | See uncommitted changes |
| Branch switching | P2 | Switch between branches |

---

## Navigation Structure

```
┌─────────────────────────────────────────┐
│  Bottom Navigation Bar                  │
├───────────┬───────────┬─────────────────┤
│   📁      │    📝     │       🤖        │
│  Files    │  Editor   │    AI Chat      │
└───────────┴───────────┴─────────────────┘
```

**Screen Flow**:
```
Files ──────────────────►  Editor
  │                          │
  │                          ▼
  │                       AI Chat (sheet)
  │                          │
  └──────── Settings ◄───────┘
```

---

## Technical Architecture

### Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | Kotlin | Modern, concise, Android-first |
| **UI** | Jetpack Compose | Declarative, reactive, modern |
| **Architecture** | MVVM + Clean | Separation of concerns, testable |
| **DI** | Hilt | Standard Android DI |
| **Networking** | Retrofit + OkHttp | REST APIs (Anthropic, DeepGram) |
| **Storage** | Room + DataStore | Local DB + preferences |
| **Git** | JGit | Pure Java Git implementation |
| **Markdown** | Markwon | Android Markdown rendering |
| **Editor** | Custom Compose TextField | Full control over editing |

### Module Structure

```
app/
├── core/
│   ├── data/          # Repositories, data sources
│   ├── domain/        # Use cases, entities
│   └── ui/            # Shared UI components, theme
├── features/
│   ├── editor/        # Markdown editor screen
│   ├── files/         # File browser screen
│   ├── chat/          # AI chat screen
│   ├── recording/     # Voice recording
│   └── settings/      # App settings
└── services/
    ├── ai/            # Claude/GPT API clients
    ├── transcription/ # DeepGram integration
    └── git/           # JGit operations
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI Layer  │◄───►│  ViewModel  │◄───►│  Repository │
│  (Compose)  │     │   (State)   │     │   (Data)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
              ┌─────▼─────┐            ┌───────▼───────┐          ┌───────▼───────┐
              │  Room DB  │            │  File System  │          │  Remote APIs  │
              │  (local)  │            │   (storage)   │          │ (AI, GitHub)  │
              └───────────┘            └───────────────┘          └───────────────┘
```

---

## Git & GitHub Integration Options (Core Design Decision)

This is a critical architectural choice that affects offline capability, complexity, and user experience.

### Option A: GitHub REST/GraphQL API Only (No Local Git)

**Approach**: All operations go through GitHub's web API. No local Git repository.

```
┌─────────────┐                    ┌─────────────┐
│   Android   │ ◄── HTTPS API ──► │   GitHub    │
│    App      │                    │   Servers   │
└─────────────┘                    └─────────────┘
```

| Pros | Cons |
|------|------|
| Simple implementation | Requires internet for all operations |
| No Git binary/library needed | No offline editing with sync |
| Small app size | No local commit history |
| Works on all Android versions | Rate limits (5000 req/hr authenticated) |
| Easy authentication (OAuth/PAT) | Can't stage partial changes |

**Best for**: Read-heavy apps, simple file viewers, quick edits.

**API Capabilities**:
- `GET /repos/{owner}/{repo}/contents/{path}` — Read files
- `PUT /repos/{owner}/{repo}/contents/{path}` — Create/update files (requires commit)
- `DELETE /repos/{owner}/{repo}/contents/{path}` — Delete files
- `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` — Full file tree
- `POST /repos/{owner}/{repo}/git/commits` — Create commits (low-level)

### Option B: JGit (Pure Java Git Implementation)

**Approach**: Full Git client running on-device. Clone repos locally, work offline, push when ready.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Android   │ ◄──►│  Local Git  │ ◄──►│   GitHub    │
│    App      │     │  (JGit)     │     │   (remote)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

| Pros | Cons |
|------|------|
| Full offline support | Larger app size (+3-5MB) |
| Real Git history locally | More complex implementation |
| Stage, commit, branch locally | Memory usage for large repos |
| Works exactly like desktop Git | SSH key management complexity |
| No rate limits for local ops | Initial clone can be slow |

**JGit on Android**:
- Eclipse JGit is pure Java, runs on Android
- Used by apps like **SGit**, **MGit**, **Pocket Git**
- Gradle: `implementation 'org.eclipse.jgit:org.eclipse.jgit:6.8.0.202311291450-r'`

**Key Operations**:
```kotlin
// Clone
Git.cloneRepository()
    .setURI("https://github.com/user/repo.git")
    .setDirectory(localPath)
    .setCredentialsProvider(UsernamePasswordCredentialsProvider(token, ""))
    .call()

// Pull
git.pull().setCredentialsProvider(credentials).call()

// Add + Commit
git.add().addFilepattern(".").call()
git.commit().setMessage("Updated chapter 3").call()

// Push
git.push().setCredentialsProvider(credentials).call()
```

**Best for**: Full-featured Git clients, offline-first workflows, power users.

### Option C: Hybrid (GitHub API + Local Git)

**Approach**: Use GitHub API for browsing/quick edits, JGit for offline work and heavy operations.

```
┌─────────────────────────────────────────────────────┐
│                    Android App                       │
├─────────────────────┬───────────────────────────────┤
│   Quick Mode        │   Full Mode                   │
│   (GitHub API)      │   (JGit Local)                │
│   - Browse repos    │   - Clone for offline         │
│   - View files      │   - Full commit history       │
│   - Quick edits     │   - Branch management         │
│   - Single commits  │   - Conflict resolution       │
└─────────────────────┴───────────────────────────────┘
```

| Pros | Cons |
|------|------|
| Flexible per-repo choice | Two code paths to maintain |
| Fast browsing, deep editing | UX complexity (which mode?) |
| Graceful offline fallback | Larger app size |
| Best of both worlds | More testing surface |

**Best for**: Apps that want broad compatibility with deep features for power users.

### Option D: Isomorphic-git (JavaScript)

**Approach**: Use isomorphic-git in a WebView or via wasm.

| Pros | Cons |
|------|------|
| Battle-tested library | Requires WebView/wasm bridge |
| Same code as web apps | Performance overhead |
| Active community | Not native Kotlin |

**Verdict**: Not recommended for native Android. Added complexity without benefit.

### Option E: libgit2 via JNI

**Approach**: Native C library with Kotlin bindings.

| Pros | Cons |
|------|------|
| Very fast, low memory | Complex JNI setup |
| Used by GitHub Desktop | NDK build complexity |
| Full Git compatibility | Per-architecture binaries |

**Verdict**: Overkill for this app. JGit is sufficient.

---

### Authentication Options

| Method | Use Case | Implementation |
|--------|----------|----------------|
| **Personal Access Token (PAT)** | Simple, user-managed | User enters token in Settings |
| **OAuth App** | Proper auth flow | Redirect to GitHub → callback |
| **GitHub App** | Org/enterprise | Complex, not needed here |
| **SSH Keys** | Power users | Generate/import keypair |

**Recommendation**: Start with **PAT** (simplest), add **OAuth** later for better UX.

**OAuth Flow on Android**:
```
1. Open browser: github.com/login/oauth/authorize?client_id=XXX
2. User authorizes
3. GitHub redirects to: macrovox://callback?code=XXX
4. App exchanges code for access token
5. Store token in Android Keystore
```

---

### Recommended Approach

**For MacroVox Android MVP**: 

| Phase | Approach | Rationale |
|-------|----------|-----------|
| **Phase 1** | GitHub API only | Ship fast, validate concept |
| **Phase 2** | Add JGit for "offline repos" | Power user feature |
| **Phase 3** | Hybrid with smart switching | Best UX |

**Phase 1 Implementation**:
- Browse any public repo via API
- Authenticate with PAT for private repos
- Edit files → direct commit via API
- No offline support initially

**Phase 2 Addition**:
- "Download for offline" option per repo
- Uses JGit to clone locally
- Work offline, sync when online
- Full commit control

---

### Comparison Summary

| Criteria | API Only | JGit | Hybrid |
|----------|----------|------|--------|
| **Complexity** | Low | Medium | High |
| **Offline** | ❌ | ✅ | ✅ |
| **App Size** | Small | +5MB | +5MB |
| **Time to MVP** | Fast | Medium | Slow |
| **User Control** | Limited | Full | Full |
| **Recommended** | MVP | V2 | V3 |

---

## API Integrations

### Anthropic Claude API

```kotlin
// Claude messages endpoint
POST https://api.anthropic.com/v1/messages

// Request body
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    {"role": "user", "content": "Help me improve this paragraph..."}
  ],
  "system": "You are a helpful writing assistant..."
}
```

### DeepGram Transcription

```kotlin
// Pre-recorded audio transcription
POST https://api.deepgram.com/v1/listen?model=nova-2

// Real-time via WebSocket
wss://api.deepgram.com/v1/listen
```

### GitHub REST API

```kotlin
// Repository contents
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}

// Using JGit for clone/pull/push operations locally
```

---

## Security & Storage

### API Keys

| Key | Storage | Entry |
|-----|---------|-------|
| Anthropic API Key | Android Keystore (encrypted) | Settings screen |
| DeepGram API Key | Android Keystore (encrypted) | Settings screen |
| GitHub PAT | Android Keystore (encrypted) | GitHub login flow |

### Local Storage

| Data | Location |
|------|----------|
| Markdown files | App-specific external storage |
| Git repos | App-specific external storage |
| Chat history | Room database (encrypted) |
| Settings | DataStore (preferences) |
| Recordings | App-specific external storage |

---

## Accessibility Considerations

Given Owen's needs:

| Feature | Implementation |
|---------|----------------|
| **Voice-first input** | Prominent mic buttons, long-press shortcuts |
| **Large touch targets** | Min 48dp, preferably larger |
| **Minimal typing** | Quick actions, voice commands, templates |
| **TalkBack support** | Full content descriptions |
| **High contrast** | Dark theme default, configurable |
| **Simple navigation** | Minimal depth, predictable layout |

---

## Phase Roadmap

### Phase 1: Core Editor (MVP)
- [ ] Project setup (Kotlin, Compose, Hilt)
- [ ] Basic Markdown editor with syntax highlighting
- [ ] Local file storage (create, read, save)
- [ ] Simple file browser
- [ ] Dark theme

### Phase 2: AI Chat
- [ ] Claude API integration
- [ ] Chat UI with streaming responses
- [ ] Document context passing
- [ ] Insert response to editor

### Phase 3: Voice Input
- [ ] Android STT for dictation
- [ ] DeepGram integration (optional upgrade)
- [ ] Voice recording with transcription
- [ ] Voice-to-AI chat

### Phase 4: GitHub Integration
- [ ] GitHub OAuth / PAT login
- [ ] Clone repository
- [ ] Pull / commit / push
- [ ] Branch viewing

### Phase 5: Polish
- [ ] Markdown preview mode
- [ ] Split view (edit + preview)
- [ ] Widgets for quick capture
- [ ] Settings refinement

---

## Open Questions

1. **Offline-first?** — Should AI chat work offline with cached responses?
2. **Sync strategy** — GitHub-only or also OneDrive/Dropbox?
3. **Editor library** — Custom Compose or wrap existing (e.g., CodeEditor)?
4. **Monetization** — Free with API key entry? Subscription with bundled API?

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Editor load time | < 500ms |
| AI response start | < 1s (streaming) |
| Voice transcription latency | < 1s |
| App size | < 30MB |
| Crash-free sessions | > 99.5% |

---

## Next Actions

1. [ ] Set up Android project with Compose + Hilt scaffold
2. [ ] Implement basic Markdown editor screen
3. [ ] Add local file read/write
4. [ ] Create file browser navigation
5. [ ] Integrate Claude API for chat

