const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const {
  listAll,
  createSavedCommand,
  updateSavedCommand,
  deleteSavedCommand,
  markUsed,
  createCategory,
  deleteCategory,
} = require("../services/savedCommandService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await listAll({
      scope: String(req.query.scope || "global"),
      serverId: req.query.serverId ? String(req.query.serverId) : null,
    });
    res.json({ data });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = await createSavedCommand(req.body || {});
    res.status(201).json({ data });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await updateSavedCommand(req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  "/:id/used",
  asyncHandler(async (req, res) => {
    const data = await markUsed(req.params.id);
    res.json({ data });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = await deleteSavedCommand(req.params.id);
    res.json({ data });
  })
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const data = await createCategory(req.body || {});
    res.status(201).json({ data });
  })
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const data = await deleteCategory(req.params.id);
    res.json({ data });
  })
);

module.exports = router;
