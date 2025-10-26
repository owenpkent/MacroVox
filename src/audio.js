import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import Logger from './logger.js';
import { config } from './config.js';

const logger = new Logger(config.logLevel);

let recordingProcess = null;
let audioStream = null;

export async function startAudioCapture() {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Starting audio capture from default microphone...');
      
      // Create a PassThrough stream to wrap ffmpeg output
      audioStream = new PassThrough();
      
      // Use ffmpeg to capture audio from Windows microphone  
      // Directly use the Shure MV7+ microphone (skip device detection for speed)
      const ffmpegPath = 'C:\\Tools\\ffmpeg-8.0-full_build\\bin\\ffmpeg.exe';
      const deviceName = 'Microphone (4- Shure MV7+)';
      logger.info(`Using default audio input device`);
      
      recordingProcess = spawn(ffmpegPath, [
        '-f', 'dshow',
        '-i', 'audio=Microphone (4- Shure MV7+)',
        '-acodec', 'pcm_s16le',
        '-ar', config.audio.sampleRate.toString(),
        '-ac', config.audio.channels.toString(),
        '-f', 's16le',
        'pipe:1'
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      
      recordingProcess.on('error', (err) => {
        logger.error('Audio capture error:', err.message);
        audioStream.destroy(err);
        reject(err);
      });

      let ffmpegStarted = false;
      recordingProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        // Log all messages to see what's happening
        if (msg) {
          logger.info(`ffmpeg: ${msg}`);
          // Check if ffmpeg actually started capturing
          if (msg.includes('size=') || msg.includes('time=')) {
            ffmpegStarted = true;
          }
        }
      });

      // Pipe ffmpeg stdout to our PassThrough stream
      recordingProcess.stdout.pipe(audioStream);
      
      // Wait for ffmpeg to actually start capturing before resolving
      setTimeout(() => {
        logger.info('Audio capture started successfully');
        resolve(audioStream);
      }, 1000);
    } catch (err) {
      logger.error('Failed to start audio capture:', err.message);
      reject(err);
    }
  });
}

export function stopAudioCapture() {
  if (recordingProcess) {
    logger.info('Stopping audio capture...');
    recordingProcess.kill();
    recordingProcess = null;
  }
}

export function getAudioStream() {
  return recordingProcess ? recordingProcess.stdout : null;
}
