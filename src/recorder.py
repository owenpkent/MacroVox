"""
Voice Memo Recorder - Core recording logic
"""

import json
import os
import queue
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import sounddevice as sd
import soundfile as sf


class VoiceRecorder:
    """Handles audio recording from a selected microphone."""

    SUPPORTED_FORMATS = {
        "wav": {"subtype": "PCM_16", "extension": "wav"},
        "flac": {"subtype": "PCM_16", "extension": "flac"},
        "mp3": {"subtype": None, "extension": "mp3"},  # Requires additional handling
        "ogg": {"subtype": "VORBIS", "extension": "ogg"},
    }

    def __init__(self, config: dict = None):
        self.config = config or self._default_config()
        self.is_recording = False
        self.audio_queue: queue.Queue = queue.Queue()
        self.recording_thread: Optional[threading.Thread] = None
        self.current_file: Optional[str] = None
        self._stop_event = threading.Event()
        self.stream = None

    def _default_config(self) -> dict:
        return {
            "output_folder": str(Path.home() / "VoiceMemos" / "Inbox"),
            "sample_rate": 44100,
            "channels": 1,
            "format": "wav",
            "device": None,  # None = default device
            "filename_template": "{timestamp}_{label}",
            "timestamp_format": "%Y%m%d_%H%M%S",
        }

    def update_config(self, **kwargs):
        """Update configuration settings."""
        self.config.update(kwargs)

    @staticmethod
    def get_input_devices() -> list[dict]:
        """Get list of available input devices."""
        devices = []
        for i, dev in enumerate(sd.query_devices()):
            if dev["max_input_channels"] > 0:
                devices.append({
                    "id": i,
                    "name": dev["name"],
                    "channels": dev["max_input_channels"],
                    "sample_rate": dev["default_samplerate"],
                })
        return devices

    @staticmethod
    def get_supported_formats() -> list[str]:
        """Get list of supported audio formats."""
        return ["wav", "flac", "ogg"]

    def _get_output_folder(self) -> Path:
        """Get and create output folder if needed."""
        folder = Path(self.config["output_folder"]).expanduser()
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def _generate_filename(self, label: str = "") -> str:
        """Generate filename based on template."""
        timestamp = datetime.now().strftime(self.config["timestamp_format"])
        label = label.strip() if label else "memo"
        label = "".join(c if c.isalnum() or c in "-_" else "_" for c in label)
        
        fmt = self.config.get("format", "wav")
        filename = self.config["filename_template"].format(
            timestamp=timestamp, label=label
        )
        return f"{filename}.{fmt}"

    def _audio_callback(self, indata, frames, time_info, status):
        """Callback for sounddevice to capture audio."""
        if status:
            print(f"Audio status: {status}")
        self.audio_queue.put(indata.copy())

    def _recording_worker(self, filepath: str):
        """Worker thread that writes audio data to file."""
        fmt = self.config.get("format", "wav").upper()
        if fmt == "OGG":
            fmt = "OGG"
        elif fmt == "FLAC":
            fmt = "FLAC"
        else:
            fmt = "WAV"

        with sf.SoundFile(
            filepath,
            mode="w",
            samplerate=self.config["sample_rate"],
            channels=self.config["channels"],
            format=fmt,
        ) as f:
            while not self._stop_event.is_set() or not self.audio_queue.empty():
                try:
                    data = self.audio_queue.get(timeout=0.1)
                    f.write(data)
                except queue.Empty:
                    continue

    def start_recording(self, label: str = "") -> str:
        """Start recording audio. Returns the filepath."""
        if self.is_recording:
            return self.current_file

        self._stop_event.clear()
        self.audio_queue = queue.Queue()

        output_folder = self._get_output_folder()
        filename = self._generate_filename(label)
        self.current_file = str(output_folder / filename)

        # Start recording thread
        self.recording_thread = threading.Thread(
            target=self._recording_worker, args=(self.current_file,)
        )
        self.recording_thread.start()

        # Start audio stream with selected device
        device = self.config.get("device")
        self.stream = sd.InputStream(
            device=device,
            samplerate=self.config["sample_rate"],
            channels=self.config["channels"],
            callback=self._audio_callback,
        )
        self.stream.start()
        self.is_recording = True

        return self.current_file

    def stop_recording(self) -> Optional[str]:
        """Stop recording and return the filepath."""
        if not self.is_recording:
            return None

        self.stream.stop()
        self.stream.close()

        self._stop_event.set()
        if self.recording_thread:
            self.recording_thread.join(timeout=2.0)

        self.is_recording = False
        filepath = self.current_file
        self.current_file = None

        return filepath

    def get_output_folder(self) -> str:
        """Return the output folder path."""
        return str(self._get_output_folder())
