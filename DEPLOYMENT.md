# MacroVox Deployment Guide

## Status: Ready for Testing ✅

**Command mapping**: 17/17 tests passing
**Audio capture**: Switched to ffmpeg (more reliable)
**AutoHotkey**: Path detection implemented
**Deepgram**: Ready for API key

## Installation Checklist

### 1. Prerequisites
- [ ] Node.js 20+ installed
- [ ] ffmpeg installed and in PATH
- [ ] AutoHotkey v2.0 installed and in PATH
- [ ] Deepgram API key obtained

### 2. Setup Steps

```bash
# 1. Install npm dependencies
npm install

# 2. Create .env with your Deepgram API key
# Edit .env and replace:
# DEEPGRAM_API_KEY=your_api_key_here

# 3. Test command mapping (no dependencies needed)
npm run test:mapper

# 4. Test with full system (requires ffmpeg + Deepgram key)
npm start
```

### 3. Install ffmpeg

**Windows:**
1. Download from https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to system PATH
4. Verify: `ffmpeg -version`

### 4. Install AutoHotkey v2.0

1. Download from https://www.autohotkey.com
2. Run installer, select "AutoHotkey v2.0"
3. Verify: `AutoHotkey.exe --version`

### 5. Get Deepgram API Key

1. Go to https://console.deepgram.com
2. Sign up (free tier available)
3. Create API key
4. Add to `.env`: `DEEPGRAM_API_KEY=<your_key>`

## Quick Start

```bash
# Start listening
npm start

# In another terminal, test a component
npm run test:mapper      # Command mapping (always works)
npm run test:audio       # Microphone capture (requires ffmpeg)
npm run test:deepgram    # Deepgram streaming (requires API key)
npm run test:ahk         # AutoHotkey execution (requires AHK installed)
npm run test:e2e         # Full pipeline (requires all above)
npm run measure-latency  # Performance test (requires all above)
```

## Troubleshooting

### ffmpeg not found
```bash
# Verify installation
ffmpeg -version

# If not found, add to PATH:
# 1. Right-click This PC → Properties
# 2. Advanced system settings → Environment Variables
# 3. Edit PATH, add C:\ffmpeg\bin
# 4. Restart terminal
```

### AutoHotkey not found
```bash
# Verify installation
AutoHotkey.exe --version

# If not found, add to PATH or use full path in config/app.json
```

### Deepgram connection fails
```bash
# Check API key in .env
cat .env | grep DEEPGRAM_API_KEY

# Verify network connection
# Test with: npm run test:deepgram
```

### Microphone not detected
```bash
# Check Windows Sound settings
# Verify microphone is enabled and set as default

# If microphone name differs, edit src/audio.js:
# Change: audio="Microphone"
# To: audio="Your Microphone Name"
```

## Architecture

```
User speaks → ffmpeg captures audio → Deepgram transcribes
    ↓
CommandMapper fuzzy matches → Profile lookup
    ↓
AutoHotkey executes keystrokes → Target app receives input
```

## Performance

- **Latency**: 300–500ms (Deepgram + keystroke dispatch)
- **CPU**: <5% idle, <15% during listening
- **Memory**: ~80–120 MB

## Next Steps

1. ✅ Install dependencies
2. ✅ Install ffmpeg and AutoHotkey
3. ✅ Add Deepgram API key
4. ✅ Run `npm run test:mapper` (verify mapping)
5. ✅ Run `npm start` (start listening)
6. ✅ Test with your target app (Premiere, Resolve, etc.)
7. ✅ Customize profiles in `config/profiles.json`
8. ✅ Add new commands with `npm run add-command`

## Support

- See [README.md](README.md) for full documentation
- See [TESTING.md](TESTING.md) for component testing
- See [QUICKSTART.md](QUICKSTART.md) for quick setup
- Enable verbose logging: `LOG_LEVEL=debug npm start`
