const API = {
  async request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const password = localStorage.getItem("oggo-password");
    if (password) {
      headers["x-oggo-password"] = password;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
    }

    if (!response.ok) {
      const message = payload.error || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return payload.data ?? payload;
  },

  getJobs() {
    return this.request("/api/jobs");
  },
  createJob(job) {
    return this.request("/api/jobs", { method: "POST", body: JSON.stringify(job) });
  },
  updateJob(id, job) {
    return this.request(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(job) });
  },
  deleteJob(id) {
    return this.request(`/api/jobs/${id}`, { method: "DELETE" });
  },
  toggleJob(id) {
    return this.request(`/api/jobs/${id}/toggle`, { method: "POST" });
  },
  runJob(id) {
    return this.request(`/api/jobs/${id}/run`, { method: "POST" });
  },
  getLogs(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/logs?${params.toString()}`);
  },
  clearJobLogs(jobId) {
    return this.request(`/api/logs/${jobId}`, { method: "DELETE" });
  },
  clearAllLogs() {
    return this.request("/api/logs", { method: "DELETE" });
  },
  getSettings() {
    return this.request("/api/settings");
  },
  saveSettings(settings) {
    return this.request("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
  },
  testEmail() {
    return this.request("/api/settings/test-email", { method: "POST" });
  },
  resetSettings() {
    return this.request("/api/settings/reset", { method: "POST" });
  },
  getDashboard() {
    return this.request("/api/dashboard");
  },
  restartServer() {
    return this.request("/api/server/restart", { method: "POST" });
  },
  stopServer() {
    return this.request("/api/server/stop", { method: "POST" });
  },
  getServers() {
    return this.request("/api/servers");
  },
  createServer(payload) {
    return this.request("/api/servers", { method: "POST", body: JSON.stringify(payload) });
  },
  updateServer(id, payload) {
    return this.request(`/api/servers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteServer(id) {
    return this.request(`/api/servers/${id}`, { method: "DELETE" });
  },
  testServer(id) {
    return this.request(`/api/servers/${id}/test`, { method: "POST" });
  },
  getServerStatus(id) {
    return this.request(`/api/servers/${id}/status`);
  },
  getRemoteJobs(id) {
    return this.request(`/api/servers/${id}/jobs`);
  },
  createRemoteJob(id, payload) {
    return this.request(`/api/servers/${id}/jobs`, { method: "POST", body: JSON.stringify(payload) });
  },
  getKeys() {
    return this.request("/api/keys");
  },
  createKey(payload) {
    return this.request("/api/keys", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteKey(id) {
    return this.request(`/api/keys/${id}`, { method: "DELETE" });
  },
  generateKey(type) {
    return this.request("/api/keys/generate", { method: "POST", body: JSON.stringify({ type }) });
  },
  getTerminalSuggestions(query, serverId) {
    const params = new URLSearchParams({ q: query || "", serverId: serverId || "local" });
    return this.request(`/api/terminal/suggest?${params.toString()}`);
  },
  explainTerminalCommand(command) {
    return this.request("/api/terminal/explain", { method: "POST", body: JSON.stringify({ command }) });
  },
  riskCheckCommand(command) {
    return this.request("/api/terminal/risk-check", { method: "POST", body: JSON.stringify({ command }) });
  },
  getTerminalHistory(serverId, limit = 1000) {
    const params = new URLSearchParams({ serverId: serverId || "local", limit: String(limit) });
    return this.request(`/api/terminal/history?${params.toString()}`);
  },
  pushTerminalHistory(payload) {
    return this.request("/api/terminal/history", { method: "POST", body: JSON.stringify(payload) });
  },
  getSnippets() {
    return this.request("/api/terminal/snippets");
  },
  createSnippet(payload) {
    return this.request("/api/terminal/snippets", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteSnippet(id) {
    return this.request(`/api/terminal/snippets/${id}`, { method: "DELETE" });
  },
  getS3Regions() {
    return this.request("/api/s3/regions");
  },
  getS3Connections() {
    return this.request("/api/s3/connections");
  },
  createS3Connection(payload) {
    return this.request("/api/s3/connections", { method: "POST", body: JSON.stringify(payload) });
  },
  updateS3Connection(id, payload) {
    return this.request(`/api/s3/connections/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteS3Connection(id) {
    return this.request(`/api/s3/connections/${id}`, { method: "DELETE" });
  },
  testS3Connection(id) {
    return this.request(`/api/s3/connections/${id}/test`, { method: "POST" });
  },
  testS3DraftConnection(payload) {
    return this.request("/api/s3/connections/test", { method: "POST", body: JSON.stringify(payload) });
  },
  listS3Files(id, params = {}) {
    const safeParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
    const q = new URLSearchParams(safeParams);
    return this.request(`/api/s3/connections/${id}/files?${q.toString()}`);
  },
  uploadS3File(id, payload) {
    return this.request(`/api/s3/connections/${id}/upload`, { method: "POST", body: JSON.stringify(payload) });
  },
  createS3Folder(id, path) {
    return this.request(`/api/s3/connections/${id}/folders`, { method: "POST", body: JSON.stringify({ path }) });
  },
  deleteS3File(id, key) {
    const q = new URLSearchParams({ key });
    return this.request(`/api/s3/connections/${id}/files?${q.toString()}`, { method: "DELETE" });
  },
  getS3PresignedUrl(id, key, expiresIn = 3600) {
    const q = new URLSearchParams({ key, expiresIn: String(expiresIn) });
    return this.request(`/api/s3/connections/${id}/presign?${q.toString()}`);
  },
  getAwsRegions() {
    return this.request("/api/aws/regions");
  },
  getAwsConnections() {
    return this.request("/api/aws/connections");
  },
  createAwsConnection(payload) {
    return this.request("/api/aws/connections", { method: "POST", body: JSON.stringify(payload) });
  },
  updateAwsConnection(id, payload) {
    return this.request(`/api/aws/connections/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteAwsConnection(id) {
    return this.request(`/api/aws/connections/${id}`, { method: "DELETE" });
  },
  testAwsConnection(id) {
    return this.request(`/api/aws/connections/${id}/test`, { method: "POST" });
  },
  getAwsIamHelper() {
    return this.request("/api/aws/iam-helper");
  },
  listCloudWatchLogGroups(connectionId, params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/aws/connections/${connectionId}/cloudwatch/log-groups?${q.toString()}`);
  },
  listRdsInstances(connectionId, params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/aws/connections/${connectionId}/rds/instances?${q.toString()}`);
  },
  listEc2Instances(connectionId, params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/aws/connections/${connectionId}/ec2/instances?${q.toString()}`);
  },
  listLambdaFunctions(connectionId, params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/aws/connections/${connectionId}/lambda/functions?${q.toString()}`);
  },
  listAwsSecrets(connectionId, params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/aws/connections/${connectionId}/secrets?${q.toString()}`);
  },
  listSslMonitors() {
    return this.request("/api/devtools/ssl");
  },
  createSslMonitor(payload) {
    return this.request("/api/devtools/ssl", { method: "POST", body: JSON.stringify(payload) });
  },
  checkSslMonitor(id) {
    return this.request(`/api/devtools/ssl/${id}/check`, { method: "POST" });
  },
  checkSslNow(payload) {
    return this.request("/api/devtools/ssl/check-now", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteSslMonitor(id) {
    return this.request(`/api/devtools/ssl/${id}`, { method: "DELETE" });
  },
  listDnsMonitors() {
    return this.request("/api/devtools/dns");
  },
  createDnsMonitor(payload) {
    return this.request("/api/devtools/dns", { method: "POST", body: JSON.stringify(payload) });
  },
  checkDnsMonitor(id) {
    return this.request(`/api/devtools/dns/${id}/check`, { method: "POST" });
  },
  dnsLookup(payload) {
    return this.request("/api/devtools/dns/lookup", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteDnsMonitor(id) {
    return this.request(`/api/devtools/dns/${id}`, { method: "DELETE" });
  },
  listPortMonitors() {
    return this.request("/api/devtools/ports");
  },
  createPortMonitor(payload) {
    return this.request("/api/devtools/ports", { method: "POST", body: JSON.stringify(payload) });
  },
  checkPortMonitor(id) {
    return this.request(`/api/devtools/ports/${id}/check`, { method: "POST" });
  },
  deletePortMonitor(id) {
    return this.request(`/api/devtools/ports/${id}`, { method: "DELETE" });
  },
  listEnvVars() {
    return this.request("/api/devtools/env");
  },
  createEnvVar(payload) {
    return this.request("/api/devtools/env", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteEnvVar(id) {
    return this.request(`/api/devtools/env/${id}`, { method: "DELETE" });
  },
  listHttpChecks() {
    return this.request("/api/devtools/http-checks");
  },
  createHttpCheck(payload) {
    return this.request("/api/devtools/http-checks", { method: "POST", body: JSON.stringify(payload) });
  },
  runHttpCheck(id) {
    return this.request(`/api/devtools/http-checks/${id}/check`, { method: "POST" });
  },
  deleteHttpCheck(id) {
    return this.request(`/api/devtools/http-checks/${id}`, { method: "DELETE" });
  },
  scanPackages(serverId, manager = "") {
    const q = new URLSearchParams();
    if (manager) q.set("manager", manager);
    return this.request(`/api/software/package-manager/${serverId}/scan?${q.toString()}`);
  },
  packageOperation(serverId, payload) {
    return this.request(`/api/software/package-manager/${serverId}/operate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  pinPackage(serverId, payload) {
    return this.request(`/api/software/package-manager/${serverId}/pin`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  unpinPackage(serverId, payload) {
    return this.request(`/api/software/package-manager/${serverId}/pin`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  },
  packageHistory(serverId, limit = 200) {
    return this.request(`/api/software/package-manager/${serverId}/history?limit=${Number(limit || 200)}`);
  },
  packageVulnerabilities(serverId, params) {
    const q = new URLSearchParams(params || {});
    return this.request(`/api/software/package-manager/${serverId}/vulnerabilities?${q.toString()}`);
  },
  runInstaller(serverId, payload) {
    return this.request(`/api/software/installer/${serverId}/install`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

window.OggoAPI = API;
