# Task Breakdown

**Timeline**: 1 week (5-7 days)  
**Approach**: Extend existing MacroVox PySide6 app

---

## Day 1: GitHub Integration

### Setup
- [ ] Add new dependencies to requirements.txt (PyGithub, anthropic, deepgram-sdk)
- [ ] Create `src/services/` folder
- [ ] Create `.env` file for API keys
- [ ] Add settings UI for GitHub token input

### GitHub Service
- [ ] Create `github_service.py`
- [ ] Authenticate with personal access token
- [ ] List user's repositories
- [ ] Add repo selector dropdown to UI

**Day 1 Deliverable**: Can enter GitHub token and see list of repos.

---

## Day 2: File Browser + Editor

### Extend FileBrowserPanel
- [ ] Connect to GitHub repo instead of local filesystem
- [ ] Load repo file tree via PyGithub
- [ ] Display folders and files
- [ ] Click file → load content

### Editor Panel
- [ ] Create `editor_panel.py` (QTextEdit-based)
- [ ] Display file content when selected
- [ ] Add Save button → commit to GitHub
- [ ] Show current file path in header

**Day 2 Deliverable**: Can browse GitHub repo files and edit/save them.

---

## Day 3: Deepgram Streaming

### Replace File-Based Recording
- [ ] Create `deepgram_service.py`
- [ ] WebSocket connection to Deepgram
- [ ] Stream audio from sounddevice (existing)
- [ ] Receive real-time transcripts

### Voice UI
- [ ] Add transcript display area
- [ ] Show recording indicator
- [ ] Display interim + final results
- [ ] Clear transcript on new recording

**Day 3 Deliverable**: Can speak and see real-time transcript.

---

## Day 4: Claude Integration

### Claude Service
- [ ] Create `claude_service.py`
- [ ] Define tool schemas (create_file, edit_file, navigate, delete_file)
- [ ] Build prompt with context (repo, current file, transcript)
- [ ] Parse tool call responses

### Context Building
- [ ] Include current repo name
- [ ] Include current file path + content
- [ ] Include file tree structure (summary)

**Day 4 Deliverable**: Can send transcript to Claude and get tool call response.

---

## Day 5: Action Execution

### Action Executor
- [ ] Create `action_executor.py`
- [ ] Implement `create_file` → GitHub API
- [ ] Implement `edit_file` → GitHub API
- [ ] Implement `navigate` → update UI
- [ ] Implement `delete_file` → confirm dialog → GitHub API

### Wire It Together
- [ ] Voice recording → transcript → Claude → action → GitHub
- [ ] Update file browser after changes
- [ ] Show success/error feedback

**Day 5 Deliverable**: Full voice → action pipeline working.

---

## Day 6-7: Polish + Test

### Error Handling
- [ ] Handle API errors gracefully
- [ ] Show user-friendly messages
- [ ] Add retry buttons where appropriate

### UX Polish
- [ ] Loading indicators during API calls
- [ ] Confirm dialog for destructive actions
- [ ] Status bar showing current state

### Testing
- [ ] Test create file flow
- [ ] Test edit file flow
- [ ] Test navigation
- [ ] Test error cases
- [ ] Test with Shure MV7+ mic

**Day 6-7 Deliverable**: Stable, usable prototype.

---

## Task Dependencies

```
Day 1              Day 2              Day 3              Day 4              Day 5
─────              ─────              ─────              ─────              ─────

GitHub Auth ──────▶ File Browser ─────────────────────────────────────────▶ Wire Up
                         │                                                      │
                         ▼                                                      │
                   Editor Panel ──────────────────────────────────────────▶ Actions
                                                                               │
                                   Deepgram ──────▶ Claude ──────────────────▶─┘
```

---

## Blockers & Risks

| Risk | Mitigation |
|------|------------|
| Deepgram Python SDK streaming complexity | Use websockets directly if needed |
| Claude tool-use response parsing | Start with simple JSON, add structure |
| GitHub rate limits | Cache file tree, minimize API calls |
| Audio threading with PySide6 | Use QThread for async operations |

---

## Definition of Done

- [ ] Can authenticate with GitHub (PAT in settings)
- [ ] Can select repo and browse file tree
- [ ] Can view and edit files
- [ ] Can save changes (commits to GitHub)
- [ ] Deepgram transcribes speech in real-time
- [ ] Claude interprets transcript and returns tool calls
- [ ] Tool calls execute GitHub actions
- [ ] UI updates after actions complete

---

## Out of Scope (Phase 2)

- ❌ Mobile/web version
- ❌ GitHub OAuth device flow
- ❌ Multiple branches
- ❌ PR/issue management
- ❌ Syntax highlighting
- ❌ Undo/redo
- ❌ Offline mode

---

## Quick Wins (If Ahead of Schedule)

- [ ] Markdown preview toggle
- [ ] Recent repos list
- [ ] Keyboard shortcut for voice (spacebar hold)
- [ ] Copy file path button
- [ ] Dark/light theme toggle (already have themes)
