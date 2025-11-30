import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import Logger from './logger.js';
import { config } from './config.js';

const logger = new Logger(config.logLevel);

/**
 * Find AutoHotkey executable
 */
function findAutoHotkey() {
  const candidates = [
    'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe',
    'C:\\Program Files\\AutoHotkey\\AutoHotkey.exe',
    'C:\\Program Files (x86)\\AutoHotkey\\AutoHotkey.exe',
    'C:\\Program Files\\AutoHotkey v2\\AutoHotkey.exe',
    'C:\\Program Files (x86)\\AutoHotkey v2\\AutoHotkey.exe',
  ];
  
  // Check each candidate
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.debug(`Found AutoHotkey at: ${candidate}`);
      return candidate;
    }
  }
  
  // Fallback to PATH
  logger.debug('AutoHotkey not found in common locations, trying PATH');
  return 'AutoHotkey.exe';
}

/**
 * Execute a macro via AutoHotkey
 * @param {string} keyword - Command keyword (e.g., 'undo', 'cut')
 * @param {string} profileName - Profile name (e.g., 'premiere')
 * @returns {Promise<void>}
 */
export async function executeCommand(keyword, profileName) {
  return new Promise((resolve, reject) => {
    try {
      const scriptPath = config.ahk.scriptPath;
      const ahkExe = findAutoHotkey();

      logger.info(`Executing command: ${keyword} (profile: ${profileName})`);

      // Spawn AutoHotkey with arguments
      const child = spawn(ahkExe, [scriptPath, `--keyword=${keyword}`, `--profile=${profileName}`], {
        windowsHide: false,
        stdio: 'pipe',
      });

      const timeout = setTimeout(() => {
        child.kill();
        logger.warn(`AutoHotkey execution timed out for keyword: ${keyword}`);
        reject(new Error(`Timeout executing ${keyword}`));
      }, config.ahk.timeout || 5000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          logger.debug(`AutoHotkey executed successfully: ${keyword}`);
          resolve();
        } else {
          logger.warn(`AutoHotkey exited with code ${code} for keyword: ${keyword}`);
          reject(new Error(`AutoHotkey exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        logger.error(`Failed to spawn AutoHotkey: ${err.message}`);
        reject(err);
      });

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          logger.debug(`AHK stdout: ${data.toString().trim()}`);
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          logger.warn(`AHK stderr: ${data.toString().trim()}`);
        });
      }
    } catch (err) {
      logger.error(`Error executing command: ${err.message}`);
      reject(err);
    }
  });
}
