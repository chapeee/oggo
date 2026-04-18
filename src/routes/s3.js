const express = require("express");
const {
  AWS_REGIONS,
  listConnections,
  getConnectionById,
  saveConnection,
  testConnection,
  listFiles,
  uploadFile,
  deleteFile,
  createFolder,
  generatePresignedUrl,
  sanitizeConnection,
} = require("../services/s3Service");
const { asyncHandler } = require("../utils/async-handler");

const router = express.Router();

router.get("/regions", (_req, res) => {
  res.json({ data: AWS_REGIONS });
});

router.get("/connections", asyncHandler(async (_req, res) => {
  const rows = await listConnections();
  res.json({ data: rows });
}));

router.post("/connections", asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const required = ["name", "access_key_id", "secret_access_key", "region", "bucket_name"];
  const missing = required.filter((field) => !String(payload[field] || "").trim());
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  const saved = await saveConnection(payload);
  res.status(201).json({ data: saved });
}));

router.put("/connections/:id", asyncHandler(async (req, res) => {
  const existing = await getConnectionById(req.params.id);
  if (!existing) return res.status(404).json({ error: "S3 connection not found", code: "NOT_FOUND" });
  const payload = req.body || {};
  const saved = await saveConnection({ ...existing, ...payload }, existing);
  res.json({ data: saved });
}));

router.delete("/connections/:id", asyncHandler(async (req, res) => {
  const existing = await getConnectionById(req.params.id);
  if (!existing) return res.status(404).json({ error: "S3 connection not found", code: "NOT_FOUND" });
  const { run } = require("../db/database");
  await run("DELETE FROM s3_connections WHERE id = ?", [req.params.id]);
  res.json({ message: "S3 connection deleted" });
}));

router.post("/connections/:id/test", asyncHandler(async (req, res) => {
  const result = await testConnection(req.params.id);
  if (!result.success) return res.status(400).json({ data: result });
  res.json({ data: result });
}));

router.post("/connections/test", asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const required = ["access_key_id", "secret_access_key", "region", "bucket_name"];
  const missing = required.filter((field) => !String(payload[field] || "").trim());
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }
  const result = await testConnection(payload);
  if (!result.success) return res.status(400).json({ data: result });
  res.json({ data: result });
}));

router.get("/connections/:id/files", asyncHandler(async (req, res) => {
  const data = await listFiles(req.params.id, req.query || {});
  res.json({ data });
}));

router.post("/connections/:id/upload", asyncHandler(async (req, res) => {
  const payload = req.body || {};
  if (!payload.key || !payload.contentBase64) {
    return res.status(400).json({ error: "key and contentBase64 are required" });
  }
  const data = await uploadFile(req.params.id, payload);
  res.json({ data });
}));

router.post("/connections/:id/folders", asyncHandler(async (req, res) => {
  const folderPath = String(req.body?.path || "");
  if (!folderPath) return res.status(400).json({ error: "Folder path is required" });
  const data = await createFolder(req.params.id, folderPath);
  res.json({ data });
}));

router.delete("/connections/:id/files", asyncHandler(async (req, res) => {
  const key = String(req.query.key || "");
  if (!key) return res.status(400).json({ error: "key query param is required" });
  const data = await deleteFile(req.params.id, key);
  res.json({ data });
}));

router.get("/connections/:id/presign", asyncHandler(async (req, res) => {
  const key = String(req.query.key || "");
  if (!key) return res.status(400).json({ error: "key query param is required" });
  const expiresIn = Number(req.query.expiresIn || 3600);
  const data = await generatePresignedUrl(req.params.id, key, expiresIn);
  res.json({ data });
}));

module.exports = router;
