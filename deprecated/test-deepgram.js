#!/usr/bin/env node

/**
 * Test harness for Deepgram integration
 * Usage: node test-deepgram.js
 * 
 * This will test the Deepgram connection and live transcription
 */

import { startAudioCapture, stopAudioCapture } from './src/audio.js';
import DeepgramStreamer from './src/deepgram.js';
import Logger from './src/logger.js';
import { config } from './src/config.js';

const logger = new Logger('info');

console.log('\n=== MacroVox Deepgram Integration Test ===\n');

let testTimeout;
let transcriptCount = 0;

async function runTest() {
  try {
    logger.info('Connecting to Deepgram...');

    // Start audio capture
    const audioStream = await startAudioCapture();
    logger.info('Audio capture started');

    // Initialize Deepgram
    const deepgram = new DeepgramStreamer();

    // Start live transcription
    await deepgram.startLiveTranscription(audioStream, (data) => {
      transcriptCount++;
      const type = data.isFinal ? 'FINAL' : 'interim';
      console.log(`[${type}] ${data.transcript} (confidence: ${data.confidence.toFixed(2)})`);
    });

    console.log('\nListening for 10 seconds...');
    console.log('Speak into your microphone.\n');

    // Stop after 10 seconds
    testTimeout = setTimeout(() => {
      logger.info('Stopping test...');
      deepgram.stopLiveTranscription();
      stopAudioCapture();

      console.log(`\n✓ Test complete. Received ${transcriptCount} transcript events.`);
      if (transcriptCount === 0) {
        console.log('⚠ No transcripts received. Check:');
        console.log('  1. Microphone is connected and enabled');
        console.log('  2. DEEPGRAM_API_KEY is set in .env');
        console.log('  3. Network connection is active');
      }
      process.exit(0);
    }, 10000);
  } catch (err) {
    logger.error('Test failed:', err.message);
    if (testTimeout) clearTimeout(testTimeout);
    stopAudioCapture();
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  logger.info('Stopping...');
  if (testTimeout) clearTimeout(testTimeout);
  stopAudioCapture();
  process.exit(0);
});

runTest();
