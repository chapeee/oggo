/**
 * Base application error with HTTP status and machine-readable code.
 */
class AppError extends Error {
  /**
   * @param {string} message Human-readable error message.
   * @param {number} status HTTP status code.
   * @param {string} code Machine-readable error code.
   * @param {Record<string, unknown>} [context] Optional contextual metadata.
   * @param {Error} [cause] Original wrapped error.
   */
  constructor(message, status = 500, code = "INTERNAL_ERROR", context = {}, cause) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.context = context;
    this.cause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 * @param {Error} [cause]
 * @returns {AppError}
 */
function validationError(message, context = {}, cause) {
  return new AppError(message, 400, "VALIDATION_ERROR", context, cause);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 * @param {Error} [cause]
 * @returns {AppError}
 */
function notFoundError(message, context = {}, cause) {
  return new AppError(message, 404, "NOT_FOUND", context, cause);
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 * @param {Error} [cause]
 * @returns {AppError}
 */
function connectionError(message, context = {}, cause) {
  return new AppError(message, 503, "CONNECTION_ERROR", context, cause);
}

module.exports = {
  AppError,
  validationError,
  notFoundError,
  connectionError,
};

