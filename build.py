#!/usr/bin/env python
"""
Build script for MacroVox Voice Memo Recorder
Creates a standalone Windows executable using PyInstaller
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

VERSION = "1.0.0"
APP_NAME = "MacroVox"
RELEASE_DIR = Path("releases") / f"v{VERSION}"


def clean():
    """Clean previous build artifacts."""
    for folder in ["build", "dist"]:
        if Path(folder).exists():
            shutil.rmtree(folder)
    for spec in Path(".").glob("*.spec"):
        spec.unlink()


def build():
    """Build the executable."""
    print(f"Building {APP_NAME} v{VERSION}...")
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", APP_NAME,
        "--onefile",
        "--windowed",
        "--clean",
        "--noconfirm",
        # Add icon if exists
        # "--icon", "assets/icon.ico",
        "run.py"
    ]
    
    subprocess.run(cmd, check=True)


def package():
    """Package the release."""
    print(f"Packaging release to {RELEASE_DIR}...")
    
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Copy executable
    exe_src = Path("dist") / f"{APP_NAME}.exe"
    exe_dst = RELEASE_DIR / f"{APP_NAME}.exe"
    shutil.copy2(exe_src, exe_dst)
    
    # Create default config
    config_content = '''{
  "output_folder": "~/VoiceMemos/Inbox",
  "sample_rate": 44100,
  "channels": 1,
  "format": "wav",
  "device": null,
  "device_name": "Default",
  "theme": "dark",
  "filename_template": "{timestamp}_{label}",
  "timestamp_format": "%Y%m%d_%H%M%S",
  "tags": [
    {"name": "IDEA", "color": "#00d4aa"},
    {"name": "TODO", "color": "#ff6b35"},
    {"name": "NOTE", "color": "#4da6ff"},
    {"name": "URGENT", "color": "#ff3366"}
  ]
}
'''
    (RELEASE_DIR / "config.json").write_text(config_content)
    
    # Create README
    readme = f"""# {APP_NAME} v{VERSION}

## Quick Start
1. Run `{APP_NAME}.exe`
2. Click tags to categorize your memo
3. Click REC to start recording
4. Click STOP to save

## Configuration
Edit `config.json` to customize:
- Output folder
- Microphone
- Audio format
- Tags and colors
- Theme (dark/light)

## Files
Recordings are saved as: `YYYYMMDD_HHMMSS_TAGS.wav`
"""
    (RELEASE_DIR / "README.txt").write_text(readme)
    
    print(f"\n✓ Release created: {RELEASE_DIR.absolute()}")
    print(f"  - {APP_NAME}.exe")
    print(f"  - config.json")
    print(f"  - README.txt")


def main():
    os.chdir(Path(__file__).parent)
    clean()
    build()
    package()
    print(f"\n🎉 {APP_NAME} v{VERSION} build complete!")


if __name__ == "__main__":
    main()
