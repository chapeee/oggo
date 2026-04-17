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
};

window.OggoAPI = API;
