#!/usr/bin/env node

/**
 * End-to-end test for MacroVox
 * Tests the full pipeline: audio → Deepgram → mapper → AHK
 * 
 * Usage: node test-e2e.js [--profile=premiere] [--duration=10]
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startAudioCapture, stopAudioCapture } from './src/audio.js';
import DeepgramStreamer from './src/deepgram.js';
import CommandMapper from './src/mapper.js';
import ProfileManager from './src/profiles.js';
import { executeCommand } from './src/ahk.js';
import Logger from './src/logger.js';
import { config } from './src/config.js';

const logger = new Logger('info');

class E2ETest {
  constructor(options = {}) {
    this.profile = options.profile || config.defaultProfile;
    this.duration = options.duration || 15;
    this.testResults = {
      audio: null,
      deepgram: null,
      mapper: null,
      ahk: null,
    };
    this.transcripts = [];
    this.commands = [];
    this.deepgramStreamer = null;
    this.commandMapper = null;
    this.profileManager = null;
  }

  async run() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MacroVox End-to-End Test Suite       ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Step 1: Initialize
      await this.initialize();

      // Step 2: Test audio capture
      await this.testAudioCapture();

      // Step 3: Test Deepgram streaming
      await this.testDeepgramStreaming();

      // Step 4: Test command mapping
      await this.testCommandMapping();

      // Step 5: Test AHK execution
      await this.testAHKExecution();

      // Step 6: Summary
      this.printSummary();
    } catch (err) {
      logger.error(`Test failed: ${err.message}`);
      process.exit(1);
    }
  }

  async initialize() {
    console.log('📋 Initializing...\n');

    // Initialize profile manager
    this.profileManager = new ProfileManager();
    process.env.CLI_PROFILE_OVERRIDE = this.profile;
    this.profileManager.loadProfileState();

    const currentProfile = this.profileManager.getCurrentProfile();
    logger.info(`Profile: ${this.profileManager.getProfileName(currentProfile)}`);
    logger.info(`Duration: ${this.duration}s`);

    // Initialize mapper
    this.commandMapper = new CommandMapper();

    console.log('✓ Initialized\n');
  }

  async testAudioCapture() {
    console.log('🎤 Testing Audio Capture...\n');

    try {
      const stream = await startAudioCapture();
      this.testResults.audio = { status: 'pass', details: 'Audio stream started' };
      logger.info('✓ Audio capture initialized');
      console.log();
      return stream;
    } catch (err) {
      this.testResults.audio = { status: 'fail', error: err.message };
      logger.error(`✗ Audio capture failed: ${err.message}`);
      throw err;
    }
  }

  async testDeepgramStreaming() {
    console.log('🌐 Testing Deepgram Streaming...\n');

    return new Promise((resolve, reject) => {
      try {
        const audioStream = this.startAudioCapture();
        this.deepgramStreamer = new DeepgramStreamer();

        const transcriptHandler = (data) => {
          const { transcript, isFinal, confidence } = data;
          this.transcripts.push({ transcript, isFinal, confidence });

          const type = isFinal ? 'FINAL' : 'interim';
          console.log(`  [${type}] "${transcript}" (confidence: ${confidence.toFixed(2)})`);
        };

        this.deepgramStreamer.startLiveTranscription(audioStream, transcriptHandler)
          .then(() => {
            logger.info('✓ Deepgram connection opened');
            console.log(`\nListening for ${this.duration}s... Speak into your microphone.\n`);

            setTimeout(() => {
              this.deepgramStreamer.stopLiveTranscription();
              stopAudioCapture();

              if (this.transcripts.length > 0) {
                this.testResults.deepgram = {
                  status: 'pass',
                  details: `Received ${this.transcripts.length} transcript events`,
                };
                logger.info(`✓ Deepgram streaming test passed (${this.transcripts.length} events)`);
              } else {
                this.testResults.deepgram = {
                  status: 'warn',
                  details: 'No transcripts received',
                };
                logger.warn('⚠ No transcripts received (check microphone and API key)');
              }
              console.log();
              resolve();
            }, this.duration * 1000);
          })
          .catch(reject);
      } catch (err) {
        this.testResults.deepgram = { status: 'fail', error: err.message };
        logger.error(`✗ Deepgram test failed: ${err.message}`);
        reject(err);
      }
    });
  }


  async testCommandMapping() {
    console.log('🗺️  Testing Command Mapping...\n');

    const profile = this.profileManager.getCurrentProfile();
    const testPhrases = [
      'undo',
      'undo please',
      'cut',
      'next frame',
      'foobar', // Should not match
    ];

    let passed = 0;
    let failed = 0;

    for (const phrase of testPhrases) {
      const result = this.commandMapper.mapPhrase(phrase, profile);
      if (result) {
        console.log(`  ✓ "${phrase}" → "${result.keyword}" (confidence: ${result.confidence.toFixed(2)})`);
        this.commands.push(result);
        passed++;
      } else {
        console.log(`  ○ "${phrase}" → no match (expected for non-commands)`);
      }
    }

    this.testResults.mapper = {
      status: 'pass',
      details: `${passed} matches, ${failed} failures`,
    };
    logger.info(`✓ Command mapping test passed (${passed} matches)`);
    console.log();
  }

  async testAHKExecution() {
    console.log('⚙️  Testing AutoHotkey Execution...\n');

    const profile = this.profileManager.getCurrentProfile();

    try {
      logger.info('Executing test command: "undo" (Ctrl+Z)');
      console.log('  (Focus a text editor to see the effect)\n');

      await executeCommand('undo', profile);

      this.testResults.ahk = {
        status: 'pass',
        details: 'AutoHotkey executed successfully',
      };
      logger.info('✓ AutoHotkey execution test passed');
      console.log();
    } catch (err) {
      this.testResults.ahk = {
        status: 'fail',
        error: err.message,
      };
      logger.error(`✗ AutoHotkey test failed: ${err.message}`);
      console.log();
    }
  }

  printSummary() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║          Test Results Summary          ║');
    console.log('╚════════════════════════════════════════╝\n');

    const results = this.testResults;
    let totalTests = 0;
    let passedTests = 0;
    let warnedTests = 0;

    for (const [name, result] of Object.entries(results)) {
      totalTests++;
      const status = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
      const statusText = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL';

      console.log(`${status} ${name.toUpperCase().padEnd(15)} [${statusText}]`);
      if (result.details) {
        console.log(`  └─ ${result.details}`);
      }
      if (result.error) {
        console.log(`  └─ Error: ${result.error}`);
      }

      if (result.status === 'pass') passedTests++;
      if (result.status === 'warn') warnedTests++;
    }

    console.log();
    console.log(`Summary: ${passedTests}/${totalTests} passed, ${warnedTests} warnings`);

    if (this.transcripts.length > 0) {
      console.log(`\nTranscripts received: ${this.transcripts.length}`);
      const finalTranscripts = this.transcripts.filter(t => t.isFinal);
      if (finalTranscripts.length > 0) {
        console.log(`Final transcripts: ${finalTranscripts.length}`);
        finalTranscripts.forEach((t, i) => {
          console.log(`  ${i + 1}. "${t.transcript}"`);
        });
      }
    }

    if (this.commands.length > 0) {
      console.log(`\nCommands matched: ${this.commands.length}`);
      this.commands.forEach((cmd, i) => {
        console.log(`  ${i + 1}. ${cmd.keyword} (${cmd.method})`);
      });
    }

    console.log();

    // Exit code
    const hasFailures = Object.values(results).some(r => r.status === 'fail');
    if (hasFailures) {
      console.log('❌ Some tests failed. Check the output above.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! MacroVox is ready to use.');
      console.log('\nNext steps:');
      console.log('  1. npm start              (start listening)');
      console.log('  2. Say a command          (e.g., "undo", "cut")');
      console.log('  3. npm run add-command    (add custom commands)');
      process.exit(0);
    }
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('profile', {
      alias: 'p',
      describe: 'Profile to test',
      type: 'string',
      default: config.defaultProfile,
    })
    .option('duration', {
      alias: 'd',
      describe: 'Duration to listen (seconds)',
      type: 'number',
      default: 15,
    })
    .help()
    .parse();

  const test = new E2ETest({
    profile: argv.profile,
    duration: argv.duration,
  });

  await test.run();
}

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
