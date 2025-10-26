# MacroVox Quick Start Guide

Get MacroVox running in 5 minutes.

## 1. Prerequisites

- Windows 10/11
- Node.js 20+ ([download](https://nodejs.org))
- AutoHotkey v2.0 ([download](https://www.autohotkey.com))
- SoX for Windows ([download](https://sox.sourceforge.net/download.html))
- Deepgram API key ([free tier](https://console.deepgram.com))

## 2. Setup

### Option A: Automated Setup (PowerShell)

```powershell
cd c:\Users\Owen\dev\MacroVox
.\setup.ps1
```

This will:
- Check Node.js, AutoHotkey, and SoX
- Install npm dependencies
- Create `.env` from `.env.example`

### Option B: Manual Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your Deepgram API key
# (Open in your editor and replace DEEPGRAM_API_KEY)
```

## 3. Get Your Deepgram API Key

1. Go to [console.deepgram.com](https://console.deepgram.com)
2. Sign up (free tier available)
3. Create a new API key
4. Copy the key and paste into `.env`:

```
DEEPGRAM_API_KEY=your_key_here
```

## 4. Test Components

Before running the full system, test each component:

```bash
# Test command mapping
npm run test:mapper

# Test microphone capture
npm run test:audio

# Test Deepgram streaming
npm run test:deepgram

# Test AutoHotkey
npm run test:ahk
```

All tests should pass with ✓ marks.

## 5. Start Listening

```bash
npm start
```

You should see:
```
[INFO] MacroVox starting...
[INFO] Connecting to Deepgram live transcription...
[INFO] Deepgram connection opened
[INFO] MacroVox is listening... (press Ctrl+C to stop)
```

## 6. Test a Command

1. Open a text editor (Notepad, VS Code, etc.)
2. Type some text
3. Say **"undo"** clearly into your microphone
4. The last character should be undone (Ctrl+Z executed)

## 7. Switch Profiles

Say one of these to switch profiles:
- **"premiere"** → Adobe Premiere Pro commands
- **"gaming"** → Gaming mode commands
- **"resolve"** → DaVinci Resolve commands

## 8. Add Your Own Commands

```bash
# Add a command to premiere profile
npm run add-command -- --profile=premiere --keyword=zoom-in --keys="^+" --description="Zoom in timeline"

# List all commands in a profile
npm run add-command -- --profile=premiere --list
```

## Common Issues

| Problem | Solution |
|---------|----------|
| "DEEPGRAM_API_KEY is not set" | Edit `.env` and add your API key |
| "Audio capture error" | Verify SoX is installed: `sox --version` |
| "Target window not found" | Open the target app (Premiere, etc.) before speaking |
| Commands not executing | Check AutoHotkey: `AutoHotkey.exe --version` |

## Next Steps

- Customize `config/profiles.json` with your commands
- Test with your target apps
- Tune latency in `config/app.json`
- See [README.md](README.md) for advanced configuration

## Support

- Check [TESTING.md](TESTING.md) for detailed troubleshooting
- See [README.md](README.md) for full documentation
- Enable verbose logging: `npm start -- --verbose`
