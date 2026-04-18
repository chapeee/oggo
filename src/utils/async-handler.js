/**
 * Wraps an async Express route handler and forwards rejected promises to next().
 *
 * @param {(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<unknown>} handler
 * @returns {import("express").RequestHandler}
 */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  asyncHandler,
};

