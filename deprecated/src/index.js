import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startAudioCapture, stopAudioCapture, getAudioStream } from './audio.js';
import DeepgramStreamer from './deepgram.js';
import CommandMapper from './mapper.js';
import ProfileManager from './profiles.js';
import { executeCommand } from './ahk.js';
import Logger from './logger.js';
import { config, getProfile } from './config.js';

const logger = new Logger(config.logLevel);

let profileManager = null;
let deepgramStreamer = null;
let commandMapper = null;
let isRunning = false;

/**
 * Handle transcript from Deepgram
 */
async function handleTranscript(data) {
  const { transcript, isFinal, confidence } = data;

  // Log ALL transcripts so user can see what's being heard
  logger.info(`[${isFinal ? 'FINAL' : 'interim'}] Heard: "${transcript}" (confidence: ${confidence?.toFixed(2) || 'N/A'})`);

  // Only process final transcripts
  if (!isFinal) {
    return;
  }

  // Only act on final transcripts with sufficient confidence
  if (!isFinal || confidence < config.mapping.minConfidence) {
    return;
  }

  const currentProfile = profileManager.getCurrentProfile();

  // Check if this is a profile-switch command
  const profileMatch = profileManager.mapProfilePhrase(transcript);
  if (profileMatch && profileMatch !== currentProfile) {
    logger.info(`Profile switch detected: "${transcript}" → ${profileMatch}`);
    profileManager.switchProfile(profileMatch);
    logger.info(`✓ Switched to profile: ${profileManager.getProfileName(profileMatch)}`);
    return;
  }

  // Map phrase to command
  logger.info(`Trying to map: "${transcript}" in profile: ${currentProfile}`);
  const match = commandMapper.mapPhrase(transcript, currentProfile);
  if (!match) {
    logger.info(`❌ No command match for: "${transcript}"`);
    return;
  }

  logger.info(
    `Matched: "${transcript}" → "${match.keyword}" (confidence: ${match.confidence.toFixed(2)}, method: ${match.method})`
  );

  // Dedupe check
  if (!commandMapper.shouldExecute(match.keyword, currentProfile)) {
    return;
  }

  // Execute command
  try {
    await executeCommand(match.keyword, currentProfile);
    logger.info(`✓ Executed: ${match.keyword}`);
  } catch (err) {
    logger.error(`Failed to execute command: ${err.message}`);
  }
}

/**
 * Initialize and start the listener
 */
async function start() {
  try {
    // Initialize profile manager
    profileManager = new ProfileManager();
    const currentProfile = profileManager.getCurrentProfile();

    logger.info('MacroVox starting...');
    logger.info(`Current profile: ${profileManager.getProfileName(currentProfile)}`);
    logger.info(`Available profiles: ${profileManager.getAvailableProfiles().map(p => profileManager.getProfileName(p)).join(', ')}`);

    // Validate profile
    const profile = getProfile(currentProfile);
    if (!profile) {
      throw new Error(`Profile not found: ${currentProfile}`);
    }

    // Initialize mapper
    commandMapper = new CommandMapper();

    // Start audio capture
    const audioStream = await startAudioCapture();

    // Initialize Deepgram
    deepgramStreamer = new DeepgramStreamer();

    // Start live transcription
    await deepgramStreamer.startLiveTranscription(audioStream, handleTranscript);

    isRunning = true;
    logger.info('MacroVox is listening... (press Ctrl+C to stop)');
    logger.info('Say a profile name (e.g., "premiere", "gaming") to switch profiles');
  } catch (err) {
    logger.error(`Failed to start MacroVox: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Parse command-line arguments
 */
async function parseArgs() {
  const argv = await yargs(hideBin(process.argv))
    .option('profile', {
      alias: 'p',
      describe: 'Start with a specific profile',
      type: 'string',
      choices: Object.keys(config.profiles),
    })
    .option('list-profiles', {
      describe: 'List all available profiles and exit',
      type: 'boolean',
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose logging',
      type: 'boolean',
    })
    .help()
    .parse();

  // List profiles and exit
  if (argv.listProfiles) {
    console.log('\nAvailable profiles:');
    for (const [key, profile] of Object.entries(config.profiles)) {
      const commands = Object.keys(profile.commands || {});
      console.log(`  ${key}: ${profile.name} (${commands.length} commands)`);
    }
    process.exit(0);
  }

  // Override profile if specified
  if (argv.profile) {
    logger.info(`CLI override: using profile "${argv.profile}"`);
    // Store in a temp env var to be picked up by ProfileManager
    process.env.CLI_PROFILE_OVERRIDE = argv.profile;
  }

  // Override verbose if specified
  if (argv.verbose) {
    process.env.VERBOSE = 'true';
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  logger.info('Shutting down MacroVox...');
  isRunning = false;

  if (deepgramStreamer) {
    deepgramStreamer.stopLiveTranscription();
  }

  stopAudioCapture();
  logger.info('MacroVox stopped');
  process.exit(0);
}

// Handle signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the application
(async () => {
  await parseArgs();
  await start();
})();
