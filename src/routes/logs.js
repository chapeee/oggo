const express = require("express");
const { getLogs, clearJobLogs, clearAllLogs } = require("../services/logService");

const router = express.Router();

router.get("/", async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const offset = Number(req.query.offset || 0);
  const status = req.query.status || undefined;
  const jobId = req.query.jobId || undefined;
  const logs = await getLogs({ limit, offset, status, jobId });
  return res.json({ data: logs });
});

router.get("/:jobId", async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const logs = await getLogs({ jobId: req.params.jobId, limit });
  return res.json({ data: logs });
});

router.delete("/:jobId", async (req, res) => {
  await clearJobLogs(req.params.jobId);
  return res.json({ message: "Logs cleared for job" });
});

router.delete("/", async (req, res) => {
  await clearAllLogs();
  return res.json({ message: "All logs cleared" });
});

module.exports = router;
