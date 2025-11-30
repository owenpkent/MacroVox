#!/usr/bin/env node

/**
 * Utility to easily add new commands to profiles
 * Usage: node add-command.js --profile=premiere --keyword=split --keys="^k" --description="Split clip"
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilesPath = path.join(__dirname, 'config', 'profiles.json');

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('profile', {
      alias: 'p',
      describe: 'Profile name (e.g., premiere, resolve, gaming)',
      type: 'string',
      demandOption: true,
    })
    .option('keyword', {
      alias: 'k',
      describe: 'Command keyword (e.g., split, zoom-in)',
      type: 'string',
      demandOption: true,
    })
    .option('keys', {
      describe: 'AutoHotkey key sequence (e.g., "^k", "^+z", "Space")',
      type: 'string',
      demandOption: true,
    })
    .option('description', {
      alias: 'd',
      describe: 'Human-readable description',
      type: 'string',
      default: '',
    })
    .option('list', {
      alias: 'l',
      describe: 'List all commands in a profile',
      type: 'boolean',
    })
    .help()
    .parse();

  try {
    // Read current profiles
    const content = fs.readFileSync(profilesPath, 'utf-8');
    const config = JSON.parse(content);

    // Validate profile exists
    if (!config.profiles[argv.profile]) {
      console.error(`✗ Profile not found: ${argv.profile}`);
      console.log(`Available profiles: ${Object.keys(config.profiles).join(', ')}`);
      process.exit(1);
    }

    // List mode
    if (argv.list) {
      const profile = config.profiles[argv.profile];
      console.log(`\nCommands in profile "${argv.profile}" (${profile.name}):\n`);
      const commands = profile.commands || {};
      for (const [keyword, cmd] of Object.entries(commands)) {
        console.log(`  ${keyword.padEnd(20)} → ${cmd.keys.padEnd(10)} (${cmd.description})`);
      }
      console.log();
      process.exit(0);
    }

    // Add command
    const profile = config.profiles[argv.profile];
    if (!profile.commands) {
      profile.commands = {};
    }

    const keyword = argv.keyword.toLowerCase();

    if (profile.commands[keyword]) {
      console.log(`⚠ Command already exists: ${keyword}`);
      console.log(`  Old: ${profile.commands[keyword].keys} (${profile.commands[keyword].description})`);
      console.log(`  New: ${argv.keys} (${argv.description})`);
      console.log('Overwriting...');
    }

    profile.commands[keyword] = {
      keys: argv.keys,
      description: argv.description || `Custom command: ${keyword}`,
    };

    // Write back to file
    fs.writeFileSync(profilesPath, JSON.stringify(config, null, 2));

    console.log(`✓ Added command to profile "${argv.profile}"`);
    console.log(`  Keyword: ${keyword}`);
    console.log(`  Keys: ${argv.keys}`);
    console.log(`  Description: ${argv.description}`);
  } catch (err) {
    console.error(`✗ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
