/**
 * BrainBrief - Centralized Logger
 * 
 * Purpose: Consistent logging across all modules with levels and formatting
 * Dependencies: Node.js fs (for file logging in future)
 * 
 * @module logger
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_TO_FILE = false; // TODO(v1.1): Enable file logging
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

// Log levels (higher number = more verbose)
const LEVELS = {
  ERROR: 0,
  WARN: 1,
  SUCCESS: 2,
  INFO: 3,
  DEBUG: 4
};

// Colors for console output
const COLORS = {
  ERROR: '\x1b[31m',   // Red
  WARN: '\x1b[33m',    // Yellow
  SUCCESS: '\x1b[32m', // Green
  INFO: '\x1b[36m',    // Cyan
  DEBUG: '\x1b[90m',   // Gray
  RESET: '\x1b[0m'
};

// Icons for log levels
const ICONS = {
  ERROR: '❌',
  WARN: '⚠️',
  SUCCESS: '✅',
  INFO: 'ℹ️',
  DEBUG: '🔍'
};

/**
 * Format timestamp
 * 
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format log message
 * 
 * @param {string} level - Log level (ERROR, WARN, SUCCESS, INFO, DEBUG)
 * @param {string} module - Module name (twitter, db, ui, etc)
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
function formatMessage(level, module, message) {
  const timestamp = getTimestamp();
  const icon = ICONS[level];
  const moduleName = module ? `[${module}]` : '';
  
  return `[${timestamp}] ${icon} ${moduleName} ${message}`;
}

/**
 * Write log to console (and file in future)
 * 
 * @param {string} level - Log level
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {any} data - Optional data to log
 */
function writeLog(level, module, message, data = null) {
  // Check if this log level should be shown
  if (LEVELS[level] > LEVELS[LOG_LEVEL]) {
    return;
  }
  
  const formattedMessage = formatMessage(level, module, message);
  const color = COLORS[level];
  const reset = COLORS.RESET;
  
  // Console output with color
  if (data) {
    console.log(`${color}${formattedMessage}${reset}`, data);
  } else {
    console.log(`${color}${formattedMessage}${reset}`);
  }
  
  // TODO(v1.1): Write to file
  // if (LOG_TO_FILE) {
  //   fs.appendFileSync(logFilePath, `${formattedMessage}\n`);
  // }
}

/**
 * Public API
 */
const logger = {
  /**
   * Log error message
   * 
   * @param {string} message - Error message
   * @param {Error|string} error - Error object or string
   * @param {string} module - Module name (optional)
   */
  error(message, error = null, module = null) {
    const errorMessage = error ? (error.message || error) : '';
    const fullMessage = errorMessage ? `${message}: ${errorMessage}` : message;
    writeLog('ERROR', module, fullMessage);
  },
  
  /**
   * Log warning message
   * 
   * @param {string} message - Warning message
   * @param {string} module - Module name (optional)
   */
  warn(message, module = null) {
    writeLog('WARN', module, message);
  },
  
  /**
   * Log success message
   * 
   * @param {string} message - Success message
   * @param {string} module - Module name (optional)
   */
  success(message, module = null) {
    writeLog('SUCCESS', module, message);
  },
  
  /**
   * Log info message
   * 
   * @param {string} message - Info message
   * @param {string} module - Module name (optional)
   */
  info(message, module = null) {
    writeLog('INFO', module, message);
  },
  
  /**
   * Log debug message (dev only)
   * 
   * @param {string} message - Debug message
   * @param {any} data - Data to log (optional)
   * @param {string} module - Module name (optional)
   */
  debug(message, data = null, module = null) {
    writeLog('DEBUG', module, message, data);
  }
};

module.exports = logger;

