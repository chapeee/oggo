const express = require("express");
const { DEFAULT_CONFIG, loadConfig, saveConfig } = require("../config/configLoader");
const { sendTestEmail } = require("../services/mailService");
const { reloadAllJobs } = require("../services/cronService");

const router = express.Router();

router.get("/", (req, res) => {
  return res.json({ data: loadConfig() });
});

router.put("/", (req, res) => {
  try {
    const saved = saveConfig(req.body || {});
    reloadAllJobs(saved);
    return res.json({ data: saved });
  } catch (error) {
    return res.status(400).json({ error: error.message, code: "SETTINGS_SAVE_FAILED" });
  }
});

router.post("/test-email", async (req, res) => {
  try {
    const config = loadConfig();
    const result = await sendTestEmail(config);
    return res.json({ data: result });
  } catch (error) {
    return res.status(400).json({ error: error.message, code: "EMAIL_TEST_FAILED" });
  }
});

router.post("/reset", (req, res) => {
  const saved = saveConfig(DEFAULT_CONFIG);
  reloadAllJobs(saved);
  return res.json({ data: saved });
});

module.exports = router;
