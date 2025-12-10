# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MacroVox Desktop (PySide6)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      Main Window                        │    │
│  │                                                         │    │
│  │   ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐  │    │
│  │   │  Repo   │  │   File   │  │  Editor │  │  Voice  │  │    │
│  │   │ Selector│  │   Tree   │  │  Panel  │  │   Bar   │  │    │
│  │   └────┬────┘  └────┬─────┘  └────┬────┘  └────┬────┘  │    │
│  │        │            │             │            │        │    │
│  │        │      (existing)    (new/extend)  (new/extend)  │    │
│  │        └────────────┴──────┬──────┴────────────┘        │    │
│  │                            │                            │    │
│  │                     ┌──────▼──────┐                     │    │
│  │                     │  AppState   │                     │    │
│  │                     │  (signals)  │                     │    │
│  │                     └──────┬──────┘                     │    │
│  └────────────────────────────┼────────────────────────────┘    │
│                               │                                  │
│         ┌─────────────────────┼─────────────────────┐           │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  GitHub     │      │  Deepgram   │      │   Claude    │     │
│  │  Service    │      │  Service    │      │   Service   │     │
│  │  (PyGithub) │      │  (stream)   │      │  (tools)    │     │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘     │
│         │                    │                    │             │
└─────────┼────────────────────┼────────────────────┼─────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  GitHub     │     │  Deepgram   │     │  Anthropic  │
   │  REST API   │     │  WebSocket  │     │  REST API   │
   └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Voice → Action Flow

```
┌──────────────┐
│ User speaks  │
│ (desktop mic)│
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Deepgram     │────▶│  Transcript  │
│ (streaming)  │     │  "create a   │
└──────────────┘     │  file..."    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Context    │
                     │   Builder    │
                     └──────┬───────┘
                            │
      ┌─────────────────────┴─────────────────────┐
      │                                           │
      ▼                                           ▼
┌───────────────┐                        ┌─────────────────┐
│ Current repo  │                        │ Current file    │
│ + branch      │                        │ (if open)       │
└───────────────┘                        └─────────────────┘
      │                                           │
      └─────────────────────┬─────────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Claude     │
                     │   (w/ tools) │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Action     │
                     │   Executor   │
                     └──────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │ createFile │    │ editFile   │    │ navigate   │
  └────────────┘    └────────────┘    └────────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   GitHub     │
                     │   API call   │
                     └──────────────┘
```

---

## LLM Tool Definitions

Claude receives these tools via the Anthropic SDK:

```python
tools = [
    {
        "name": "create_file",
        "description": "Create a new file in the repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path relative to repo root"},
                "content": {"type": "string", "description": "Initial file content"},
                "commit_message": {"type": "string", "description": "Commit message"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "edit_file",
        "description": "Edit/append to an existing file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "new_content": {"type": "string", "description": "New file content"},
                "commit_message": {"type": "string"}
            },
            "required": ["path", "new_content"]
        }
    },
    {
        "name": "delete_file",
        "description": "Delete a file (will prompt for confirmation)",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "commit_message": {"type": "string"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "navigate",
        "description": "Open a file or folder in the UI",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"]
        }
    }
]
```

---

## Screen Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  Repo List  │────▶│  File Tree  │
│   Screen    │     │             │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Editor    │
                                        │   View      │
                                        └─────────────┘

All screens have:
┌─────────────────────────────────────────────┐
│            [Voice Input Bar]                │
│  🎙️  "create a readme file..."             │
└─────────────────────────────────────────────┘
```

---

## File Structure (Updated)

```
MacroVox/
├── run.py
├── config.json
├── requirements.txt
├── .env                    # API keys (gitignored)
│
├── src/
│   ├── __init__.py
│   ├── ui.py               # Main window (existing, extend)
│   ├── recorder.py         # Audio capture (existing)
│   ├── settings.py         # Settings (existing)
│   ├── themes.py           # Themes (existing)
│   │
│   ├── panels/
│   │   ├── __init__.py
│   │   ├── file_browser.py     # Existing (extend for GitHub)
│   │   ├── output_panel.py     # Existing
│   │   ├── terminal.py         # Existing
│   │   └── editor_panel.py     # NEW: text editor + save
│   │
│   └── services/               # NEW folder
│       ├── __init__.py
│       ├── github_service.py   # PyGithub wrapper
│       ├── deepgram_service.py # Streaming STT
│       ├── claude_service.py   # LLM + tool calling
│       └── action_executor.py  # Execute tool results
│
└── designs/                # Planning docs
```

---

## State Management

Using PySide6 signals for reactive updates:

```python
class AppState(QObject):
    """Central state management with Qt signals."""
    
    # Signals
    repo_changed = Signal(object)      # Repository selected
    file_changed = Signal(str, str)    # path, content
    transcript_updated = Signal(str)   # Real-time transcript
    action_executed = Signal(dict)     # Tool call result
    error_occurred = Signal(str)       # Error message
    
    def __init__(self):
        super().__init__()
        self.github_token: str | None = None
        self.current_repo: Repository | None = None
        self.current_branch: str = "main"
        self.current_file_path: str | None = None
        self.current_file_content: str | None = None
        self.voice_status: str = "idle"  # idle, listening, processing
        self.transcript: str = ""
```

---

## PyGithub Usage

```python
from github import Github

# Auth
g = Github(token)
user = g.get_user()

# List repos
repos = user.get_repos()

# Get file content
repo = g.get_repo("owner/repo")
file = repo.get_contents("path/to/file.md")
content = file.decoded_content.decode()

# Create/update file
repo.create_file("path.md", "commit msg", "content")
repo.update_file("path.md", "commit msg", "new content", file.sha)

# Delete file
repo.delete_file("path.md", "commit msg", file.sha)
```

---

## Error States

| Error | User Sees | Recovery |
|-------|-----------|----------|
| No GitHub token | "Enter GitHub token in settings" | Settings dialog |
| Invalid token | "GitHub authentication failed" | Re-enter token |
| Voice service error | "Couldn't connect to Deepgram" | Check API key |
| LLM error | "Claude request failed" | Retry button |
| GitHub API error | "Couldn't save file" | Show details |
| File conflict | "File was modified externally" | Refresh + retry |
