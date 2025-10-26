# MacroVox

Voice-controlled macro executor for Windows. Speak commands, execute keystrokes via AutoHotkey.

## Status: WORKING

**Tested and confirmed working:**
- Speech recognition (Deepgram nova-2)
- Command mapping (exact matching)
- AutoHotkey execution (Ctrl+Z, Ctrl+V, Ctrl+C)
- Notepad integration (paste, undo, copy)

**Known Limitations:**
- Latency: 2-3 seconds (Deepgram endpointing + processing)
- False positives: Occasional misrecognition (e.g., "i'm gay" instead of silence)
- Fuzzy matching needs tuning for better accuracy

## Features

- **Real-time speech recognition** via Deepgram (nova-2 model)
- **Fuzzy command matching** (exact, substring, Levenshtein distance)
- **AutoHotkey v2.0 integration** (ControlSend for non-focus-stealing)
- **Multiple profiles** (Premiere, Resolve, Gaming)
- **Voice-triggered profile switching**
- **Easy command expansion** via CLI or JSON config

## Architecture

```
Microphone → ffmpeg → Deepgram → CommandMapper → AutoHotkey → Target App
```

- **Audio**: ffmpeg + DirectShow (Windows, Shure MV7+ tested)
- **Speech-to-Text**: Deepgram nova-2 (real-time streaming, 300ms endpointing)
- **Mapping**: Exact, fuzzy (Levenshtein), substring matching
- **Execution**: AutoHotkey v2.0 (ControlSend)

- **AutoHotkey Executor** (`ahk/MacroVox.ahk`)
  - Receives command keyword and profile name
  - Looks up keystrokes from `config/profiles.json`
  - Uses `ControlSend` to send keys without stealing focus

