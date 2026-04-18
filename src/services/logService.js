const fs = require("fs-extra");
const path = require("path");
const winston = require("winston");
const { randomUUID } = require("crypto");
const { run, all } = require("../db/database");
const { getLogsDir } = require("./platformService");

fs.ensureDirSync(getLogsDir());

const appLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(getLogsDir(), "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

async function addLog(log, config) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    job_id: log.job_id,
    job_name: log.job_name || "",
    status: log.status || "failed",
    output: log.output || "",
    error: log.error || "",
    duration: Number.isFinite(log.duration) ? log.duration : 0,
    exit_code: Number.isFinite(log.exit_code) ? log.exit_code : 1,
    created_at: log.created_at || now,
  };

  await run(`
    INSERT INTO logs (id, job_id, job_name, status, output, error, duration, exit_code, created_at)
    VALUES (@id, @job_id, @job_name, @status, @output, @error, @duration, @exit_code, @created_at)
  `, record);

  await pruneLogs(record.job_id, config);
  return record;
}

async function pruneLogs(jobId, config) {
  if (!jobId) return;
  const maxLogsPerJob = Math.max(10, Number(config?.maxLogsPerJob || 100));
  const retentionDays = Math.max(1, Number(config?.logRetentionDays || 30));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  await run("DELETE FROM logs WHERE job_id = ? AND created_at < ?", [jobId, cutoff]);

  const keepRows = await all(
    "SELECT id FROM logs WHERE job_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [jobId, 1000000, maxLogsPerJob]
  );
  for (const row of keepRows) {
    await run("DELETE FROM logs WHERE id = ?", [row.id]);
  }
}

async function getLogs({ jobId, status, limit = 100, offset = 0 } = {}) {
  const where = [];
  const values = [];

  if (jobId) {
    where.push("job_id = ?");
    values.push(jobId);
  }
  if (status) {
    where.push("status = ?");
    values.push(status);
  }

  const sql = `
    SELECT * FROM logs
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  values.push(Number(limit), Number(offset));
  return all(sql, values);
}

function clearJobLogs(jobId) {
  return run("DELETE FROM logs WHERE job_id = ?", [jobId]);
}

function clearAllLogs() {
  return run("DELETE FROM logs", []);
}

module.exports = {
  appLogger,
  addLog,
  getLogs,
  clearJobLogs,
  clearAllLogs,
};
