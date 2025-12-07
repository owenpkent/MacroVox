"""
MacroVox File Browser Panel
Tree view for navigating recordings organized by date and tags
"""

import os
from datetime import datetime
from pathlib import Path

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)


class FileBrowserPanel(QFrame):
    """File browser panel for navigating recordings."""
    
    file_selected = Signal(str)  # Emits file path when selected
    
    def __init__(self, recordings_folder: str = "", parent=None):
        super().__init__(parent)
        self.recordings_folder = recordings_folder
        self.setObjectName("fileBrowserPanel")
        self._setup_ui()
        
    def _setup_ui(self):
        """Initialize the file browser UI."""
        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # Header
        header = QLabel("FILES")
        header.setObjectName("panelHeader")
        layout.addWidget(header)
        
        # Search bar
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search recordings...")
        self.search_input.setObjectName("searchInput")
        self.search_input.textChanged.connect(self._filter_tree)
        layout.addWidget(self.search_input)
        
        # File tree
        self.tree = QTreeWidget()
        self.tree.setObjectName("fileTree")
        self.tree.setHeaderHidden(True)
        self.tree.setRootIsDecorated(True)
        self.tree.setAnimated(True)
        self.tree.itemClicked.connect(self._on_item_clicked)
        self.tree.itemDoubleClicked.connect(self._on_item_double_clicked)
        layout.addWidget(self.tree, 1)
        
        # Refresh button
        refresh_btn = QPushButton("↻ REFRESH")
        refresh_btn.setObjectName("refreshBtn")
        refresh_btn.clicked.connect(self.refresh)
        layout.addWidget(refresh_btn)
        
    def set_folder(self, folder: str):
        """Set the recordings folder and refresh the tree."""
        self.recordings_folder = folder
        self.refresh()
        
    def refresh(self):
        """Refresh the file tree."""
        self.tree.clear()
        
        if not self.recordings_folder or not os.path.isdir(self.recordings_folder):
            placeholder = QTreeWidgetItem(self.tree, ["No folder selected"])
            placeholder.setFlags(Qt.NoItemFlags)
            return
            
        # Group files by date
        files_by_date: dict[str, list[Path]] = {}
        folder_path = Path(self.recordings_folder)
        
        for file in folder_path.glob("*.wav"):
            mtime = datetime.fromtimestamp(file.stat().st_mtime)
            date_key = mtime.strftime("%Y-%m-%d")
            if date_key not in files_by_date:
                files_by_date[date_key] = []
            files_by_date[date_key].append(file)
            
        # Also check for mp3 files
        for file in folder_path.glob("*.mp3"):
            mtime = datetime.fromtimestamp(file.stat().st_mtime)
            date_key = mtime.strftime("%Y-%m-%d")
            if date_key not in files_by_date:
                files_by_date[date_key] = []
            files_by_date[date_key].append(file)
        
        # Sort dates descending
        for date_key in sorted(files_by_date.keys(), reverse=True):
            # Create date node
            date_item = QTreeWidgetItem(self.tree, [f"📁 {date_key}"])
            date_item.setData(0, Qt.UserRole, None)  # Not a file
            date_item.setExpanded(date_key == sorted(files_by_date.keys(), reverse=True)[0])
            
            # Add files under this date
            for file in sorted(files_by_date[date_key], key=lambda f: f.stat().st_mtime, reverse=True):
                file_item = QTreeWidgetItem(date_item, [f"🎤 {file.name}"])
                file_item.setData(0, Qt.UserRole, str(file))
                file_item.setToolTip(0, str(file))
                
        if not files_by_date:
            placeholder = QTreeWidgetItem(self.tree, ["No recordings yet"])
            placeholder.setFlags(Qt.NoItemFlags)
    
    def _filter_tree(self, text: str):
        """Filter tree items based on search text."""
        search_lower = text.lower()
        
        for i in range(self.tree.topLevelItemCount()):
            date_item = self.tree.topLevelItem(i)
            date_visible = False
            
            for j in range(date_item.childCount()):
                file_item = date_item.child(j)
                file_name = file_item.text(0).lower()
                matches = search_lower in file_name or not text
                file_item.setHidden(not matches)
                if matches:
                    date_visible = True
                    
            date_item.setHidden(not date_visible)
            if date_visible and text:
                date_item.setExpanded(True)
                
    def _on_item_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle single click on tree item."""
        file_path = item.data(0, Qt.UserRole)
        if file_path:
            self.file_selected.emit(file_path)
            
    def _on_item_double_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle double click on tree item."""
        file_path = item.data(0, Qt.UserRole)
        if file_path:
            # Open file with default application
            os.startfile(file_path)
