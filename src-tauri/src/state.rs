use std::sync::{Arc, Mutex};

/// Shared mutable state for the MacroVox Tauri backend.
///
/// Wrapped in `Mutex` so Tauri command handlers (which run on the async executor)
/// can safely access it. Each field maps to a concept from the old Electron
/// main process globals in `src/main/main.ts`.
///
/// Audio fields (`audio_level`, `recording_buffer`, `is_recording`) are
/// `Arc<Mutex<T>>` rather than plain `Mutex<T>` so the cpal capture callback
/// closure can share them without borrowing `AppState`.
pub struct AppState {
    /// Name of the selected microphone device (`None` = system default).
    pub selected_mic_device: Mutex<Option<String>>,

    /// Whether the dictation window stays on top of other windows.
    pub dictation_always_on_top: Mutex<bool>,

    /// Whether closing the window hides it to tray instead of quitting.
    pub minimize_to_tray: Mutex<bool>,

    // ── Phase 3: cpal WASAPI audio ────────────────────────────────────────────

    /// Live cpal capture stream. Dropping it stops audio capture.
    /// `None` when the stream is stopped.
    pub audio_stream: Mutex<Option<cpal::Stream>>,

    /// Current RMS level of the capture stream (range 0.0–1.0).
    /// Updated by the cpal callback on every audio frame.
    pub audio_level: Arc<Mutex<f64>>,

    /// PCM f32 samples accumulated while `is_recording` is true.
    /// Consumed (and cleared) by `recording_stop`.
    pub recording_buffer: Arc<Mutex<Vec<f32>>>,

    /// True between `recording_start` and `recording_stop`/`recording_cancel`.
    pub is_recording: Arc<Mutex<bool>>,

    /// Sample rate of the active capture stream (default 16 000 Hz).
    /// Updated in `audio_start` after opening the device.
    pub audio_sample_rate: Mutex<u32>,

    /// Channel count of the active capture stream (1 = mono, 2 = stereo).
    /// Updated in `audio_start` after opening the device.
    pub audio_channels: Mutex<u16>,

    // ── Deepgram ──────────────────────────────────────────────────────────────

    /// Keywords forwarded to Deepgram for boosted recognition.
    /// Parsed from the `deepgram_keywords` settings key (newline-separated).
    pub deepgram_keywords: Mutex<Vec<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            selected_mic_device: Mutex::new(None),
            dictation_always_on_top: Mutex::new(true),
            minimize_to_tray: Mutex::new(false),
            audio_stream: Mutex::new(None),
            audio_level: Arc::new(Mutex::new(0.0)),
            recording_buffer: Arc::new(Mutex::new(Vec::new())),
            is_recording: Arc::new(Mutex::new(false)),
            audio_sample_rate: Mutex::new(16_000),
            audio_channels: Mutex::new(1),
            deepgram_keywords: Mutex::new(Vec::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_default_values() {
        let state = AppState::default();
        assert!(state.selected_mic_device.lock().unwrap().is_none());
        assert!(*state.dictation_always_on_top.lock().unwrap());
        assert!(!*state.minimize_to_tray.lock().unwrap());
        assert!(state.audio_stream.lock().unwrap().is_none());
        assert_eq!(*state.audio_level.lock().unwrap(), 0.0);
        assert!(state.recording_buffer.lock().unwrap().is_empty());
        assert!(!*state.is_recording.lock().unwrap());
        assert_eq!(*state.audio_sample_rate.lock().unwrap(), 16_000);
        assert_eq!(*state.audio_channels.lock().unwrap(), 1);
        assert!(state.deepgram_keywords.lock().unwrap().is_empty());
    }

    #[test]
    fn state_mic_device_mutation() {
        let state = AppState::default();
        *state.selected_mic_device.lock().unwrap() = Some("Headset Mic".to_string());
        assert_eq!(
            state.selected_mic_device.lock().unwrap().as_deref(),
            Some("Headset Mic")
        );
    }

    #[test]
    fn state_audio_level_shared_arc() {
        let state = AppState::default();
        let level_clone = Arc::clone(&state.audio_level);
        *level_clone.lock().unwrap() = 0.75;
        assert_eq!(*state.audio_level.lock().unwrap(), 0.75);
    }

    #[test]
    fn state_recording_buffer_accumulates() {
        let state = AppState::default();
        state.recording_buffer.lock().unwrap().extend([0.1f32, 0.2, 0.3]);
        assert_eq!(state.recording_buffer.lock().unwrap().len(), 3);
    }

    #[test]
    fn state_keywords_mutation() {
        let state = AppState::default();
        state
            .deepgram_keywords
            .lock()
            .unwrap()
            .extend(["foo".to_string(), "bar".to_string()]);
        assert_eq!(state.deepgram_keywords.lock().unwrap().len(), 2);
    }
}
