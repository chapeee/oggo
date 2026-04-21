const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const {
  listWorkspaces,
  getWorkspaceDetail,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  attachS3Config,
  attachService,
  detachService,
  getWorkspaceStats,
} = require("../services/workspaceService");
const { buildSearchIndex } = require("../services/searchService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listWorkspaces());
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const saved = await createWorkspace(req.body || {});
    await buildSearchIndex();
    res.status(201).json(saved);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const workspace = await getWorkspaceDetail(req.params.id);
    res.json(workspace);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const saved = await updateWorkspace(req.params.id, req.body || {});
    await buildSearchIndex();
    res.json(saved);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteWorkspace(req.params.id);
    await buildSearchIndex();
    res.status(204).send();
  })
);

router.post(
  "/:id/s3",
  asyncHandler(async (req, res) => {
    const s3ConfigId = String(req.body?.s3ConfigId || "").trim();
    if (!s3ConfigId) {
      return res.status(400).json({ error: "s3ConfigId is required", code: "VALIDATION_ERROR" });
    }
    const data = await attachS3Config(req.params.id, s3ConfigId, req.body?.label || "");
    await buildSearchIndex();
    res.status(201).json(data);
  })
);

router.post(
  "/:id/services",
  asyncHandler(async (req, res) => {
    const data = await attachService(req.params.id, req.body || {});
    await buildSearchIndex();
    res.status(201).json(data);
  })
);

router.delete(
  "/:id/services/:serviceId",
  asyncHandler(async (req, res) => {
    await detachService(req.params.id, req.params.serviceId);
    await buildSearchIndex();
    res.status(204).send();
  })
);

router.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const data = await getWorkspaceStats(req.params.id);
    res.status(200).json(data);
  })
);

module.exports = router;
