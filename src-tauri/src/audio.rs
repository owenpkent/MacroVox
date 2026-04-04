/// MacroVox audio utilities — Phase 3: cpal WASAPI native capture.
///
/// This module provides:
/// - `pcm_to_wav`          — encode f32 PCM samples as RIFF/WAV bytes (for Deepgram upload)
/// - `process_audio_frame` — cpal callback body; updates level meter and recording buffer
/// - `build_input_stream`  — open a cpal capture stream, dispatching on sample format

use std::sync::{Arc, Mutex};
use cpal::traits::DeviceTrait;

// ── WAV encoding ─────────────────────────────────────────────────────────────

/// Encodes interleaved f32 PCM samples as a RIFF/WAV byte vector.
///
/// Samples are clamped to `[-1.0, 1.0]` and stored as 16-bit signed PCM.
/// `channels` should match the channel count of `samples` (1 = mono, 2 = stereo).
pub fn pcm_to_wav(samples: &[f32], sample_rate: u32, channels: u16) -> Vec<u8> {
    let bits_per_sample: u16 = 16;
    let byte_rate = sample_rate * channels as u32 * bits_per_sample as u32 / 8;
    let block_align = channels * bits_per_sample / 8;
    let data_size = (samples.len() * bits_per_sample as usize / 8) as u32;
    // RIFF file size = 4 ("WAVE") + fmt chunk (24) + data chunk header (8) + data = 36 + data_size
    let riff_size = 36 + data_size;

    let mut buf = Vec::with_capacity(44 + data_size as usize);

    // RIFF header
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&riff_size.to_le_bytes());
    buf.extend_from_slice(b"WAVE");

    // fmt chunk (16-byte PCM format)
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());         // chunk size
    buf.extend_from_slice(&1u16.to_le_bytes());          // PCM = 1
    buf.extend_from_slice(&channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());

    // data chunk
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());
    for &s in samples {
        let val = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        buf.extend_from_slice(&val.to_le_bytes());
    }

    buf
}

// ── Capture callback ──────────────────────────────────────────────────────────

/// Called from the cpal input-stream callback with a slice of f32 samples.
///
/// Updates `level` with the RMS value of the frame and, when `is_recording` is
/// true, appends the samples to `buffer`.
pub fn process_audio_frame(
    data: &[f32],
    level: &Arc<Mutex<f64>>,
    buffer: &Arc<Mutex<Vec<f32>>>,
    is_recording: &Arc<Mutex<bool>>,
) {
    if data.is_empty() {
        return;
    }
    let rms = {
        let sum_sq: f32 = data.iter().map(|s| s * s).sum();
        (sum_sq / data.len() as f32).sqrt()
    };
    *level.lock().unwrap() = rms as f64;

    if *is_recording.lock().unwrap() {
        buffer.lock().unwrap().extend_from_slice(data);
    }
}

// ── Stream builder ────────────────────────────────────────────────────────────

