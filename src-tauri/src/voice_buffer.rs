/// MacroVox — Voice memo buffer.
///
/// Saves dictation recordings as WAV files in a rolling buffer directory,
/// capped at a configurable size (default 100 MB). Each recording is paired
/// with its transcript in a JSON manifest for future playback and model
/// training use.
///
/// ## Storage layout
///
/// ```text
/// %LOCALAPPDATA%/com.okstudio.macrovox/voice-buffer/
/// ├── manifest.json          ← index of all recordings
/// ├── 2026-04-14T09-32-17.wav
/// ├── 2026-04-14T10-15-03.wav
/// └── ...
/// ```
///
/// ## Eviction policy
///
/// FIFO — oldest recordings are deleted first when the buffer exceeds
/// `max_size_bytes`. Eviction runs before each new save.

use log::{debug, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// ── Manifest types ───────────────────────────────────────────────────────────

/// A single recording entry in the voice buffer manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceRecording {
    /// Filename (not full path), e.g. "2026-04-14T09-32-17.wav"
    pub file: String,
    /// ISO 8601 timestamp of when the recording was made
    pub timestamp: String,
    /// Duration in seconds
    pub duration_secs: f64,
    /// File size in bytes
    pub size_bytes: u64,
    /// Transcript text (from Deepgram or AI cleanup)
    pub transcript: String,
}

/// The voice buffer manifest — tracks all recordings and buffer limits.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBufferManifest {
    /// Maximum total size of all recordings in bytes (default 100 MB)
    pub max_size_bytes: u64,
    /// Current total size of all recordings in bytes
    pub current_size_bytes: u64,
    /// List of recordings, oldest first
    pub recordings: Vec<VoiceRecording>,
}

impl Default for VoiceBufferManifest {
    fn default() -> Self {
        Self {
            max_size_bytes: 100 * 1024 * 1024, // 100 MB
            current_size_bytes: 0,
            recordings: Vec::new(),
        }
    }
}

/// Summary info returned to the frontend.
#[derive(Debug, Serialize)]
pub struct VoiceBufferInfo {
    pub enabled: bool,
    pub max_size_bytes: u64,
    pub current_size_bytes: u64,
    pub recording_count: usize,
    pub total_duration_secs: f64,
}

// ── Core operations ──────────────────────────────────────────────────────────

/// Loads the manifest from disk, or returns a default if it doesn't exist.
pub fn load_manifest(buffer_dir: &Path) -> VoiceBufferManifest {
    let path = buffer_dir.join("manifest.json");
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => VoiceBufferManifest::default(),
    }
}

/// Writes the manifest to disk atomically (write to .tmp, then rename).
pub fn save_manifest(buffer_dir: &Path, manifest: &VoiceBufferManifest) -> Result<(), String> {
    let path = buffer_dir.join("manifest.json");
    let tmp_path = buffer_dir.join("manifest.json.tmp");
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {e}"))?;
    fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename manifest: {e}"))?;
    Ok(())
}

/// Evicts oldest recordings until `current_size_bytes + new_size` fits
/// within `max_size_bytes`. Deletes the WAV files from disk.
pub fn evict_if_needed(
    buffer_dir: &Path,
    manifest: &mut VoiceBufferManifest,
    new_size: u64,
) {
    while manifest.current_size_bytes + new_size > manifest.max_size_bytes
        && !manifest.recordings.is_empty()
    {
        let oldest = manifest.recordings.remove(0);
        let file_path = buffer_dir.join(&oldest.file);
        if let Err(e) = fs::remove_file(&file_path) {
            warn!("[voice_buffer] Failed to delete {}: {e}", oldest.file);
        } else {
            debug!("[voice_buffer] Evicted {} ({} bytes)", oldest.file, oldest.size_bytes);
        }
        manifest.current_size_bytes = manifest.current_size_bytes.saturating_sub(oldest.size_bytes);
    }
}

