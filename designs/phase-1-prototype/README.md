# Phase 1 Prototype: MacroVox Voice-Controlled Terminal

## Goal

Extend the **existing MacroVox desktop app** (PySide6) with a voice-controlled terminal where an LLM can interpret commands and execute them. Validate the voice→terminal workflow before building more complex integrations.

**Timeframe**: 1 week  
**Output**: Desktop app where you can speak commands and an LLM executes them in a terminal

---

## What "Done" Looks Like

1. Open MacroVox on your desktop
2. Click record: "List all Python files in the current directory"
3. Deepgram transcribes in real-time
4. Claude interprets → generates shell command
5. Command executes in embedded terminal
6. Output displayed to user
7. Speak: "Create a new folder called 'notes' and add a readme file"
8. Commands execute sequentially in terminal

---

## Why Desktop First

- **Reuse existing code**: PySide6 UI, recorder, file browser, terminal already built
- **No browser quirks**: Native mic access, no sandboxing issues
- **Faster validation**: ~1 week vs ~3 weeks for web
- **Full terminal access**: Can run any shell command the user has access to

---

## Primary Use Cases

- **File operations**: Create, move, copy, delete files/folders by voice
- **Git commands**: Commit, push, pull, branch operations
- **Dev workflows**: Run scripts, start servers, install packages
- **System tasks**: Navigate directories, search files, check status

---

## Scope

### In Scope
- Deepgram streaming (real-time voice transcription)
- Claude interprets voice → shell commands
- Execute commands in embedded terminal
- Display command output
- Working directory selection
- Command confirmation for destructive operations

### Out of Scope (Phase 2)
- Mobile/web version
- Direct API integrations (GitHub, etc.)
- Multi-terminal sessions
- Command history persistence
- Custom command aliases

---

## Documents in This Folder

| File | Description |
|------|-------------|
| `README.md` | This overview |
| `tech-stack.md` | Technology choices and rationale |
| `architecture.md` | System design and data flow |
| `tasks.md` | Week-by-week task breakdown |

---

## Quick Start (After Build)

```bash
cd MacroVox
pip install -r requirements.txt
python run.py
```

---

## Key Decisions

1. **Extend, don't rebuild** — Add to existing PySide6 app
2. **Shell execution** — Run commands via subprocess in embedded terminal
3. **Deepgram streaming** — Replace file-based recording with real-time
4. **Claude tool-use** — LLM returns structured commands, we execute them
5. **Safety first** — Confirm destructive commands before execution

---

## Voice Command Examples

| You Say | Claude Returns | Terminal Executes |
|---------|----------------|-------------------|
| "List all Python files" | `{"command": "dir *.py /s"}` | `dir *.py /s` |
| "Create a folder called docs" | `{"command": "mkdir docs"}` | `mkdir docs` |
| "Show git status" | `{"command": "git status"}` | `git status` |
| "Install requests library" | `{"command": "pip install requests", "confirm": true}` | Prompts, then runs |
| "Delete the temp folder" | `{"command": "rmdir /s temp", "confirm": true}` | Prompts, then runs |

---

## Success Criteria

- [ ] Deepgram streams transcript in real-time
- [ ] Claude interprets and returns shell commands
- [ ] Commands execute in embedded terminal
- [ ] Output displays correctly
- [ ] Destructive commands require confirmation
- [ ] Can change working directory
- [ ] Voice latency < 500ms (speech → text visible)
