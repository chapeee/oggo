const express = require("express");
const { getLogs, clearJobLogs, clearAllLogs } = require("../services/logService");

const router = express.Router();

router.get("/", (req, res) => {
  const limit = Number(req.query.limit || 100);
  const offset = Number(req.query.offset || 0);
  const status = req.query.status || undefined;
  const jobId = req.query.jobId || undefined;
  const logs = getLogs({ limit, offset, status, jobId });
  return res.json({ data: logs });
});

router.get("/:jobId", (req, res) => {
  const limit = Number(req.query.limit || 100);
  const logs = getLogs({ jobId: req.params.jobId, limit });
  return res.json({ data: logs });
});

router.delete("/:jobId", (req, res) => {
  clearJobLogs(req.params.jobId);
  return res.json({ message: "Logs cleared for job" });
});

router.delete("/", (req, res) => {
  clearAllLogs();
  return res.json({ message: "All logs cleared" });
});

module.exports = router;
