"""
MacroVox Terminal Panel
Terminal-style console for AI tools and DeepGram status
"""

from datetime import datetime

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QTextCursor
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


class TerminalPanel(QFrame):
    """Terminal panel for AI console and status messages."""
    
    command_entered = Signal(str)  # Emits when user enters a command
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("terminalPanel")
        self.command_history: list[str] = []
        self.history_index = -1
        self._setup_ui()
        self._show_welcome()
        
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
        
    def _show_welcome(self):
        """Show welcome message."""
        self.log("MacroVox Terminal v1.0", "info")
        self.log("Type 'help' for available commands", "dim")
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
        
        # Log and emit
        self.log_command(command)
        self.command_entered.emit(command)
        
        # Handle built-in commands
        self._handle_builtin(command)
        
        # Clear input
        self.input_line.clear()
        
    def _handle_builtin(self, command: str):
        """Handle built-in terminal commands."""
        cmd_lower = command.lower().strip()
        
        if cmd_lower == "help":
            self.log("Available commands:", "info")
            self.log("  help     - Show this help message", "dim")
            self.log("  clear    - Clear terminal output", "dim")
            self.log("  status   - Show connection status", "dim")
            self.log("  version  - Show version info", "dim")
        elif cmd_lower == "clear":
            self.output.clear()
            self._show_welcome()
        elif cmd_lower == "status":
            self.log("DeepGram: Not connected", "warning")
            self.log("AI Console: Ready", "info")
        elif cmd_lower == "version":
            self.log("MacroVox Terminal v1.0.0", "info")
        else:
            self.log(f"Unknown command: {command}", "dim")
            self.log("Type 'help' for available commands", "dim")
            
    def clear(self):
        """Clear the terminal output."""
        self.output.clear()
        self._show_welcome()
