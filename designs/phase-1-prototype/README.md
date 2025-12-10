# Phase 1 Prototype: MacroVox GitHub Integration

## Goal

Extend the **existing MacroVox desktop app** (PySide6) with GitHub integration and LLM-powered voice commands. Validate the voice→GitHub workflow before building anything new.

**Timeframe**: 1 week  
**Output**: Desktop app where you can speak commands to create/edit GitHub files

---

## What "Done" Looks Like

1. Open MacroVox on your desktop
2. Sign in with GitHub (via device flow or token)
3. Select a repo from dropdown
4. Click record: "Create a new file called design-notes.md with a header for project planning"
5. Deepgram transcribes in real-time
6. Claude interprets → calls GitHub API
7. File created, appears in file browser
8. Speak: "Add a section about authentication"
9. File updated in GitHub

---

## Why Desktop First

- **Reuse existing code**: PySide6 UI, recorder, file browser, terminal already built
- **No browser quirks**: Native mic access, no CORS issues
- **Faster validation**: ~1 week vs ~3 weeks for web
- **Phone later**: If this works well, port to web for mobile access

---

## Primary Use Cases

- **Planning**: Create markdown docs, outlines, task lists
- **Documentation**: README files, API docs, design notes
- **Light coding**: Edit files, add functions by voice
- **Ideation**: Capture ideas directly into repo files

---

## Scope

### In Scope
- GitHub authentication (personal access token or device flow)
- Browse repos / select repo
- File tree shows repo contents (extend existing FileBrowserPanel)
- Deepgram streaming (replace file-based recording)
- Claude interprets voice → structured actions
- Execute actions via GitHub API (create/edit/delete files)
- Editor panel for viewing/editing file content

### Out of Scope (Phase 2)
- Mobile/web version
- PR / issue management
- Multi-branch support
- Collaborative editing
- Offline mode

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
2. **GitHub API via PyGithub** — Well-maintained, easy to use
3. **Deepgram streaming** — Replace file-based recording with real-time
4. **Claude tool-use** — LLM returns structured actions, we execute them
5. **PAT for auth** — Personal access token (simple), device flow later

---

## Voice Command Examples

| You Say | Claude Returns | Action |
|---------|----------------|--------|
| "Create a file called todo.md" | `{tool: "create_file", path: "todo.md"}` | GitHub API creates file |
| "Add a checklist for MVP features" | `{tool: "edit_file", content: "- [ ] ..."}` | Appends to current file |
| "Open the readme" | `{tool: "navigate", path: "README.md"}` | Opens file in editor |
| "Delete the old notes file" | `{tool: "delete_file", path: "notes.md"}` | Deletes (with confirm) |

---

## Success Criteria

- [ ] Can authenticate with GitHub (PAT)
- [ ] Can select a repo and see file tree
- [ ] Deepgram streams transcript in real-time
- [ ] Claude interprets and returns tool calls
- [ ] Can create a new file entirely by voice
- [ ] Can edit existing file content by voice
- [ ] Changes appear in GitHub immediately
- [ ] Voice latency < 500ms (speech → text visible)
