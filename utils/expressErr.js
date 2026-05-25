/**
 * Operational error class for known, expected errors.
 * These are safe to expose to the client.
 * Programmer errors (bugs) should NOT use this class.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message    - Human-readable error message
   * @param {string} [code]     - Optional machine-readable error code
   *                             e.g. 'LISTING_NOT_FOUND', 'CSRF_INVALID'
   */
  constructor(statusCode, message, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = statusCode;   // keep .status for backward compat
    this.message = message;
    this.code = code;
    this.isOperational = true;  // distinguishes from programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