/// Saves a new recording to the voice buffer.
///
/// - Encodes `samples` as WAV using the existing `pcm_to_wav` function
/// - Evicts old recordings if needed to stay within `max_size_bytes`
/// - Writes the WAV file and updates the manifest
///
/// Returns the filename of the saved recording on success.
pub fn save_recording(
    buffer_dir: &Path,
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
    transcript: &str,
    max_size_bytes: Option<u64>,
) -> Result<String, String> {
    if samples.is_empty() {
        return Err("No audio to save".to_string());
    }

    // Ensure the buffer directory exists
    fs::create_dir_all(buffer_dir)
        .map_err(|e| format!("Failed to create voice buffer directory: {e}"))?;

    // Generate timestamp-based filename with milliseconds for uniqueness
    let now = chrono::Local::now();
    let filename = format!("{}.wav", now.format("%Y-%m-%dT%H-%M-%S%.3f"));
    let file_path = buffer_dir.join(&filename);

    // Encode as WAV
    let wav_bytes = crate::audio::pcm_to_wav(samples, sample_rate, channels);
    let file_size = wav_bytes.len() as u64;

    // Load manifest and apply max_size override if provided
    let mut manifest = load_manifest(buffer_dir);
    if let Some(max) = max_size_bytes {
        manifest.max_size_bytes = max;
    }

    // Evict old recordings to make room
    evict_if_needed(buffer_dir, &mut manifest, file_size);

    // Write the WAV file
    fs::write(&file_path, &wav_bytes)
        .map_err(|e| format!("Failed to write WAV file: {e}"))?;

    let duration_secs = samples.len() as f64 / (sample_rate as f64 * channels as f64);

    // Add to manifest
    manifest.recordings.push(VoiceRecording {
        file: filename.clone(),
        timestamp: now.to_rfc3339(),
        duration_secs,
        size_bytes: file_size,
        transcript: transcript.to_string(),
    });
    manifest.current_size_bytes += file_size;

    // Save manifest
    save_manifest(buffer_dir, &manifest)?;

    debug!(
        "[voice_buffer] Saved {} ({:.1}s, {} bytes, {}/{} MB used)",
        filename,
        duration_secs,
        file_size,
        manifest.current_size_bytes / (1024 * 1024),
        manifest.max_size_bytes / (1024 * 1024),
    );

    Ok(filename)
}

/// Lists all recordings in the buffer, newest first.
pub fn list_recordings(buffer_dir: &Path) -> Vec<VoiceRecording> {
    let mut manifest = load_manifest(buffer_dir);
    manifest.recordings.reverse(); // newest first for UI
    manifest.recordings
}

/// Returns buffer info (size, count, etc.).
pub fn get_info(buffer_dir: &Path, enabled: bool) -> VoiceBufferInfo {
    let manifest = load_manifest(buffer_dir);
    VoiceBufferInfo {
        enabled,
        max_size_bytes: manifest.max_size_bytes,
        current_size_bytes: manifest.current_size_bytes,
        recording_count: manifest.recordings.len(),
        total_duration_secs: manifest.recordings.iter().map(|r| r.duration_secs).sum(),
    }
}

/// Reads a WAV file from the buffer and returns its bytes.
pub fn get_audio(buffer_dir: &Path, filename: &str) -> Result<Vec<u8>, String> {
    // Prevent path traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let path = buffer_dir.join(filename);
    fs::read(&path).map_err(|e| format!("Failed to read audio file: {e}"))
}

/// Deletes a single recording from the buffer.
pub fn delete_recording(buffer_dir: &Path, filename: &str) -> Result<(), String> {
    // Prevent path traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }

    let mut manifest = load_manifest(buffer_dir);
    let idx = manifest
        .recordings
        .iter()
        .position(|r| r.file == filename)
        .ok_or_else(|| "Recording not found".to_string())?;

    let recording = manifest.recordings.remove(idx);
    manifest.current_size_bytes = manifest.current_size_bytes.saturating_sub(recording.size_bytes);

    let file_path = buffer_dir.join(filename);
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete file: {e}"))?;
    }

    save_manifest(buffer_dir, &manifest)?;
    debug!("[voice_buffer] Deleted {}", filename);
    Ok(())
}

/// Deletes all recordings and resets the manifest.
pub fn clear_all(buffer_dir: &Path) -> Result<(), String> {
    let manifest = load_manifest(buffer_dir);
    for recording in &manifest.recordings {
        let file_path = buffer_dir.join(&recording.file);
        if file_path.exists() {
            let _ = fs::remove_file(&file_path);
        }
    }
    save_manifest(buffer_dir, &VoiceBufferManifest::default())?;
    debug!("[voice_buffer] Cleared all recordings");
    Ok(())
}

