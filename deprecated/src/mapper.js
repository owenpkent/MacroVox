import { distance } from 'fastest-levenshtein';
import Logger from './logger.js';
import { config, getCommand } from './config.js';

const logger = new Logger(config.logLevel);

class CommandMapper {
  constructor() {
    this.lastCommandTime = 0;
    this.lastCommand = null;
    this.dedupeWindow = config.mapping.dedupeWindow || 500;
    this.fuzzyThreshold = config.mapping.fuzzyThreshold || 0.8;
    this.minConfidence = config.mapping.minConfidence || 0.5;
  }

  /**
   * Map a recognized phrase to a command keyword
   * @param {string} phrase - Recognized text from Deepgram
   * @param {string} profileName - Current profile (e.g., 'premiere')
   * @returns {object|null} { keyword, command, confidence } or null
   */
  mapPhrase(phrase, profileName) {
    if (!phrase || !profileName) return null;

    const profile = config.profiles[profileName];
    if (!profile) {
      logger.warn(`Profile not found: ${profileName}`);
      return null;
    }

    const normalizedPhrase = phrase.toLowerCase().trim();
    const commands = profile.commands || {};
    const keywords = Object.keys(commands);

    if (keywords.length === 0) {
      logger.warn(`No commands defined for profile: ${profileName}`);
      return null;
    }

    // Exact match (highest priority)
    if (keywords.includes(normalizedPhrase)) {
      return {
        keyword: normalizedPhrase,
        command: commands[normalizedPhrase],
        confidence: 1.0,
        method: 'exact',
      };
    }

    // Fuzzy match using Levenshtein distance
    let bestMatch = null;
    let bestScore = 0;

    for (const keyword of keywords) {
      const similarity = this.calculateSimilarity(normalizedPhrase, keyword);
      if (similarity > bestScore && similarity >= this.fuzzyThreshold) {
        bestScore = similarity;
        bestMatch = keyword;
      }
    }

    if (bestMatch) {
      return {
        keyword: bestMatch,
        command: commands[bestMatch],
        confidence: bestScore,
        method: 'fuzzy',
      };
    }

    // Substring match (e.g., "next" matches "next frame")
    for (const keyword of keywords) {
      if (keyword.includes(normalizedPhrase) || normalizedPhrase.includes(keyword)) {
        const confidence = Math.max(
          normalizedPhrase.length / keyword.length,
          keyword.length / normalizedPhrase.length
        );
        if (confidence >= this.fuzzyThreshold) {
          return {
            keyword,
            command: commands[keyword],
            confidence,
            method: 'substring',
          };
        }
      }
    }

    logger.debug(`No match found for phrase: "${phrase}" in profile: ${profileName}`);
    return null;
  }

  /**
   * Calculate similarity between two strings (0 to 1)
   */
  calculateSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    const lev = distance(str1, str2);
    return 1 - lev / maxLen;
  }

  /**
   * Check if command should be executed (dedupe check)
   */
  shouldExecute(keyword, profileName) {
    const now = Date.now();
    const timeSinceLastCommand = now - this.lastCommandTime;

    // Dedupe: ignore if same command within window
    if (
      this.lastCommand === keyword &&
      timeSinceLastCommand < this.dedupeWindow
    ) {
      logger.debug(
        `Deduped command "${keyword}" (${timeSinceLastCommand}ms since last)`
      );
      return false;
    }

    this.lastCommand = keyword;
    this.lastCommandTime = now;
    return true;
  }
}

export default CommandMapper;
