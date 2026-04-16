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
    pub storage_path: String,
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

/// Converts f32 PCM samples to i16 (clamped to [-1.0, 1.0]).
fn f32_to_i16_samples(samples: &[f32]) -> Vec<i16> {
    samples
        .iter()
        .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect()
}

/// Encodes f32 PCM samples as OGG Opus.
///
/// Uses the `ogg-opus` crate which handles both Opus encoding and OGG
/// container in one step. Input must be 16kHz mono (the MacroVox default).
/// Falls back to WAV if Opus encoding fails.
fn encode_opus(samples: &[f32]) -> Result<Vec<u8>, String> {
    let i16_samples = f32_to_i16_samples(samples);
    ogg_opus::encode::<16000, 1>(&i16_samples)
        .map_err(|e| format!("Opus encoding failed: {e}"))
}

/// Saves a new recording to the voice buffer.
///
/// - Encodes `samples` as OGG Opus (~10x smaller than WAV)
/// - Evicts old recordings if needed to stay within `max_size_bytes`
/// - Writes the file and updates the manifest
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

    // Encode as OGG Opus (falls back to WAV if encoding fails)
    let (encoded_bytes, extension) = match encode_opus(samples) {
        Ok(opus_bytes) => {
            debug!("[voice_buffer] Opus encoded: {} samples → {} bytes ({:.0}x compression)",
                samples.len() * 2, // WAV would be 2 bytes per sample + 44 header
                opus_bytes.len(),
                (samples.len() * 2) as f64 / opus_bytes.len().max(1) as f64,
            );
            (opus_bytes, "ogg")
        }
        Err(e) => {
            warn!("[voice_buffer] Opus encoding failed, falling back to WAV: {e}");
            (crate::audio::pcm_to_wav(samples, sample_rate, channels), "wav")
        }
    };

    // Generate timestamp-based filename with milliseconds for uniqueness
    let now = chrono::Local::now();
    let filename = format!("{}.{}", now.format("%Y-%m-%dT%H-%M-%S%.3f"), extension);
    let file_path = buffer_dir.join(&filename);

    let file_size = encoded_bytes.len() as u64;

    // Load manifest and apply max_size override if provided
    let mut manifest = load_manifest(buffer_dir);
    if let Some(max) = max_size_bytes {
        manifest.max_size_bytes = max;
    }

    // Evict old recordings to make room
    evict_if_needed(buffer_dir, &mut manifest, file_size);

    // Write the encoded file
    fs::write(&file_path, &encoded_bytes)
        .map_err(|e| format!("Failed to write audio file: {e}"))?;

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
    // Sort by timestamp descending so newest recordings always appear first,
    // regardless of manifest insertion order.
    manifest.recordings.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
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
        storage_path: buffer_dir.to_string_lossy().to_string(),
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

/// Updates the transcript for a recording in the manifest.
pub fn update_transcript(buffer_dir: &Path, filename: &str, transcript: &str) -> Result<(), String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let mut manifest = load_manifest(buffer_dir);
    let recording = manifest
        .recordings
        .iter_mut()
        .find(|r| r.file == filename)
        .ok_or_else(|| "Recording not found".to_string())?;
    recording.transcript = transcript.to_string();
    save_manifest(buffer_dir, &manifest)?;
    debug!("[voice_buffer] Updated transcript for {}", filename);
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
    fn save_recording_creates_ogg_and_manifest() {
        let dir = temp_dir();
        let samples = vec![0.0f32; 16_000]; // 1 second at 16kHz mono
        let result = save_recording(&dir, &samples, 16_000, 1, "test transcript", None);
        assert!(result.is_ok());

        let filename = result.unwrap();
        assert!(filename.ends_with(".ogg"), "Expected .ogg, got: {filename}");
        assert!(dir.join(&filename).exists());

        let manifest = load_manifest(&dir);
        assert_eq!(manifest.recordings.len(), 1);
        assert_eq!(manifest.recordings[0].transcript, "test transcript");
        assert!((manifest.recordings[0].duration_secs - 1.0).abs() < 0.01);

        // OGG Opus should be much smaller than WAV (WAV = 32044 bytes for 1s @ 16kHz)
        assert!(manifest.recordings[0].size_bytes < 10_000,
            "OGG Opus should be much smaller than WAV, got {} bytes", manifest.recordings[0].size_bytes);
        cleanup(&dir);
    }

    #[test]
    fn eviction_removes_oldest_when_full() {
        let dir = temp_dir();
        // Opus files are small (~1-2KB for short clips), so use a tiny buffer
        let samples = vec![0.1f32; 16_000]; // 1 second of audio

        // Save one to measure the Opus file size
        let f1 = save_recording(&dir, &samples, 16_000, 1, "first", Some(100 * 1024 * 1024)).unwrap();
        let manifest = load_manifest(&dir);
        let one_file_size = manifest.recordings[0].size_bytes;

        // Set max to fit only one file — second should evict first
        let small_max = one_file_size + 100; // room for one but not two
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
    fn opus_encoding_compresses_significantly() {
        // 5 seconds of audio at 16kHz mono
        let samples: Vec<f32> = (0..80_000)
            .map(|i| (i as f32 * 0.01).sin() * 0.5)
            .collect();
        let opus_bytes = encode_opus(&samples).unwrap();
        let wav_size = samples.len() * 2 + 44; // i16 samples + WAV header
        let ratio = wav_size as f64 / opus_bytes.len() as f64;
        assert!(ratio > 5.0, "Expected >5x compression, got {ratio:.1}x (WAV={wav_size}, Opus={})", opus_bytes.len());
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
