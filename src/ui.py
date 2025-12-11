"""
MacroVox - Voice-to-Text Workstation
IDE-inspired multi-panel interface with DeepGram integration
"""

import os
import subprocess
import sys
from pathlib import Path

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QApplication,
    QColorDialog,
    QComboBox,
    QDialog,
    QFileDialog,
    QFormLayout,
    QFrame,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPushButton,
    QScrollArea,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from .panels import FileBrowserPanel, OutputPanel, TerminalPanel
from .recorder import VoiceRecorder
from .services import (
    set_api_key, has_api_key, DEEPGRAM_KEY, ANTHROPIC_KEY,
    DeepgramService,
    ClaudeService,
)
from .settings import Settings
from .themes import DEFAULT_TAGS, get_theme


class FlowLayout(QHBoxLayout):
    """Simple flow layout that wraps widgets."""
    pass


class TagButton(QPushButton):
    """A clickable tag button with color."""
    
    removed = Signal(str)
    
    def __init__(self, name: str, color: str, parent=None):
        super().__init__(name, parent)
        self.tag_name = name
        self.tag_color = color
        self.selected = False
        self._apply_style()
        
    def _apply_style(self):
        """Apply color-based styling."""
        if self.selected:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: {self.tag_color};
                    color: #0a0e14;
                    border: 2px solid {self.tag_color};
                    padding: 6px 12px;
                    border-radius: 2px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                QPushButton:hover {{
                    opacity: 0.9;
                }}
            """)
        else:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: transparent;
                    color: {self.tag_color};
                    border: 1px solid {self.tag_color};
                    padding: 6px 12px;
                    border-radius: 2px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                QPushButton:hover {{
                    background-color: {self.tag_color}22;
                }}
            """)
    
    def set_selected(self, selected: bool):
        """Set selection state."""
        self.selected = selected
        self._apply_style()

    def contextMenuEvent(self, event):
        """Right-click to remove tag."""
        self.removed.emit(self.tag_name)


class TagEditor(QDialog):
    """Dialog for adding/editing tags."""
    
    def __init__(self, parent=None, name: str = "", color: str = "#00d4aa"):
        super().__init__(parent)
        self.setWindowTitle("Add Tag" if not name else "Edit Tag")
        self.setMinimumWidth(300)
        self.tag_color = color
        self._setup_ui(name)
    
    def _setup_ui(self, name: str):
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Name input
        name_layout = QHBoxLayout()
        name_label = QLabel("Name:")
        self.name_input = QLineEdit(name)
        self.name_input.setPlaceholderText("TAG NAME")
        name_layout.addWidget(name_label)
        name_layout.addWidget(self.name_input)
        layout.addLayout(name_layout)
        
        # Color picker
        color_layout = QHBoxLayout()
        color_label = QLabel("Color:")
        self.color_btn = QPushButton()
        self.color_btn.setObjectName("colorBtn")
        self.color_btn.setFixedSize(60, 30)
        self.color_btn.setStyleSheet(f"background-color: {self.tag_color};")
        self.color_btn.clicked.connect(self._pick_color)
        color_layout.addWidget(color_label)
        color_layout.addWidget(self.color_btn)
        color_layout.addStretch()
        layout.addLayout(color_layout)
        
        # Preview
        self.preview = TagButton(name or "PREVIEW", self.tag_color)
        self.preview.setEnabled(False)
        preview_layout = QHBoxLayout()
        preview_layout.addStretch()
        preview_layout.addWidget(self.preview)
        preview_layout.addStretch()
        layout.addLayout(preview_layout)
        
        self.name_input.textChanged.connect(self._update_preview)
        
        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        save_btn = QPushButton("Save")
        save_btn.clicked.connect(self._save)
        save_btn.setDefault(True)
        btn_layout.addWidget(save_btn)
        
        layout.addLayout(btn_layout)
    
    def _pick_color(self):
        """Open color picker."""
        color = QColorDialog.getColor(QColor(self.tag_color), self)
        if color.isValid():
            self.tag_color = color.name()
            self.color_btn.setStyleSheet(f"background-color: {self.tag_color};")
            self._update_preview()
    
    def _update_preview(self):
        """Update preview button."""
        name = self.name_input.text().upper() or "PREVIEW"
        self.preview.tag_name = name
        self.preview.tag_color = self.tag_color
        self.preview.setText(name)
        self.preview._apply_style()
    
    def _save(self):
        """Validate and save."""
        if not self.name_input.text().strip():
            return
        self.accept()
    
    def get_tag(self) -> dict:
        """Return tag data."""
        return {
            "name": self.name_input.text().strip().upper(),
            "color": self.tag_color
        }


