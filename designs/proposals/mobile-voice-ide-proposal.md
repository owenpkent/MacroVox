# MacroVox Mobile: Voice-First Cloud IDE

## Overview

A **browser-based cloud IDE** built on Monaco with integrated Deepgram voice input, designed for coding from your phone. Type when convenient, speak when it's not.

**Primary use case**: You're on the couch, on the train, or away from your desk—you want to code but typing on a phone keyboard is painful. Speak your intent, let the AI generate code.

---

## The Problem

Mobile coding sucks:
- Phone keyboards aren't made for code (symbols, indentation)
- Existing mobile IDEs are touch-first, not voice-first
- No good way to dictate code naturally
- Cloud IDEs (Codespaces, Gitpod) are desktop-focused

---

## The Solution

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Browser                           │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Monaco Editor                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 1  import express from 'express';              │  │  │
│  │  │ 2  const app = express();                      │  │  │
│  │  │ 3  |                                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  🎤 "add a GET route for slash users that returns    │  │
│  │      a list of users from the database"              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐            │
│  │  🎙️   │  │  📁   │  │  ▶️   │  │  💾   │            │
│  │ Voice  │  │ Files  │  │  Run   │  │ Save   │            │
│  └────────┘  └────────┘  └────────┘  └────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Monaco Editor (Mobile-Optimized)
- Full syntax highlighting, IntelliSense
- Touch-friendly: larger tap targets, gesture navigation
- Responsive layout for portrait/landscape
- Virtual keyboard optional (minimize when using voice)

### 2. Deepgram Voice Input
- Tap mic → speak → see real-time transcript
- Streaming transcription (< 300ms latency)
- Optimized for code vocabulary

### 3. LLM Code Generation
- Voice transcript → LLM prompt
- AI generates/modifies code based on intent
- Preview diff before applying
- Works with cursor position and selection context

### 4. Cloud Workspace
- Persistent file storage
- Run code in cloud container (Node, Python, etc.)
- Terminal access
- GitHub sync

---

## User Flow

```
1. Open macrovox.dev on phone
2. Sign in with GitHub
3. Open existing repo or create new workspace
4. Editor loads with your code
5. Tap 🎙️ mic button
6. Speak: "create a function that validates email addresses"
7. See transcript stream in real-time
8. Release mic (or pause)
9. LLM generates code, shows diff preview
10. Tap "Accept" to insert at cursor
11. Tap ▶️ to run
12. See output in terminal panel
```

---

## Architecture

### ADR-001: GitHub-Only Storage (No S3)

**Decision**: Use GitHub API directly for file storage instead of S3 + containers.

**Rationale**:
- Simpler architecture (no sync logic, no S3 config)
- GitHub is the source of truth anyway
- Cheaper (no storage costs)
- Built-in versioning, branching, history

**Trade-offs**:
- GitHub API rate limits (5000 req/hr authenticated)
- Can't persist uncommitted changes across sessions
- No "draft" mode without polluting git history

**Future**: Add S3 layer only if we hit scale issues or need multi-user shared workspaces.

---

### ADR-002: Two Voice Modes

**Decision**: Support both "Agent" and "Dictation" modes.

| Mode | Behavior |
|------|----------|
| **Agent** | Voice → Claude → Generated code → Accept/Reject |
| **Dictation** | Voice → Direct text insertion at cursor |

**Rationale**: Different use cases need different behaviors. Dictation for comments/strings, Agent for code generation.

---

### ADR-003: BYOK (Bring Your Own Keys)

**Decision**: Users provide their own API keys (stored in localStorage).

**Keys required**:
- GitHub Personal Access Token (repo scope)
- Deepgram API key
- Anthropic API key

**Rationale**: Simplifies MVP, no backend auth needed, users control their own costs.

---

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Browser Only)                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │   Monaco    │  │   Voice     │  │   File Browser          │   │
│  │   Editor    │  │   Input     │  │   (GitHub API)          │   │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘   │
│         │                │                      │                 │
│         └────────────────┼──────────────────────┘                 │
│                          │                                        │
│                    ┌─────▼─────┐                                  │
│                    │  App Core │                                  │
│                    └─────┬─────┘                                  │
└──────────────────────────┼────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌───────────┐  ┌───────────┐  ┌───────────┐
     │ Deepgram  │  │  Claude   │  │  GitHub   │
     │ WebSocket │  │   API     │  │   API     │
     └───────────┘  └───────────┘  └───────────┘