/// Updates the max buffer size in the manifest and evicts if needed.
pub fn set_max_size(buffer_dir: &Path, max_size_bytes: u64) -> Result<(), String> {
    let mut manifest = load_manifest(buffer_dir);
    manifest.max_size_bytes = max_size_bytes;
    evict_if_needed(buffer_dir, &mut manifest, 0);
    save_manifest(buffer_dir, &manifest)?;
    debug!("[voice_buffer] Max size set to {} MB", max_size_bytes / (1024 * 1024));
    Ok(())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    use std::sync::atomic::{AtomicU64, Ordering};
    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_dir() -> PathBuf {
        let id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "macrovox-test-{}-{}",
            std::process::id(),
            id
        ));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn manifest_default_is_100mb() {
        let m = VoiceBufferManifest::default();
        assert_eq!(m.max_size_bytes, 100 * 1024 * 1024);
        assert_eq!(m.current_size_bytes, 0);
        assert!(m.recordings.is_empty());
    }

    #[test]
    fn save_and_load_manifest_roundtrip() {
        let dir = temp_dir();
        let mut manifest = VoiceBufferManifest::default();
        manifest.recordings.push(VoiceRecording {
            file: "test.wav".to_string(),
            timestamp: "2026-04-14T09:00:00+00:00".to_string(),
            duration_secs: 5.0,
            size_bytes: 1000,
            transcript: "hello world".to_string(),
        });
        manifest.current_size_bytes = 1000;
        save_manifest(&dir, &manifest).unwrap();

        let loaded = load_manifest(&dir);
        assert_eq!(loaded.recordings.len(), 1);
        assert_eq!(loaded.recordings[0].file, "test.wav");
        assert_eq!(loaded.current_size_bytes, 1000);
        cleanup(&dir);
    }

    #[test]
    fn save_recording_creates_wav_and_manifest() {
        let dir = temp_dir();
        let samples = vec![0.0f32; 16_000]; // 1 second at 16kHz mono
        let result = save_recording(&dir, &samples, 16_000, 1, "test transcript", None);
        assert!(result.is_ok());

        let filename = result.unwrap();
        assert!(filename.ends_with(".wav"));
        assert!(dir.join(&filename).exists());

        let manifest = load_manifest(&dir);
        assert_eq!(manifest.recordings.len(), 1);
        assert_eq!(manifest.recordings[0].transcript, "test transcript");
        assert!((manifest.recordings[0].duration_secs - 1.0).abs() < 0.01);
        cleanup(&dir);
    }

    #[test]
    fn eviction_removes_oldest_when_full() {
        let dir = temp_dir();
        // Set a very small buffer (10 KB)
        let small_max = 10 * 1024;
        let samples = vec![0.0f32; 4000]; // ~8KB WAV

        // Save two recordings — second should evict first
        let f1 = save_recording(&dir, &samples, 16_000, 1, "first", Some(small_max)).unwrap();
        let _f2 = save_recording(&dir, &samples, 16_000, 1, "second", Some(small_max)).unwrap();

        // First file should be evicted
        assert!(!dir.join(&f1).exists());
        let manifest = load_manifest(&dir);
        assert_eq!(manifest.recordings.len(), 1);
        assert_eq!(manifest.recordings[0].transcript, "second");
        cleanup(&dir);
    }

    #[test]
    fn delete_recording_removes_file_and_updates_manifest() {
        let dir = temp_dir();
        let samples = vec![0.0f32; 16_000];
        let filename = save_recording(&dir, &samples, 16_000, 1, "to delete", None).unwrap();

        assert!(dir.join(&filename).exists());
        delete_recording(&dir, &filename).unwrap();
        assert!(!dir.join(&filename).exists());

        let manifest = load_manifest(&dir);
        assert!(manifest.recordings.is_empty());
        assert_eq!(manifest.current_size_bytes, 0);
        cleanup(&dir);
    }

    #[test]
    fn clear_all_removes_everything() {
        let dir = temp_dir();
        let samples = vec![0.0f32; 16_000];
        save_recording(&dir, &samples, 16_000, 1, "one", None).unwrap();
        save_recording(&dir, &samples, 16_000, 1, "two", None).unwrap();

        let manifest = load_manifest(&dir);
        assert_eq!(manifest.recordings.len(), 2);

        clear_all(&dir).unwrap();
        let manifest = load_manifest(&dir);
        assert!(manifest.recordings.is_empty());
        assert_eq!(manifest.current_size_bytes, 0);
        cleanup(&dir);
    }

    #[test]
    fn path_traversal_blocked() {
        let dir = temp_dir();
        assert!(get_audio(&dir, "../etc/passwd").is_err());
        assert!(get_audio(&dir, "..\\windows\\system32").is_err());
        assert!(delete_recording(&dir, "../malicious").is_err());
        cleanup(&dir);
    }

    #[test]
    fn empty_samples_rejected() {
        let dir = temp_dir();
        let result = save_recording(&dir, &[], 16_000, 1, "empty", None);
        assert!(result.is_err());
        cleanup(&dir);
    }

    #[test]
    fn get_info_returns_correct_summary() {
        let dir = temp_dir();
        let samples = vec![0.0f32; 16_000]; // 1 second
        save_recording(&dir, &samples, 16_000, 1, "info test", None).unwrap();

        let info = get_info(&dir, true);
        assert!(info.enabled);
        assert_eq!(info.recording_count, 1);
        assert!((info.total_duration_secs - 1.0).abs() < 0.01);
        assert!(info.current_size_bytes > 0);
        cleanup(&dir);
    }
}
