/**
 * vault.js
 *
 * HTTP routes for vault credential management.
 */
const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { validationError } = require("../errors/app-error");
const vaultService = require("../services/vaultService");

const router = express.Router();
const VALID_CATEGORIES = new Set(["ssh", "database", "aws", "redis", "api_key", "certificate", "other"]);
const copyRate = new Map();

/**
 * In-memory IP limiter for copy endpoint (10 requests / minute).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
function copyRateLimit(req, res, next) {
  const ip = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 10;
  const row = copyRate.get(ip) || [];
  const recent = row.filter((ts) => now - ts < windowMs);
  if (recent.length >= max) {
    res.status(429).json({ error: "Too many copy requests. Try again in a minute.", code: "RATE_LIMITED" });
    return;
  }
  recent.push(now);
  copyRate.set(ip, recent);
  next();
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await vaultService.listEntries();
    res.json({ data });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    if (!String(payload.name || "").trim()) throw validationError("name is required");
    if (!VALID_CATEGORIES.has(String(payload.category || "").toLowerCase())) {
      throw validationError("category must be one of ssh, database, aws, redis, api_key, certificate, other");
    }
    const data = await vaultService.createEntry(payload);
    res.status(201).json({ data });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await vaultService.getEntry(req.params.id);
    res.json({ data });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    if (payload.category && !VALID_CATEGORIES.has(String(payload.category || "").toLowerCase())) {
      throw validationError("category must be one of ssh, database, aws, redis, api_key, certificate, other");
    }
    const data = await vaultService.updateEntry(req.params.id, payload);
    res.json({ data });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const force = String(req.query.force || "").toLowerCase() === "true";
    await vaultService.deleteEntry(req.params.id, force);
    res.status(204).send();
  })
);

router.post(
  "/:id/copy",
  copyRateLimit,
  asyncHandler(async (req, res) => {
    const value = await vaultService.getDecryptedValue(req.params.id);
    res.json({ data: { value } });
  })
);

router.post(
  "/:id/rotate",
  asyncHandler(async (req, res) => {
    const newValue = String(req.body?.newValue || "");
    if (!newValue) throw validationError("newValue is required");
    const data = await vaultService.rotatePassword(req.params.id, newValue);
    res.json({ data });
  })
);

router.get(
  "/:id/services",
  asyncHandler(async (req, res) => {
    const data = await vaultService.getLinkedServices(req.params.id);
    res.json({ data });
  })
);

router.post(
  "/:id/services",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const data = await vaultService.linkService(
      req.params.id,
      String(payload.serviceType || ""),
      String(payload.serviceId || ""),
      String(payload.fieldName || "")
    );
    res.status(201).json({ data });
  })
);

router.delete(
  "/:id/services/:linkId",
  asyncHandler(async (req, res) => {
    await vaultService.unlinkService(req.params.linkId);
    res.status(204).send();
  })
);

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const password = vaultService.generatePassword(payload.length, {
      uppercase: payload.uppercase,
      numbers: payload.numbers,
      symbols: payload.symbols,
    });
    res.json({ data: { password } });
  })
);

module.exports = router;
