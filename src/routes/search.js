const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { buildSearchIndex, getSearchIndex, searchIndex } = require("../services/searchService");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "");
    const activeWorkspaceId = String(req.query.workspaceId || "").trim() || null;
    const maxPerGroup = Number(req.query.maxPerGroup || 4);
    const data = await searchIndex(q, { activeWorkspaceId, maxPerGroup });
    res.json({ data });
  })
);

router.get(
  "/index",
  asyncHandler(async (req, res) => {
    const rebuild = String(req.query.rebuild || "").toLowerCase() === "true";
    if (rebuild) {
      await buildSearchIndex();
    }
    const index = await getSearchIndex();
    res.json({
      data: {
        builtAt: index.builtAt,
        count: index.items.length,
        items: index.items,
      },
    });
  })
);

module.exports = router;