- **Configuration** (`config/`)
  - `profiles.json`: Per-profile command definitions and target windows
  - `app.json`: Audio, Deepgram, mapping, and AHK settings

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **AutoHotkey v2.0** (download from [autohotkey.com](https://www.autohotkey.com))
- **ffmpeg** (for Windows audio capture; see [Installation](#installation))
- **Deepgram API key** (free tier available at [console.deepgram.com](https://console.deepgram.com))

## Installation

### 1. Clone and Install Dependencies

```bash
cd c:\Users\Owen\dev\MacroVox
npm install
```

### 2. Install ffmpeg (Windows)

ffmpeg is required for microphone capture via DirectShow:

1. Download from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to your system PATH:
   - Right-click **This PC** → **Properties** → **Advanced system settings** → **Environment Variables**
   - Edit `PATH` and add `C:\ffmpeg\bin`
   - Restart your terminal

Verify installation:
```bash
ffmpeg -version
```

### 3. Install AutoHotkey v2.0

1. Download from [autohotkey.com](https://www.autohotkey.com)
2. Run the installer and select **AutoHotkey v2.0**
3. Verify installation:
   ```bash
   AutoHotkey.exe --version
   ```

### 4. Set Up Environment

Copy `.env.example` to `.env` and add your Deepgram API key:

```bash
cp .env.example .env
```

Edit `.env`:
```
DEEPGRAM_API_KEY=your_api_key_here
DEFAULT_PROFILE=premiere
LOG_LEVEL=info
```

## Configuration

### Profiles (`config/profiles.json`)

Define voice commands and target windows per profile:

```json
{
  "profiles": {
    "premiere": {
      "name": "Adobe Premiere Pro",
      "target": {
        "ahk_exe": "Adobe Premiere Pro.exe"
      },
      "commands": {
        "undo": {
          "keys": "^z",
          "description": "Undo last action"
        },
        "cut": {
          "keys": "^k",
          "description": "Cut/split clip at playhead"
        }
      }
    }
  }
}
```

**Key syntax** (AutoHotkey v2):
- `^` = Ctrl
- `+` = Shift
- `!` = Alt
- `#` = Win
- `Space`, `Left`, `Right`, `Up`, `Down` = Arrow keys
- `r`, `v`, `c` = Regular keys

### Adding New Commands

Use the `add-command` utility to easily add commands to profiles:

```bash
# Add a new command to premiere profile
npm run add-command -- --profile=premiere --keyword=split --keys="^k" --description="Split clip at playhead"

# Add to gaming profile
npm run add-command -- --profile=gaming --keyword=melee --keys="v" --description="Melee attack"

# List all commands in a profile
npm run add-command -- --profile=premiere --list
```

Or edit `config/profiles.json` directly and add a new command object:

```json
"your-command": {
  "keys": "^k",
  "description": "Your command description"
}
```

### App Settings (`config/app.json`)

Tune audio capture, Deepgram, and command mapping:

```json
{
  "audio": {
    "sampleRate": 16000,
    "channels": 1,
    "bitDepth": 16
  },
  "deepgram": {
    "model": "nova-2",
    "interimResults": true,
    "endpointing": 300
  },
  "mapping": {
    "dedupeWindow": 500,
    "fuzzyThreshold": 0.8,
    "minConfidence": 0.5
  }
}
```

## Usage

### Start Listening

```bash
npm start
```

You should see:
```
[INFO] MacroVox starting...
[INFO] Starting audio capture from default microphone...
[INFO] Connecting to Deepgram live transcription...
[INFO] Deepgram connection opened
[INFO] MacroVox is listening... (press Ctrl+C to stop)
[INFO] Say a profile name (e.g., "premiere", "gaming") to switch profiles
```

### Start with a Specific Profile

```bash
npm start -- --profile=gaming
# or
npm start -- -p resolve
```

### List Available Profiles

```bash
npm run list-profiles
```

Output:
```
Available profiles:
  premiere: Adobe Premiere Pro (12 commands)
  resolve: DaVinci Resolve (7 commands)
  gaming: Gaming Mode (5 commands)
```

### Speak a Command

Say a command (e.g., "undo", "cut", "render"). MacroVox will:
1. Recognize the phrase
2. Map it to a keyword
3. Execute the corresponding keystroke in the target app

### Switch Profiles by Voice

While listening, simply say a profile name:
- Say **"premiere"** or **"premiere mode"** → switches to Premiere profile
- Say **"gaming"** → switches to Gaming profile
- Say **"resolve"** → switches to Resolve profile

The current profile is saved and will be restored on next startup.

### Stop Listening

Press `Ctrl+C` to gracefully shut down.

## Troubleshooting

### "DEEPGRAM_API_KEY is not set"
- Ensure `.env` exists and contains your API key
- Restart the application

### "Audio capture error" or "Failed to start audio capture"
- Verify ffmpeg is installed: `ffmpeg -version`
- Check microphone is connected and enabled in Windows Sound settings
- Verify microphone name matches in `src/audio.js` (currently looks for "Microphone")
- Check Windows audio permissions

### "Target window not found"
- Ensure the target app (e.g., Premiere) is open
- Verify the `ahk_exe` in `config/profiles.json` matches the process name

### Commands not executing
- Enable verbose logging: `LOG_LEVEL=debug npm start`
- Verify command keys are correct in `config/profiles.json`

### High latency or missed commands
- Increase `endpointing` in `config/app.json` (e.g., 500 ms)
- Lower `fuzzyThreshold` to catch more variations
- Ensure microphone is close and ambient noise is low

### False positives (hearing things that weren't said)
- This is a known limitation of Deepgram's VAD (voice activity detection)
- Reduce `endpointing` to detect silence faster (currently 300ms)
- Increase `minConfidence` threshold in `config/app.json` (currently 0.5)
- Use exact matching only by setting `fuzzyThreshold` to 0 (disables fuzzy matching)

### Latency is too high (2-3 seconds)
- The 300ms endpointing delay is intentional to avoid cutting off words
- Reduce to 100-200ms for faster response (may cause false cuts)
- Deepgram processing adds ~500-800ms
- AutoHotkey execution adds ~100-200ms
- Total: ~1-2 seconds minimum with current settings

## Development

### Run in Dev Mode (with auto-reload)

```bash
npm run dev
```

### Verbose Logging

```bash
LOG_LEVEL=debug npm start
# or
npm start -- --verbose
```

### Test Command Mapping

```bash
npm run test:mapper
```

### Test Individual Components

```bash
npm run test:mapper     # Test command mapping
npm run test:audio      # Test microphone capture
npm run test:deepgram   # Test Deepgram streaming
npm run test:ahk        # Test AutoHotkey execution
npm run test:all        # Run all component tests
```

### End-to-End Testing

```bash
# Full pipeline test (audio → Deepgram → mapper → AHK)
npm run test:e2e

# E2E test with specific profile
npm run test:e2e -- --profile=gaming

# E2E test with longer listening
npm run test:e2e -- --duration=30
```

### Measure Latency

```bash
# Measure end-to-end latency (5 iterations)
npm run measure-latency

# Measure with more iterations
npm run measure-latency -- --iterations=10

# Measure with specific profile
npm run measure-latency -- --profile=gaming
```

See [TEST-ORCHESTRATION.md](TEST-ORCHESTRATION.md) for comprehensive testing strategy.

### CLI Options

```bash
# Start with a specific profile
npm start -- --profile=gaming

# List all profiles
npm start -- --list-profiles

# Enable verbose logging
npm start -- --verbose

# Combine options
npm start -- -p resolve -v
```

## Performance

- **Latency**: ~300–500 ms (Deepgram endpointing + keystroke dispatch)
- **CPU**: <5% idle, <15% during active listening
- **Memory**: ~80–120 MB

## Roadmap

- [ ] Push-to-listen hotkey (e.g., hold a key to activate)
- [ ] Visual feedback (tray icon, LED indicator)
- [ ] Contextual vocabularies per app
- [ ] Macro recording UI
- [ ] Multi-language support
- [ ] Custom fuzzy matching and synonyms

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues or questions, open a GitHub issue or check the [Deepgram docs](https://developers.deepgram.com).
