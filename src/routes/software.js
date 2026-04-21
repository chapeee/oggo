const express = require("express");
const {
  scanPackages,
  streamScan,
  executePackageOperation,
  runCustomInstall,
  upsertPin,
  removePin,
  listHistory,
  fetchCVEs,
  fetchVersions,
} = require("../services/softwareService");
const { asyncHandler } = require("../utils/async-handler");

const router = express.Router();

router.get("/package-manager/:serverId/scan", asyncHandler(async (req, res) => {
  if (String(req.query.stream || "").toLowerCase() === "true") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
      await streamScan(req.params.serverId, req.query.manager || null, send);
      res.end();
    } catch (error) {
      send("error", { message: error.message || "Scan failed" });
      res.end();
    }
    return;
  }
  const data = await scanPackages(req.params.serverId, req.query.manager || null);
  res.json({ data });
}));

router.post("/package-manager/:serverId/operate", asyncHandler(async (req, res) => {
  const data = await executePackageOperation(req.params.serverId, req.body || {});
  res.json({ data });
}));

router.post("/package-manager/:serverId/pin", asyncHandler(async (req, res) => {
  const { manager, packageName, version } = req.body || {};
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await upsertPin(req.params.serverId, manager, packageName, version || "");
  return res.status(201).json({ data });
}));

router.delete("/package-manager/:serverId/pin", asyncHandler(async (req, res) => {
  const { manager, packageName } = req.body || {};
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  await removePin(req.params.serverId, manager, packageName);
  return res.json({ message: "Package unpinned" });
}));

router.get("/package-manager/:serverId/history", asyncHandler(async (req, res) => {
  const data = await listHistory(
    req.params.serverId,
    Number(req.query.limit || 200),
    req.query.filter || "all",
    req.query.search || ""
  );
  res.json({ data });
}));

router.get("/package-manager/:serverId/vulnerabilities", asyncHandler(async (req, res) => {
  const manager = String(req.query.manager || "").trim();
  const packageName = String(req.query.packageName || "").trim();
  const version = String(req.query.version || "").trim();
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await fetchCVEs(req.params.serverId, manager, packageName, version);
  return res.json({ data });
}));

router.get("/package-manager/:serverId/versions", asyncHandler(async (req, res) => {
  const manager = String(req.query.manager || "").trim();
  const packageName = String(req.query.packageName || "").trim();
  const limit = Number(req.query.limit || 5);
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await fetchVersions(req.params.serverId, manager, packageName, limit);
  return res.json({ data });
}));

router.get("/packages/history", asyncHandler(async (req, res) => {
  const serverId = String(req.query.serverId || "").trim();
  if (!serverId) {
    return res.status(400).json({ error: "serverId is required", code: "VALIDATION_ERROR" });
  }
  const data = await listHistory(
    serverId,
    Number(req.query.limit || 100),
    req.query.filter || "all",
    req.query.search || ""
  );
  return res.json({ data });
}));

router.get("/packages/:serverId/:manager/:packageName/versions", asyncHandler(async (req, res) => {
  const { serverId, manager, packageName } = req.params;
  const data = await fetchVersions(serverId, manager, packageName, Number(req.query.limit || 10));
  return res.json({ data });
}));

router.get("/packages/:serverId/:manager/:packageName/cves", asyncHandler(async (req, res) => {
  const { serverId, manager, packageName } = req.params;
  const version = String(req.query.version || "").trim();
  const data = await fetchCVEs(serverId, manager, packageName, version);
  return res.json({ data });
}));

router.post("/installer/:serverId/install", asyncHandler(async (req, res) => {
  const { manager, packageName, version, customCommand, triggeredBy } = req.body || {};
  if (customCommand) {
    const data = await runCustomInstall(req.params.serverId, customCommand, triggeredBy || "ui");
    return res.json({ data });
  }
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await executePackageOperation(req.params.serverId, {
    manager,
    packageName,
    action: "install",
    version,
    triggeredBy: triggeredBy || "ui",
  });
  return res.json({ data });
}));

module.exports = router;
