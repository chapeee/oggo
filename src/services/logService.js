const fs = require("fs-extra");
const path = require("path");
const winston = require("winston");
const { randomUUID } = require("crypto");
const { getDb } = require("../db/database");
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

function addLog(log, config) {
  const db = getDb();
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

  const insert = db.prepare(`
    INSERT INTO logs (id, job_id, job_name, status, output, error, duration, exit_code, created_at)
    VALUES (@id, @job_id, @job_name, @status, @output, @error, @duration, @exit_code, @created_at)
  `);
  insert.run(record);

  pruneLogs(record.job_id, config);
  return record;
}

function pruneLogs(jobId, config) {
  if (!jobId) return;
  const db = getDb();
  const maxLogsPerJob = Math.max(10, Number(config?.maxLogsPerJob || 100));
  const retentionDays = Math.max(1, Number(config?.logRetentionDays || 30));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  db.prepare("DELETE FROM logs WHERE job_id = ? AND created_at < ?").run(jobId, cutoff);

  db.prepare(`
    DELETE FROM logs
    WHERE id IN (
      SELECT id FROM logs
      WHERE job_id = ?
      ORDER BY created_at DESC
      LIMIT -1 OFFSET ?
    )
  `).run(jobId, maxLogsPerJob);
}

function getLogs({ jobId, status, limit = 100, offset = 0 } = {}) {
  const db = getDb();
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
  return db.prepare(sql).all(...values);
}

function clearJobLogs(jobId) {
  return getDb().prepare("DELETE FROM logs WHERE job_id = ?").run(jobId);
}

function clearAllLogs() {
  return getDb().prepare("DELETE FROM logs").run();
}

module.exports = {
  appLogger,
  addLog,
  getLogs,
  clearJobLogs,
  clearAllLogs,
};
