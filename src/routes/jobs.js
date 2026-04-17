const express = require("express");
const cron = require("node-cron");
const { randomUUID } = require("crypto");
const cronstrue = require("cronstrue");
const { getDb } = require("../db/database");
const { upsertJobSchedules, deleteJobSchedules, runJobNow } = require("../services/cronService");
const { loadConfig } = require("../config/configLoader");

const router = express.Router();

function toBoolInt(value) {
  return value ? 1 : 0;
}

router.get("/", (req, res) => {
  const jobs = getDb()
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC")
    .all()
    .map((job) => {
      let humanSchedule = job.schedule;
      try {
        humanSchedule = cronstrue.toString(job.schedule);
      } catch (_error) {
        // Keep raw expression if descriptor parsing fails.
      }
      return { ...job, humanSchedule };
    });
  return res.json({ data: jobs });
});

router.post("/", (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    name: (req.body.name || "").trim(),
    command: (req.body.command || "").trim(),
    schedule: (req.body.schedule || "").trim(),
    description: req.body.description || "",
    enabled: toBoolInt(req.body.enabled !== false),
    notify: req.body.notify || "failure",
    created_at: now,
    updated_at: now,
    last_run: null,
    last_status: "never",
  };

  if (!job.name || !job.command || !job.schedule) {
    return res.status(400).json({ error: "name, command and schedule are required", code: "VALIDATION_ERROR" });
  }
  if (!cron.validate(job.schedule)) {
    return res.status(400).json({ error: "Invalid cron expression", code: "INVALID_SCHEDULE" });
  }

  db.prepare(`
    INSERT INTO jobs (id, name, command, schedule, description, enabled, notify, created_at, updated_at, last_run, last_status)
    VALUES (@id, @name, @command, @schedule, @description, @enabled, @notify, @created_at, @updated_at, @last_run, @last_status)
  `).run(job);

  upsertJobSchedules(job, loadConfig());
  return res.status(201).json({ data: job });
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }

  const updated = {
    ...existing,
    name: (req.body.name ?? existing.name).trim(),
    command: (req.body.command ?? existing.command).trim(),
    schedule: (req.body.schedule ?? existing.schedule).trim(),
    description: req.body.description ?? existing.description,
    enabled: toBoolInt(req.body.enabled !== undefined ? req.body.enabled : existing.enabled === 1),
    notify: req.body.notify ?? existing.notify,
    updated_at: new Date().toISOString(),
  };

  if (!updated.name || !updated.command || !updated.schedule) {
    return res.status(400).json({ error: "name, command and schedule are required", code: "VALIDATION_ERROR" });
  }
  if (!cron.validate(updated.schedule)) {
    return res.status(400).json({ error: "Invalid cron expression", code: "INVALID_SCHEDULE" });
  }

  db.prepare(`
    UPDATE jobs
    SET name = @name, command = @command, schedule = @schedule, description = @description,
        enabled = @enabled, notify = @notify, updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  upsertJobSchedules(updated, loadConfig());
  return res.json({ data: updated });
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const result = db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
  if (!result.changes) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }
  deleteJobSchedules(id);
  return res.json({ message: "Job deleted" });
});

router.post("/:id/toggle", (req, res) => {
  const db = getDb();
  const id = req.params.id;
  const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }

  const enabled = existing.enabled === 1 ? 0 : 1;
  const updated = { ...existing, enabled, updated_at: new Date().toISOString() };
  db.prepare("UPDATE jobs SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled, updated.updated_at, id);
  upsertJobSchedules(updated, loadConfig());
  return res.json({ data: updated });
});

router.post("/:id/run", async (req, res) => {
  try {
    const log = await runJobNow(req.params.id);
    return res.json({ data: log });
  } catch (error) {
    return res.status(404).json({ error: error.message, code: "RUN_FAILED" });
  }
});

module.exports = router;