/// Opens a cpal input stream on `device` with the given `config`.
///
/// Handles `F32`, `I16`, `I32`, and `U16` sample formats by converting to f32
/// before passing to `process_audio_frame`. Returns `StreamTypeNotSupported`
/// for other formats.
///
/// The returned `cpal::Stream` is paused; call `.play()` to start capture.
pub fn build_input_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    level: Arc<Mutex<f64>>,
    buffer: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<Mutex<bool>>,
) -> Result<cpal::Stream, cpal::BuildStreamError> {
    let err_fn = |e| eprintln!("[MacroVox audio] stream error: {e}");

    match config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config.config(),
            move |data: &[f32], _| process_audio_frame(data, &level, &buffer, &is_recording),
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => {
            device.build_input_stream(
                &config.config(),
                move |data: &[i16], _| {
                    let floats: Vec<f32> =
                        data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                    process_audio_frame(&floats, &level, &buffer, &is_recording);
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::I32 => {
            device.build_input_stream(
                &config.config(),
                move |data: &[i32], _| {
                    let floats: Vec<f32> =
                        data.iter().map(|&s| s as f32 / i32::MAX as f32).collect();
                    process_audio_frame(&floats, &level, &buffer, &is_recording);
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            device.build_input_stream(
                &config.config(),
                move |data: &[u16], _| {
                    let floats: Vec<f32> = data
                        .iter()
                        .map(|&s| (s as f32 / u16::MAX as f32) * 2.0 - 1.0)
                        .collect();
                    process_audio_frame(&floats, &level, &buffer, &is_recording);
                },
                err_fn,
                None,
            )
        }
        _ => Err(cpal::BuildStreamError::StreamTypeNotSupported),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_is_44_bytes_for_empty_samples() {
        let wav = pcm_to_wav(&[], 16000, 1);
        assert_eq!(wav.len(), 44);
    }

    #[test]
    fn wav_riff_and_wave_magic() {
        let wav = pcm_to_wav(&[0.0], 16000, 1);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[12..16], b"fmt ");
        assert_eq!(&wav[36..40], b"data");
    }

    #[test]
    fn wav_data_size_field_matches_sample_count() {
        let samples = vec![0.0f32; 100];
        let wav = pcm_to_wav(&samples, 16000, 1);
        let data_size = u32::from_le_bytes(wav[40..44].try_into().unwrap());
        // 100 samples * 2 bytes each = 200
        assert_eq!(data_size, 200);
        assert_eq!(wav.len(), 44 + 200);
    }

    #[test]
    fn wav_sample_rate_written_correctly() {
        let wav = pcm_to_wav(&[], 48000, 1);
        let sr = u32::from_le_bytes(wav[24..28].try_into().unwrap());
        assert_eq!(sr, 48000);
    }

    #[test]
    fn wav_clamps_out_of_range_samples() {
        let wav = pcm_to_wav(&[2.0, -2.0], 16000, 1);
        let s0 = i16::from_le_bytes(wav[44..46].try_into().unwrap());
        let s1 = i16::from_le_bytes(wav[46..48].try_into().unwrap());
        assert_eq!(s0, i16::MAX);
        assert_eq!(s1, -i16::MAX);
    }

    #[test]
    fn wav_stereo_block_align_is_4() {
        let wav = pcm_to_wav(&[], 48000, 2);
        let block_align = u16::from_le_bytes(wav[32..34].try_into().unwrap());
        assert_eq!(block_align, 4); // 2 channels * 2 bytes
    }

    #[test]
    fn process_audio_frame_updates_level() {
        let level = Arc::new(Mutex::new(0.0f64));
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let is_recording = Arc::new(Mutex::new(false));

        // RMS of [1.0, -1.0] = 1.0 / sqrt(1) ... actually sqrt((1+1)/2) = 1.0
        process_audio_frame(&[1.0, -1.0], &level, &buffer, &is_recording);
        let lvl = *level.lock().unwrap();
        assert!((lvl - 1.0).abs() < 1e-6, "level = {lvl}");
        assert!(buffer.lock().unwrap().is_empty(), "no buffering when not recording");
    }

    #[test]
    fn process_audio_frame_buffers_when_recording() {
        let level = Arc::new(Mutex::new(0.0f64));
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let is_recording = Arc::new(Mutex::new(true));

        process_audio_frame(&[0.1, 0.2, 0.3], &level, &buffer, &is_recording);
        let buf = buffer.lock().unwrap().clone();
        assert_eq!(buf, vec![0.1, 0.2, 0.3]);
    }

    #[test]
    fn process_audio_frame_ignores_empty_slice() {
        let level = Arc::new(Mutex::new(0.5f64));
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let is_recording = Arc::new(Mutex::new(false));
        process_audio_frame(&[], &level, &buffer, &is_recording);
        // level unchanged
        assert!((0.5 - *level.lock().unwrap()).abs() < 1e-9);
    }
}
