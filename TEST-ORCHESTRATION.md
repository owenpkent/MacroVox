# MacroVox Test Orchestration Guide

Complete testing strategy for validating MacroVox end-to-end.

## Test Pyramid

```
        ┌─────────────────┐
        │   E2E Tests     │  Full pipeline validation
        └────────┬────────┘
        ┌────────┴────────┐
        │ Component Tests │  Individual module validation
        ├────────┬────────┤
        │ Mapper │ Audio  │  Deepgram │ AHK
        └────────┴────────┘
```

## Test Execution Order

### Phase 1: Unit Tests (5 min)

Test individual components in isolation.

```bash
# Test command mapping (no external dependencies)
npm run test:mapper

# Expected: All phrase→keyword mappings pass
```

### Phase 2: Integration Tests (15 min)

Test each component with real services/hardware.

```bash
# Test microphone capture
npm run test:audio

# Expected: 5-second WAV file saved with audio data

# Test Deepgram streaming
npm run test:deepgram

# Expected: Live transcripts printed as you speak

# Test AutoHotkey execution
npm run test:ahk

# Expected: Ctrl+Z executed in active window
```

### Phase 3: End-to-End Test (20 min)

Test the complete pipeline with real audio input.

```bash
# Full E2E test (default 15s listening)
npm run test:e2e

# E2E test with specific profile
npm run test:e2e -- --profile=gaming

# E2E test with longer listening duration
npm run test:e2e -- --duration=30
```

**What it tests**:
1. Audio capture from microphone
2. Deepgram live transcription
3. Command mapping (phrase → keyword)
4. AutoHotkey execution
5. Full latency measurement

### Phase 4: Manual Validation (10 min)

Real-world testing with actual applications.

```bash
# Start the listener
npm start

# Test with Premiere/Resolve/Game
# 1. Open target application
# 2. Say commands (e.g., "undo", "cut", "next frame")
# 3. Verify actions execute correctly
# 4. Say profile name to switch profiles
```

## Quick Test Suite

Run all tests sequentially:

```bash
# Unit + Integration tests
npm run test:all

# Then run E2E
npm run test:e2e

# Then manual validation
npm start
```

## Test Checklist

### Pre-Test Setup
- [ ] `.env` configured with `DEEPGRAM_API_KEY`
- [ ] AutoHotkey v2.0 installed
- [ ] SoX installed and in PATH
- [ ] Microphone connected and enabled
- [ ] Network connection active

### Unit Tests
- [ ] `npm run test:mapper` passes
  - Exact matches work
  - Fuzzy matches work
  - Substring matches work
  - Non-matches return null

### Integration Tests
- [ ] `npm run test:audio` produces WAV file
  - Audio data captured
  - File size > 100KB (5 seconds @ 16kHz)
  
- [ ] `npm run test:deepgram` shows transcripts
  - Interim results appear
  - Final results appear
  - Confidence scores displayed
  
- [ ] `npm run test:ahk` executes command
  - AutoHotkey spawns successfully
  - Command executes (Ctrl+Z in text editor)

### E2E Test
- [ ] `npm run test:e2e` completes successfully
  - Audio captured
  - Deepgram receives transcripts
  - Mapper matches commands
  - AHK executes
  - Summary shows all PASS

### Manual Validation
- [ ] Commands execute in target app
  - Premiere: "undo" → Ctrl+Z
  - Premiere: "cut" → Ctrl+K
  - Premiere: "next frame" → Right arrow
  
- [ ] Profile switching works
  - Say "gaming" → switches to gaming profile
  - Say "premiere" → switches back
  
- [ ] Latency acceptable
  - Command executes within 1 second of speech
  - No noticeable delay

## Troubleshooting by Test Phase

### Unit Tests Fail
- Check `config/profiles.json` is valid JSON
- Verify command keywords exist in profile
- Check fuzzy matching threshold in `config/app.json`

### Audio Test Fails
- Verify SoX installed: `sox --version`
- Check microphone in Windows Sound settings
- Try different device in `config/app.json`

### Deepgram Test Fails
- Verify API key in `.env`
- Check network connection
- Ensure Deepgram account is active
- Check API key hasn't expired

### AHK Test Fails
- Verify AutoHotkey v2.0: `AutoHotkey.exe --version`
- Check `ahk/MacroVox.ahk` exists
- Verify profile/command in `config/profiles.json`

### E2E Test Fails
- Run individual tests to isolate issue
- Check logs: `LOG_LEVEL=debug npm run test:e2e`
- Verify all prerequisites installed

### Manual Validation Fails
- Check target app is in focus
- Verify `ahk_exe` matches process name
- Check command keys in `config/profiles.json`
- Increase `endpointing` in `config/app.json`

## Performance Benchmarks

Target metrics:

| Metric | Target | Acceptable | Poor |
|--------|--------|-----------|------|
| Latency | <300ms | <500ms | >1s |
| Accuracy | >95% | >85% | <80% |
| CPU (idle) | <2% | <5% | >10% |
| Memory | <100MB | <150MB | >200MB |
| Uptime | 24h+ | 8h+ | <1h |

## Continuous Testing

### Development Workflow

```bash
# Watch mode (auto-reload on changes)
npm run dev

# In another terminal, run tests
npm run test:mapper
npm run test:e2e
```

### Pre-Commit Testing

```bash
# Run all tests before committing
npm run test:all
npm run test:e2e
```

### Regression Testing

After making changes:
1. Run `npm run test:mapper` (command mapping)
2. Run `npm run test:e2e` (full pipeline)
3. Manual validation with target app

## Test Reporting

### Generate Test Report

```bash
# Run all tests and capture output
npm run test:all > test-results.txt 2>&1
npm run test:e2e >> test-results.txt 2>&1
```

### Sample Output

```
✓ AUDIO [PASS]
  └─ Audio stream started

✓ DEEPGRAM [PASS]
  └─ Received 12 transcript events

✓ MAPPER [PASS]
  └─ 5 matches, 0 failures

✓ AHK [PASS]
  └─ AutoHotkey executed successfully

Summary: 4/4 passed, 0 warnings
✅ All tests passed! MacroVox is ready to use.
```

## Next Steps

After all tests pass:
1. Customize `config/profiles.json` with your commands
2. Test with your target applications
3. Tune `config/app.json` for your environment
4. Deploy as background service (optional)

## Support

- See [TESTING.md](TESTING.md) for component-level troubleshooting
- See [README.md](README.md) for configuration options
- Enable verbose logging: `LOG_LEVEL=debug npm run test:e2e`
