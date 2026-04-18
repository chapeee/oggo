/**
 * Parses JSON safely and falls back to a default.
 *
 * @param {string | null | undefined} value
 * @param {any} fallback
 * @returns {any}
 */
function jsonParseSafe(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

/**
 * Parses selected JSON fields on a DB row.
 *
 * @param {Record<string, any>} row
 * @param {string[]} jsonFields
 * @returns {Record<string, any>}
 */
function formatMonitor(row, jsonFields = []) {
  const copy = { ...row };
  jsonFields.forEach((fieldName) => {
    copy[fieldName] = jsonParseSafe(copy[fieldName], []);
  });
  return copy;
}

/**
 * Calculates whole days until a datetime string.
 *
 * @param {string | null | undefined} dateStr
 * @returns {number | null}
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.floor(ms / 86400000);
}

module.exports = {
  jsonParseSafe,
  formatMonitor,
  daysUntil,
};

