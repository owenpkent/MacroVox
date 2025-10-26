#!/usr/bin/env node

/**
 * Test harness for audio capture
 * Usage: node test-audio.js
 * 
 * This will capture 5 seconds of audio and save it to test-audio.wav
 */

import { startAudioCapture, stopAudioCapture, getAudioStream } from './src/audio.js';
import fs from 'fs';
import Logger from './src/logger.js';
import { config } from './src/config.js';

const logger = new Logger('info');

console.log('\n=== MacroVox Audio Capture Test ===\n');
console.log('Recording for 5 seconds...');
console.log('Speak into your microphone.\n');

let recordedData = Buffer.alloc(0);
let isRecording = false;

async function runTest() {
  try {
    // Start audio capture
    const stream = await startAudioCapture();
    isRecording = true;

    // Collect audio data
    stream.on('data', (chunk) => {
      recordedData = Buffer.concat([recordedData, chunk]);
    });

    stream.on('error', (err) => {
      logger.error('Stream error:', err.message);
    });

    // Stop after 5 seconds
    setTimeout(() => {
      stopAudioCapture();
      isRecording = false;

      // Save to file
      const filename = 'test-audio.wav';
      fs.writeFileSync(filename, recordedData);
      console.log(`\n✓ Audio saved to ${filename} (${recordedData.length} bytes)`);
      console.log(`  Sample rate: ${config.audio.sampleRate} Hz`);
      console.log(`  Channels: ${config.audio.channels}`);
      console.log(`  Bit depth: ${config.audio.bitDepth}`);
      console.log('\nYou can test this audio with Deepgram or another speech-to-text service.');
      process.exit(0);
    }, 5000);
  } catch (err) {
    logger.error('Test failed:', err.message);
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  if (isRecording) {
    logger.info('Stopping...');
    stopAudioCapture();
    isRecording = false;
  }
  process.exit(0);
});

runTest();
