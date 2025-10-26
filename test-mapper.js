#!/usr/bin/env node

/**
 * Test harness for CommandMapper
 * Usage: node test-mapper.js
 */

import CommandMapper from './src/mapper.js';
import { config, getProfile } from './src/config.js';
import Logger from './src/logger.js';

const logger = new Logger('debug');

console.log('\n=== MacroVox Command Mapper Test ===\n');

const mapper = new CommandMapper();

// Test cases: [phrase, profile, expectedKeyword]
const testCases = [
  // Premiere exact matches
  ['undo', 'premiere', 'undo'],
  ['cut', 'premiere', 'cut'],
  ['render', 'premiere', 'render'],
  ['next frame', 'premiere', 'next frame'],
  ['reload', 'premiere', 'reload'],

  // Premiere fuzzy matches
  ['undo please', 'premiere', 'undo'],
  ['cut that', 'premiere', 'cut'],
  ['next', 'premiere', 'next frame'],
  ['zoom in', 'premiere', 'zoom in'],

  // Resolve
  ['undo', 'resolve', 'undo'],
  ['split', 'resolve', 'split'],
  ['play', 'resolve', 'play'],

  // Gaming
  ['reload', 'gaming', 'reload'],
  ['jump', 'gaming', 'jump'],
  ['crouch', 'gaming', 'crouch'],

  // Non-matches
  ['foobar', 'premiere', null],
  ['xyz', 'gaming', null],
];

let passed = 0;
let failed = 0;

for (const [phrase, profile, expected] of testCases) {
  const result = mapper.mapPhrase(phrase, profile);
  const matched = result ? result.keyword : null;
  const success = matched === expected;

  if (success) {
    passed++;
    console.log(`✓ "${phrase}" (${profile}) → "${matched}"`);
  } else {
    failed++;
    console.log(
      `✗ "${phrase}" (${profile}) → got "${matched}", expected "${expected}"`
    );
    if (result) {
      console.log(
        `  (confidence: ${result.confidence.toFixed(2)}, method: ${result.method})`
      );
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
