const { get, all } = require("../db/database");

/**
 * Builds dashboard summary payload for jobs and logs.
 *
 * @returns {Promise<{
 *   totalJobs:number,
 *   activeJobs:number,
 *   failedToday:number,
 *   successRate:number,
 *   recentActivity:any[],
 *   chartData:any[]
 * }>}
 */
async function getDashboardSummary() {
  const totals = await get(
    `
      SELECT
        COUNT(*) as totalJobs,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as activeJobs
      FROM jobs
    `
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();

  const failedToday = (await get("SELECT COUNT(*) as count FROM logs WHERE status = 'failed' AND created_at >= ?", [startOfDay]))
    ?.count || 0;

  const successRateData = await get(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
      FROM logs
      WHERE created_at >= ?
    `,
    [startOfDay]
  );

  const successRate = successRateData.total
    ? Math.round((100 * (successRateData.success || 0)) / successRateData.total)
    : 100;

  const recentActivity = await all("SELECT * FROM logs ORDER BY created_at DESC LIMIT 10");

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 6);
  last7Days.setUTCHours(0, 0, 0, 0);

  const logsLast7Days = await all(
    `
      SELECT
        SUBSTRING(created_at, 1, 10) as log_date,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM logs
      WHERE created_at >= ?
      GROUP BY log_date
      ORDER BY log_date ASC
    `,
    [last7Days.toISOString()]
  );

  return {
    totalJobs: totals.totalJobs || 0,
    activeJobs: totals.activeJobs || 0,
    failedToday,
    successRate,
    recentActivity,
    chartData: logsLast7Days,
  };
}

module.exports = {
  getDashboardSummary,
};