```

**No backend required for MVP.** All API calls happen directly from browser.

---

## Technical Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Editor** | Monaco Editor | VS Code parity, mobile-capable |
| **Frontend** | React + Tailwind | Fast, mobile-responsive |
| **Voice** | Deepgram Nova-2 (WebSocket) | Best streaming STT |
| **LLM** | Claude API / OpenAI | Code generation |
| **Backend** | Node.js + Hono | Lightweight, fast |
| **Containers** | None (MVP) | Future: ephemeral for "Run" feature |
| **Storage** | GitHub API (direct) | No backend needed, git is source of truth |
| **Auth** | GitHub OAuth | Repo access, familiar |
| **Hosting** | Fly.io or Railway | Simple, global edge |

---

## Mobile-First UI Design

### Portrait Mode (Primary)
```
┌─────────────────────┐
│  [≡] project-name   │  ← Header (collapsible file tree)
├─────────────────────┤
│                     │
│                     │
│   Monaco Editor     │  ← 60% of screen
│   (code here)       │
│                     │
│                     │
├─────────────────────┤
│  🎤 Voice Input     │  ← Transcript area
│  "add error hand... │
├─────────────────────┤
│ [🎙️] [📁] [▶️] [⋮] │  ← Action bar
└─────────────────────┘
```

### Key Mobile Optimizations
- **Large touch targets**: Buttons minimum 44x44px
- **Swipe gestures**: Swipe up for terminal, swipe right for files
- **Minimal chrome**: Hide everything except editor and voice
- **Haptic feedback**: Vibrate on voice start/stop
- **Dark mode**: Default for battery + readability

---

## Voice → Code Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Speech    │────▶│  Deepgram   │────▶│ Transcript  │
│             │     │  Streaming  │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Context   │
                                        │   Builder   │
                                        └──────┬──────┘
                                               │
        ┌──────────────────────────────────────┤
        │                                      │
        ▼                                      ▼
┌───────────────┐                    ┌─────────────────┐
│ Current file  │                    │ Cursor position │
│ content       │                    │ / selection     │
└───────────────┘                    └─────────────────┘
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Prompt    │
                    │   Builder   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │     LLM     │
                    │   (Claude)  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Diff View  │
                    │  (Preview)  │
                    └──────┬──────┘
                           │
                      [Accept]
                           │
                           ▼
                    ┌─────────────┐
                    │   Monaco    │
                    │   (Apply)   │
                    └─────────────┘
```

### Context-Aware Prompting

The LLM receives:
```json
{
  "transcript": "add a GET route for /users that returns users from database",
  "file": "src/index.ts",
  "fileContent": "import express from 'express';\nconst app = express();\n\n",
  "cursorLine": 3,
  "selection": null,
  "language": "typescript",
  "recentFiles": ["src/db.ts", "src/types.ts"]
}
```

LLM responds with:
```json
{
  "action": "insert",
  "position": { "line": 3 },
  "code": "app.get('/users', async (req, res) => {\n  const users = await db.query('SELECT * FROM users');\n  res.json(users);\n});\n"
}
```

---

## MVP Scope (Phase 1)

### Included (MVP - Implemented)
- [x] Monaco editor in browser
- [x] GitHub PAT auth (BYOK)
- [x] Browse repos / file tree via GitHub API
- [x] Load/save files (commits directly to GitHub)
- [x] Deepgram voice input (streaming WebSocket)
- [x] LLM code generation (Claude API)
- [x] Accept/Reject preview before applying
- [x] Mobile-responsive layout
- [x] **Two modes: Agent vs Dictation**
- [x] Auto language detection from file extension

### Excluded (Later Phases)
- [ ] GitHub OAuth (currently using PAT)
- [ ] Multi-file context for LLM
- [ ] Git operations UI (branch, PR)
- [ ] Terminal / Run code (needs containers)
- [ ] Collaborative editing
- [ ] Custom voice commands
- [ ] Offline support

---

## Development Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Project scaffold (React + Vite + Tailwind)
- [x] Monaco editor integration (mobile-optimized)
- [x] GitHub API integration (PAT auth, file browse/load/save)
- [x] Mobile-responsive layout

### Phase 2: Voice + AI ✅ COMPLETE
- [x] Deepgram WebSocket integration (streaming)
- [x] Voice input UI (mic button, transcript area)
- [x] Claude API integration (code generation)
- [x] Context builder (file content + cursor position)
- [x] Accept/Reject preview component
- [x] **Agent vs Dictation mode toggle**

### Phase 3: Runtime (Future)
- [ ] Container orchestration (Docker/Fly.io)
- [ ] Terminal (xterm.js + WebSocket)
- [ ] Run code button
- [ ] Ephemeral workspaces

### Phase 4: App Store Distribution (Future)
- [ ] Add Capacitor to wrap React app in native shell
- [ ] Configure Android build (Android Studio, signed AAB)
- [ ] Configure iOS build (Xcode, provisioning profiles)
- [ ] Google Play submission ($25 one-time)
- [ ] iOS App Store submission ($99/year Apple Developer)

### Phase 5: Production & Multi-User (Future)
- [ ] Deploy to Netlify/Vercel (public URL)
- [ ] Add GitHub OAuth (replace PAT prompt)
- [ ] Add auth provider (Clerk or Supabase)
- [ ] Encrypted API key storage per user
- [ ] Landing page + docs
- [ ] Optional: Managed keys + Stripe billing

**MVP Status: Functional prototype complete in `web/` folder**

---

## App Store Strategy

### ADR-004: Capacitor for Native Distribution

