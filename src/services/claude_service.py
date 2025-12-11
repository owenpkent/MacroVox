"""
MacroVox Claude Service
LLM-powered command interpretation using Anthropic Claude
"""

import json
import threading
from typing import Optional

from PySide6.QtCore import QObject, Signal

import anthropic

from .api_keys import get_api_key, ANTHROPIC_KEY


# Tool definitions for Claude
TOOLS = [
    {
        "name": "run_command",
        "description": "Execute a shell command in the terminal. Use this for single commands like 'dir', 'git status', 'mkdir folder', etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                },
                "explanation": {
                    "type": "string",
                    "description": "Brief explanation of what this command does (shown to user)"
                }
            },
            "required": ["command", "explanation"]
        }
    },
    {
        "name": "run_multiple_commands",
        "description": "Execute multiple shell commands in sequence. Use this when the user's request requires several steps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "command": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": ["command", "explanation"]
                    },
                    "description": "List of commands to execute in order"
                }
            },
            "required": ["commands"]
        }
    },
    {
        "name": "change_directory",
        "description": "Change the current working directory. Use 'cd /d <path>' on Windows.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The directory path to change to"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "clarify",
        "description": "Ask the user for clarification when the request is ambiguous or missing information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The clarifying question to ask the user"
                }
            },
            "required": ["question"]
        }
    }
]

SYSTEM_PROMPT = """You are a voice-controlled terminal assistant for MacroVox. Your job is to interpret voice commands and translate them into shell commands.

Context:
- Operating System: Windows
- Shell: cmd.exe (Windows Command Prompt)
- You have access to run shell commands via the terminal

Guidelines:
1. Interpret the user's natural language request and determine the appropriate shell command(s)
2. For file operations, use Windows commands (dir, mkdir, del, copy, move, type, etc.)
3. For git operations, use standard git commands
4. If the request is ambiguous, use the clarify tool to ask for more information
5. Always provide a brief explanation of what each command does
6. For destructive operations (del, rmdir, format), warn the user in the explanation
7. If you're unsure what the user wants, ask for clarification rather than guessing

Examples of voice commands you might receive:
- "list the files" → dir
- "create a new folder called test" → mkdir test
- "show me the git status" → git status
- "go to the documents folder" → cd /d %USERPROFILE%\\Documents
- "commit my changes with message fixed bug" → git commit -m "fixed bug"
"""


class ClaudeService(QObject):
    """
    Claude-powered command interpretation service.
    
    Signals:
        command_ready: Emits (command, explanation) when a command is ready to execute
        commands_ready: Emits list of (command, explanation) tuples for multiple commands
        clarification_needed: Emits question string when clarification is needed
        response_received: Emits raw response text for display
        error_occurred: Emits error messages
    """
    
    command_ready = Signal(str, str)           # (command, explanation)
    commands_ready = Signal(list)              # [(command, explanation), ...]
    clarification_needed = Signal(str)         # question
    response_received = Signal(str)            # raw response
    error_occurred = Signal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._client: Optional[anthropic.Anthropic] = None
        
    @property
    def is_configured(self) -> bool:
        """Check if Anthropic API key is configured."""
        return get_api_key(ANTHROPIC_KEY) is not None
    
    def _get_client(self) -> Optional[anthropic.Anthropic]:
        """Get or create Anthropic client."""
        if self._client is None:
            api_key = get_api_key(ANTHROPIC_KEY)
            if not api_key:
                self.error_occurred.emit("Anthropic API key not configured")
                return None
            
            try:
                self._client = anthropic.Anthropic(api_key=api_key)
            except Exception as e:
                self.error_occurred.emit(f"Failed to create Anthropic client: {e}")
                return None
                
        return self._client
    
    def interpret_command(self, transcript: str, working_dir: str = None, recent_commands: list = None):
        """
        Interpret a voice transcript and determine the appropriate shell command(s).
        
        Args:
            transcript: The voice transcript to interpret
            working_dir: Current working directory (for context)
            recent_commands: List of recent commands (for context)
        """
        thread = threading.Thread(
            target=self._interpret_command_sync,
            args=(transcript, working_dir, recent_commands),
            daemon=True
        )
        thread.start()
    
    def _interpret_command_sync(self, transcript: str, working_dir: str = None, recent_commands: list = None):
        """Synchronous command interpretation."""
        client = self._get_client()
        if not client:
            return
        
        # Build context message
        context_parts = []
        if working_dir:
            context_parts.append(f"Current directory: {working_dir}")
        if recent_commands:
            context_parts.append(f"Recent commands: {', '.join(recent_commands[-5:])}")
        
        context = "\n".join(context_parts) if context_parts else ""
        
        user_message = f"{context}\n\nUser voice command: {transcript}" if context else f"User voice command: {transcript}"
        
        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )
            
            self._handle_response(response)
            
        except Exception as e:
            self.error_occurred.emit(f"Claude API error: {e}")
    
    def _handle_response(self, response):
        """Handle Claude's response and emit appropriate signals."""
        # Check for tool use
        for block in response.content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input
                
                if tool_name == "run_command":
                    self.command_ready.emit(
                        tool_input["command"],
                        tool_input.get("explanation", "")
                    )
                    return
                    
                elif tool_name == "run_multiple_commands":
                    commands = [
                        (cmd["command"], cmd.get("explanation", ""))
                        for cmd in tool_input["commands"]
                    ]
                    self.commands_ready.emit(commands)
                    return
                    
                elif tool_name == "change_directory":
                    path = tool_input["path"]
                    self.command_ready.emit(
                        f"cd /d {path}",
                        f"Change directory to {path}"
                    )
                    return
                    
                elif tool_name == "clarify":
                    self.clarification_needed.emit(tool_input["question"])
                    return
            
            elif block.type == "text":
                # If Claude responded with text instead of a tool, emit it
                self.response_received.emit(block.text)
