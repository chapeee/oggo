const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../../db/database");
const { jsonParseSafe, formatMonitor } = require("./common");

/**
 * Runs one HTTP check and evaluates configured assertions.
 *
 * @param {Record<string, any>} check
 * @returns {Promise<Record<string, any>>}
 */
async function runHttpCheck(check) {
  const startedAt = Date.now();
  const headers = jsonParseSafe(check.headers_json, {});
  const assertions = jsonParseSafe(check.assertions_json, {});
  let response;
  let bodyText = "";
  try {
    response = await fetch(check.url, {
      method: check.method || "GET",
      headers,
      body: check.body_text || undefined,
      redirect: check.follow_redirects ? "follow" : "manual",
      signal: AbortSignal.timeout(Math.max(1000, Number(check.timeout_seconds || 10) * 1000)),
    });
    bodyText = await response.text();
  } catch (error) {
    return {
      success: false,
      status: "down",
      error: error.message,
      responseTimeMs: Date.now() - startedAt,
      statusCode: null,
    };
  }

  const responseTimeMs = Date.now() - startedAt;
  let passed = true;
  if (assertions.statusCode && Number(response.status) !== Number(assertions.statusCode)) passed = false;
  if (assertions.maxResponseMs && responseTimeMs > Number(assertions.maxResponseMs)) passed = false;
  if (assertions.bodyContains && !bodyText.includes(assertions.bodyContains)) passed = false;
  if (assertions.bodyRegex) {
    try {
      if (!new RegExp(assertions.bodyRegex).test(bodyText)) passed = false;
    } catch (_error) {}
  }
  return {
    success: passed,
    status: passed ? "up" : "down",
    responseTimeMs,
    statusCode: response.status,
    error: passed ? null : "Assertion failed",
    bodyPreview: bodyText.slice(0, 2000),
  };
}

/**
 * Returns all HTTP checks.
 *
 * @returns {Promise<any[]>}
 */
async function listHttpChecks() {
  return (await all("SELECT * FROM http_checks ORDER BY name ASC")).map((row) =>
    formatMonitor(row, ["headers_json", "assertions_json", "channels_json"])
  );
}

/**
 * Creates one HTTP check.
 *
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function createHttpCheck(payload) {
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    name: payload.name,
    url: payload.url,
    method: String(payload.method || "GET").toUpperCase(),
    headers_json: JSON.stringify(payload.headers || {}),
    body_text: payload.body || "",
    timeout_seconds: Number(payload.timeoutSeconds || 10),
    follow_redirects: payload.followRedirects === false ? 0 : 1,
    assertions_json: JSON.stringify(payload.assertions || {}),
    alert_after_failures: Number(payload.alertAfterFailures || 1),
    retry_before_fail: payload.retryBeforeFail ? 1 : 0,
    channels_json: JSON.stringify(payload.channels || []),
    status: "unknown",
    last_response_time_ms: null,
    last_status_code: null,
    last_checked_at: null,
    last_error: null,
    created_at: now,
  };
  await run(
    `INSERT INTO http_checks (id,name,url,method,headers_json,body_text,timeout_seconds,follow_redirects,assertions_json,alert_after_failures,retry_before_fail,channels_json,status,last_response_time_ms,last_status_code,last_checked_at,last_error,created_at)
     VALUES (@id,@name,@url,@method,@headers_json,@body_text,@timeout_seconds,@follow_redirects,@assertions_json,@alert_after_failures,@retry_before_fail,@channels_json,@status,@last_response_time_ms,@last_status_code,@last_checked_at,@last_error,@created_at)`,
    row
  );
  return row;
}

/**
 * Runs one HTTP monitor and updates latest status.
 *
 * @param {string} id
 * @returns {Promise<Record<string, any>>}
 */
async function checkHttpMonitor(id) {
  const row = await get("SELECT * FROM http_checks WHERE id = ?", [id]);
  if (!row) throw new Error("HTTP check not found");
  const result = await runHttpCheck(row);
  await run("UPDATE http_checks SET status=?, last_response_time_ms=?, last_status_code=?, last_checked_at=?, last_error=? WHERE id=?", [
    result.status,
    result.responseTimeMs || null,
    result.statusCode || null,
    new Date().toISOString(),
    result.error || null,
    id,
  ]);
  return result;
}

/**
 * Deletes one HTTP check.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteHttpCheck(id) {
  await run("DELETE FROM http_checks WHERE id = ?", [id]);
}

module.exports = {
  runHttpCheck,
  listHttpChecks,
  createHttpCheck,
  checkHttpMonitor,
  deleteHttpCheck,
};

