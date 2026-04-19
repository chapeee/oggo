const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { getDashboardSummary } = require("../services/dashboard-service");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await getDashboardSummary();
    res.json({ data });
  })
);

module.exports = router;

