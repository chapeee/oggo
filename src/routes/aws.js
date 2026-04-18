const express = require("express");
const {
  AWS_REGIONS,
  IAM_HELPER,
  listAwsConnections,
  getAwsConnectionById,
  saveAwsConnection,
  testAwsConnection,
  listCloudWatchLogGroups,
  listRdsInstances,
  listEc2Instances,
  listLambdaFunctions,
  listSecrets,
} = require("../services/awsService");
const { run } = require("../db/database");

const router = express.Router();

router.get("/regions", (_req, res) => {
  res.json({ data: AWS_REGIONS });
});

router.get("/iam-helper", (_req, res) => {
  res.json({ data: IAM_HELPER });
});

router.get("/connections", async (_req, res) => {
  res.json({ data: await listAwsConnections() });
});

router.post("/connections", async (req, res) => {
  const payload = req.body || {};
  const required = ["name", "access_key_id", "secret_access_key", "default_region"];
  const missing = required.filter((k) => !String(payload[k] || "").trim());
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  const saved = await saveAwsConnection(payload);
  res.status(201).json({ data: saved });
});

router.put("/connections/:id", async (req, res) => {
  const existing = await getAwsConnectionById(req.params.id);
  if (!existing) return res.status(404).json({ error: "AWS connection not found", code: "NOT_FOUND" });
  const payload = req.body || {};
  const saved = await saveAwsConnection({ ...existing, ...payload }, existing);
  res.json({ data: saved });
});

router.delete("/connections/:id", async (req, res) => {
  const existing = await getAwsConnectionById(req.params.id);
  if (!existing) return res.status(404).json({ error: "AWS connection not found", code: "NOT_FOUND" });
  await run("DELETE FROM aws_connections WHERE id = ?", [req.params.id]);
  res.json({ message: "AWS connection deleted" });
});

router.post("/connections/:id/test", async (req, res) => {
  try {
    const result = await testAwsConnection(req.params.id);
    res.json({ data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/connections/:id/cloudwatch/log-groups", async (req, res) => {
  const data = await listCloudWatchLogGroups(req.params.id, req.query || {});
  res.json({ data });
});

router.get("/connections/:id/rds/instances", async (req, res) => {
  const data = await listRdsInstances(req.params.id, req.query || {});
  res.json({ data });
});

router.get("/connections/:id/ec2/instances", async (req, res) => {
  const data = await listEc2Instances(req.params.id, req.query || {});
  res.json({ data });
});

router.get("/connections/:id/lambda/functions", async (req, res) => {
  const data = await listLambdaFunctions(req.params.id, req.query || {});
  res.json({ data });
});

router.get("/connections/:id/secrets", async (req, res) => {
  const data = await listSecrets(req.params.id, req.query || {});
  res.json({ data });
});

module.exports = router;

