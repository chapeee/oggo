const { AppError } = require("../errors/app-error");
const { appLogger } = require("../services/logService");

/**
 * Central API error formatter and logger.
 *
 * @param {Error} error
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError =
    error instanceof AppError
      ? error
      : new AppError(error?.message || "Internal server error", 500, "INTERNAL_ERROR");

  appLogger.error(appError.stack || appError.message, {
    module: "middleware/error-handler",
    method: req.method,
    path: req.originalUrl,
    code: appError.code,
    status: appError.status,
    context: appError.context || {},
    cause: appError.cause?.message,
  });

  const isProduction = process.env.NODE_ENV === "production";
  res.status(appError.status).json({
    error: appError.message,
    code: appError.code,
    ...(isProduction ? {} : { context: appError.context || {} }),
  });
}

module.exports = {
  errorHandler,
};

