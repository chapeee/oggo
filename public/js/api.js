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
  // Terminal AI assistant (dia-ai:) endpoints.
  getTerminalAiSettings() {
    return this.request("/api/terminal/ai/settings");
  },
  saveTerminalAiSettings(payload) {
    return this.request("/api/terminal/ai/settings", { method: "POST", body: JSON.stringify(payload) });
  },
  testTerminalAiConnection() {
    return this.request("/api/terminal/ai/test", { method: "POST" });
  },
  forgetTerminalAiKey() {
    return this.request("/api/terminal/ai/key", { method: "DELETE" });
  },
  generateTerminalAiCommand(payload) {
    return this.request("/api/terminal/ai/command", { method: "POST", body: JSON.stringify(payload) });
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
  listSavedCommands(scope = "global", serverId = "") {
    const params = new URLSearchParams({ scope });
    if (serverId) params.set("serverId", serverId);
    return this.request(`/api/saved-commands?${params.toString()}`);
  },
  createSavedCommand(payload) {
    return this.request("/api/saved-commands", { method: "POST", body: JSON.stringify(payload) });
  },
  updateSavedCommand(id, payload) {
    return this.request(`/api/saved-commands/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteSavedCommand(id) {
    return this.request(`/api/saved-commands/${id}`, { method: "DELETE" });
  },
  markSavedCommandUsed(id) {
    return this.request(`/api/saved-commands/${id}/used`, { method: "POST" });
  },
  createCommandCategory(payload) {
    return this.request("/api/saved-commands/categories", { method: "POST", body: JSON.stringify(payload) });
  },
  deleteCommandCategory(id) {
    return this.request(`/api/saved-commands/categories/${id}`, { method: "DELETE" });
  },
  guiRunCommand(payload) {
    return this.request("/api/terminal-gui/command", { method: "POST", body: JSON.stringify(payload) });
  },
  guiListFiles(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/files?${q.toString()}`);
  },
  guiResolveSession(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/session?${q.toString()}`);
  },
  guiFsList(payload = {}) {
    return this.request("/api/terminal-gui/fs/list", { method: "POST", body: JSON.stringify(payload) });
  },
  guiFsRead(payload = {}) {
    return this.request("/api/terminal-gui/fs/read", { method: "POST", body: JSON.stringify(payload) });
  },
  guiFsWrite(payload = {}) {
    return this.request("/api/terminal-gui/fs/write", { method: "POST", body: JSON.stringify(payload) });
  },
  guiListProcesses(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/processes?${q.toString()}`);
  },
  guiKillProcess(payload) {
    return this.request("/api/terminal-gui/processes/kill", { method: "POST", body: JSON.stringify(payload) });
  },
  guiListServices(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/services?${q.toString()}`);
  },
  guiServiceAction(payload) {
    return this.request("/api/terminal-gui/services/action", { method: "POST", body: JSON.stringify(payload) });
  },
  guiLogSources(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/logs/sources?${q.toString()}`);
  },
  guiReadLog(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/logs/read?${q.toString()}`);
  },
  guiDisk(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/disk?${q.toString()}`);
  },
  guiFindLargeFiles(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/disk/find-large?${q.toString()}`);
  },
  guiNetwork(params = {}) {
    const q = new URLSearchParams(params);
    return this.request(`/api/terminal-gui/network?${q.toString()}`);
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
  getWorkspaces() {
    return this.request("/api/workspaces");
  },
  getWorkspaceStats(id) {
    return this.request(`/api/workspaces/${id}/stats`);
  },
  createWorkspace(payload) {
    return this.request("/api/workspaces", { method: "POST", body: JSON.stringify(payload) });
  },
  getWorkspace(id) {
    return this.request(`/api/workspaces/${id}`);
  },
  updateWorkspace(id, payload) {
    return this.request(`/api/workspaces/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteWorkspace(id) {
    return this.request(`/api/workspaces/${id}`, { method: "DELETE" });
  },
  attachServiceToWorkspace(workspaceId, data) {
    return this.request(`/api/workspaces/${workspaceId}/services`, { method: "POST", body: JSON.stringify(data) });
  },
  updateWorkspaceService(workspaceId, serviceId, data) {
    return this.request(`/api/workspaces/${workspaceId}/services/${serviceId}`, { method: "PUT", body: JSON.stringify(data) });
  },
  detachServiceFromWorkspace(workspaceId, serviceId) {
    return this.request(`/api/workspaces/${workspaceId}/services/${serviceId}`, { method: "DELETE" });
  },
  testWorkspaceService(workspaceId, serviceId) {
    return this.request(`/api/workspaces/${workspaceId}/services/${serviceId}/test`, { method: "POST" });
  },
  testWorkspaceServiceDraft(workspaceId, data) {
    return this.request(`/api/workspaces/${workspaceId}/services/test`, { method: "POST", body: JSON.stringify(data) });
  },
  useWorkspaceDefaultCredentials(workspaceId, serviceId) {
    return this.request(`/api/workspaces/${workspaceId}/services/${serviceId}/use-default-credentials`, { method: "POST" });
  },
  // Backward compatibility for existing app.js wiring.
  attachWorkspaceService(id, type, payload) {
    return this.attachServiceToWorkspace(id, {
      serviceType: type,
      friendlyName: payload.friendly_name || payload.friendlyName || payload.serviceIdentifier || "",
      accessKeyId: payload.access_key_id || payload.accessKeyId || "",
      secretAccessKey: payload.secret_access_key || payload.secretAccessKey || "",
      region: payload.region || "us-east-1",
      resourceIdentifier:
        payload.resource_identifier ||
        payload.service_identifier ||
        payload.serviceIdentifier ||
        payload.topic_name ||
        payload.identity ||
        payload.name ||
        payload.instance_identifier ||
        payload.instance_id ||
        payload.function_name ||
        payload.secret_name ||
        "",
      configJson: payload.config_json || payload.configJson || payload.metadata || {},
    });
  },
  detachWorkspaceService(id, _type, serviceId) {
    return this.detachServiceFromWorkspace(id, serviceId);
  },
  search(query, options = {}) {
    const params = new URLSearchParams();
    if (query !== undefined && query !== null) params.set("q", query);
    if (options.workspaceId) params.set("workspaceId", options.workspaceId);
    if (options.maxPerGroup) params.set("maxPerGroup", String(options.maxPerGroup));
    return this.request(`/api/search?${params.toString()}`);
  },
  getSearchIndex(rebuild = false) {
    const q = new URLSearchParams();
    if (rebuild) q.set("rebuild", "true");
    return this.request(`/api/search/index?${q.toString()}`);
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
  streamPackageScan(serverId, manager = "") {
    const q = new URLSearchParams();
    q.set("stream", "true");
    if (manager) q.set("manager", manager);
    const password = localStorage.getItem("oggo-password");
    if (password) q.set("password", password);
    return new EventSource(`/api/software/package-manager/${serverId}/scan?${q.toString()}`);
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
  packageHistoryV2(serverId, limit = 100, filter = "all", search = "") {
    const q = new URLSearchParams({
      serverId: String(serverId),
      limit: String(Number(limit || 100)),
      filter: String(filter || "all"),
    });
    if (search) q.set("search", String(search));
    return this.request(`/api/software/packages/history?${q.toString()}`);
  },
  packageVulnerabilities(serverId, params) {
    const q = new URLSearchParams(params || {});
    return this.request(`/api/software/package-manager/${serverId}/vulnerabilities?${q.toString()}`);
  },
  packageCVEs(serverId, manager, packageName, version = "") {
    const q = new URLSearchParams();
    if (version) q.set("version", version);
    return this.request(`/api/software/packages/${encodeURIComponent(serverId)}/${encodeURIComponent(manager)}/${encodeURIComponent(packageName)}/cves?${q.toString()}`);
  },
  packageVersions(serverId, params) {
    const q = new URLSearchParams(params || {});
    return this.request(`/api/software/package-manager/${serverId}/versions?${q.toString()}`);
  },
  packageVersionsV2(serverId, manager, packageName, limit = 10) {
    const q = new URLSearchParams({ limit: String(Number(limit || 10)) });
    return this.request(`/api/software/packages/${encodeURIComponent(serverId)}/${encodeURIComponent(manager)}/${encodeURIComponent(packageName)}/versions?${q.toString()}`);
  },
  runInstaller(serverId, payload) {
    return this.request(`/api/software/installer/${serverId}/install`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getVaultEntries() {
    return this.request("/api/vault");
  },
  createVaultEntry(data) {
    return this.request("/api/vault", { method: "POST", body: JSON.stringify(data) });
  },
  updateVaultEntry(id, data) {
    return this.request(`/api/vault/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteVaultEntry(id, force = false) {
    return this.request(`/api/vault/${id}?force=${force ? "true" : "false"}`, { method: "DELETE" });
  },
  copyVaultEntry(id) {
    return this.request(`/api/vault/${id}/copy`, { method: "POST" });
  },
  rotateVaultEntry(id, newValue) {
    return this.request(`/api/vault/${id}/rotate`, { method: "POST", body: JSON.stringify({ newValue }) });
  },
  getVaultEntryServices(id) {
    return this.request(`/api/vault/${id}/services`);
  },
  linkVaultService(id, data) {
    return this.request(`/api/vault/${id}/services`, { method: "POST", body: JSON.stringify(data) });
  },
  unlinkVaultService(id, linkId) {
    return this.request(`/api/vault/${id}/services/${linkId}`, { method: "DELETE" });
  },
  generateVaultPassword(options) {
    return this.request("/api/vault/generate", { method: "POST", body: JSON.stringify(options || {}) });
  },
};

window.OggoAPI = API;
