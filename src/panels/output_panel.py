"""
MacroVox Output Panel
Editable text area for transcribed text with copy functionality
"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QTextCursor
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


class OutputPanel(QFrame):
    """Output panel for displaying and editing transcribed text."""
    
    text_changed = Signal(str)  # Emits when text content changes
    process_with_ai = Signal(str)  # Emits text to process with Claude
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("outputPanel")
        self._setup_ui()
        
    def _setup_ui(self):
        """Initialize the output panel UI."""
        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # Header
        header_layout = QHBoxLayout()
        
        header = QLabel("OUTPUT")
        header.setObjectName("panelHeader")
        header_layout.addWidget(header)
        
        header_layout.addStretch()
        
        # Word count
        self.word_count = QLabel("0 words")
        self.word_count.setObjectName("wordCount")
        header_layout.addWidget(self.word_count)
        
        layout.addLayout(header_layout)
        
        # Text editor
        self.text_edit = QTextEdit()
        self.text_edit.setObjectName("outputText")
        self.text_edit.setPlaceholderText("Transcribed text will appear here...\n\nYou can also type directly or paste text.")
        self.text_edit.textChanged.connect(self._on_text_changed)
        layout.addWidget(self.text_edit, 1)
        
        # Button row
        button_layout = QHBoxLayout()
        button_layout.setSpacing(8)
        
        # Clear button
        clear_btn = QPushButton("CLEAR")
        clear_btn.setObjectName("clearBtn")
        clear_btn.clicked.connect(self.clear)
        button_layout.addWidget(clear_btn)
        
        button_layout.addStretch()
        
        # Process with AI button
        self.ai_btn = QPushButton("🤖 PROCESS")
        self.ai_btn.setObjectName("aiBtn")
        self.ai_btn.setToolTip("Send to Claude for command interpretation")
        self.ai_btn.clicked.connect(self._process_with_ai)
        button_layout.addWidget(self.ai_btn)
        
        # Copy button (prominent)
        self.copy_btn = QPushButton("📋 COPY ALL")
        self.copy_btn.setObjectName("copyBtn")
        self.copy_btn.clicked.connect(self.copy_all)
        button_layout.addWidget(self.copy_btn)
        
        layout.addLayout(button_layout)
        
    def _on_text_changed(self):
        """Handle text content changes."""
        text = self.text_edit.toPlainText()
        
        # Update word count
        words = len(text.split()) if text.strip() else 0
        chars = len(text)
        self.word_count.setText(f"{words} words · {chars} chars")
        
        # Emit signal
        self.text_changed.emit(text)
        
    def append_text(self, text: str):
        """Append text to the output (for streaming transcription)."""
        cursor = self.text_edit.textCursor()
        cursor.movePosition(QTextCursor.End)
        cursor.insertText(text)
        self.text_edit.setTextCursor(cursor)
        self.text_edit.ensureCursorVisible()
        
    def set_text(self, text: str):
        """Replace all text in the output."""
        self.text_edit.setPlainText(text)
        
    def get_text(self) -> str:
        """Get the current text content."""
        return self.text_edit.toPlainText()
        
    def clear(self):
        """Clear all text."""
        self.text_edit.clear()
        
    def copy_all(self):
        """Copy all text to clipboard."""
        text = self.text_edit.toPlainText()
        if text:
            clipboard = QApplication.clipboard()
            clipboard.setText(text)
            
            # Visual feedback
            original_text = self.copy_btn.text()
            self.copy_btn.setText("✓ COPIED!")
            self.copy_btn.setProperty("copied", True)
            self.copy_btn.style().unpolish(self.copy_btn)
            self.copy_btn.style().polish(self.copy_btn)
            
            # Reset after 1.5 seconds
            from PySide6.QtCore import QTimer
            QTimer.singleShot(1500, lambda: self._reset_copy_button(original_text))
            
    def _reset_copy_button(self, original_text: str):
        """Reset copy button to original state."""
        self.copy_btn.setText(original_text)
        self.copy_btn.setProperty("copied", False)
        self.copy_btn.style().unpolish(self.copy_btn)
        self.copy_btn.style().polish(self.copy_btn)
        
    def _process_with_ai(self):
        """Send current text to Claude for processing."""
        text = self.text_edit.toPlainText().strip()
        if text:
            self.process_with_ai.emit(text)
            
            # Visual feedback
            original_text = self.ai_btn.text()
            self.ai_btn.setText("⏳ PROCESSING...")
            self.ai_btn.setEnabled(False)
            
            # Reset after 2 seconds
            from PySide6.QtCore import QTimer
            QTimer.singleShot(2000, lambda: self._reset_ai_button(original_text))
            
    def _reset_ai_button(self, original_text: str):
        """Reset AI button to original state."""
        self.ai_btn.setText(original_text)
        self.ai_btn.setEnabled(True)
