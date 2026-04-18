const net = require("net");
const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../../db/database");
const { formatMonitor } = require("./common");

/**
 * Scans one host/port using TCP socket connect.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<{success:boolean,responseTimeMs?:number,error?:string}>}
 */
async function scanPort(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = new net.Socket();
    let settled = false;
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      if (settled) return;
      settled = true;
      const responseTime = Date.now() - startedAt;
      socket.end();
      resolve({ success: true, responseTimeMs: responseTime });
    });
    socket.on("timeout", () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ success: false, error: "Connection timeout" });
    });
    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      resolve({ success: false, error: error.message });
    });
    socket.connect(Number(port), host);
  });
}

/**
 * Returns all port monitors.
 *
 * @returns {Promise<any[]>}
 */
async function listPortMonitors() {
  return (await all("SELECT * FROM port_monitors ORDER BY name ASC")).map((row) => formatMonitor(row, ["channels_json"]));
}

/**
 * Creates one port monitor.
 *
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createPortMonitor(payload) {
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    name: payload.name,
    host: payload.host,
    port: Number(payload.port),
    protocol: (payload.protocol || "tcp").toLowerCase(),
    expected_banner: payload.expectedBanner || "",
    check_interval: payload.checkInterval || "hourly",
    channels_json: JSON.stringify(payload.channels || []),
    status: "unknown",
    response_time_ms: null,
    last_checked_at: null,
    last_error: null,
    created_at: now,
  };
  await run(
    `INSERT INTO port_monitors (id,name,host,port,protocol,expected_banner,check_interval,channels_json,status,response_time_ms,last_checked_at,last_error,created_at)
     VALUES (@id,@name,@host,@port,@protocol,@expected_banner,@check_interval,@channels_json,@status,@response_time_ms,@last_checked_at,@last_error,@created_at)`,
    row
  );
  return row;
}

/**
 * Runs one port monitor check and updates status.
 *
 * @param {string} id
 * @returns {Promise<{success:boolean,responseTimeMs?:number,error?:string}>}
 */
async function checkPortMonitor(id) {
  const monitor = await get("SELECT * FROM port_monitors WHERE id = ?", [id]);
  if (!monitor) throw new Error("Port monitor not found");
  const result = await scanPort(monitor.host, monitor.port, 5000);
  const now = new Date().toISOString();
  await run("UPDATE port_monitors SET status=?, response_time_ms=?, last_checked_at=?, last_error=? WHERE id=?", [
    result.success ? (result.responseTimeMs > 2000 ? "slow" : "up") : "down",
    result.responseTimeMs || null,
    now,
    result.error || null,
    id,
  ]);
  return result;
}

/**
 * Deletes one port monitor.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deletePortMonitor(id) {
  await run("DELETE FROM port_monitors WHERE id = ?", [id]);
}

module.exports = {
  scanPort,
  listPortMonitors,
  createPortMonitor,
  checkPortMonitor,
  deletePortMonitor,
};

