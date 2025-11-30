# MacroVox Testing Guide

This document describes how to test each component of MacroVox before running the full system.

## Prerequisites

Before testing, ensure you have:
1. Completed setup: `.\setup.ps1`
2. Created `.env` with your `DEEPGRAM_API_KEY`
3. Installed Node dependencies: `npm install`

## Test Order

Run tests in this order to isolate issues:

### 1. Command Mapper Test

**What it tests**: Phrase-to-keyword mapping logic (fuzzy matching, exact matches, substrings)

```bash
npm run test:mapper
```

**Expected output**:
```
✓ "undo" (premiere) → "undo"
✓ "cut" (premiere) → "cut"
✓ "next frame" (premiere) → "next frame"
✓ "undo please" (premiere) → "undo"
...
=== Results: X passed, 0 failed ===
```

**If it fails**:
- Check `config/profiles.json` is valid JSON
- Verify command keywords match test cases
- Adjust `fuzzyThreshold` in `config/app.json` if needed

---

### 2. Audio Capture Test

**What it tests**: Microphone capture via `node-record-lpcm16` and SoX

```bash
npm run test:audio
```

**Expected output**:
```
Recording for 5 seconds...
Speak into your microphone.

✓ Audio saved to test-audio.wav (160000 bytes)
  Sample rate: 16000 Hz
  Channels: 1
  Bit depth: 16
```

**If it fails**:
- Check SoX is installed: `sox --version`
- Verify microphone is connected and enabled in Windows Sound settings
- Try a different audio device in `config/app.json` (change `"device": "default"`)
- Check Windows audio permissions

**Troubleshooting**:
```bash
# List available audio devices
sox -h | grep -A 20 "EFFECTS"

# Test SoX directly
sox -d test-sox.wav trim 0 5
```

---

### 3. Deepgram Integration Test

**What it tests**: Live transcription streaming to Deepgram API

```bash
npm run test:deepgram
```

**Expected output**:
```
Connecting to Deepgram...
Audio capture started
Listening for 10 seconds...
Speak into your microphone.

[interim] hello
[interim] hello world
[FINAL] hello world (confidence: 0.95)

✓ Test complete. Received 3 transcript events.
```

**If it fails**:
- Check `DEEPGRAM_API_KEY` is set in `.env`: `cat .env | grep DEEPGRAM`
- Verify API key is valid at [console.deepgram.com](https://console.deepgram.com)
- Check network connection (Deepgram requires internet)
- Enable verbose logging: `LOG_LEVEL=debug npm run test:deepgram`

**Troubleshooting**:
```bash
# Test API key directly
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test-audio.wav
```

---

### 4. AutoHotkey Integration Test

**What it tests**: Spawning AutoHotkey and executing a command

```bash
npm run test:ahk
```

**Expected output**:
```
Testing AutoHotkey integration...
Profile: premiere
AHK path: AutoHotkey.exe
Script path: c:\Users\Owen\dev\MacroVox\ahk\MacroVox.ahk

Executing test command: "undo" in profile "premiere"
(This should trigger Ctrl+Z in the active window)

✓ AutoHotkey executed successfully
```

**If it fails**:
- Check AutoHotkey v2.0 is installed: `AutoHotkey.exe --version`
- Verify `ahk/MacroVox.ahk` exists
- Check `config/profiles.json` has the "premiere" profile with "undo" command
- Enable verbose logging: `LOG_LEVEL=debug npm run test:ahk`

**Manual test**:
```bash
# Run AHK directly
AutoHotkey.exe ahk/MacroVox.ahk --keyword=undo --profile=premiere
```

---

## Full End-to-End Test

Once all individual tests pass, run the full system:

```bash
npm start
```

**Expected output**:
```
[INFO] MacroVox starting...
[INFO] Starting audio capture from default microphone...
[INFO] Connecting to Deepgram live transcription...
[INFO] Deepgram connection opened
[INFO] MacroVox is listening... (press Ctrl+C to stop)
```

**Test procedure**:
1. Open a text editor (Notepad, VS Code, etc.)
2. Type some text
3. Say "undo" clearly
4. Verify the last character/word is undone
5. Say "redo"
6. Verify the undo is reversed

**If commands don't execute**:
- Check `LOG_LEVEL=debug npm start` for detailed logs
- Verify the target app is in focus
- Check `config/profiles.json` target window matches the app
- Increase `endpointing` in `config/app.json` to give Deepgram more time to finalize

---

## Performance Tuning

### Latency Optimization

If latency is too high (>1 second):

1. **Reduce Deepgram endpointing**:
   ```json
   "deepgram": {
     "endpointing": 200
   }
   ```

2. **Lower fuzzy match threshold** (may increase false positives):
   ```json
   "mapping": {
     "fuzzyThreshold": 0.7
   }
   ```

3. **Increase dedupe window** (may miss rapid commands):
   ```json
   "mapping": {
     "dedupeWindow": 300
   }
   ```

### Accuracy Optimization

If you're getting false positives or missed commands:

1. **Increase endpointing** (Deepgram waits longer for silence):
   ```json
   "deepgram": {
     "endpointing": 500
   }
   ```

2. **Raise fuzzy threshold**:
   ```json
   "mapping": {
     "fuzzyThreshold": 0.85
   }
   ```

3. **Increase minimum confidence**:
   ```json
   "mapping": {
     "minConfidence": 0.6
   }
   ```

---

## Debugging

### Enable Verbose Logging

```bash
LOG_LEVEL=debug npm start
```

This will show:
- All transcript events (interim and final)
- Fuzzy match scores and methods
- AHK execution details

### Check Configuration

```bash
node -e "import { config } from './src/config.js'; console.log(JSON.stringify(config, null, 2));"
```

### Test a Specific Profile

```bash
node -e "
import CommandMapper from './src/mapper.js';
const mapper = new CommandMapper();
const result = mapper.mapPhrase('cut', 'premiere');
console.log(result);
"
```

### Monitor AHK Execution

Open AutoHotkey's debug window:
```bash
AutoHotkey.exe /ErrorStdOut ahk/MacroVox.ahk --keyword=undo --profile=premiere
```

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "DEEPGRAM_API_KEY is not set" | `.env` missing or empty | Create `.env` with your API key |
| "Audio capture error" | SoX not installed or not in PATH | Install SoX and add to PATH |
| "Target window not found" | App not open or wrong `ahk_exe` | Open target app, verify process name |
| "No transcripts received" | Microphone muted or no audio | Check Windows Sound settings |
| Commands execute too slowly | High latency | Reduce `endpointing`, lower `fuzzyThreshold` |
| False positives | Fuzzy matching too loose | Increase `fuzzyThreshold`, raise `minConfidence` |

---

## Next Steps

Once all tests pass:
1. Customize `config/profiles.json` with your commands
2. Test with your target apps (Premiere, Resolve, games)
3. Tune latency and accuracy for your environment
4. Consider adding push-to-listen or visual feedback (see README roadmap)
