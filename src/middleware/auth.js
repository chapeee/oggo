const { loadConfig } = require("../config/configLoader");

/**
 * Guards API routes with optional password-based auth from config.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function apiAuthMiddleware(req, res, next) {
  const config = loadConfig();
  if (!config.passwordEnabled || !config.password) {
    next();
    return;
  }

  const supplied = req.header("x-oggo-password") || req.query.password;
  if (supplied !== config.password) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }
  next();
}

module.exports = {
  apiAuthMiddleware,
};

