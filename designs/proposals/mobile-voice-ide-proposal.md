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

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (Browser)                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │   Monaco    │  │   Voice     │  │   File Explorer         │   │
│  │   Editor    │  │   Input     │  │   + Terminal            │   │
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
     │ Deepgram  │  │    LLM    │  │  Backend  │
     │   API     │  │   (API)   │  │   API     │
     └───────────┘  └───────────┘  └─────┬─────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │  Container  │
                                  │  (per user) │
                                  │  - Files    │
                                  │  - Runtime  │
                                  │  - Shell    │
                                  └─────────────┘
```

---

## Technical Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Editor** | Monaco Editor | VS Code parity, mobile-capable |
| **Frontend** | React + Tailwind | Fast, mobile-responsive |
| **Voice** | Deepgram Nova-2 (WebSocket) | Best streaming STT |
| **LLM** | Claude API / OpenAI | Code generation |
| **Backend** | Node.js + Hono | Lightweight, fast |
| **Containers** | Docker + lightweight orchestration | Isolation, persistence |
| **Storage** | S3-compatible (files) + Postgres (metadata) | Durable, scalable |
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

### Included
- [x] Monaco editor in browser
- [x] GitHub OAuth login
- [x] Clone repo / create new workspace
- [x] File tree (read/write)
- [x] Deepgram voice input (streaming)
- [x] LLM code generation (insert/replace)
- [x] Diff preview before applying
- [x] Basic terminal (run commands)
- [x] Mobile-responsive layout

### Excluded (Later Phases)
- [ ] Multi-file context for LLM
- [ ] Git operations (commit, push, PR)
- [ ] Collaborative editing
- [ ] Custom voice commands
- [ ] Offline support
- [ ] VS Code extension sync

---

## Development Roadmap

### Phase 1: Foundation (Weeks 1-3)
- [ ] Project scaffold (React + Vite)
- [ ] Monaco editor integration
- [ ] GitHub OAuth flow
- [ ] Basic file storage (S3)
- [ ] Mobile-responsive layout

### Phase 2: Voice + AI (Weeks 4-6)
- [ ] Deepgram WebSocket integration
- [ ] Voice input UI (mic button, transcript)
- [ ] LLM integration (Claude API)
- [ ] Context builder (file + cursor)
- [ ] Diff preview component

### Phase 3: Runtime (Weeks 7-8)
- [ ] Container orchestration (Docker)
- [ ] Terminal (xterm.js + WebSocket)
- [ ] Run code button
- [ ] Persistent workspaces

### Phase 4: Polish (Weeks 9-10)
- [ ] Mobile gesture navigation
- [ ] Keyboard shortcuts
- [ ] Error handling + loading states
- [ ] Landing page + docs
- [ ] Beta launch

**Total: ~10 weeks to beta**

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

### Infrastructure (per user)
| Resource | Cost |
|----------|------|
| Container runtime (idle) | ~$0.01/hr |
| Container runtime (active) | ~$0.05/hr |
| Storage (1GB) | ~$0.02/mo |
| Bandwidth | ~$0.01/GB |

### Per-Request Costs (pass-through BYOK)
| Service | Cost |
|---------|------|
| Deepgram | $0.0043/min |
| Claude Sonnet | ~$0.01/request avg |

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

1. **Prototype**: Monaco + Deepgram in a single HTML page (1 day)
2. **Validate mobile audio**: Test mic access on iOS Safari, Android Chrome
3. **Design mockups**: Figma mobile UI flows
4. **Backend spike**: Container orchestration POC
5. **Build MVP**: Execute Phase 1-2 roadmap

---

*Document Version: 1.0*  
*Date: December 2024*
