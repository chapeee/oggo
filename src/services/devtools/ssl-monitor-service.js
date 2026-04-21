const tls = require("tls");
const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../../db/database");
const { formatMonitor, daysUntil } = require("./common");

/**
 * Checks TLS certificate details for a domain and port.
 *
 * @param {string} domain
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<Record<string, any>>}
 */
async function checkSslDomain(domain, port = 443, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: Number(port), servername: domain, rejectUnauthorized: false, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate(true);
        const issuer = cert?.issuer?.O || cert?.issuer?.CN || "Unknown";
        const issuedAt = cert?.valid_from ? new Date(cert.valid_from).toISOString() : null;
        const expiresAt = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
        const result = {
          success: true,
          issuer,
          issuedAt,
          expiresAt,
          daysRemaining: daysUntil(expiresAt),
          subject: cert?.subject || {},
          san: cert?.subjectaltname || "",
          fingerprint: cert?.fingerprint256 || cert?.fingerprint || "",
          keyAlgorithm: cert?.pubkey ? "public-key" : "unknown",
          chainValid: Boolean(cert),
        };
        socket.end();
        resolve(result);
      }
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ success: false, error: "Connection timed out" });
    });
    socket.on("error", (error) => resolve({ success: false, error: error.message }));
  });
}

/**
 * Returns all SSL monitors.
 *
 * @returns {Promise<any[]>}
 */
async function listSslMonitors() {
  return (await all("SELECT * FROM ssl_monitors ORDER BY domain ASC")).map((row) =>
    formatMonitor(row, ["thresholds_json", "channels_json"])
  );
}

/**
 * Creates one SSL monitor.
 *
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createSslMonitor(payload) {
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    domain: payload.domain,
    port: Number(payload.port || 443),
    check_interval: payload.checkInterval || "daily",
    thresholds_json: JSON.stringify(payload.thresholds || [30, 14, 7, 1]),
    channels_json: JSON.stringify(payload.channels || []),
    issuer: null,
    issued_at: null,
    expires_at: null,
    days_remaining: null,
    status: "unknown",
    last_checked_at: null,
    last_error: null,
    created_at: now,
  };
  await run(
    `INSERT INTO ssl_monitors (id,domain,port,check_interval,thresholds_json,channels_json,issuer,issued_at,expires_at,days_remaining,status,last_checked_at,last_error,created_at)
     VALUES (@id,@domain,@port,@check_interval,@thresholds_json,@channels_json,@issuer,@issued_at,@expires_at,@days_remaining,@status,@last_checked_at,@last_error,@created_at)`,
    row
  );
  return row;
}

/**
 * Runs one SSL monitor check and persists latest status.
 *
 * @param {string} id
 * @returns {Promise<Record<string, any>>}
 */
async function checkSslMonitor(id) {
  const monitor = await get("SELECT * FROM ssl_monitors WHERE id = ?", [id]);
  if (!monitor) throw new Error("SSL monitor not found");
  const result = await checkSslDomain(monitor.domain, monitor.port);
  const now = new Date().toISOString();
  await run(
    "UPDATE ssl_monitors SET issuer=?, issued_at=?, expires_at=?, days_remaining=?, status=?, last_checked_at=?, last_error=? WHERE id=?",
    [
      result.issuer || null,
      result.issuedAt || null,
      result.expiresAt || null,
      Number(result.daysRemaining ?? 0),
      result.success
        ? Number(result.daysRemaining) < 0
          ? "expired"
          : Number(result.daysRemaining) < 10
            ? "urgent"
            : Number(result.daysRemaining) <= 30
              ? "warning"
              : "ok"
        : "error",
      now,
      result.error || null,
      id,
    ]
  );
  return result;
}

/**
 * Deletes one SSL monitor.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteSslMonitor(id) {
  await run("DELETE FROM ssl_monitors WHERE id = ?", [id]);
}

module.exports = {
  checkSslDomain,
  listSslMonitors,
  createSslMonitor,
  checkSslMonitor,
  deleteSslMonitor,
};

