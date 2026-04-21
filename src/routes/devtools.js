const express = require("express");
const {
  listSslMonitors,
  createSslMonitor,
  checkSslMonitor,
  deleteSslMonitor,
  checkSslDomain,
  listDnsMonitors,
  createDnsMonitor,
  checkDnsMonitor,
  deleteDnsMonitor,
  runDnsLookup,
  listPortMonitors,
  createPortMonitor,
  checkPortMonitor,
  deletePortMonitor,
  listEnvVars,
  createEnvVar,
  deleteEnvVar,
  listHttpChecks,
  createHttpCheck,
  checkHttpMonitor,
  deleteHttpCheck,
} = require("../services/devToolsService");
const { asyncHandler } = require("../utils/async-handler");

const router = express.Router();

router.get("/ssl", asyncHandler(async (_req, res) => res.json({ data: await listSslMonitors() })));
router.post("/ssl", asyncHandler(async (req, res) => res.status(201).json({ data: await createSslMonitor(req.body || {}) })));
router.post("/ssl/:id/check", asyncHandler(async (req, res) => res.json({ data: await checkSslMonitor(req.params.id) })));
router.post("/ssl/check-now", asyncHandler(async (req, res) => {
  const { domain, port } = req.body || {};
  if (!domain) return res.status(400).json({ error: "domain is required" });
  res.json({ data: await checkSslDomain(domain, Number(port || 443)) });
}));
router.delete("/ssl/:id", asyncHandler(async (req, res) => {
  await deleteSslMonitor(req.params.id);
  res.json({ message: "SSL monitor deleted" });
}));

router.get("/dns", asyncHandler(async (_req, res) => res.json({ data: await listDnsMonitors() })));
router.post("/dns", asyncHandler(async (req, res) => res.status(201).json({ data: await createDnsMonitor(req.body || {}) })));
router.post("/dns/:id/check", asyncHandler(async (req, res) => res.json({ data: await checkDnsMonitor(req.params.id) })));
router.post("/dns/lookup", asyncHandler(async (req, res) => {
  const { domain, recordType } = req.body || {};
  if (!domain) return res.status(400).json({ error: "domain is required" });
  res.json({ data: await runDnsLookup(domain, recordType || "ALL") });
}));
router.delete("/dns/:id", asyncHandler(async (req, res) => {
  await deleteDnsMonitor(req.params.id);
  res.json({ message: "DNS monitor deleted" });
}));

router.get("/ports", asyncHandler(async (_req, res) => res.json({ data: await listPortMonitors() })));
router.post("/ports", asyncHandler(async (req, res) => res.status(201).json({ data: await createPortMonitor(req.body || {}) })));
router.post("/ports/:id/check", asyncHandler(async (req, res) => res.json({ data: await checkPortMonitor(req.params.id) })));
router.delete("/ports/:id", asyncHandler(async (req, res) => {
  await deletePortMonitor(req.params.id);
  res.json({ message: "Port monitor deleted" });
}));

router.get("/env", asyncHandler(async (_req, res) => res.json({ data: await listEnvVars() })));
router.post("/env", asyncHandler(async (req, res) => res.status(201).json({ data: await createEnvVar(req.body || {}) })));
router.delete("/env/:id", asyncHandler(async (req, res) => {
  await deleteEnvVar(req.params.id);
  res.json({ message: "Variable deleted" });
}));

router.get("/http-checks", asyncHandler(async (_req, res) => res.json({ data: await listHttpChecks() })));
router.post("/http-checks", asyncHandler(async (req, res) => res.status(201).json({ data: await createHttpCheck(req.body || {}) })));
router.post("/http-checks/:id/check", asyncHandler(async (req, res) => res.json({ data: await checkHttpMonitor(req.params.id) })));
router.delete("/http-checks/:id", asyncHandler(async (req, res) => {
  await deleteHttpCheck(req.params.id);
  res.json({ message: "HTTP check deleted" });
}));

module.exports = router;
