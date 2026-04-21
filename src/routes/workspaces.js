const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const {
  listWorkspaces,
  getWorkspaceDetail,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  attachService,
  updateService,
  detachService,
  testServiceAttachment,
  testServiceDraft,
  useWorkspaceDefaultCredentials,
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
  "/:id/services",
  asyncHandler(async (req, res) => {
    const data = await attachService(req.params.id, req.body || {});
    await buildSearchIndex();
    res.status(201).json(data);
  })
);

router.put(
  "/:id/services/:serviceId",
  asyncHandler(async (req, res) => {
    const data = await updateService(req.params.id, req.params.serviceId, req.body || {});
    await buildSearchIndex();
    res.status(200).json(data);
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

router.post(
  "/:id/services/:serviceId/test",
  asyncHandler(async (req, res) => {
    const data = await testServiceAttachment(req.params.id, req.params.serviceId);
    res.status(200).json(data);
  })
);

router.post(
  "/:id/services/test",
  asyncHandler(async (req, res) => {
    const data = await testServiceDraft(req.params.id, req.body || {});
    res.status(200).json(data);
  })
);

router.post(
  "/:id/services/:serviceId/use-default-credentials",
  asyncHandler(async (req, res) => {
    const data = await useWorkspaceDefaultCredentials(req.params.id, req.params.serviceId);
    await buildSearchIndex();
    res.status(200).json(data);
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
