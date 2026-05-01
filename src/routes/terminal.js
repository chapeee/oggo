const express = require("express");
const { all } = require("../db/database");
const {
  detectRisk,
  explainCommand,
  detectError,
  getHistory,
  recordTerminalHistory,
  listSnippets,
  addSnippet,
  deleteSnippet,
} = require("../services/commandIntelService");
const { searchCommands, getCommand } = require("../services/tldrService");
const {
  getAssistantSettings,
  saveAssistantSettings,
  testAssistantConnection,
  forgetAssistantKey,
  generateAssistantCommand,
} = require("../services/terminalAiService");

const router = express.Router();

router.get("/suggest", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const serverId = String(req.query.serverId || req.query.server_id || "local");
    if (!q) return res.json({ data: { suggestions: [] } });

    const historyRows = await all(`
        SELECT command, COUNT(*) as freq
        FROM terminal_history
        WHERE command LIKE ? AND server_id = ?
        GROUP BY command
        ORDER BY freq DESC
        LIMIT 4
      `, [`${q}%`, serverId]);

    const tldrRows = await searchCommands(q, 6);
    const suggestions = [];

    historyRows.forEach((row) => {
      suggestions.push({
        cmd: row.command,
        desc: `Used ${row.freq} time${row.freq > 1 ? "s" : ""}`,
        source: "history",
        icon: "clock",
      });
    });

    tldrRows.forEach((row) => {
      const alreadyInHistory = suggestions.some((item) => item.cmd.startsWith(row.name));
      if (!alreadyInHistory) {
        suggestions.push({
          cmd: row.name,
          desc: row.description,
          source: "tldr",
          icon: "book",
          examples: Array.isArray(row.examples) ? row.examples.slice(0, 3) : [],
        });
      }
    });

    return res.json({ data: { suggestions: suggestions.slice(0, 8) } });
  } catch (error) {
    return res.status(500).json({ error: error.message, code: "SUGGEST_FAILED" });
  }
});

router.get("/command/:name", async (req, res) => {
  try {
    const command = await getCommand(req.params.name);
    if (!command) {
      return res.status(404).json({ error: "Command not found", code: "NOT_FOUND" });
    }
    return res.json({ data: command });
  } catch (error) {
    return res.status(500).json({ error: error.message, code: "COMMAND_LOOKUP_FAILED" });
  }
});

router.get("/history", async (req, res) => {
  const serverId = String(req.query.serverId || "local");
  const limit = Number(req.query.limit || 1000);
  res.json({ data: await getHistory(serverId, limit) });
});

router.post("/history", async (req, res) => {
  const { serverId = "local", command = "", output = "", status = "success" } = req.body || {};
  if (!command) {
    return res.status(400).json({ error: "command is required", code: "VALIDATION_ERROR" });
  }
  await recordTerminalHistory(String(serverId), String(command), String(output), String(status));
  const error = detectError(output);
  return res.json({ data: { saved: true, error } });
});

router.post("/risk-check", (req, res) => {
  const command = String(req.body?.command || "");
  const risk = detectRisk(command);
  res.json({ data: risk });
});

router.post("/explain", async (req, res) => {
  const command = String(req.body?.command || "");
  if (!command) {
    return res.status(400).json({ error: "command is required", code: "VALIDATION_ERROR" });
  }
  const data = await explainCommand(command);
  return res.json({ data });
});

router.get("/snippets", async (req, res) => {
  res.json({ data: await listSnippets() });
});

router.post("/snippets", async (req, res) => {
  const payload = req.body || {};
  if (!payload.title || !payload.command) {
    return res.status(400).json({ error: "title and command are required", code: "VALIDATION_ERROR" });
  }
  const created = await addSnippet(payload);
  return res.status(201).json({ data: created });
});

router.delete("/snippets/:id", async (req, res) => {
  await deleteSnippet(req.params.id);
  res.json({ data: { deleted: true } });
});

router.get("/ai/settings", async (_req, res) => {
  try {
    const data = await getAssistantSettings();
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message, code: "AI_SETTINGS_READ_FAILED" });
  }
});

router.post("/ai/settings", async (req, res) => {
  try {
    const payload = req.body || {};
    const data = await saveAssistantSettings({
      enabled: payload.enabled,
      model: payload.model,
      apiKey: payload.apiKey,
      validate: Boolean(payload.validate),
    });
    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message, code: "AI_SETTINGS_SAVE_FAILED" });
  }
});

router.post("/ai/test", async (_req, res) => {
  try {
    const data = await testAssistantConnection();
    return res.json({ data });
  } catch (error) {
    return res.status(400).json({ error: error.message, code: "AI_TEST_FAILED" });
  }
});

router.delete("/ai/key", async (_req, res) => {
  try {
    const data = await forgetAssistantKey();
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message, code: "AI_KEY_DELETE_FAILED" });
  }
});

router.post("/ai/command", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required", code: "VALIDATION_ERROR" });
    }
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required", code: "VALIDATION_ERROR" });
    }
    const data = await generateAssistantCommand({ sessionId, prompt });
    return res.json({ data });
  } catch (error) {
    const message = String(error?.message || "AI command failed");
    const status = message.includes("disabled") || message.includes("missing") ? 400 : 500;
    return res.status(status).json({ error: message, c