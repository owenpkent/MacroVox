"""
Voice Memo Recorder - Theme definitions
Expanse-inspired futuristic UI
"""

# Default tag presets with Expanse-style colors
DEFAULT_TAGS = [
    {"name": "IDEA", "color": "#00d4aa"},      # Teal - MCRN style
    {"name": "TODO", "color": "#ff6b35"},      # Orange - alert
    {"name": "NOTE", "color": "#4da6ff"},      # Blue - UN style  
    {"name": "URGENT", "color": "#ff3366"},    # Red - warning
    {"name": "MEETING", "color": "#a855f7"},   # Purple
    {"name": "PERSONAL", "color": "#fbbf24"},  # Amber
]

DARK_THEME = """
/* === EXPANSE DARK THEME === */
/* Inspired by MCRN/Belter interfaces */

QMainWindow, QDialog {
    background-color: #0a0e14;
    color: #b0bec5;
}

QMainWindow {
    border: 1px solid #1a2633;
}

QLabel {
    color: #b0bec5;
    font-family: 'Segoe UI', 'Roboto', sans-serif;
}

QLabel#statusLabel {
    color: #546e7a;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

QLabel#durationLabel {
    color: #00d4aa;
    font-family: 'Consolas', 'Roboto Mono', monospace;
    font-size: 42px;
    font-weight: 300;
}

QLabel#deviceLabel {
    color: #37474f;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

QLineEdit, QComboBox {
    padding: 10px 14px;
    border: 1px solid #1a2633;
    border-radius: 2px;
    background-color: #0d1117;
    color: #b0bec5;
    font-family: 'Segoe UI', sans-serif;
    selection-background-color: #00d4aa;
    selection-color: #0a0e14;
}

QLineEdit:focus, QComboBox:focus {
    border-color: #00d4aa;
    background-color: #0f1419;
}

QLineEdit::placeholder {
    color: #37474f;
}

QComboBox::drop-down {
    border: none;
    padding-right: 10px;
}

QComboBox::down-arrow {
    image: none;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid #00d4aa;
    margin-right: 10px;
}

QComboBox QAbstractItemView {
    background-color: #0d1117;
    color: #b0bec5;
    selection-background-color: #1a2633;
    border: 1px solid #1a2633;
    outline: none;
}

QPushButton {
    background-color: #1a2633;
    color: #b0bec5;
    border: 1px solid #263340;
    border-radius: 2px;
    padding: 10px 20px;
    font-family: 'Segoe UI', sans-serif;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
}

QPushButton:hover {
    background-color: #263340;
    border-color: #37474f;
}

QPushButton:pressed {
    background-color: #0d1117;
}

QPushButton:disabled {
    background-color: #0d1117;
    color: #37474f;
    border-color: #1a2633;
}

/* Record Button - Idle State */
QPushButton#recordBtn {
    background-color: transparent;
    border: 2px solid #ff3366;
    color: #ff3366;
    font-size: 13px;
    font-weight: 600;
}

QPushButton#recordBtn:hover {
    background-color: rgba(255, 51, 102, 0.1);
    border-color: #ff5580;
    color: #ff5580;
}

/* Record Button - Recording State */
QPushButton#recordBtn[recording="true"] {
    background-color: #ff3366;
    border-color: #ff3366;
    color: #0a0e14;
}

QPushButton#recordBtn[recording="true"]:hover {
    background-color: #ff5580;
    border-color: #ff5580;
}

/* Utility Buttons */
QPushButton#folderBtn, QPushButton#settingsBtn {
    background-color: transparent;
    border: 1px solid #263340;
    color: #546e7a;
    font-size: 14px;
}

QPushButton#folderBtn:hover, QPushButton#settingsBtn:hover {
    border-color: #00d4aa;
    color: #00d4aa;
}

/* Tag Buttons */
QPushButton.tagBtn {
    padding: 6px 12px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 1px solid;
}

QPushButton.tagBtn:hover {
    opacity: 0.8;
}

QPushButton.tagBtn[selected="true"] {
    border-width: 2px;
}

/* Add Tag Button */
QPushButton#addTagBtn {
    background-color: transparent;
    border: 1px dashed #263340;
    color: #37474f;
    font-size: 16px;
    padding: 4px 10px;
}

QPushButton#addTagBtn:hover {
    border-color: #00d4aa;
    color: #00d4aa;
}

/* Group Boxes */
QGroupBox {
    border: 1px solid #1a2633;
    border-radius: 2px;
    margin-top: 16px;
    padding-top: 12px;
    color: #546e7a;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 8px;
    background-color: #0a0e14;
}

/* Scrollbar */
QScrollBar:vertical {
    background-color: #0a0e14;
    width: 8px;
    border: none;
}

QScrollBar::handle:vertical {
    background-color: #263340;
    border-radius: 4px;
    min-height: 20px;
}

QScrollBar::handle:vertical:hover {
    background-color: #37474f;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}

/* Frame for tags area */
QFrame#tagsFrame {
    background-color: #0d1117;
    border: 1px solid #1a2633;
    border-radius: 2px;
}

/* Color picker button */
QPushButton#colorBtn {
    border: 2px solid #263340;
    border-radius: 2px;
}

QPushButton#colorBtn:hover {
    border-color: #00d4aa;
}

/* === IDE PANEL STYLES === */

/* Panel Headers */
QLabel#panelHeader {
    color: #546e7a;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 2px;
    padding-bottom: 4px;
}

/* Splitter handles */
QSplitter::handle {
    background-color: #1a2633;
}

QSplitter::handle:horizontal {
    width: 2px;
}

QSplitter::handle:vertical {
    height: 2px;
}

QSplitter::handle:hover {
    background-color: #00d4aa;
}

/* File Browser Panel */
QFrame#fileBrowserPanel {
    background-color: #0d1117;
    border-right: 1px solid #1a2633;
}

QTreeWidget#fileTree {
    background-color: transparent;
    border: none;
    color: #b0bec5;
    font-size: 12px;
}

QTreeWidget#fileTree::item {
    padding: 4px 8px;
    border-radius: 2px;
}

QTreeWidget#fileTree::item:hover {
    background-color: #1a2633;
}

QTreeWidget#fileTree::item:selected {
    background-color: #263340;
    color: #00d4aa;
}

QTreeWidget#fileTree::branch {
    background-color: transparent;
}

QPushButton#refreshBtn {
    background-color: transparent;
    border: 1px solid #263340;
    color: #546e7a;
    padding: 6px 12px;
    font-size: 10px;
}

QPushButton#refreshBtn:hover {
    border-color: #00d4aa;
    color: #00d4aa;
}

/* Terminal Panel */
QFrame#terminalPanel {
    background-color: #0a0e14;
    border-bottom: 1px solid #1a2633;
}

QTextEdit#terminalOutput {
    background-color: #0d1117;
    border: 1px solid #1a2633;
    border-radius: 2px;
    color: #b0bec5;
    font-family: 'Consolas', 'Roboto Mono', monospace;
    font-size: 12px;
    padding: 8px;
}

QLabel#terminalPrompt {
    color: #00d4aa;
    font-family: 'Consolas', 'Roboto Mono', monospace;
    font-size: 14px;
    font-weight: bold;
}

QLineEdit#terminalInput {
    background-color: #0d1117;
    border: 1px solid #1a2633;
    border-radius: 2px;
    color: #00d4aa;
    font-family: 'Consolas', 'Roboto Mono', monospace;
    font-size: 12px;
    padding: 6px 10px;
}

QLineEdit#terminalInput:focus {
    border-color: #00d4aa;
}

QLabel#statusIndicator {
    color: #4ade80;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
}

/* Output Panel */
QFrame#outputPanel {
    background-color: #0d1117;
    border-left: 1px solid #1a2633;
}

QTextEdit#outputText {
    background-color: #0a0e14;
    border: 1px solid #1a2633;
    border-radius: 2px;
    color: #b0bec5;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
    padding: 12px;
    line-height: 1.5;
}

QTextEdit#outputText:focus {
    border-color: #00d4aa;
}

QLabel#wordCount {
    color: #37474f;
    font-size: 10px;
    font-family: 'Consolas', monospace;
}

QPushButton#copyBtn {
    background-color: #00d4aa;
    border: none;
    border-radius: 2px;
    color: #0a0e14;
    font-size: 11px;
    font-weight: 600;
    padding: 8px 16px;
}

QPushButton#copyBtn:hover {
    background-color: #00e6b8;
}

QPushButton#copyBtn[copied="true"] {
    background-color: #4ade80;
}

QPushButton#clearBtn {
    background-color: transparent;
    border: 1px solid #263340;
    color: #546e7a;
    padding: 6px 12px;
    font-size: 10px;
}

QPushButton#clearBtn:hover {
    border-color: #ff3366;
    color: #ff3366;
}

/* Recorder Panel (center bottom) */
QFrame#recorderPanel {
    background-color: #0a0e14;
    border-top: 1px solid #1a2633;
}

/* Search input in file browser */
QLineEdit#searchInput {
    background-color: #0a0e14;
    border: 1px solid #1a2633;
    border-radius: 2px;
    color: #b0bec5;
    font-size: 11px;
    padding: 6px 10px;
}

QLineEdit#searchInput:focus {
    border-color: #00d4aa;
}
"""