class SettingsDialog(QDialog):
    """Settings dialog for configuring the recorder."""

    def __init__(self, settings: Settings, parent=None):
        super().__init__(parent)
        self.settings = settings
        self.tags = list(settings.get("tags", DEFAULT_TAGS))
        self.setWindowTitle("SETTINGS")
        self.setMinimumWidth(480)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(24, 24, 24, 24)

        # Output folder
        folder_group = QGroupBox("OUTPUT LOCATION")
        folder_layout = QHBoxLayout(folder_group)
        
        self.folder_input = QLineEdit(self.settings.get("output_folder"))
        self.folder_input.setReadOnly(True)
        folder_layout.addWidget(self.folder_input)
        
        browse_btn = QPushButton("BROWSE")
        browse_btn.clicked.connect(self._browse_folder)
        folder_layout.addWidget(browse_btn)
        layout.addWidget(folder_group)

        # Audio settings
        audio_group = QGroupBox("AUDIO")
        audio_layout = QFormLayout(audio_group)

        self.mic_combo = QComboBox()
        self._populate_microphones()
        audio_layout.addRow("MICROPHONE", self.mic_combo)

        self.format_combo = QComboBox()
        for fmt in VoiceRecorder.get_supported_formats():
            self.format_combo.addItem(fmt.upper(), fmt)
        current_fmt = self.settings.get("format", "wav")
        idx = self.format_combo.findData(current_fmt)
        if idx >= 0:
            self.format_combo.setCurrentIndex(idx)
        audio_layout.addRow("FORMAT", self.format_combo)

        layout.addWidget(audio_group)

        # Tags management
        tags_group = QGroupBox("TAGS")
        tags_layout = QVBoxLayout(tags_group)
        
        self.tags_container = QWidget()
        self.tags_flow = QHBoxLayout(self.tags_container)
        self.tags_flow.setSpacing(8)
        self.tags_flow.setContentsMargins(0, 0, 0, 0)
        self._rebuild_tags()
        
        tags_scroll = QScrollArea()
        tags_scroll.setWidget(self.tags_container)
        tags_scroll.setWidgetResizable(True)
        tags_scroll.setFixedHeight(50)
        tags_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        tags_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        tags_layout.addWidget(tags_scroll)
        
        tags_btn_layout = QHBoxLayout()
        add_tag_btn = QPushButton("+ ADD TAG")
        add_tag_btn.clicked.connect(self._add_tag)
        tags_btn_layout.addWidget(add_tag_btn)
        tags_btn_layout.addStretch()
        
        reset_tags_btn = QPushButton("RESET")
        reset_tags_btn.clicked.connect(self._reset_tags)
        tags_btn_layout.addWidget(reset_tags_btn)
        tags_layout.addLayout(tags_btn_layout)
        
        layout.addWidget(tags_group)

        # API Keys (secure storage)
        api_group = QGroupBox("API KEYS")
        api_layout = QFormLayout(api_group)
        
        self.deepgram_input = QLineEdit()
        self.deepgram_input.setEchoMode(QLineEdit.Password)
        self.deepgram_input.setPlaceholderText("Enter DeepGram API key...")
        if has_api_key(DEEPGRAM_KEY):
            self.deepgram_input.setPlaceholderText("••••••••••••••••  (configured)")
        api_layout.addRow("DEEPGRAM", self.deepgram_input)
        
        self.anthropic_input = QLineEdit()
        self.anthropic_input.setEchoMode(QLineEdit.Password)
        self.anthropic_input.setPlaceholderText("Enter Anthropic API key...")
        if has_api_key(ANTHROPIC_KEY):
            self.anthropic_input.setPlaceholderText("••••••••••••••••  (configured)")
        api_layout.addRow("ANTHROPIC", self.anthropic_input)
        
        api_note = QLabel("Keys are stored securely in Windows Credential Manager")
        api_note.setStyleSheet("color: #546e7a; font-size: 10px;")
        api_layout.addRow("", api_note)
        
        layout.addWidget(api_group)

        # Appearance
        appearance_group = QGroupBox("APPEARANCE")
        appearance_layout = QFormLayout(appearance_group)

        self.theme_combo = QComboBox()
        self.theme_combo.addItem("DARK", "dark")
        self.theme_combo.addItem("LIGHT", "light")
        current_theme = self.settings.get("theme", "dark")
        idx = self.theme_combo.findData(current_theme)
        if idx >= 0:
            self.theme_combo.setCurrentIndex(idx)
        appearance_layout.addRow("THEME", self.theme_combo)

        layout.addWidget(appearance_group)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("CANCEL")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("SAVE")
        save_btn.clicked.connect(self._save_settings)
        save_btn.setDefault(True)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def _rebuild_tags(self):
        """Rebuild tag buttons."""
        # Clear existing
        while self.tags_flow.count():
            item = self.tags_flow.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        for tag in self.tags:
            btn = TagButton(tag["name"], tag["color"])
            btn.removed.connect(self._remove_tag)
            btn.setToolTip("Right-click to remove")
            self.tags_flow.addWidget(btn)
        
        self.tags_flow.addStretch()

    def _add_tag(self):
        """Add a new tag."""
        dialog = TagEditor(self)
        dialog.setStyleSheet(self.styleSheet())
        if dialog.exec() == QDialog.Accepted:
            tag = dialog.get_tag()
            # Check for duplicates
            if not any(t["name"] == tag["name"] for t in self.tags):
                self.tags.append(tag)
                self._rebuild_tags()

    def _remove_tag(self, name: str):
        """Remove a tag."""
        self.tags = [t for t in self.tags if t["name"] != name]
        self._rebuild_tags()

    def _reset_tags(self):
        """Reset to default tags."""
        self.tags = list(DEFAULT_TAGS)
        self._rebuild_tags()

    def _populate_microphones(self):
        """Populate microphone dropdown."""
        self.mic_combo.clear()
        self.mic_combo.addItem("Default", None)
        
        devices = VoiceRecorder.get_input_devices()
        current_device = self.settings.get("device")
        
        for dev in devices:
            self.mic_combo.addItem(dev["name"], dev["id"])
            if dev["id"] == current_device:
                self.mic_combo.setCurrentIndex(self.mic_combo.count() - 1)

    def _browse_folder(self):
        """Open folder browser dialog."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Output Folder",
            self.folder_input.text(),
        )
        if folder:
            self.folder_input.setText(folder)

    def _save_settings(self):
        """Save settings and close dialog."""
        # Save API keys if provided (securely in Windows Credential Manager)
        deepgram_key = self.deepgram_input.text().strip()
        if deepgram_key:
            set_api_key(DEEPGRAM_KEY, deepgram_key)
            
        anthropic_key = self.anthropic_input.text().strip()
        if anthropic_key:
            set_api_key(ANTHROPIC_KEY, anthropic_key)
        
        # Save other settings
        self.settings.update(
            output_folder=self.folder_input.text(),
            device=self.mic_combo.currentData(),
            device_name=self.mic_combo.currentText(),
            format=self.format_combo.currentData(),
            theme=self.theme_combo.currentData(),
            tags=self.tags,
        )
        self.accept()


class RecorderPanel(QFrame):
    """Recorder panel widget containing the recording controls."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("recorderPanel")


