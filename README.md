# Voice Memo Recorder

A lightweight, futuristic voice memo recorder with an Expanse-inspired UI. Designed for quick audio capture with seamless sync to shared folders for processing with Whisper, ChatGPT, n8n, or other automation tools.

![Dark Theme](assets/screenshot-dark.png)

## Features

- **Expanse-Inspired UI** - Futuristic dark/light themes with MCRN-style aesthetics
- **Quick Tags** - Color-coded, one-click tags for fast categorization (IDEA, TODO, NOTE, etc.)
- **Configurable Output** - Save recordings to any folder (OneDrive, Dropbox, custom paths)
- **Microphone Selection** - Choose from available input devices
- **Multiple Formats** - WAV, FLAC, or OGG output
- **Clean Filenames** - Auto-generated timestamps with tags: `20241130_143022_IDEA_TODO.wav`

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python run.py
```

## Usage

1. **Select Tags** - Click colored tag buttons to categorize your memo
2. **Add Label** (optional) - Type additional context in the text field
3. **Record** - Click the red REC button to start/stop
4. **Open Folder** - Quick access to your recordings
5. **Settings** - Configure mic, output folder, format, tags, and theme

## Configuration

Settings are stored in `config.json`:

```json
{
  "output_folder": "C:/Users/You/OneDrive/VoiceMemos",
  "device": 1,
  "device_name": "Microphone (Shure MV7+)",
  "format": "wav",
  "theme": "dark",
  "tags": [
    {"name": "IDEA", "color": "#00d4aa"},
    {"name": "TODO", "color": "#ff6b35"}
  ]
}
```

## Project Structure

```
MacroVox/
├── run.py              # Entry point
├── config.json         # User settings
├── requirements.txt    # Dependencies
├── src/
│   ├── ui.py           # Main GUI application
│   ├── recorder.py     # Audio recording logic
│   ├── settings.py     # Settings management
│   └── themes.py       # Dark/light theme definitions
└── assets/             # Icons and screenshots
```

## Requirements

- Python 3.10+
- PySide6
- sounddevice
- soundfile
- numpy

## License

MIT
