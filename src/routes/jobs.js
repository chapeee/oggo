const express = require("express");
const cron = require("node-cron");
const { randomUUID } = require("crypto");
const cronstrue = require("cronstrue");
const { get, all, run } = require("../db/database");
const { upsertJobSchedules, deleteJobSchedules, runJobNow } = require("../services/cronService");
const { loadConfig } = require("../config/configLoader");

const router = express.Router();

function toBoolInt(value) {
  return value ? 1 : 0;
}

router.get("/", async (req, res) => {
  const jobs = (await all("SELECT * FROM jobs ORDER BY created_at DESC"))
    .map((job) => {
      let humanSchedule = job.schedule;
      try {
        humanSchedule = cronstrue.toString(job.schedule);
      } catch (_error) {
        // Keep raw expression if descriptor parsing fails.
      }
      return { ...job, humanSchedule };
    });
  const s3Rows = await all("SELECT * FROM job_s3_settings");
  const s3Map = new Map(s3Rows.map((row) => [row.job_id, row]));
  const merged = jobs.map((job) => {
    const s3 = s3Map.get(job.id);
    return {
      ...job,
      s3UploadEnabled: Boolean(s3?.upload_enabled),
      s3ConnectionId: s3?.connection_id || "",
      s3UploadCondition: s3?.upload_condition || "failure",
      s3FilePattern: s3?.file_pattern || "{job}-{timestamp}.log",
    };
  });
  return res.json({ data: merged });
});

router.post("/", async (req, res) => {
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

  await run(`
    INSERT INTO jobs (id, name, command, schedule, description, enabled, notify, created_at, updated_at, last_run, last_status)
    VALUES (@id, @name, @command, @schedule, @description, @enabled, @notify, @created_at, @updated_at, @last_run, @last_status)
  `, job);
  await run(
    `INSERT INTO job_s3_settings (job_id, upload_enabled, connection_id, upload_condition, file_pattern, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET
       upload_enabled=excluded.upload_enabled,
       connection_id=excluded.connection_id,
       upload_condition=excluded.upload_condition,
       file_pattern=excluded.file_pattern,
       updated_at=excluded.updated_at`,
    [
      job.id,
      req.body.s3UploadEnabled ? 1 : 0,
      req.body.s3ConnectionId || null,
      req.body.s3UploadCondition || "failure",
      req.body.s3FilePattern || "{job}-{timestamp}.log",
      now,
    ]
  );

  await upsertJobSchedules(job, loadConfig());
  return res.status(201).json({ data: job });
});

router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const existing = await get("SELECT * FROM jobs WHERE id = ?", [id]);
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

  await run(`
    UPDATE jobs
    SET name = @name, command = @command, schedule = @schedule, description = @description,
        enabled = @enabled, notify = @notify, updated_at = @updated_at
    WHERE id = @id
  `, updated);
  await run(
    `INSERT INTO job_s3_settings (job_id, upload_enabled, connection_id, upload_condition, file_pattern, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(job_id) DO UPDATE SET
       upload_enabled=excluded.upload_enabled,
       connection_id=excluded.connection_id,
       upload_condition=excluded.upload_condition,
       file_pattern=excluded.file_pattern,
       updated_at=excluded.updated_at`,
    [
      id,
      req.body.s3UploadEnabled ? 1 : 0,
      req.body.s3ConnectionId || null,
      req.body.s3UploadCondition || "failure",
      req.body.s3FilePattern || "{job}-{timestamp}.log",
      updated.updated_at,
    ]
  );

  await upsertJobSchedules(updated, loadConfig());
  return res.json({ data: updated });
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const result = await run("DELETE FROM jobs WHERE id = ?", [id]);
  if (!result.changes) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }
  await run("DELETE FROM job_s3_settings WHERE job_id = ?", [id]);
  await deleteJobSchedules(id);
  return res.json({ message: "Job deleted" });
});

router.post("/:id/toggle", async (req, res) => {
  const id = req.params.id;
  const existing = await get("SELECT * FROM jobs WHERE id = ?", [id]);
  if (!existing) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }

  const enabled = existing.enabled === 1 ? 0 : 1;
  const updated = { ...existing, enabled, updated_at: new Date().toISOString() };
  await run("UPDATE jobs SET enabled = ?, updated_at = ? WHERE id = ?", [enabled, updated.updated_at, id]);
  await upsertJobSchedules(updated, loadConfig());
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
