const dns = require("dns").promises;
const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../../db/database");
const { formatMonitor } = require("./common");

/**
 * Performs a DNS lookup for one record type or ALL.
 *
 * @param {string} domain
 * @param {string} recordType
 * @returns {Promise<any>}
 */
async function runDnsLookup(domain, recordType = "A") {
  const type = String(recordType || "A").toUpperCase();
  if (type === "ALL") {
    const recordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];
    const out = {};
    for (const t of recordTypes) {
      try {
        out[t] = await runDnsLookup(domain, t);
      } catch (_error) {
        out[t] = [];
      }
    }
    return out;
  }
  try {
    if (type === "A") return await dns.resolve4(domain);
    if (type === "AAAA") return await dns.resolve6(domain);
    if (type === "CNAME") return await dns.resolveCname(domain);
    if (type === "MX") return await dns.resolveMx(domain);
    if (type === "TXT") return await dns.resolveTxt(domain);
    if (type === "NS") return await dns.resolveNs(domain);
    if (type === "SOA") return await dns.resolveSoa(domain);
    if (type === "CAA") return await dns.resolveCaa(domain);
    if (type === "PTR") return await dns.reverse(domain);
    return [];
  } catch (error) {
    return { error: error.message, code: error.code || "DNS_ERROR" };
  }
}

/**
 * Returns all DNS monitors.
 *
 * @returns {Promise<any[]>}
 */
async function listDnsMonitors() {
  return (await all("SELECT * FROM dns_monitors ORDER BY domain ASC")).map((row) => formatMonitor(row, ["channels_json"]));
}

/**
 * Creates one DNS monitor.
 *
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createDnsMonitor(payload) {
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    domain: payload.domain,
    record_type: String(payload.recordType || "A").toUpperCase(),
    expected_value: payload.expectedValue || "",
    check_interval: payload.checkInterval || "hourly",
    channels_json: JSON.stringify(payload.channels || []),
    current_value: "",
    status: "unknown",
    last_checked_at: null,
    last_error: null,
    created_at: now,
  };
  await run(
    `INSERT INTO dns_monitors (id,domain,record_type,expected_value,check_interval,channels_json,current_value,status,last_checked_at,last_error,created_at)
     VALUES (@id,@domain,@record_type,@expected_value,@check_interval,@channels_json,@current_value,@status,@last_checked_at,@last_error,@created_at)`,
    row
  );
  return row;
}

/**
 * Runs one DNS monitor check.
 *
 * @param {string} id
 * @returns {Promise<{lookup:any,status:string}>}
 */
async function checkDnsMonitor(id) {
  const monitor = await get("SELECT * FROM dns_monitors WHERE id = ?", [id]);
  if (!monitor) throw new Error("DNS monitor not found");
  const lookup = await runDnsLookup(monitor.domain, monitor.record_type);
  const now = new Date().toISOString();
  const currentValue = typeof lookup === "object" ? JSON.stringify(lookup) : String(lookup || "");
  const hasError = Boolean(lookup?.error);
  const status =
    hasError ? "error" : monitor.expected_value && currentValue !== monitor.expected_value ? "changed" : "matching";
  await run("UPDATE dns_monitors SET current_value=?, status=?, last_checked_at=?, last_error=? WHERE id=?", [
    currentValue,
    status,
    now,
    hasError ? lookup.error : null,
    id,
  ]);
  return { lookup, status };
}

/**
 * Deletes one DNS monitor.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteDnsMonitor(id) {
  await run("DELETE FROM dns_monitors WHERE id = ?", [id]);
}

module.exports = {
  runDnsLookup,
  listDnsMonitors,
  createDnsMonitor,
  checkDnsMonitor,
  deleteDnsMonitor,
};

