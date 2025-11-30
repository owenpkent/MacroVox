import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';
import { config } from './config.js';

const logger = new Logger(config.logLevel);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Profile manager for switching between profiles and persisting state
 */
class ProfileManager {
  constructor() {
    this.currentProfile = config.defaultProfile;
    this.profileStateFile = path.join(projectRoot, '.profile-state.json');
    this.loadProfileState();
  }

  /**
   * Load the last used profile from persistent state
   */
  loadProfileState() {
    try {
      // Check for CLI override first
      if (process.env.CLI_PROFILE_OVERRIDE) {
        this.currentProfile = process.env.CLI_PROFILE_OVERRIDE;
        logger.info(`Using CLI profile override: ${this.currentProfile}`);
        return;
      }

      if (fs.existsSync(this.profileStateFile)) {
        const state = JSON.parse(fs.readFileSync(this.profileStateFile, 'utf-8'));
        if (state.currentProfile && config.profiles[state.currentProfile]) {
          this.currentProfile = state.currentProfile;
          logger.info(`Loaded profile from state: ${this.currentProfile}`);
        }
      }
    } catch (err) {
      logger.warn(`Failed to load profile state: ${err.message}`);
    }
  }

  /**
   * Save current profile to persistent state
   */
  saveProfileState() {
    try {
      fs.writeFileSync(
        this.profileStateFile,
        JSON.stringify({ currentProfile: this.currentProfile }, null, 2)
      );
      logger.debug(`Saved profile state: ${this.currentProfile}`);
    } catch (err) {
      logger.warn(`Failed to save profile state: ${err.message}`);
    }
  }

  /**
   * Get current profile name
   */
  getCurrentProfile() {
    return this.currentProfile;
  }

  /**
   * Switch to a different profile
   */
  switchProfile(profileName) {
    if (!config.profiles[profileName]) {
      logger.warn(`Profile not found: ${profileName}`);
      return false;
    }

    this.currentProfile = profileName;
    this.saveProfileState();
    logger.info(`Switched to profile: ${profileName}`);
    return true;
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles() {
    return Object.keys(config.profiles);
  }

  /**
   * Get profile display name
   */
  getProfileName(profileKey) {
    const profile = config.profiles[profileKey];
    return profile ? profile.name : profileKey;
  }

  /**
   * Map a profile-switch phrase to a profile name
   * E.g., "premiere mode" → "premiere", "gaming" → "gaming"
   */
  mapProfilePhrase(phrase) {
    const normalized = phrase.toLowerCase().trim();

    // Direct match
    if (config.profiles[normalized]) {
      return normalized;
    }

    // Match with " mode" suffix
    const withoutMode = normalized.replace(/\s+mode\s*$/, '');
    if (config.profiles[withoutMode]) {
      return withoutMode;
    }

    // Substring match
    for (const profileKey of Object.keys(config.profiles)) {
      if (normalized.includes(profileKey) || profileKey.includes(normalized)) {
        return profileKey;
      }
    }

    return null;
  }
}

export default ProfileManager;
