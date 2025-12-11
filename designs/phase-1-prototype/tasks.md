# Task Breakdown

**Timeline**: 1 week (5-7 days)  
**Approach**: Extend existing MacroVox PySide6 app

---

## Day 1: Project Setup + Command Executor

### Setup
- [x] Add new dependencies to requirements.txt (pywinpty, deepgram-sdk, keyring)
- [x] Create `src/services/` folder
- [x] Secure API key storage via keyring (Windows Credential Manager)
- [x] Add settings UI for API key inputs (Deepgram, Anthropic)

### Command Executor Service
- [x] Create `command_executor.py` with pywinpty PTY support
- [x] Implement real shell session (persistent cmd.exe)
- [x] Background thread for output reading
- [x] Qt signals for async output handling

**Day 1 Deliverable**: ✅ Can execute shell commands in real PTY session.

---

## Day 2: Terminal Panel Integration

### Extend Terminal Panel
- [x] Connect terminal panel to CommandExecutor
- [x] Display command output in real-time
- [x] Show connection status indicator
- [ ] Add "Change Directory" button/dialog

### Output Handling
- [x] Stream PTY output to terminal display
- [x] ANSI escape code stripping
- [x] HTML formatting for display

**Day 2 Deliverable**: ✅ Real terminal with persistent shell session working.

---

## Day 3: Deepgram Transcription

### File-Based Transcription (Implemented)
- [x] Create `deepgram_service.py`
- [x] File transcription via DeepGram API
- [x] Auto-transcribe after recording stops
- [x] Display transcript in output panel

### Voice UI
- [x] Transcript displays in output panel
- [x] Recording indicator in terminal
- [x] Transcription status messages

**Day 3 Deliverable**: ✅ Record audio → auto-transcribe → display in output panel.

---

## Day 4: Claude Integration

### Claude Service
- [x] Create `claude_service.py`
- [x] Define tool schemas (run_command, change_directory, run_multiple, clarify)
- [x] Build prompt with context (working dir, recent commands)
- [x] Parse tool call responses

### Context Building
- [x] Include recent command history
- [x] Include OS/shell information in system prompt
- [ ] Include current working directory (future enhancement)

**Day 4 Deliverable**: ✅ Can send transcript to Claude and get shell command response.

---

## Day 5: Wire It Together

### Command Execution Pipeline
- [x] Voice recording → transcript → Claude → command → terminal
- [x] Show command + explanation before execution (in terminal log)
- [x] Add "PROCESS" button for manual AI trigger (user choice)
- [ ] Handle confirmation for destructive commands (future)

### Safety Features
- [ ] Detect destructive commands (rm, del, format, etc.)
- [ ] Show confirmation dialog with command preview
- [ ] Allow user to edit command before running

**Day 5 Deliverable**: ✅ Full voice → command pipeline working (manual trigger via PROCESS button).

---

## Day 6-7: Polish + Test

### Error Handling
- [ ] Handle API errors gracefully
- [ ] Show user-friendly messages
- [ ] Add retry buttons where appropriate

### UX Polish
- [ ] Loading indicators during API calls
- [ ] Command history navigation
- [ ] Status bar showing current state

### Testing
- [ ] Test file operations (mkdir, touch, etc.)
- [ ] Test git commands
- [ ] Test directory navigation
- [ ] Test error cases
- [ ] Test with Shure MV7+ mic

**Day 6-7 Deliverable**: Stable, usable prototype.

---

## Task Dependencies

```
Day 1              Day 2              Day 3              Day 4              Day 5
─────              ─────              ─────              ─────              ─────

Cmd Executor ────▶ Terminal Panel ─────────────────────────────────▶ Wire Up
                                                                               │
                                   Deepgram ──────▶ Claude ──────────────▶─┘
```

---

## Blockers & Risks

| Risk | Mitigation |
|------|------------|
| Deepgram Python SDK streaming complexity | Use websockets directly if needed |
| Claude tool-use response parsing | Start with simple JSON, add structure |
| Destructive command safety | Always require confirmation for rm/del/format |
| Audio threading with PySide6 | Use QThread for async operations |
| Long-running commands blocking UI | Run subprocess in separate thread |

---

## Definition of Done

- [ ] Can execute shell commands via voice
- [ ] Commands run in selected working directory
- [ ] Deepgram transcribes speech in real-time
- [ ] Claude interprets transcript and returns shell commands
- [ ] Destructive commands require confirmation
- [ ] Command output displays in terminal panel
- [ ] UI updates after commands complete

---

## Out of Scope (Phase 2)

- ❌ Mobile/web version
- ❌ Direct API integrations (GitHub, etc.)
- ❌ Multi-terminal sessions
- ❌ Command history persistence
- ❌ Custom command aliases
- ❌ Offline mode

---

## Quick Wins (If Ahead of Schedule)

- [ ] Keyboard shortcut for voice (spacebar hold)
- [ ] Command history with up/down arrows
- [ ] Copy last command output
- [ ] Favorite/saved commands
- [ ] Dark/light theme toggle (already have themes)
