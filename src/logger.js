const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor(level = 'info') {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  debug(msg, data) {
    if (this.level <= LOG_LEVELS.debug) {
      console.log(`[DEBUG] ${msg}`, data || '');
    }
  }

  info(msg, data) {
    if (this.level <= LOG_LEVELS.info) {
      console.log(`[INFO] ${msg}`, data || '');
    }
  }

  warn(msg, data) {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${msg}`, data || '');
    }
  }

  error(msg, data) {
    if (this.level <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${msg}`, data || '');
    }
  }
}

export default Logger;
