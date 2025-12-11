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
│  │   │  File   │  │ Terminal │  │  Output │  │  Voice  │  │    │
│  │   │ Browser │  │  Panel   │  │  Panel  │  │   Bar   │  │    │
│  │   └────┬────┘  └────┬─────┘  └────┬────┘  └────┬────┘  │    │
│  │        │            │             │            │        │    │
│  │   (existing)   (existing)    (existing)   (new/extend)  │    │
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
│  │  Terminal   │      │  Deepgram   │      │   Claude    │     │
│  │  Executor   │      │  Service    │      │   Service   │     │
│  │ (subprocess)│      │  (stream)   │      │  (tools)    │     │
│  └──────┬──────┘      └──────┬──────┘      └──────┬──────┘     │
│         │                    │                    │             │
└─────────┼────────────────────┼────────────────────┼─────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   Local     │     │  Deepgram   │     │  Anthropic  │
   │   Shell     │     │  WebSocket  │     │  REST API   │
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
│ (streaming)  │     │  "list all   │
└──────────────┘     │  py files"   │
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
│ Working dir   │                        │ Recent commands │
│ (cwd)         │                        │ (history)       │
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
                     │   Command    │
                     │   Executor   │
                     └──────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │ run_command│    │ change_dir │    │ confirm    │
  └────────────┘    └────────────┘    └────────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Local      │
                     │   Shell      │
                     └──────────────┘
```

---

## LLM Tool Definitions

Claude receives these tools via the Anthropic SDK:

```python
tools = [
    {
        "name": "run_command",
        "description": "Execute a shell command in the terminal",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to execute"},
                "requires_confirmation": {
                    "type": "boolean", 
                    "description": "True if command is destructive (delete, install, etc.)"
                },
                "explanation": {"type": "string", "description": "Brief explanation of what this command does"}
            },
            "required": ["command"]
        }
    },
    {
        "name": "change_directory",
        "description": "Change the working directory for subsequent commands",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory path (absolute or relative)"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "run_multiple",
        "description": "Execute multiple commands in sequence",
        "input_schema": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of commands to run in order"
                },
                "stop_on_error": {
                    "type": "boolean",
                    "description": "Stop execution if a command fails"
                }
            },
            "required": ["commands"]
        }
    }
]
```

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▼ MACROVOX                                                    ─ □ ✕       │
├───────────────┬───────────────────────────────────────┬─────────────────────┤
│               │                                       │                     │
│   FILE        │   TERMINAL                            │   OUTPUT            │
│   BROWSER     │   ─────────────────────────────────   │   ─────────────     │
│               │   > dir *.py /s                       │                     │
│   📁 Current  │   Processing voice input...          │   Transcribed text  │
│   ├── src/    │   ✓ Command executed                 │   appears here.     │
│   │   └── ... │   > _                                 │                     │
│   ├── docs/   │                                       │   Ready for editing │
│   └── ...     │                                       │   and copying.      │
│               │                                       │                     │
│               ├───────────────────────────────────────┤                     │
│   Working Dir:│                                       │                     │
│   C:\Projects │   VOICE INPUT                         │                     │
│               │   ─────────────────────────────────   │                     │
│   [Change...] │                                       │                     │
│               │   🎙️  "list all python files..."     │                     │
│               │                                       │                     │
│               │   [ ● REC ]  [⚙]                      │                     │
│               │                                       │                     │
└───────────────┴───────────────────────────────────────┴─────────────────────┘
```

All panels have access to:
┌─────────────────────────────────────────────┐
│            [Voice Input Bar]                │
│  🎙️  "show git status..."                  │
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
│   │   ├── file_browser.py     # Existing
│   │   ├── output_panel.py     # Existing
│   │   └── terminal.py         # Existing (extend for command execution)
│   │
│   └── services/               # NEW folder
│       ├── __init__.py
│       ├── deepgram_service.py # Streaming STT
│       ├── claude_service.py   # LLM + tool calling
│       └── command_executor.py # Execute shell commands
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
    cwd_changed = Signal(str)          # Working directory changed
    command_started = Signal(str)      # Command execution started
    command_finished = Signal(str, int)# Command output, exit code
    transcript_updated = Signal(str)   # Real-time transcript
    error_occurred = Signal(str)       # Error message
    
    def __init__(self):
        super().__init__()
        self.working_directory: str = os.getcwd()
        self.command_history: list[str] = []
        self.voice_status: str = "idle"  # idle, listening, processing
        self.transcript: str = ""
        self.pending_confirmation: dict | None = None  # Command awaiting user OK
```

---

## Command Execution

```python
import subprocess
import os

class CommandExecutor:
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.getcwd()
    
    def run(self, command: str) -> tuple[str, int]:
        """Execute command and return (output, exit_code)."""
        result = subprocess.run(
            command,
            shell=True,
            cwd=self.cwd,
            capture_output=True,
            text=True
        )
        output = result.stdout + result.stderr
        return output, result.returncode
    
    def change_dir(self, path: str) -> bool:
        """Change working directory."""
        new_path = os.path.join(self.cwd, path) if not os.path.isabs(path) else path
        if os.path.isdir(new_path):
            self.cwd = os.path.abspath(new_path)
            return True
        return False
```

---

## Error States

| Error | User Sees | Recovery |
|-------|-----------|----------|
| Voice service error | "Couldn't connect to Deepgram" | Check API key |
| LLM error | "Claude request failed" | Retry button |
| Command failed | "Command exited with error" | Show output, allow retry |
| Invalid directory | "Directory not found" | Show current dir, suggest alternatives |
| Permission denied | "Access denied" | Explain, suggest running as admin |
