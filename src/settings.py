"""
Voice Memo Recorder - Settings management
"""

import json
from pathlib import Path
from typing import Optional

from .themes import DEFAULT_TAGS


class Settings:
    """Manages application settings with persistence."""

    DEFAULTS = {
        "output_folder": str(Path.home() / "VoiceMemos" / "Inbox"),
        "sample_rate": 44100,
        "channels": 1,
        "format": "wav",
        "device": None,
        "device_name": "Default",
        "theme": "dark",
        "filename_template": "{timestamp}_{label}",
        "timestamp_format": "%Y%m%d_%H%M%S",
        "tags": DEFAULT_TAGS.copy(),
    }

    def __init__(self, config_path: str = "config.json"):
        self.config_path = Path(config_path)
        self.settings = self.DEFAULTS.copy()
        self.load()

    def load(self):
        """Load settings from file."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    saved = json.load(f)
                    self.settings.update(saved)
            except (json.JSONDecodeError, IOError):
                pass

    def save(self):
        """Save settings to file."""
        with open(self.config_path, "w") as f:
            json.dump(self.settings, f, indent=2)

    def get(self, key: str, default=None):
        """Get a setting value."""
        return self.settings.get(key, default)

    def set(self, key: str, value):
        """Set a setting value and save."""
        self.settings[key] = value
        self.save()

    def update(self, **kwargs):
        """Update multiple settings and save."""
        self.settings.update(kwargs)
        self.save()

    def to_dict(self) -> dict:
        """Return settings as dictionary."""
        return self.settings.copy()