**Decision**: Use Capacitor to wrap existing React web app for app store distribution.

**Rationale**:
- Reuses 100% of existing React/TypeScript code
- Minimal additional work (vs React Native rewrite)
- Full access to native APIs (mic permissions, etc.)
- Single codebase for web + Android + iOS

**Alternative considered**: PWA-only (no app store presence, limited iOS support)

---

### ADR-005: Multi-User Auth Strategy

**Decision**: Phased approach to user authentication.

**Phase A (MVP)**: BYOK - Users provide their own API keys (localStorage)
**Phase B**: GitHub OAuth for login, encrypted key storage
**Phase C**: Optional managed keys with subscription billing

**Recommended stack**:
- **Auth**: Clerk or Supabase Auth (handles OAuth, user management)
- **Key storage**: Supabase DB with row-level security, or Clerk metadata
- **Billing**: Stripe (if monetizing)

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│              Frontend (Netlify/Vercel)           │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│         Auth Provider (Clerk / Supabase)         │
│         - User accounts                          │
│         - Encrypted API key storage              │
│         - Optional: Usage tracking               │
└─────────────────────┬───────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      Deepgram    Claude     GitHub API
```

### Distribution Timeline

| Platform | Effort | Approval Time |
|----------|--------|---------------|
| **PWA** | Done | N/A (web) |
| **Android (Play Store)** | 1 week | 1-3 days |
| **iOS (App Store)** | 2 weeks | 1-2 weeks |

### Requirements

| Platform | Cost | Tools Needed |
|----------|------|-------------|
| Google Play | $25 one-time | Android Studio |
| iOS App Store | $99/year | Mac + Xcode |

---

## API Keys & Configuration

Users provide their own keys (BYOK) initially:

```json
{
  "deepgram": {
    "apiKey": "user-provides"
  },
  "llm": {
    "provider": "anthropic",
    "apiKey": "user-provides",
    "model": "claude-3-5-sonnet-20241022"
  },
  "github": {
    "token": "from-oauth"
  }
}
```

Later: hosted option where we manage keys for subscribers.

---

## Cost Estimates

### Infrastructure (MVP)
| Resource | Cost |
|----------|------|
| Static hosting (Netlify/Vercel) | Free tier |
| No backend | $0 |
| No storage | $0 (GitHub handles it) |

### Per-Request Costs (BYOK - user pays directly)
| Service | Cost |
|---------|------|
| Deepgram | $0.0043/min |
| Claude Sonnet | ~$0.01/request avg |
| GitHub API | Free (5000 req/hr)

### Hosted Pricing (Future)
| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | BYOK only, 10hr/mo runtime |
| Pro | $12/mo | Managed keys, 100hr runtime, 5GB storage |
| Team | $20/user/mo | Shared workspaces, priority support |

---

## Security

- **Container isolation**: Each user gets isolated Docker container
- **No key storage** (BYOK): Keys stored in browser localStorage, never on server
- **GitHub OAuth scopes**: Minimal (repo read/write only)
- **HTTPS everywhere**: TLS for all connections
- **Audio not stored**: Deepgram processes in real-time, no retention

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mobile browser audio issues | Test on iOS Safari, Chrome Android early |
| Monaco performance on phone | Use lightweight mode, limit file size |
| LLM latency on mobile networks | Show loading state, allow cancel |
| Container cold starts | Keep warm pool, optimize image size |
| Deepgram accuracy for code | Vocabulary boosting, post-processing |

---

## Success Metrics

| Metric | Target (3mo post-launch) |
|--------|--------------------------|
| Registered users | 1,000 |
| Weekly active users | 200 |
| Avg session length (mobile) | 15 min |
| Voice inputs per session | 8 |
| Code acceptance rate | 70% |

---

## Competitive Landscape

| Product | Mobile | Voice | Cloud Runtime | LLM Integration |
|---------|--------|-------|---------------|-----------------|
| GitHub Codespaces | ⚠️ | ❌ | ✅ | ❌ |
| Gitpod | ⚠️ | ❌ | ✅ | ❌ |
| Replit Mobile | ✅ | ❌ | ✅ | ✅ |
| CodeSandbox | ⚠️ | ❌ | ✅ | ⚠️ |
| **MacroVox Mobile** | ✅ | ✅ | ✅ | ✅ |

**Differentiation**: Only option with voice-first mobile experience.

---

## Next Steps

1. ✅ **Prototype**: React + Monaco + Deepgram + Claude (COMPLETE)
2. **Validate mobile audio**: Test mic access on iOS Safari, Android Chrome
3. **Deploy PWA**: Host on Netlify/Vercel for public URL
4. **Add GitHub OAuth**: Replace PAT prompt with proper OAuth flow
5. **Add user auth**: Clerk/Supabase for signups + key storage
6. **Capacitor setup**: Wrap for app store distribution
7. **Android release**: Google Play submission
8. **iOS release**: App Store submission (requires Mac)

---

*Document Version: 1.0*  
*Date: December 2024*
