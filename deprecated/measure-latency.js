#!/usr/bin/env node

/**
 * Measure end-to-end latency of MacroVox
 * 
 * This script measures the time from when audio is captured
 * to when the command is executed.
 * 
 * Usage: node measure-latency.js [--iterations=5]
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

class LatencyMeasurer {
  constructor(options = {}) {
    this.iterations = options.iterations || 5;
    this.profile = options.profile || config.defaultProfile;
    this.measurements = [];
    this.deepgramStreamer = null;
    this.commandMapper = null;
    this.profileManager = null;
  }

  async run() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    MacroVox Latency Measurement        ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Initialize
      this.profileManager = new ProfileManager();
      process.env.CLI_PROFILE_OVERRIDE = this.profile;
      this.profileManager.loadProfileState();
      this.commandMapper = new CommandMapper();

      console.log(`Profile: ${this.profileManager.getProfileName(this.profile)}`);
      console.log(`Iterations: ${this.iterations}`);
      console.log(`\nInstructions:`);
      console.log('1. Open a text editor (Notepad, VS Code, etc.)');
      console.log('2. Click in the editor to focus it');
      console.log('3. When prompted, say "undo" clearly');
      console.log('4. Latency will be measured from speech to action\n');

      console.log('Press Enter to start...');
      await this.waitForEnter();

      // Run measurements
      for (let i = 0; i < this.iterations; i++) {
        console.log(`\n[${i + 1}/${this.iterations}] Measuring latency...`);
        console.log('Say "undo" now...\n');
        await this.measureLatency();
      }

      // Print results
      this.printResults();
    } catch (err) {
      logger.error(`Measurement failed: ${err.message}`);
      process.exit(1);
    }
  }

  async measureLatency() {
    return new Promise((resolve) => {
      try {
        const audioStream = this.startAudioCapture();
        this.deepgramStreamer = new DeepgramStreamer();

        const captureTime = Date.now();
        let firstTranscriptTime = null;
        let matchTime = null;
        let executeTime = null;

        const transcriptHandler = async (data) => {
          const { transcript, isFinal, confidence } = data;

          if (!firstTranscriptTime) {
            firstTranscriptTime = Date.now();
          }

          if (isFinal && confidence >= config.mapping.minConfidence) {
            const match = this.commandMapper.mapPhrase(transcript, this.profile);

            if (match && match.keyword === 'undo') {
              matchTime = Date.now();

              // Execute command
              try {
                await executeCommand(match.keyword, this.profile);
                executeTime = Date.now();

                // Stop listening
                this.deepgramStreamer.stopLiveTranscription();
                stopAudioCapture();

                // Calculate latencies
                const transcriptLatency = firstTranscriptTime - captureTime;
                const matchLatency = matchTime - captureTime;
                const executeLatency = executeTime - captureTime;

                this.measurements.push({
                  transcript,
                  transcriptLatency,
                  matchLatency,
                  executeLatency,
                  confidence,
                });

                console.log(`  Transcript: ${transcriptLatency}ms`);
                console.log(`  Match: ${matchLatency}ms`);
                console.log(`  Execute: ${executeLatency}ms`);

                resolve();
              } catch (err) {
                logger.error(`Execution failed: ${err.message}`);
                resolve();
              }
            }
          }
        };

        this.deepgramStreamer.startLiveTranscription(audioStream, transcriptHandler)
          .catch(err => {
            logger.error(`Streaming error: ${err.message}`);
            resolve();
          });

        // Timeout after 10 seconds
        setTimeout(() => {
          this.deepgramStreamer.stopLiveTranscription();
          stopAudioCapture();
          logger.warn('Timeout: no matching command detected');
          resolve();
        }, 10000);
      } catch (err) {
        logger.error(`Measurement error: ${err.message}`);
        resolve();
      }
    });
  }


  async waitForEnter() {
    return new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
  }

  printResults() {
    if (this.measurements.length === 0) {
      console.log('\n❌ No measurements collected');
      process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         Latency Results                ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Calculate statistics
    const transcriptLatencies = this.measurements.map(m => m.transcriptLatency);
    const matchLatencies = this.measurements.map(m => m.matchLatency);
    const executeLatencies = this.measurements.map(m => m.executeLatency);

    const stats = {
      transcript: this.calculateStats(transcriptLatencies),
      match: this.calculateStats(matchLatencies),
      execute: this.calculateStats(executeLatencies),
    };

    // Print detailed results
    console.log('Detailed Measurements:\n');
    this.measurements.forEach((m, i) => {
      console.log(`${i + 1}. "${m.transcript}" (confidence: ${m.confidence.toFixed(2)})`);
      console.log(`   Transcript: ${m.transcriptLatency}ms`);
      console.log(`   Match:      ${m.matchLatency}ms`);
      console.log(`   Execute:    ${m.executeLatency}ms`);
    });

    // Print statistics
    console.log('\n' + '═'.repeat(40));
    console.log('Statistics:\n');

    this.printStatTable('Transcript Latency', stats.transcript);
    this.printStatTable('Match Latency', stats.match);
    this.printStatTable('Execute Latency', stats.execute);

    // Print recommendations
    console.log('\n' + '═'.repeat(40));
    console.log('Recommendations:\n');

    const avgExecute = stats.execute.avg;
    if (avgExecute < 300) {
      console.log('✅ Excellent latency (<300ms)');
    } else if (avgExecute < 500) {
      console.log('✓ Good latency (<500ms)');
    } else if (avgExecute < 1000) {
      console.log('⚠ Acceptable latency (<1s)');
      console.log('  Consider:');
      console.log('  - Reducing endpointing in config/app.json');
      console.log('  - Lowering fuzzyThreshold');
      console.log('  - Checking network latency to Deepgram');
    } else {
      console.log('❌ High latency (>1s)');
      console.log('  Issues:');
      console.log('  - Check Deepgram API latency');
      console.log('  - Verify network connection');
      console.log('  - Check system CPU usage');
      console.log('  - Reduce endpointing value');
    }

    console.log();
  }

  calculateStats(values) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(values.reduce((a, b) => a + b) / values.length);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { min, max, avg, median };
  }

  printStatTable(label, stats) {
    console.log(`${label}:`);
    console.log(`  Min:    ${stats.min}ms`);
    console.log(`  Max:    ${stats.max}ms`);
    console.log(`  Avg:    ${stats.avg}ms`);
    console.log(`  Median: ${stats.median}ms`);
    console.log();
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('iterations', {
      alias: 'i',
      describe: 'Number of measurements to take',
      type: 'number',
      default: 5,
    })
    .option('profile', {
      alias: 'p',
      describe: 'Profile to use',
      type: 'string',
      default: config.defaultProfile,
    })
    .help()
    .parse();

  const measurer = new LatencyMeasurer({
    iterations: argv.iterations,
    profile: argv.profile,
  });

  await measurer.run();
}

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
