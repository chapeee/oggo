const express = require("express");
const asyncHandler = require("../utils/async-handler");
const {
  listWorkspaces,
  getWorkspaceById,
  getWorkspaceDetail,
  saveWorkspace,
  deleteWorkspace,
  listWorkspaceServices,
  attachWorkspaceService,
  detachWorkspaceService,
} = require("../services/workspaceService");
const { buildSearchIndex } = require("../services/searchService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ data: await listWorkspaces() });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const saved = await saveWorkspace(req.body || null);
    await buildSearchIndex();
    res.status(201).json({ data: saved });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const workspace = await getWorkspaceDetail(req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    }
    res.json({ data: workspace });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await getWorkspaceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    }
    const saved = await saveWorkspace(req.body || {}, existing);
    await buildSearchIndex();
    res.json({ data: saved });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await getWorkspaceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    }
    await deleteWorkspace(req.params.id);
    await buildSearchIndex();
    res.json({ message: "Workspace deleted" });
  })
);

router.get(
  "/:id/services",
  asyncHandler(async (req, res) => {
    const existing = await getWorkspaceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Workspace not found", code: "NOT_FOUND" });
    }
    res.json({ data: await listWorkspaceServices(req.params.id) });
  })
);

router.post(
  "/:id/s3",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "s3", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/sns",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "sns", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/ses",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "ses", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/cloudwatch",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "cloudwatch", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/rds",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "rds", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/ec2",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "ec2", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/lambda",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "lambda", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.post(
  "/:id/secrets",
  asyncHandler(async (req, res) => {
    const data = await attachWorkspaceService(req.params.id, "secrets", req.body || {});
    await buildSearchIndex();
    res.status(201).json({ data });
  })
);

router.delete(
  "/:id/services/:serviceId",
  asyncHandler(async (req, res) => {
    const serviceType = String(req.query.type || "").trim().toLowerCase();
    if (!serviceType) {
      return res.status(400).json({ error: "Query param 'type' is required", code: "VALIDATION_ERROR" });
    }
    await detachWorkspaceService(req.params.id, serviceType, req.params.serviceId);
    await buildSearchIndex();
    res.json({ message: "Service detached" });
  })
);

module.exports = router;
