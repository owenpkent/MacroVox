#!/usr/bin/env node

/**
 * Test harness for AutoHotkey integration
 * Usage: node test-ahk.js
 * 
 * This will test spawning AutoHotkey with a simple command
 */

import { executeCommand } from './src/ahk.js';
import Logger from './src/logger.js';
import { config } from './src/config.js';

const logger = new Logger('info');

console.log('\n=== MacroVox AutoHotkey Integration Test ===\n');

async function runTest() {
  try {
    logger.info('Testing AutoHotkey integration...');
    logger.info(`Profile: ${config.defaultProfile}`);
    logger.info(`AHK path: ${config.ahk.path}`);
    logger.info(`Script path: ${config.ahk.scriptPath}`);

    // Test a simple command
    const keyword = 'undo';
    const profile = config.defaultProfile;

    console.log(`\nExecuting test command: "${keyword}" in profile "${profile}"`);
    console.log('(This should trigger Ctrl+Z in the active window)\n');

    await executeCommand(keyword, profile);

    console.log('\n✓ AutoHotkey executed successfully');
    console.log('If the active window supports Ctrl+Z, you should see an undo action.');
    process.exit(0);
  } catch (err) {
    logger.error('Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
