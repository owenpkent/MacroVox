"""
MacroVox Terminal Panel
Real terminal emulation using pywinpty
"""

import html
import re
from datetime import datetime

from PySide6.QtCore import Qt, Signal, Slot
from PySide6.QtGui import QTextCursor, QKeyEvent
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from ..services.command_executor import CommandExecutor


class TerminalPanel(QFrame):
    """Terminal panel with real PTY support."""
    
    command_entered = Signal(str)  # Emits when user enters a command
    
    def __init__(self, cwd: str = None, parent=None):
        super().__init__(parent)
        self.setObjectName("terminalPanel")
        self.command_history: list[str] = []
        self.history_index = -1
        
        # Initialize command executor
        self._executor = CommandExecutor(cwd=cwd, parent=self)
        self._executor.output_received.connect(self._on_output)
        self._executor.error_occurred.connect(self._on_error)
        
        self._setup_ui()
        self._start_shell()
        
    def _setup_ui(self):
        """Initialize the terminal UI."""
        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # Header with status indicator
        header_layout = QHBoxLayout()
        
        header = QLabel("TERMINAL")
        header.setObjectName("panelHeader")
        header_layout.addWidget(header)
        
        header_layout.addStretch()
        
        self.status_indicator = QLabel("● READY")
        self.status_indicator.setObjectName("statusIndicator")
        header_layout.addWidget(self.status_indicator)
        
        layout.addLayout(header_layout)
        
        # Output area
        self.output = QTextEdit()
        self.output.setObjectName("terminalOutput")
        self.output.setReadOnly(True)
        self.output.setLineWrapMode(QTextEdit.WidgetWidth)
        layout.addWidget(self.output, 1)
        
        # Input line
        input_layout = QHBoxLayout()
        input_layout.setSpacing(8)
        
        prompt = QLabel(">")
        prompt.setObjectName("terminalPrompt")
        input_layout.addWidget(prompt)
        
        self.input_line = QLineEdit()
        self.input_line.setObjectName("terminalInput")
        self.input_line.setPlaceholderText("Enter command...")
        self.input_line.returnPressed.connect(self._on_command_entered)
        input_layout.addWidget(self.input_line, 1)
        
        layout.addLayout(input_layout)
        
    def _start_shell(self):
        """Start the PTY shell session."""
        if self._executor.start():
            self.set_status("CONNECTED", True)
        else:
            self.set_status("DISCONNECTED", False)
            self.log("Failed to start shell. Is pywinpty installed?", "error")
            
    def _show_welcome(self):
        """Show welcome message."""
        self.log("MacroVox Terminal v1.0", "info")
        self.log("Real shell session active", "dim")
        self.log("─" * 40, "dim")
        
    def log(self, message: str, level: str = "normal"):
        """Add a log message to the terminal output."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # Color based on level
        colors = {
            "normal": "#b0bec5",
            "info": "#00d4aa",
            "warning": "#fbbf24",
            "error": "#ff3366",
            "dim": "#546e7a",
            "success": "#4ade80",
        }
        color = colors.get(level, colors["normal"])
        
        html = f'<span style="color: #37474f;">[{timestamp}]</span> <span style="color: {color};">{message}</span>'
        self.output.append(html)
        
        # Scroll to bottom
        cursor = self.output.textCursor()
        cursor.movePosition(QTextCursor.End)
        self.output.setTextCursor(cursor)
        
    def log_command(self, command: str):
        """Log a command that was entered."""
        html = f'<span style="color: #00d4aa; font-weight: bold;">> {command}</span>'
        self.output.append(html)
        
    def set_status(self, status: str, connected: bool = True):
        """Update the status indicator."""
        if connected:
            self.status_indicator.setText(f"● {status}")
            self.status_indicator.setStyleSheet("color: #4ade80;")
        else:
            self.status_indicator.setText(f"○ {status}")
            self.status_indicator.setStyleSheet("color: #546e7a;")
            
    def _on_command_entered(self):
        """Handle command input."""
        command = self.input_line.text().strip()
        if not command:
            return
            
        # Add to history
        self.command_history.append(command)
        self.history_index = len(self.command_history)
        
        # Emit signal
        self.command_entered.emit(command)
        
        # Handle built-in commands first
        if not self._handle_builtin(command):
            # Send to real shell
            self._executor.send_command(command)
        
        # Clear input
        self.input_line.clear()
        
    def _handle_builtin(self, command: str) -> bool:
        """
        Handle built-in terminal commands.
        
        Returns:
            True if command was handled as built-in, False to pass to shell.
        """
        cmd_lower = command.lower().strip()
        
        if cmd_lower == "clear":
            self.output.clear()
            return True
        
        # All other commands go to the real shell
        return False
    
    @Slot(str)
    def _on_output(self, data: str):
        """Handle output from the PTY."""
        # Strip ANSI escape codes for cleaner display
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        clean_data = ansi_escape.sub('', data)
        
        # Escape HTML and preserve whitespace
        escaped = html.escape(clean_data)
        
        # Convert newlines to HTML breaks
        formatted = escaped.replace('\n', '<br>').replace('\r', '')
        
        if formatted.strip():
            self.output.insertHtml(f'<span style="color: #b0bec5; font-family: Consolas, monospace;">{formatted}</span>')
            
            # Scroll to bottom
            cursor = self.output.textCursor()
            cursor.movePosition(QTextCursor.End)
            self.output.setTextCursor(cursor)
    
    @Slot(str)
    def _on_error(self, error: str):
        """Handle errors from the PTY."""
        self.log(error, "error")
            
    def clear(self):
        """Clear the terminal output."""
        self.output.clear()
        
    def send_command(self, command: str):
        """Send a command to the terminal programmatically."""
        self._executor.send_command(command)
        
    def stop(self):
        """Stop the terminal session."""
        self._executor.stop()
        self.set_status("DISCONNECTED", False)
