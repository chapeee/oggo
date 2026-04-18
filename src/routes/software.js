const express = require("express");
const {
  scanPackages,
  executePackageOperation,
  runCustomInstall,
  upsertPin,
  removePin,
  listHistory,
  queryOsvVulnerabilities,
} = require("../services/softwareService");

const router = express.Router();

router.get("/package-manager/:serverId/scan", async (req, res) => {
  const data = await scanPackages(req.params.serverId, req.query.manager || null);
  res.json({ data });
});

router.post("/package-manager/:serverId/operate", async (req, res) => {
  const data = await executePackageOperation(req.params.serverId, req.body || {});
  res.json({ data });
});

router.post("/package-manager/:serverId/pin", async (req, res) => {
  const { manager, packageName, version } = req.body || {};
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await upsertPin(req.params.serverId, manager, packageName, version || "");
  return res.status(201).json({ data });
});

router.delete("/package-manager/:serverId/pin", async (req, res) => {
  const { manager, packageName } = req.body || {};
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  await removePin(req.params.serverId, manager, packageName);
  return res.json({ message: "Package unpinned" });
});

router.get("/package-manager/:serverId/history", async (req, res) => {
  const data = await listHistory(req.params.serverId, Number(req.query.limit || 200));
  res.json({ data });
});

router.get("/package-manager/:serverId/vulnerabilities", async (req, res) => {
  const manager = String(req.query.manager || "").trim();
  const packageName = String(req.query.packageName || "").trim();
  const version = String(req.query.version || "").trim();
  if (!manager || !packageName) {
    return res.status(400).json({ error: "manager and packageName are required", code: "VALIDATION_ERROR" });
  }
  const data = await queryOsvVulnerabilities(manager, packageName, version);
  return res.json({ data });
});

router.post("/installer/:serverId/install", async (req, res) => {
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
});

module.exports = router;
