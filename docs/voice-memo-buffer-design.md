# Voice Memo Buffer — Design Document

**Status**: Implemented with OGG Opus compression, transcription history, and full reprocess pipeline. Model training integration is future work.

## Idea

MacroVox already captures audio for every dictation session. Instead of discarding the raw audio after transcription, retain a rolling buffer of the user's most recent voice data (capped at ~100 MB). This serves two purposes:

1. **Voice memo playback** — users can replay recent dictation sessions to hear what they said.
2. **Model training data** — the accumulated audio could be used to fine-tune a personal speech model, improving recognition accuracy for the user's voice, accent, and vocabulary over time.

This is exploratory — documenting the concept and constraints before committing to implementation.

---

## How Much Audio Is 100 MB?

| Format | Bitrate | Size/min | 100 MB = |
|--------|---------|----------|----------|
| Raw PCM (16kHz mono, 16-bit) | 256 kbps | ~1.9 MB | **~53 minutes** |
| Raw PCM (48kHz mono, 16-bit) | 768 kbps | ~5.6 MB | **~18 minutes** |
| Opus (speech, 16 kbps) | 16 kbps | ~120 KB | **~14 hours** |
| Opus (speech, 24 kbps) | 24 kbps | ~180 KB | **~9.5 hours** |
| MP3 (64 kbps) | 64 kbps | ~480 KB | **~3.5 hours** |
| WAV (16kHz mono, 16-bit) | 256 kbps | ~1.9 MB | **~53 minutes** |

**Recommendation**: Use Opus at 24 kbps. It's designed for speech, quality is excellent for voice at that bitrate, and 100 MB gives roughly **9–10 hours** of recordings — enough to accumulate meaningful training data over days or weeks of normal use.

For model training specifically, the audio would need to be decoded back to PCM before feeding into a training pipeline, but Opus is lossless enough at speech bitrates that this round-trip is fine for fine-tuning.

---

## Storage Design

### Rolling buffer

- Store recordings as individual Opus files in a dedicated directory (e.g., `\$APPDATA/MacroVox/voice-buffer/`)
- Each file = one dictation session, named by timestamp (e.g., `2026-04-14T09-32-17.opus`)
- Track total buffer size; when adding a new recording would exceed 100 MB, delete the oldest files until there's room
- Store a manifest file (`buffer.json`) with metadata: filename, timestamp, duration, size, transcript text

### Manifest schema

```json
{
  "max_size_bytes": 104857600,
  "current_size_bytes": 87234560,
  "recordings": [
    {
      "file": "2026-04-14T09-32-17.opus",
      "timestamp": "2026-04-14T09:32:17Z",
      "duration_secs": 45.2,
      "size_bytes": 135000,
      "transcript": "The quarterly report shows..."
    }
  ]
}
```

### User controls

- **Settings toggle**: "Save voice recordings for playback" (off by default — opt-in for privacy)
- **Buffer size slider**: 50 MB / 100 MB / 250 MB / 500 MB
- **Clear all recordings** button
- **Export recordings** — zip and save to user-chosen location

---

## Voice Memo Playback UI

Minimal addition to the existing UI:

- A "Recent" or "History" list in the settings window or a new panel
- Each entry shows: timestamp, duration, transcript preview
- Play/pause button per entry (in-app audio playback via Tauri)
- Delete individual recordings

This is a lightweight feature — no complex audio editor, just a chronological list with playback.

---

## Model Training Use Case

The accumulated voice buffer becomes training data for personalizing speech recognition:

### What's needed for fine-tuning
- **Audio + transcript pairs** — MacroVox already produces both (the audio from the mic, the transcript from Deepgram/AI cleanup)
- **Volume** — most speech model fine-tuning benefits from 1–10 hours of paired data. At 100 MB Opus, we'd accumulate ~9 hours — right in the sweet spot.
- **Diversity** — natural dictation covers varied vocabulary, speaking speed, and ambient conditions, which is ideal for adaptation.

### Possible approaches
1. **Deepgram custom model** — Deepgram offers model training on customer data. We could upload the buffer contents (with user consent) for server-side fine-tuning.
2. **Local Whisper fine-tuning** — Use the buffer to fine-tune a local Whisper model. This keeps data on-device but requires GPU resources for training.
3. **Keyword/vocabulary extraction** — Even without full model training, analyzing the buffer to auto-populate keyword boosts (frequently spoken terms not in standard dictionaries) would be valuable and easy to implement.

### Privacy considerations
- Voice data is biometric — must be handled with care
- Buffer should be encrypted at rest (Tauri's `tauri-plugin-stronghold` or OS-level encryption)
- Never upload without explicit user consent and clear explanation
- Provide easy full deletion ("forget my voice")
- If training happens server-side, data should be deleted after training completes

---

## Implementation Sketch

### Rust backend changes

1. **Opus encoding** — add `opus` or `audiopus` crate. After `recording_stop` or `deepgram_stop`, encode the PCM buffer to Opus and write to the voice buffer directory.
2. **Buffer management** — new module `voice_buffer.rs` with functions to save, list, delete, and evict recordings.
3. **Playback** — new IPC command `voice_buffer_play(filename)` using `rodio` crate for audio output.
4. **New IPC commands**: `voice_buffer_list`, `voice_buffer_play`, `voice_buffer_stop`, `voice_buffer_delete`, `voice_buffer_clear`, `voice_buffer_export`.

### Frontend changes

1. **History panel** — new component showing recent recordings with playback controls
2. **Settings** — toggle for voice buffer, size selector, clear button
3. **Manifest sync** — fetch recording list from backend on panel open

### Dependencies

| Crate | Purpose |
|-------|---------|
| `audiopus` or `opus` | Opus encoding |
| `ogg` | Ogg container for Opus files |
| `rodio` | Audio playback |

---

## Open Questions

- Should the buffer persist across app updates/reinstalls? (Probably yes — store outside the app bundle)
- Should recordings be associated with the user's account, or purely local?
- Is 100 MB the right default? Power users doing hours of daily dictation might want more.
- Should we store the AI-cleaned transcript alongside the raw Deepgram transcript?
- Is there a way to do lightweight voice adaptation without full fine-tuning? (e.g., speaker embeddings, pronunciation models)