LIGHT_THEME = """
/* === EXPANSE LIGHT THEME === */
/* Clean, high-contrast interface */

QMainWindow, QDialog {
    background-color: #f5f7fa;
    color: #1a2633;
}

QMainWindow {
    border: 1px solid #dde3ea;
}

QLabel {
    color: #1a2633;
    font-family: 'Segoe UI', 'Roboto', sans-serif;
}

QLabel#statusLabel {
    color: #6b7c8a;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

QLabel#durationLabel {
    color: #00a080;
    font-family: 'Consolas', 'Roboto Mono', monospace;
    font-size: 42px;
    font-weight: 300;
}

QLabel#deviceLabel {
    color: #8a9bab;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

QLineEdit, QComboBox {
    padding: 10px 14px;
    border: 1px solid #dde3ea;
    border-radius: 2px;
    background-color: #ffffff;
    color: #1a2633;
    font-family: 'Segoe UI', sans-serif;
    selection-background-color: #00a080;
    selection-color: #ffffff;
}

QLineEdit:focus, QComboBox:focus {
    border-color: #00a080;
}

QLineEdit::placeholder {
    color: #8a9bab;
}

QComboBox::drop-down {
    border: none;
    padding-right: 10px;
}

QComboBox::down-arrow {
    image: none;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid #00a080;
    margin-right: 10px;
}

QComboBox QAbstractItemView {
    background-color: #ffffff;
    color: #1a2633;
    selection-background-color: #e8f5f2;
    border: 1px solid #dde3ea;
    outline: none;
}

QPushButton {
    background-color: #e8ecf0;
    color: #1a2633;
    border: 1px solid #dde3ea;
    border-radius: 2px;
    padding: 10px 20px;
    font-family: 'Segoe UI', sans-serif;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
}

QPushButton:hover {
    background-color: #dde3ea;
    border-color: #c5ced8;
}

QPushButton:pressed {
    background-color: #c5ced8;
}

QPushButton:disabled {
    background-color: #f5f7fa;
    color: #8a9bab;
    border-color: #e8ecf0;
}

/* Record Button - Idle State */
QPushButton#recordBtn {
    background-color: transparent;
    border: 2px solid #e63956;
    color: #e63956;
    font-size: 13px;
    font-weight: 600;
}

QPushButton#recordBtn:hover {
    background-color: rgba(230, 57, 86, 0.1);
    border-color: #ff5580;
    color: #e63956;
}

/* Record Button - Recording State */
QPushButton#recordBtn[recording="true"] {
    background-color: #e63956;
    border-color: #e63956;
    color: #ffffff;
}

QPushButton#recordBtn[recording="true"]:hover {
    background-color: #ff5580;
    border-color: #ff5580;
}

/* Utility Buttons */
QPushButton#folderBtn, QPushButton#settingsBtn {
    background-color: transparent;
    border: 1px solid #dde3ea;
    color: #6b7c8a;
    font-size: 14px;
}

QPushButton#folderBtn:hover, QPushButton#settingsBtn:hover {
    border-color: #00a080;
    color: #00a080;
}

/* Tag Buttons */
QPushButton.tagBtn {
    padding: 6px 12px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 1px solid;
}

QPushButton.tagBtn[selected="true"] {
    border-width: 2px;
}

/* Add Tag Button */
QPushButton#addTagBtn {
    background-color: transparent;
    border: 1px dashed #dde3ea;
    color: #8a9bab;
    font-size: 16px;
    padding: 4px 10px;
}

QPushButton#addTagBtn:hover {
    border-color: #00a080;
    color: #00a080;
}

/* Group Boxes */
QGroupBox {
    border: 1px solid #dde3ea;
    border-radius: 2px;
    margin-top: 16px;
    padding-top: 12px;
    color: #6b7c8a;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 8px;
    background-color: #f5f7fa;
}

/* Frame for tags area */
QFrame#tagsFrame {
    background-color: #ffffff;
    border: 1px solid #dde3ea;
    border-radius: 2px;
}

/* Color picker button */
QPushButton#colorBtn {
    border: 2px solid #dde3ea;
    border-radius: 2px;
}

QPushButton#colorBtn:hover {
    border-color: #00a080;
}
"""


def get_theme(name: str) -> str:
    """Get theme stylesheet by name."""
    return DARK_THEME if name == "dark" else LIGHT_THEME
