const config = require('./config');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;

const logger = {
  error: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  warn: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  info: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    }
  },
  debug: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  },
};

module.exports = logger;