class VoiceMemoApp(QMainWindow):
    """Main application window - IDE-style voice-to-text workstation."""

    def __init__(self):
        super().__init__()
        self.settings = Settings()
        self.recorder = VoiceRecorder(self.settings.to_dict())
        self.recording_duration = 0
        self.timer = QTimer()
        self.timer.timeout.connect(self._update_duration)
        self.selected_tags: list[str] = []
        self.tag_buttons: dict[str, TagButton] = {}
        
        # DeepGram transcription service
        self.deepgram = DeepgramService(self)
        self.deepgram.transcript_received.connect(self._on_transcript_received)
        self.deepgram.transcription_started.connect(self._on_transcription_started)
        self.deepgram.transcription_finished.connect(self._on_transcription_finished)
        self.deepgram.error_occurred.connect(self._on_transcription_error)
        
        # Claude command interpretation service
        self.claude = ClaudeService(self)
        self.claude.command_ready.connect(self._on_command_ready)
        self.claude.commands_ready.connect(self._on_commands_ready)
        self.claude.clarification_needed.connect(self._on_clarification_needed)
        self.claude.response_received.connect(self._on_claude_response)
        self.claude.error_occurred.connect(self._on_claude_error)
        
        # Command history for context
        self.command_history: list[str] = []
        
        self._setup_ui()
        self._apply_theme()
        self._connect_panels()

    def _setup_ui(self):
        """Initialize the IDE-style user interface."""
        self.setWindowTitle("MACROVOX")
        self.setMinimumSize(1200, 700)
        self.resize(1400, 800)

        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QHBoxLayout(central)
        main_layout.setSpacing(0)
        main_layout.setContentsMargins(0, 0, 0, 0)

        # Main horizontal splitter (3 columns)
        self.main_splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(self.main_splitter)

        # Left panel: File Browser
        self.file_browser = FileBrowserPanel(self.recorder.get_output_folder())
        self.file_browser.setMinimumWidth(200)
        self.main_splitter.addWidget(self.file_browser)

        # Middle section: Terminal (top) + Recorder (bottom)
        middle_widget = QWidget()
        middle_layout = QVBoxLayout(middle_widget)
        middle_layout.setSpacing(0)
        middle_layout.setContentsMargins(0, 0, 0, 0)
        
        # Vertical splitter for middle section
        self.middle_splitter = QSplitter(Qt.Vertical)
        middle_layout.addWidget(self.middle_splitter)
        
        # Terminal panel (top)
        self.terminal = TerminalPanel()
        self.terminal.setMinimumHeight(150)
        self.middle_splitter.addWidget(self.terminal)
        
        # Recorder panel (bottom)
        self.recorder_panel = self._create_recorder_panel()
        self.recorder_panel.setMinimumHeight(280)
        self.middle_splitter.addWidget(self.recorder_panel)
        
        # Set middle splitter proportions (60% terminal, 40% recorder)
        self.middle_splitter.setSizes([350, 350])
        
        self.main_splitter.addWidget(middle_widget)

        # Right panel: Output
        self.output_panel = OutputPanel()
        self.output_panel.setMinimumWidth(250)
        self.main_splitter.addWidget(self.output_panel)

        # Set main splitter proportions (20% left, 50% middle, 30% right)
        self.main_splitter.setSizes([250, 600, 350])

    def _create_recorder_panel(self) -> QFrame:
        """Create the recorder panel with controls."""
        panel = RecorderPanel()
        layout = QVBoxLayout(panel)
        layout.setSpacing(12)
        layout.setContentsMargins(24, 20, 24, 20)

        # Header
        header = QLabel("RECORDER")
        header.setObjectName("panelHeader")
        layout.addWidget(header)

        # Status label
        self.status_label = QLabel("READY")
        self.status_label.setObjectName("statusLabel")
        self.status_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.status_label)

        # Duration label
        self.duration_label = QLabel("00:00")
        self.duration_label.setAlignment(Qt.AlignCenter)
        self.duration_label.setObjectName("durationLabel")
        layout.addWidget(self.duration_label)

        # Device info
        device_name = self.settings.get("device_name", "Default")
        self.device_label = QLabel(f"◉ {device_name}")
        self.device_label.setObjectName("deviceLabel")
        self.device_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.device_label)

        layout.addSpacing(4)

        # Tags section
        tags_label = QLabel("TAGS")
        tags_label.setObjectName("statusLabel")
        layout.addWidget(tags_label)

        self.tags_frame = QFrame()
        self.tags_frame.setObjectName("tagsFrame")
        self.tags_layout = QHBoxLayout(self.tags_frame)
        self.tags_layout.setSpacing(8)
        self.tags_layout.setContentsMargins(12, 10, 12, 10)
        self._rebuild_tag_buttons()
        layout.addWidget(self.tags_frame)

        # Label input field
        self.label_input = QLineEdit()
        self.label_input.setPlaceholderText("Additional label (optional)...")
        layout.addWidget(self.label_input)

        layout.addSpacing(4)

        # Button row
        button_layout = QHBoxLayout()
        button_layout.setSpacing(10)

        # Record button
        self.record_btn = QPushButton("● REC")
        self.record_btn.setObjectName("recordBtn")
        self.record_btn.setMinimumHeight(48)
        self.record_btn.clicked.connect(self._toggle_recording)
        button_layout.addWidget(self.record_btn, 2)

        # Open folder button
        self.folder_btn = QPushButton("OPEN")
        self.folder_btn.setObjectName("folderBtn")
        self.folder_btn.setMinimumHeight(48)
        self.folder_btn.setFixedWidth(64)
        self.folder_btn.setToolTip("Open output folder")
        self.folder_btn.clicked.connect(self._open_output_folder)
        button_layout.addWidget(self.folder_btn)

        # Settings button
        self.settings_btn = QPushButton("SET")
        self.settings_btn.setObjectName("settingsBtn")
        self.settings_btn.setMinimumHeight(48)
        self.settings_btn.setFixedWidth(64)
        self.settings_btn.setToolTip("Settings")
        self.settings_btn.clicked.connect(self._open_settings)
        button_layout.addWidget(self.settings_btn)

        layout.addLayout(button_layout)
        layout.addStretch()
        
        return panel

    def _connect_panels(self):
        """Connect panel signals for inter-panel communication."""
        # When a file is selected in the browser, log it in terminal
        self.file_browser.file_selected.connect(
            lambda path: self.terminal.log(f"Selected: {Path(path).name}", "info")
        )
        
        # Terminal command handling
        self.terminal.command_entered.connect(self._handle_terminal_command)
        
        # Output panel AI processing
        self.output_panel.process_with_ai.connect(self._process_text_with_ai)
        
    def _handle_terminal_command(self, command: str):
        """Handle commands from the terminal."""
        cmd_lower = command.lower().strip()
        
        if cmd_lower == "record" or cmd_lower == "rec":
            if not self.recorder.is_recording:
                self._start_recording()
                self.terminal.log("Recording started", "success")
            else:
                self.terminal.log("Already recording", "warning")
        elif cmd_lower == "stop":
            if self.recorder.is_recording:
                self._stop_recording()
                self.terminal.log("Recording stopped", "success")
            else:
                self.terminal.log("Not recording", "warning")
        elif cmd_lower == "refresh":
            self.file_browser.refresh()
            self.terminal.log("File list refreshed", "success")

    def _rebuild_tag_buttons(self):
        """Rebuild tag buttons from settings."""
        # Clear existing
        while self.tags_layout.count():
            item = self.tags_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        self.tag_buttons.clear()
        tags = self.settings.get("tags", DEFAULT_TAGS)
        
        for tag in tags:
            btn = TagButton(tag["name"], tag["color"])
            btn.clicked.connect(lambda checked, n=tag["name"]: self._toggle_tag(n))
            if tag["name"] in self.selected_tags:
                btn.set_selected(True)
            self.tag_buttons[tag["name"]] = btn
            self.tags_layout.addWidget(btn)
        
        self.tags_layout.addStretch()

    def _toggle_tag(self, name: str):
        """Toggle tag selection."""
        btn = self.tag_buttons.get(name)
        if not btn:
            return
        
        if name in self.selected_tags:
            self.selected_tags.remove(name)
            btn.set_selected(False)
        else:
            self.selected_tags.append(name)
            btn.set_selected(True)

    def _get_label(self) -> str:
        """Get combined label from tags and input."""
        parts = self.selected_tags.copy()
        extra = self.label_input.text().strip()
        if extra:
            parts.append(extra)
        return "_".join(parts) if parts else ""

    def _apply_theme(self):
        """Apply the current theme."""
        theme = self.settings.get("theme", "dark")
        self.setStyleSheet(get_theme(theme))

    def _toggle_recording(self):
        """Start or stop recording based on current state."""
        if self.recorder.is_recording:
            self._stop_recording()
        else:
            self._start_recording()

    def _start_recording(self):
        """Start recording audio."""
        label = self._get_label()
        filepath = self.recorder.start_recording(label)

        self.record_btn.setText("■ STOP")
        self.record_btn.setProperty("recording", True)
        self.record_btn.style().unpolish(self.record_btn)
        self.record_btn.style().polish(self.record_btn)

        self.status_label.setText("● RECORDING")
        self.recording_duration = 0
        self.timer.start(1000)
        self.label_input.setEnabled(False)
        self.settings_btn.setEnabled(False)
        self.tags_frame.setEnabled(False)
        
        # Update terminal
        self.terminal.log(f"Recording started: {Path(filepath).name}", "info")
        self.terminal.set_status("RECORDING", True)

    def _stop_recording(self):
        """Stop recording audio."""
        self.timer.stop()
        filepath = self.recorder.stop_recording()

        self.record_btn.setText("● REC")
        self.record_btn.setProperty("recording", False)
        self.record_btn.style().unpolish(self.record_btn)
        self.record_btn.style().polish(self.record_btn)

        filename = Path(filepath).name if filepath else "Unknown"
        self.status_label.setText(f"SAVED: {filename}")
        self.label_input.setEnabled(True)
        self.label_input.clear()
        self.settings_btn.setEnabled(True)
        self.tags_frame.setEnabled(True)
        
        # Clear selected tags
        for btn in self.tag_buttons.values():
            btn.set_selected(False)
        self.selected_tags.clear()
        
        # Update terminal and refresh file browser
        self.terminal.log(f"Saved: {filename}", "success")
        self.terminal.set_status("READY", True)
        self.file_browser.refresh()
        
        # Auto-transcribe if DeepGram is configured
        if filepath and self.deepgram.is_configured:
            self.terminal.log("Transcribing audio...", "info")
            self.deepgram.transcribe_file_async(filepath)

    def _update_duration(self):
        """Update the duration display."""
        self.recording_duration += 1
        minutes = self.recording_duration // 60
        seconds = self.recording_duration % 60
        self.duration_label.setText(f"{minutes:02d}:{seconds:02d}")

    def _open_output_folder(self):
        """Open the output folder in the system file explorer."""
        folder = self.recorder.get_output_folder()
        if sys.platform == "win32":
            os.startfile(folder)
        elif sys.platform == "darwin":
            subprocess.run(["open", folder])
        else:
            subprocess.run(["xdg-open", folder])

    def _open_settings(self):
        """Open the settings dialog."""
        dialog = SettingsDialog(self.settings, self)
        dialog.setStyleSheet(self.styleSheet())
        
        if dialog.exec() == QDialog.Accepted:
            self.recorder.update_config(**self.settings.to_dict())
            self._apply_theme()
            device_name = self.settings.get("device_name", "Default")
            self.device_label.setText(f"◉ {device_name}")
            self._rebuild_tag_buttons()
            
            # Update file browser with new output folder
            self.file_browser.set_folder(self.recorder.get_output_folder())
            self.terminal.log("Settings updated", "info")

    def _on_transcript_received(self, transcript: str):
        """Handle transcription result from DeepGram."""
        self.output_panel.set_text(transcript)
        self.terminal.log("Transcription complete", "success")
    
    def _process_text_with_ai(self, text: str):
        """Process text with Claude for command interpretation."""
        if not self.claude.is_configured:
            self.terminal.log("Anthropic API key not configured", "error")
            return
            
        self.terminal.log("Interpreting command...", "info")
        self.claude.interpret_command(
            text,
            working_dir=None,
            recent_commands=self.command_history[-5:] if self.command_history else None
        )
        
    def _on_transcription_started(self):
        """Handle transcription start."""
        self.output_panel.set_text("Transcribing...")
        
    def _on_transcription_finished(self):
        """Handle transcription completion."""
        pass  # Transcript already handled in _on_transcript_received
        
    def _on_transcription_error(self, error: str):
        """Handle transcription error."""
        self.terminal.log(f"Transcription error: {error}", "error")
        self.output_panel.set_text(f"Error: {error}")
    
    def _on_command_ready(self, command: str, explanation: str):
        """Handle single command from Claude."""
        self.terminal.log(f"Command: {command}", "info")
        self.terminal.log(f"  → {explanation}", "dim")
        
        # Execute the command
        self.terminal.send_command(command)
        self.command_history.append(command)
        
    def _on_commands_ready(self, commands: list):
        """Handle multiple commands from Claude."""
        self.terminal.log(f"Executing {len(commands)} commands...", "info")
        
        for command, explanation in commands:
            self.terminal.log(f"Command: {command}", "info")
            self.terminal.log(f"  → {explanation}", "dim")
            self.terminal.send_command(command)
            self.command_history.append(command)
            
    def _on_clarification_needed(self, question: str):
        """Handle clarification request from Claude."""
        self.terminal.log(f"Claude asks: {question}", "warning")
        self.output_panel.set_text(f"Clarification needed:\n\n{question}")
        
    def _on_claude_response(self, response: str):
        """Handle text response from Claude."""
        self.terminal.log("Claude response received", "info")
        self.output_panel.set_text(response)
        
    def _on_claude_error(self, error: str):
        """Handle Claude API error."""
        self.terminal.log(f"Claude error: {error}", "error")

    def closeEvent(self, event):
        """Handle window close - stop recording if active."""
        if self.recorder.is_recording:
            self._stop_recording()
        event.accept()


def main():
    """Application entry point."""
    app = QApplication(sys.argv)
    app.setApplicationName("MacroVox")
    
    window = VoiceMemoApp()
    window.show()

    sys.exit(app.exec())
