const state = {
  view: "dashboard",
  jobs: [],
  logs: [],
  settings: null,
  dashboard: null,
  servers: [],
  remoteJobs: [],
  keys: [],
  activeTerminalServerId: null,
};

let terminalInstance = null;
let terminalSocket = null;
let terminalFitAddon = null;
let terminalSearchAddon = null;
let terminalCurrentLine = "";
let terminalSuggestions = [];
let terminalSuggestionIndex = -1;
let terminalHistoryOverlay = { visible: false, items: [], selected: 0, query: "" };

const presets = [
  ["Every minute", "* * * * *"],
  ["Every 5 minutes", "*/5 * * * *"],
  ["Every 15 minutes", "*/15 * * * *"],
  ["Every 30 minutes", "*/30 * * * *"],
  ["Every hour", "0 * * * *"],
  ["Every 6 hours", "0 */6 * * *"],
  ["Every day at midnight", "0 0 * * *"],
  ["Every day at noon", "0 12 * * *"],
  ["Every week (Monday)", "0 0 * * 1"],
  ["Every month", "0 0 1 * *"],
  ["Custom", "custom"],
];

function el(id) {
  return document.getElementById(id);
}

function toast(message, type = "info") {
  const colors = {
    info: "bg-orange-500",
    success: "bg-green-600",
    error: "bg-red-600",
  };
  const node = document.createElement("div");
  node.className = `${colors[type] || colors.info} text-white px-4 py-2 rounded-lg shadow-lg`;
  node.textContent = message;
  el("toast-container").appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function humanizeCron(expr) {
  try {
    if (window.cronstrue) return window.cronstrue.toString(expr);
  } catch (_error) {
    // fall through
  }
  return expr;
}

function timeAgo(value) {
  if (!value) return "Never";
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusBadge(status) {
  const map = {
    success: "bg-green-500/20 text-green-500",
    failed: "bg-red-500/20 text-red-500",
    running: "bg-amber-500/20 text-amber-500",
    never: "bg-gray-400/20 text-gray-500",
  };
  return `<span class="px-2 py-1 rounded-full text-xs ${map[status] || map.never}">${status || "never"}</span>`;
}

function activateNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const isActive = btn.dataset.view === state.view;
    btn.classList.toggle("bg-[#2b211c]", isActive);
    btn.classList.toggle("border-l-2", isActive);
    btn.classList.toggle("border-orange-500", isActive);
    btn.classList.toggle("text-orange-500", isActive);
    btn.classList.toggle("text-gray-600", !isActive);
    btn.classList.toggle("dark:text-gray-400", !isActive);
  });
}

function dashboardHtml() {
  const data = state.dashboard || { totalJobs: 0, activeJobs: 0, failedToday: 0, successRate: 100, recentActivity: [], chartData: [] };
  return `
    <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      ${card("Total Jobs", data.totalJobs, "text-blue-500")}
      ${card("Active Jobs", data.activeJobs, "text-green-500")}
      ${card("Failed Today", data.failedToday, "text-red-500")}
      ${card("Success Rate", `${data.successRate}%`, "text-purple-500")}
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Last 7 Days Execution</h3>
        <div class="w-full h-64">
          <canvas id="dashboard-chart"></canvas>
        </div>
      </section>

      <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Activity</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr><th class="py-2">Job</th><th>Status</th><th>When</th><th>Duration</th></tr>
            </thead>
            <tbody>
              ${
                data.recentActivity.length
                  ? data.recentActivity
                      .map(
                        (row) => `<tr class="border-t border-gray-100 dark:border-gray-700">
                      <td class="py-2 font-medium text-gray-800 dark:text-gray-200">${row.job_name}</td>
                      <td>${statusBadge(row.status)}</td>
                      <td class="text-gray-500 dark:text-gray-400">${timeAgo(row.created_at)}</td>
                      <td class="text-gray-500 dark:text-gray-400">${row.duration || 0} ms</td>
                    </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4" class="py-4 text-center text-gray-500 dark:text-gray-400">No recent activity</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function card(title, value, color) {
  return `
    <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p class="text-sm text-gray-500">${title}</p>
      <p class="text-2xl font-bold ${color} mt-2">${value}</p>
    </article>
  `;
}

function jobsHtml() {
  return `
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Jobs</h2>
      <div class="flex items-center gap-4 w-full sm:w-auto">
        <div class="relative w-full sm:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i data-lucide="search" class="w-4 h-4 text-gray-400"></i>
          </div>
          <input type="text" id="job-search-input" placeholder="Search jobs..." 
                 class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition duration-150 ease-in-out">
        </div>
        <button id="add-job-btn" class="btn-primary flex items-center gap-2 whitespace-nowrap">
          <i data-lucide="plus" class="w-4 h-4"></i> Add Job
        </button>
      </div>
    </div>
    <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <table class="w-full text-sm">
        <thead class="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="py-3 px-4 font-medium">Name</th>
            <th class="py-3 px-4 font-medium">Schedule</th>
            <th class="py-3 px-4 font-medium">Human</th>
            <th class="py-3 px-4 font-medium">Last Run</th>
            <th class="py-3 px-4 font-medium">Status</th>
            <th class="py-3 px-4 font-medium">Enabled</th>
            <th class="py-3 px-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="jobs-tbody" class="divide-y divide-gray-200 dark:divide-gray-700">
          ${renderJobsTbody()}
        </tbody>
      </table>
    </div>
  `;
}

function renderJobsTbody() {
  const searchTerm = state.jobSearch || "";
  const filteredJobs = state.jobs.filter(j => 
    j.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.command.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return filteredJobs.length ? filteredJobs
    .map(
      (job) => `<tr>
    <td class="py-3 px-4">
      <div class="font-medium text-gray-900 dark:text-gray-100">${job.name}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs" title="${job.command}">${job.command}</div>
    </td>
    <td class="py-3 px-4"><code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 rounded text-gray-800 dark:text-gray-300">${job.schedule}</code></td>
    <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${job.humanSchedule || humanizeCron(job.schedule)}</td>
    <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${timeAgo(job.last_run)}</td>
    <td class="py-3 px-4">${statusBadge(job.last_status)}</td>
    <td class="py-3 px-4">
      <label class="relative inline-flex items-center cursor-pointer">
        <input data-action="toggle" data-id="${job.id}" type="checkbox" class="sr-only peer" ${job.enabled ? "checked" : ""}>
        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-700 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
      </label>
    </td>
    <td class="py-3 px-4 text-right space-x-2">
      <button data-action="run" data-id="${job.id}" class="text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300" title="Run Now"><i data-lucide="play" class="w-4 h-4 pointer-events-none"></i></button>
      <button data-action="edit" data-id="${job.id}" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200" title="Edit"><i data-lucide="edit" class="w-4 h-4 pointer-events-none"></i></button>
      <button data-action="delete" data-id="${job.id}" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" title="Delete"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
    </td>
  </tr>`
    )
    .join("") : `<tr><td colspan="7" class="py-8 text-center text-gray-500 dark:text-gray-400">No jobs found</td></tr>`;
}

function logsHtml() {
  return `
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Logs</h2>
      <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <div class="relative w-full sm:w-48">
          <select id="log-job-filter" class="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition duration-150 ease-in-out appearance-none">
            <option value="">All jobs</option>
            ${state.jobs.map((j) => `<option value="${j.id}">${j.name}</option>`).join("")}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="relative w-full sm:w-40">
          <select id="log-status-filter" class="block w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition duration-150 ease-in-out appearance-none">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </div>
        </div>
        <button id="apply-log-filter" class="btn-primary w-full sm:w-auto whitespace-nowrap"><i data-lucide="filter" class="w-4 h-4"></i> Filter</button>
      </div>
    </div>
    <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <table class="w-full text-sm">
        <thead class="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="py-3 px-4 font-medium">Job</th>
            <th class="py-3 px-4 font-medium">Status</th>
            <th class="py-3 px-4 font-medium">Output</th>
            <th class="py-3 px-4 font-medium">Duration</th>
            <th class="py-3 px-4 font-medium">Timestamp</th>
            <th class="py-3 px-4 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          ${
            state.logs.length ? state.logs
              .map(
                (log) => `<tr class="align-top">
                  <td class="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">${log.job_name}</td>
                  <td class="py-3 px-4">${statusBadge(log.status)}</td>
                  <td class="py-3 px-4 max-w-md">
                    <details class="group">
                      <summary class="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1 outline-none">
                        <i data-lucide="chevron-right" class="w-4 h-4 transition-transform group-open:rotate-90"></i>
                        <span class="truncate">${(log.output || log.error || "").slice(0, 60) || "(empty)"}</span>
                      </summary>
                      <div class="mt-2 pl-5">
                        <pre class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 text-xs rounded-md p-3 whitespace-pre-wrap overflow-x-auto max-h-64 font-mono">${log.output || log.error || "No output"}</pre>
                      </div>
                    </details>
                  </td>
                  <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${log.duration || 0} ms</td>
                  <td class="py-3 px-4 text-gray-500 dark:text-gray-400">${new Date(log.created_at).toLocaleString()}</td>
                  <td class="py-3 px-4 text-right">
                    <button data-clear-job="${log.job_id}" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300" title="Clear logs for this job">
                      <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                  </td>
                </tr>`
              )
              .join("") : `<tr><td colspan="6" class="py-8 text-center text-gray-500 dark:text-gray-400">No logs found</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex justify-end">
      <button id="clear-all-logs" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm font-medium flex items-center gap-1">
        <i data-lucide="trash-2" class="w-4 h-4"></i> Clear All Logs
      </button>
    </div>
  `;
}

function serversHtml() {
  const serverCards = state.servers
    .map((server) => {
      const tags = String(server.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const statusColor =
        server.last_status === "online" ? "bg-green-500" : server.last_status === "offline" ? "bg-red-500" : "bg-gray-400";
      return `
        <div class="server-card bg-white dark:bg-[#1b1410] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm" style="border-left:3px solid ${server.color || "#f97316"};">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold text-orange-500">${server.name}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-300">${server.username}@${server.host}:${server.port || 22}</p>
            </div>
            <span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><span class="w-2.5 h-2.5 rounded-full ${statusColor}"></span>${server.last_status || "unknown"}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${tags.length ? tags.map((tag) => `<span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">${tag}</span>`).join("") : ""}
          </div>
          <p class="text-xs mt-3 text-gray-500 dark:text-gray-400">Last connected: ${server.last_connected ? new Date(server.last_connected).toLocaleString() : "Never"}</p>
          <div class="mt-4 flex items-center gap-3">
            <button data-server-action="terminal" data-id="${server.id}" class="btn-secondary"><i data-lucide="terminal" class="w-4 h-4"></i>Terminal</button>
            <button data-server-action="jobs" data-id="${server.id}" class="btn-secondary"><i data-lucide="clock-3" class="w-4 h-4"></i>Jobs</button>
            <button data-server-action="test" data-id="${server.id}" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test</button>
            <button data-server-action="edit" data-id="${server.id}" class="text-orange-500 dark:text-orange-400"><i data-lucide="edit" class="w-4 h-4"></i></button>
            <button data-server-action="delete" data-id="${server.id}" class="text-red-600 dark:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Servers</h2>
      <div class="flex gap-3">
        <input id="server-search" class="input max-w-xs" placeholder="Search servers..." />
        <button id="add-server-btn" class="btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Add Server</button>
      </div>
    </div>
    ${
      state.servers.length
        ? `<div id="servers-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${serverCards}</div>`
        : `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
             <i data-lucide="server" class="w-10 h-10 text-gray-400 mx-auto"></i>
             <h3 class="mt-3 text-lg font-semibold">No servers added yet</h3>
             <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your first remote server to manage cron jobs across all machines.</p>
             <button id="add-server-btn-empty" class="btn-primary mt-4">Add Server</button>
           </div>`
    }
  `;
}

function terminalHtml() {
  return `
    <div class="flex flex-col h-[calc(100vh-100px)]">
      <div class="flex-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col overflow-hidden relative shadow-lg">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#161b22]">
          <div class="flex items-center gap-2">
            <div id="terminal-tab-bar" class="flex items-center gap-2"></div>
            <button class="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" title="New Connection" onclick="document.querySelector('[data-view=servers]').click()">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <button id="terminal-explain-btn" class="hover:text-white" title="Explain Last Command"><i data-lucide="search" class="w-4 h-4"></i></button>
            <button id="terminal-clear-btn" class="hover:text-white" title="Clear Terminal"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            <button id="terminal-disconnect-btn" class="hover:text-red-500" title="Disconnect"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
        </div>
        <div id="terminal-container" class="flex-1 bg-[#0d1117] relative">
          <div id="terminal-animation-overlay" class="absolute inset-0 z-50 flex items-center justify-center bg-[#0d1117] hidden">
            <div class="text-center">
              <img src="https://media1.tenor.com/m/o_wT_K06VwMAAAAd/tom-and-jerry.gif" alt="Connecting..." class="w-48 h-48 object-contain rounded-lg mx-auto mb-4" />
              <div class="text-orange-500 font-mono text-sm animate-pulse">Connecting to server...</div>
            </div>
          </div>
        </div>
        <div id="terminal-suggestions" class="hidden"></div>
        <div id="terminal-error-card" class="hidden border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3"></div>
        <div id="terminal-explain-panel" class="hidden border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161b22] p-3 max-h-56 overflow-auto text-sm"></div>
        <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161b22] text-xs flex justify-between items-center text-gray-500">
          <div class="flex items-center gap-4">
            <div id="terminal-status-bar" class="flex items-center gap-4">
              <span id="terminal-status" class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-gray-500"></span>Disconnected</span>
            </div>
            <div class="hidden xl:flex items-center gap-2 ml-4">
              <span class="opacity-70">Try typing:</span>
              <button class="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition" onclick="document.getElementById('terminal-container').click(); terminalInstance.write('docker '); terminalCurrentLine='docker '; showTerminalSuggestions(state.activeTerminalServerId, 'docker');">docker</button>
              <button class="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition" onclick="document.getElementById('terminal-container').click(); terminalInstance.write('git '); terminalCurrentLine='git '; showTerminalSuggestions(state.activeTerminalServerId, 'git');">git</button>
              <button class="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition" onclick="document.getElementById('terminal-container').click(); terminalInstance.write('npm '); terminalCurrentLine='npm '; showTerminalSuggestions(state.activeTerminalServerId, 'npm');">npm</button>
              <button class="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition" onclick="document.getElementById('terminal-container').click(); terminalInstance.write('grep '); terminalCurrentLine='grep '; showTerminalSuggestions(state.activeTerminalServerId, 'grep');">grep</button>
            </div>
          </div>
          <div id="terminal-tldr-status" class="flex items-center gap-2 text-orange-500">
            <span>tldr loaded</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function settingsHtml() {
  const s = state.settings;
  return `
    <form id="settings-form" class="space-y-6 max-w-4xl">
      <section class="panel">
        <h3 class="section-title"><i data-lucide="sliders" class="w-5 h-5"></i> General</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${field("Port", `<input name="port" class="input" type="number" value="${s.port}">`)}
          ${field("Timezone", `<input name="timezone" class="input" value="${s.timezone}">`)}
          ${field("Log retention days", `<input name="logRetentionDays" class="input" type="number" value="${s.logRetentionDays}">`)}
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Open browser on start</span>
            ${toggle("openBrowser", s.openBrowser)}
          </div>
        </div>
      </section>

      <section class="panel">
        <h3 class="section-title"><i data-lucide="shield" class="w-5 h-5"></i> Security</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${field("Password", `<input name="password" class="input" type="password" value="${s.password || ""}">`)}
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Enable password</span>
            ${toggle("passwordEnabled", s.passwordEnabled)}
          </div>
        </div>
      </section>

      <section class="panel">
        <h3 class="section-title"><i data-lucide="mail" class="w-5 h-5"></i> Email Notifications</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${field("Notify email", `<input name="notifications.email" class="input" value="${s.notifications.email || ""}">`)}
          ${field("SMTP Host", `<input name="smtp.host" class="input" value="${s.smtp.host || ""}">`)}
          ${field("SMTP Port", `<input name="smtp.port" class="input" type="number" value="${s.smtp.port || 587}">`)}
          ${field("SMTP User", `<input name="smtp.user" class="input" value="${s.smtp.user || ""}">`)}
          ${field("SMTP Password", `<input name="smtp.pass" class="input" type="password" value="${s.smtp.pass || ""}">`)}
          <div class="flex flex-col gap-4 pt-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-700 dark:text-gray-300">Enable notifications</span>
              ${toggle("notifications.enabled", s.notifications.enabled)}
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-700 dark:text-gray-300">Secure connection</span>
              ${toggle("smtp.secure", s.smtp.secure)}
            </div>
          </div>
        </div>
        <div class="mt-6">
          <button type="button" id="test-email-btn" class="btn-secondary"><i data-lucide="send" class="w-4 h-4"></i> Send Test Email</button>
        </div>
      </section>

      <section class="panel">
        <h3 class="section-title"><i data-lucide="palette" class="w-5 h-5"></i> Appearance</h3>
        <div class="max-w-xs">
          ${field("Theme", `<select name="theme" class="input"><option ${s.theme === "dark" ? "selected" : ""}>dark</option><option ${s.theme === "light" ? "selected" : ""}>light</option></select>`)}
        </div>
      </section>

      <section class="panel border-red-200 dark:border-red-900/30">
        <h3 class="section-title text-red-600 dark:text-red-500"><i data-lucide="alert-triangle" class="w-5 h-5"></i> Danger Zone</h3>
        <div class="flex gap-4">
          <button type="button" id="danger-clear-logs" class="btn-danger"><i data-lucide="trash-2" class="w-4 h-4"></i> Clear all logs</button>
          <button type="button" id="danger-reset" class="btn-secondary"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Reset to defaults</button>
        </div>
      </section>

      <div class="flex justify-end pt-4">
        <button class="btn-primary px-8"><i data-lucide="save" class="w-4 h-4"></i> Save Settings</button>
      </div>
    </form>
  `;
}

function field(label, content) {
  return `<div class="floating-label-group"><label>${label}</label>${content}</div>`;
}

function toggle(name, value) {
  return `<div class="pt-2"><label class="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" name="${name}" class="sr-only peer" ${value ? "checked" : ""}>
    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-700 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
  </label></div>`;
}

function render() {
  activateNav();
  const root = el("app-content");

  const terminalTabBar = el("terminal-tab-bar");
  if (terminalTabBar) {
    terminalTabBar.innerHTML = state.servers.map(s => {
      const isActive = state.activeTerminalServerId === s.id;
      const statusColor = s.last_status === "online" ? "bg-green-500" : s.last_status === "offline" ? "bg-red-500" : "bg-gray-400";
      return `
        <button data-terminal-tab="${s.id}" class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive 
            ? "bg-[#2b211c] text-orange-500 border border-orange-500/40" 
            : "bg-[#111118] text-gray-400 border border-gray-800 hover:bg-gray-800"
        }">
          <span class="w-2 h-2 rounded-full ${statusColor}"></span>
          ${s.name}
        </button>
      `;
    }).join("");
  }

  const sidebarServers = el("sidebar-servers-list");
  if (sidebarServers) {
    sidebarServers.innerHTML = state.servers.map((s) => {
      const isActive = state.view === "terminal" && state.activeTerminalServerId === s.id;
      const statusColor = s.last_status === "online" ? "bg-green-500" : s.last_status === "offline" ? "bg-red-500" : "bg-gray-400";
      return `
        <button data-sidebar-server="${s.id}" class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 ${
          isActive 
            ? "border-l-2 border-orange-500 bg-[#2b211c] text-orange-500" 
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }">
          <span class="w-2 h-2 rounded-full ${statusColor} shrink-0"></span>
          <div class="flex-1 truncate text-sm">
            <div class="font-medium ${isActive ? 'text-orange-500' : 'text-gray-800 dark:text-gray-200'}">${s.name}</div>
            <div class="text-[10px] opacity-70 truncate">${s.username}@${s.host}</div>
          </div>
        </button>
      `;
    }).join("");
  }

  if (state.view === "dashboard") {
    root.innerHTML = dashboardHtml();
    renderChart();
  } else if (state.view === "jobs") {
    root.innerHTML = jobsHtml();
  } else if (state.view === "logs") {
    root.innerHTML = logsHtml();
  } else if (state.view === "servers") {
    root.innerHTML = serversHtml();
  } else if (state.view === "terminal") {
    root.innerHTML = terminalHtml();
  } else if (state.view === "settings") {
    root.innerHTML = settingsHtml();
  }
  if (window.lucide) window.lucide.createIcons();
}

function renderChart() {
  const canvas = el("dashboard-chart");
  if (!canvas || !window.Chart || !state.dashboard || !state.dashboard.chartData) return;

  const data = state.dashboard.chartData;
  const isDark = window.OggoTheme.current === "dark";
  const textColor = isDark ? "#9ca3af" : "#4b5563";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  // Create last 7 days labels array
  const labels = [];
  const successData = [];
  const failedData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    
    const row = data.find(r => r.log_date === dateStr);
    successData.push(row ? row.success_count : 0);
    failedData.push(row ? row.failed_count : 0);
  }

  new window.Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Success",
          data: successData,
          backgroundColor: "#10b981",
          borderRadius: 4,
        },
        {
          label: "Failed",
          data: failedData,
          backgroundColor: "#ef4444",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: {
        x: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true },
      },
    },
  });
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let ref = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!ref[parts[i]]) ref[parts[i]] = {};
    ref = ref[parts[i]];
  }
  ref[parts[parts.length - 1]] = value;
}

async function refreshData() {
  const [jobs, logs, settings, dashboard, servers, keys] = await Promise.all([
    window.OggoAPI.getJobs(),
    window.OggoAPI.getLogs({ limit: 100 }),
    window.OggoAPI.getSettings(),
    window.OggoAPI.getDashboard(),
    window.OggoAPI.getServers().catch(() => []),
    window.OggoAPI.getKeys().catch(() => []),
  ]);
  state.jobs = jobs;
  state.logs = logs;
  state.settings = settings;
  state.dashboard = dashboard;
  state.servers = servers;
  state.keys = keys;
}

function openJobModal(job = null) {
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const currentSchedule = job?.schedule || "0 * * * *";
  const title = job ? "Edit Job" : "New Job";
  
  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
      <button type="button" id="job-close" class="text-gray-400 hover:text-gray-500 focus:outline-none">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </div>
    <form id="job-form" class="space-y-5 p-6">
      <input type="hidden" name="id" value="${job?.id || ""}">
      
      <div class="grid grid-cols-1 gap-5">
        ${field("Name", `<input required name="name" class="input" placeholder="e.g. Database Backup" value="${job?.name || ""}">`)}
        ${field("Command", `<input required name="command" class="input font-mono" placeholder="e.g. /usr/bin/node script.js" value="${job?.command || ""}">`)}
        ${field("Description (optional)", `<textarea name="description" class="input min-h-[80px]" placeholder="What does this job do?">${job?.description || ""}</textarea>`)}
      </div>

      <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Schedule</h4>
        <input type="hidden" name="schedule" id="real-schedule-input" value="${currentSchedule}">
        <div id="cron-builder-container"></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notifications</label>
          <select name="notify" class="input bg-white dark:bg-gray-800">
            <option value="none" ${job?.notify === "none" ? "selected" : ""}>Never</option>
            <option value="failure" ${!job || job.notify === "failure" ? "selected" : ""}>On Failure</option>
            <option value="success" ${job?.notify === "success" ? "selected" : ""}>On Success</option>
            <option value="always" ${job?.notify === "always" ? "selected" : ""}>Always</option>
          </select>
        </div>
        <div class="flex items-center justify-between sm:justify-end sm:gap-3 mt-6 sm:mt-0">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled Status</span>
          ${toggle("enabled", job ? job.enabled : true)}
        </div>
      </div>

      <div class="flex gap-3 justify-end pt-4 mt-6 border-t border-gray-100 dark:border-gray-700">
        <button type="button" id="job-cancel" class="btn-secondary px-6">Cancel</button>
        <button type="submit" class="btn-primary px-8">Save Job</button>
      </div>
    </form>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();

  if (window.CronBuilder) {
    new window.CronBuilder("cron-builder-container", currentSchedule);
  }

  const scheduleInput = el("real-schedule-input");
  const handleScheduleChange = (e) => {
    if (scheduleInput) scheduleInput.value = e.detail.expression;
  };
  document.addEventListener("schedulechange", handleScheduleChange);

  const closeModal = () => {
    document.removeEventListener("schedulechange", handleScheduleChange);
    modal.classList.add("hidden");
  };
  el("job-cancel").onclick = closeModal;
  el("job-close").onclick = closeModal;
  el("job-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const schedule = form.get("schedule");
    const payload = {
      name: form.get("name"),
      command: form.get("command"),
      description: form.get("description"),
      schedule,
      notify: form.get("notify"),
      enabled: form.get("enabled") === "on",
    };

    try {
      if (form.get("id")) {
        await window.OggoAPI.updateJob(form.get("id"), payload);
        toast("Job updated", "success");
      } else {
        await window.OggoAPI.createJob(payload);
        toast("Job created", "success");
      }
      closeModal();
      await refreshData();
      render();
    } catch (error) {
      toast(error.message, "error");
    }
  };
}

function openServerModal(server = null) {
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const title = server ? "Edit Server" : "Add Server";

  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h3 class="text-lg font-semibold">${title}</h3>
      <button id="server-close-btn" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="server-form" class="p-6 space-y-5">
      <input type="hidden" name="id" value="${server?.id || ""}" />
      <div class="modal-grid">
        ${field("Server name", `<input class="input" name="name" required value="${server?.name || ""}" placeholder="Production Web" />`)}
        ${field("Host", `<input class="input" name="host" required value="${server?.host || ""}" placeholder="192.168.1.10" />`)}
        ${field("Port", `<input class="input" name="port" type="number" value="${server?.port || 22}" />`)}
        ${field("Username", `<input class="input" name="username" required value="${server?.username || "root"}" />`)}
        ${field("Tags", `<input class="input" name="tags" value="${server?.tags || ""}" placeholder="production,web" />`)}
        ${field("Color", `<input class="input" name="color" type="color" value="${server?.color || "#f97316"}" />`)}
      </div>
      ${field("Notes", `<textarea class="input" name="notes" placeholder="Optional notes">${server?.notes || ""}</textarea>`)}

      <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="text-sm font-semibold mb-3">Authentication</div>
        ${
          server
            ? `<div class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                 Saved credentials:
                 <span class="${server.hasPassword ? "text-green-600 dark:text-green-400" : "text-gray-400"}">password ${server.hasPassword ? "present" : "missing"}</span>,
                 <span class="${server.hasPrivateKey ? "text-green-600 dark:text-green-400" : "text-gray-400"}">key ${server.hasPrivateKey ? "present" : "missing"}</span>
               </div>`
            : ""
        }
        ${field(
          "Auth type",
          `<select class="input" name="auth_type">
            <option value="password" ${!server || server.auth_type === "password" ? "selected" : ""}>Password</option>
            <option value="key" ${server?.auth_type === "key" ? "selected" : ""}>SSH Key File</option>
            <option value="key_passphrase" ${server?.auth_type === "key_passphrase" ? "selected" : ""}>Pasted Key + Passphrase</option>
          </select>`
        )}
        ${field("Password", `<input class="input" type="password" name="password" placeholder="${server ? "Leave empty to keep unchanged" : "Password"}" />`)}
        ${field("Private key path", `<input class="input" name="private_key_path" value="${server?.private_key_path || ""}" placeholder="~/.ssh/id_rsa" />`)}
        ${field("Paste private key", `<textarea class="input font-mono" name="private_key_content" placeholder="${server ? "Leave empty to keep unchanged" : "-----BEGIN OPENSSH PRIVATE KEY-----"}"></textarea>`)}
        ${field("Passphrase", `<input class="input" type="password" name="passphrase" placeholder="${server ? "Leave empty to keep unchanged" : "Optional"}" />`)}
      </div>

      <div class="flex items-center gap-3 justify-end">
        <button type="button" id="server-test-btn" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test</button>
        <button type="button" id="server-cancel-btn" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save Server</button>
      </div>
      <div id="server-test-result" class="text-sm"></div>
    </form>
  `;

  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
  const closeModal = () => modal.classList.add("hidden");
  el("server-close-btn").onclick = closeModal;
  el("server-cancel-btn").onclick = closeModal;

  const buildServerPayload = (formElement) => {
    const raw = Object.fromEntries(new FormData(formElement).entries());
    const payload = { ...raw };
    // Do not send empty secrets; backend should keep existing encrypted values.
    if (!payload.password?.trim()) delete payload.password;
    if (!payload.private_key_content?.trim()) delete payload.private_key_content;
    if (!payload.passphrase?.trim()) delete payload.passphrase;
    if (!payload.private_key_path?.trim()) delete payload.private_key_path;
    return payload;
  };

  el("server-test-btn").onclick = async () => {
    const payload = buildServerPayload(el("server-form"));
    try {
      let id = payload.id;
      if (!id) {
        const created = await window.OggoAPI.createServer(payload);
        id = created.id;
        el("server-form").querySelector('input[name="id"]').value = id;
      } else {
        await window.OggoAPI.updateServer(id, payload);
      }
      const result = await window.OggoAPI.testServer(id);
      el("server-test-result").innerHTML = result.success
        ? `<span class="text-green-600 dark:text-green-400">Connected successfully.</span>`
        : `<span class="text-red-600 dark:text-red-400">Connection failed: ${result.message}</span>`;
      await refreshData();
      render();
      bindViewEvents();
    } catch (error) {
      el("server-test-result").innerHTML = `<span class="text-red-600 dark:text-red-400">${error.message}</span>`;
    }
  };

  el("server-form").onsubmit = async (event) => {
    event.preventDefault();
    const payload = buildServerPayload(event.target);
    try {
      if (payload.id) {
        await window.OggoAPI.updateServer(payload.id, payload);
        toast("Server updated", "success");
      } else {
        await window.OggoAPI.createServer(payload);
        toast("Server created", "success");
      }
      closeModal();
      await refreshData();
      render();
      bindViewEvents();
    } catch (error) {
      toast(error.message, "error");
    }
  };
}

function connectTerminal(serverId) {
  const container = el("terminal-container");
  const statusNode = el("terminal-status");
  const server = state.servers.find((s) => s.id === serverId);
  if (!container || !server) return;

  state.activeTerminalServerId = serverId;
  statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Connecting...`;

  if (terminalSocket) {
    terminalSocket.close();
    terminalSocket = null;
  }
  if (terminalInstance) {
    terminalInstance.dispose();
    terminalInstance = null;
  }

  const term = new window.Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollback: 5000,
    theme: {
      background: "#0d1117",
      foreground: "#e6edf3",
      cursor: "#58a6ff",
      selection: "#264f78",
      black: "#484f58",
      red: "#ff7b72",
      green: "#3fb950",
      yellow: "#d29922",
      blue: "#58a6ff",
      magenta: "#bc8cff",
      cyan: "#39c5cf",
      white: "#b1bac4",
    },
  });
  const fit = new window.FitAddon.FitAddon();
  const webLinksAddon = new window.WebLinksAddon.WebLinksAddon();
  const searchAddon = new window.SearchAddon.SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(webLinksAddon);
  term.loadAddon(searchAddon);
  term.open(container);
  fit.fit();
  term.writeln("\r\n  Connecting to server...\r\n");

  const overlay = el("terminal-animation-overlay");
  if (overlay) overlay.classList.remove("hidden");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/terminal/${serverId}`);
  terminalSocket = ws;
  terminalInstance = term;
  terminalFitAddon = fit;
  terminalSearchAddon = searchAddon;
  terminalCurrentLine = "";
  terminalSuggestions = [];
  terminalSuggestionIndex = -1;

  ws.onopen = () => {
    statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500"></span>Connected: ${server.username}@${server.host}`;
    if (overlay) overlay.classList.add("hidden");
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "data") term.write(atob(msg.data));
      if (msg.type === "error") {
        term.writeln(`\r\n[error] ${msg.message}\r\n`);
        if (overlay) overlay.classList.add("hidden");
      }
      if (msg.type === "error_card") renderTerminalErrorCard(msg.data);
      if (msg.type === "status" && msg.status === "connected") {
        term.writeln("\r\nConnected.\r\n");
        if (overlay) overlay.classList.add("hidden");
      }
    } catch (_error) {
      term.write(event.data);
    }
  };
  ws.onclose = () => {
    statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-500"></span>Disconnected: ${server.name}`;
    if (overlay) overlay.classList.add("hidden");
  };
  ws.onerror = () => {
    statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span>Connection error`;
    if (overlay) overlay.classList.add("hidden");
  };

  term.onData((data) => {
    // Track current line buffer for smart suggestions and explain-last-command.
    if (data === "\r") {
      // If suggestions are visible, Enter should accept the highlighted suggestion instead of executing.
      if (terminalSuggestions.length > 0) {
        const idx = terminalSuggestionIndex >= 0 ? terminalSuggestionIndex : 0;
        applyTerminalSuggestion(idx);
        return;
      }
      const command = terminalCurrentLine.trim();
      if (command) {
        localStorage.setItem("oggo.lastCommand", command);
        terminalCurrentLine = "";
        hideTerminalSuggestions();
      }
    } else if (data === "\u007F") {
      terminalCurrentLine = terminalCurrentLine.slice(0, -1);
    } else if (data && data.length === 1 && data >= " " && data !== "\t") {
      terminalCurrentLine += data;
    }

    if (data === "\t") {
      handleTerminalTabSuggestion(serverId);
      return;
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "data", data }));
    debouncedTerminalSuggest(serverId);
  });

  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown") return true;
    if (terminalSuggestions.length > 0) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        terminalSuggestionIndex = Math.max(0, terminalSuggestionIndex - 1);
        renderTerminalSuggestionsBox();
        return false;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        terminalSuggestionIndex = Math.min(terminalSuggestions.length - 1, terminalSuggestionIndex + 1);
        renderTerminalSuggestionsBox();
        return false;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        hideTerminalSuggestions();
        return false;
      }
    }

    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      openTerminalHistoryOverlay(serverId);
      return false;
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      const q = prompt("Search in terminal");
      if (q) terminalSearchAddon.findNext(q);
      return false;
    }
    return true;
  });
  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
    fit.fit();
  });
  window.addEventListener("resize", () => fit.fit());
}

function renderTerminalErrorCard(errorData) {
  const node = el("terminal-error-card");
  if (!node || !errorData) return;
  node.classList.remove("hidden");
  node.innerHTML = `
    <div class="font-semibold text-red-700 dark:text-red-300">${errorData.title || "Execution Error"}</div>
    <div class="text-sm mt-1 text-red-600 dark:text-red-200">${errorData.what || ""}</div>
    <div class="text-xs mt-1 text-red-500 dark:text-red-300">${errorData.why || ""}</div>
    <div class="mt-2 space-y-1">
      ${(errorData.fixes || [])
        .map((fix) => `<div class="text-xs"><span class="font-semibold">${fix.desc}:</span> <code>${fix.cmd}</code></div>`)
        .join("")}
    </div>
  `;
}

function hideTerminalSuggestions() {
  const box = el("terminal-suggestions");
  if (!box) return;
  box.classList.add("hidden");
  box.innerHTML = "";
  terminalSuggestions = [];
  terminalSuggestionIndex = -1;
}

function renderTerminalSuggestionsBox() {
  const box = el("terminal-suggestions");
  if (!box) return;
  if (!terminalSuggestions.length) {
    hideTerminalSuggestions();
    return;
  }
  
  if (terminalSuggestionIndex < 0) terminalSuggestionIndex = 0;

  box.classList.remove("hidden");
  box.className = "absolute bottom-[40px] left-[20px] w-[500px] bg-[#111118] rounded-xl overflow-hidden z-[100] font-mono";
  box.style.border = "1px solid rgba(249,115,22,0.3)";
  box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
  
  const headerHtml = `
    <div class="flex justify-between items-center px-3.5 py-1.5 border-b border-white/5 text-[11px] text-[#5A5A70]">
      <span>${terminalSuggestions.length} suggestion${terminalSuggestions.length > 1 ? 's' : ''}</span>
      <div class="flex gap-2.5">
        <span class="flex items-center gap-1"><span class="border border-white/10 rounded px-1 pb-[1px]">↑↓</span> navigate</span>
        <span class="flex items-center gap-1"><span class="border border-white/10 rounded px-1 pb-[1px]">Tab</span> accept</span>
        <span class="flex items-center gap-1"><span class="border border-white/10 rounded px-1 pb-[1px]">Esc</span> dismiss</span>
      </div>
    </div>
  `;

  const itemsHtml = terminalSuggestions.slice(0, 6).map((s, i) => {
    const isSelected = i === terminalSuggestionIndex;
    const bgClass = isSelected ? "bg-[#f97316]/10" : "bg-transparent hover:bg-white/5";
    const tagBg = s.source === "history" ? "bg-[#22C55E]/15" : "bg-[#F97316]/15";
    const tagText = s.source === "history" ? "text-[#22C55E]" : "text-[#F97316]";
    
    return `
      <div data-suggest-index="${i}" class="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer border-b border-white/5 ${bgClass}">
        <span class="text-[10px] px-1.5 py-0.5 rounded-[5px] shrink-0 ${tagBg} ${tagText}">${s.source}</span>
        <span class="text-[13px] font-medium text-[#F1F1F3] shrink-0">${s.cmd}</span>
        <span class="text-[12px] text-[#5A5A70] overflow-hidden text-ellipsis whitespace-nowrap">${s.desc || ""}</span>
        <span class="ml-auto text-[11px] text-[#3A3A50] shrink-0">Tab</span>
      </div>
    `;
  }).join("");

  box.innerHTML = headerHtml + itemsHtml;
  box.onclick = (event) => {
    const idx = event.target.closest("[data-suggest-index]")?.dataset?.suggestIndex;
    if (idx === undefined) return;
    applyTerminalSuggestion(Number(idx));
  };
}

async function showTerminalSuggestions(serverId, query) {
  if (!query || query.trim().length < 2) {
    hideTerminalSuggestions();
    return;
  }
  try {
    const result = await window.OggoAPI.getTerminalSuggestions(query, serverId);
    terminalSuggestions = result.suggestions || [];
    terminalSuggestionIndex = 0;
    renderTerminalSuggestionsBox();
  } catch (_error) {
    hideTerminalSuggestions();
  }
}

function applyTerminalSuggestion(index = 0) {
  if (!terminalInstance || !terminalSuggestions[index]) return;
  const selected = terminalSuggestions[index];
  const cmd = selected.cmd;
  const erase = "\b \b".repeat(terminalCurrentLine.length);
  terminalInstance.write(erase + cmd);
  terminalCurrentLine = cmd;
  hideTerminalSuggestions();
  if (selected.examples && selected.examples.length) {
    showTerminalExamplesHint(selected);
  }
}

let terminalSuggestTimer = null;
function debouncedTerminalSuggest(serverId) {
  clearTimeout(terminalSuggestTimer);
  terminalSuggestTimer = setTimeout(() => {
    showTerminalSuggestions(serverId, terminalCurrentLine);
  }, 200);
}

async function handleTerminalTabSuggestion(serverId) {
  if (terminalSuggestions.length) {
    applyTerminalSuggestion(0);
    return;
  }
  const token = (terminalCurrentLine.split(/\s+/).pop() || "").trim();
  if (!token) return;
  try {
    const result = await window.OggoAPI.getTerminalSuggestions(token, serverId);
    terminalSuggestions = result.suggestions || [];
    if (!terminalSuggestions.length) return;
    const top = terminalSuggestions[0];
    if (top?.cmd && top.cmd.toLowerCase().startsWith(token.toLowerCase())) {
      applyTerminalSuggestion(0);
      return;
    }
    await showTerminalSuggestions(serverId, token);
  } catch (_error) {
    // ignore transient suggestion API failures
  }
}

function showTerminalExamplesHint(suggestion) {
  const panel = el("terminal-explain-panel");
  if (!panel) return;

  const examples = Array.isArray(suggestion.examples) ? suggestion.examples : [];
  if (!examples.length) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  const title = suggestion.cmd || "Command";
  const rows = examples
    .map((e) => {
      const desc = e.desc || "";
      const cmd = (e.cmd || "").replace(/"/g, "&quot;");
      const displayCmd = (e.cmd || "").replace(/\{\{(.+?)\}\}/g, "<$1>");
      return `
        <div class="mb-3 rounded-lg overflow-hidden border border-gray-800 bg-[#111118]">
          <div class="px-3 py-2 text-[11px] text-[#9ca3af] border-b border-gray-800">
            ${desc}
          </div>
          <button
            data-example-cmd="${cmd}"
            class="w-full text-left px-3 py-2 text-xs font-mono bg-[#111118] hover:bg-[#1c1c27] text-[#E6EDF3]"
          >
            ${displayCmd}
          </button>
        </div>
      `;
    })
    .join("");

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="flex items-center justify-between mb-2 text-[11px] text-[#9ca3af]">
      <div class="flex items-center gap-2">
        <span class="uppercase tracking-wider text-[#F97316]">${title} examples</span>
        <span class="hidden md:inline text-[#4b5563]">Click an example to paste it into the terminal.</span>
      </div>
      <button id="terminal-examples-close" class="text-[#6b7280] hover:text-[#e5e7eb] text-xs">✕</button>
    </div>
    <div class="space-y-1 max-h-40 overflow-auto pr-1">
      ${rows}
    </div>
  `;

  panel.onclick = (event) => {
    const close = event.target.id === "terminal-examples-close";
    if (close) {
      panel.classList.add("hidden");
      return;
    }
    const cmd = event.target.closest("[data-example-cmd]")?.dataset?.exampleCmd;
    if (!cmd || !terminalInstance) return;
    terminalInstance.write("\r");
    terminalInstance.write(cmd);
    terminalCurrentLine = cmd;
    toast("Example inserted", "success");
  };
}

async function explainLastTerminalCommand() {
  const last = localStorage.getItem("oggo.lastCommand");
  const panel = el("terminal-explain-panel");
  if (!panel || !last) {
    toast("No recent command to explain", "info");
    return;
  }
  panel.classList.remove("hidden");
  panel.innerHTML = `<div class="text-sm text-gray-500">Explaining \`${last}\`...</div>`;
  try {
    const explained = await window.OggoAPI.explainTerminalCommand(last);
    const cheat = explained.cheat ? `<pre class="text-xs whitespace-pre-wrap">${explained.cheat.slice(0, 2500)}</pre>` : "<div class='text-xs text-gray-500'>No cheat.sh result.</div>";
    const mankier = explained.mankier?.explanations || explained.mankier?.explanation || [];
    const flags = Array.isArray(mankier)
      ? mankier
          .map((item) => `<div class="text-xs"><code>${item.arg || item.option || ""}</code> - ${item.explanation || item.desc || ""}</div>`)
          .join("")
      : "";
    panel.innerHTML = `
      <div class="font-semibold mb-2">Explain: <code>${last}</code></div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div><div class="font-medium mb-1">cheat.sh</div>${cheat}</div>
        <div><div class="font-medium mb-1">mankier flags</div>${flags || "<div class='text-xs text-gray-500'>No flag breakdown.</div>"}</div>
      </div>
    `;
  } catch (error) {
    panel.innerHTML = `<div class="text-sm text-red-600">${error.message}</div>`;
  }
}

async function openTerminalHistoryOverlay(serverId) {
  const history = await window.OggoAPI.getTerminalHistory(serverId, 1000);
  terminalHistoryOverlay = { visible: true, items: history || [], selected: 0, query: "" };
  const query = prompt("History search (Ctrl+R):");
  if (query === null) return;
  const FuseCtor = window.Fuse;
  if (!FuseCtor) {
    toast("Fuse.js not loaded", "error");
    return;
  }
  const fuse = new FuseCtor(
    terminalHistoryOverlay.items.map((item) => ({ command: item.command })),
    { keys: ["command"], threshold: 0.4, includeScore: true, includeMatches: true }
  );
  const match = fuse.search(query)[0]?.item?.command;
  if (!match || !terminalInstance) return;
  const erase = "\b \b".repeat(terminalCurrentLine.length);
  terminalInstance.write(erase + match);
  terminalCurrentLine = match;
  toast("Loaded from history", "success");
}

function bindGlobalEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      state.view = btn.dataset.view;
      await refreshData();
      render();
      bindViewEvents();
      
      if (state.view === "terminal") {
        if (!state.activeTerminalServerId && state.servers.length > 0) {
          state.activeTerminalServerId = state.servers[0].id;
          render();
          bindViewEvents();
        }
        if (state.activeTerminalServerId && (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN)) {
          connectTerminal(state.activeTerminalServerId);
        } else if (state.activeTerminalServerId && terminalInstance) {
          // just re-attach or refocus if needed, but since we re-rendered, 
          // the terminal container is new! We MUST re-open the terminal instance 
          // or reconnect if the container was destroyed.
          // Since render() destroys the #terminal-container, we have to reconnect.
          connectTerminal(state.activeTerminalServerId);
        }
      }
    })
  );

  const themeBtn = el("theme-toggle");
  if (themeBtn) themeBtn.onclick = () => window.OggoTheme.toggle();

  const restartBtn = el("server-restart-btn");
  if (restartBtn) {
    restartBtn.onclick = async () => {
      if (confirm("Restart the oggo-server?")) {
        toast("Restarting server...", "success");
        try {
          await window.OggoAPI.restartServer();
          setTimeout(() => window.location.reload(), 3000);
        } catch (error) {
          toast(error.message, "error");
        }
      }
    };
  }

  const stopBtn = el("server-stop-btn");
  if (stopBtn) {
    stopBtn.onclick = async () => {
      if (confirm("Stop the oggo-server? You will need to start it manually from the terminal.")) {
        toast("Stopping server...", "success");
        try {
          await window.OggoAPI.stopServer();
        } catch (error) {
          toast(error.message, "error");
        }
      }
    };
  }
}

function bindViewEvents() {
  document.querySelectorAll("[data-sidebar-server], [data-terminal-tab]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.sidebarServer || btn.dataset.terminalTab;
      state.activeTerminalServerId = id;
      state.view = "terminal";
      render();
      bindViewEvents();
      connectTerminal(id);
    };
  });

  if (state.view === "jobs") {
    const searchInput = el("job-search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.jobSearch = e.target.value;
        render();
        bindViewEvents();
        // Maintain focus after re-render
        const newSearchInput = el("job-search-input");
        if (newSearchInput) {
          newSearchInput.focus();
          const val = newSearchInput.value;
          newSearchInput.value = "";
          newSearchInput.value = val;
        }
      };
    }

    el("add-job-btn").onclick = () => openJobModal();
    el("app-content").onclick = async (event) => {
      const id = event.target.dataset.id;
      const action = event.target.dataset.action;
      if (!id || !action) return;
      try {
        if (action === "edit") openJobModal(state.jobs.find((j) => j.id === id));
        if (action === "run") {
          const runningJob = state.jobs.find((j) => j.id === id);
          if (runningJob) {
            runningJob.last_status = "running";
            runningJob.last_run = new Date().toISOString();
            render();
            bindViewEvents();
          }

          const log = await window.OggoAPI.runJob(id);
          const completedJob = state.jobs.find((j) => j.id === id);
          if (completedJob) {
            completedJob.last_status = log?.status || "success";
            completedJob.last_run = log?.created_at || new Date().toISOString();
          }
          toast("Job executed", "success");
          render();
          bindViewEvents();

          // Keep local UI snappy, then sync all data in background.
          try {
            await refreshData();
            render();
            bindViewEvents();
          } catch (_error) {
            // Ignore background refresh errors after successful run.
          }
          return;
        }
        if (action === "delete") {
          await window.OggoAPI.deleteJob(id);
          toast("Job deleted", "success");
        }
        if (action === "toggle") {
          await window.OggoAPI.toggleJob(id);
        }
        await refreshData();
        render();
        bindViewEvents();
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (state.view === "logs") {
    el("apply-log-filter").onclick = async () => {
      try {
        state.logs = await window.OggoAPI.getLogs({
          jobId: el("log-job-filter").value,
          status: el("log-status-filter").value,
          limit: 200,
        });
        render();
        bindViewEvents();
      } catch (error) {
        toast(error.message, "error");
      }
    };
    el("clear-all-logs").onclick = async () => {
      await window.OggoAPI.clearAllLogs();
      toast("All logs cleared", "success");
      await refreshData();
      render();
      bindViewEvents();
    };
    el("app-content").onclick = async (event) => {
      const jobId = event.target.dataset.clearJob;
      if (!jobId) return;
      await window.OggoAPI.clearJobLogs(jobId);
      toast("Job logs cleared", "success");
      await refreshData();
      render();
      bindViewEvents();
    };
  }

  if (state.view === "servers") {
    const addBtn = el("add-server-btn");
    const addBtnEmpty = el("add-server-btn-empty");
    if (addBtn) addBtn.onclick = () => openServerModal();
    if (addBtnEmpty) addBtnEmpty.onclick = () => openServerModal();

    const search = el("server-search");
    if (search) {
      search.oninput = (event) => {
        const q = event.target.value.toLowerCase().trim();
        document.querySelectorAll("#servers-grid > div").forEach((card) => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? "" : "none";
        });
      };
    }

    el("app-content").onclick = async (event) => {
      const id = event.target.closest("[data-id]")?.dataset?.id;
      const action = event.target.closest("[data-server-action]")?.dataset?.serverAction;
      if (!id || !action) return;
      const server = state.servers.find((s) => s.id === id);
      try {
        if (action === "edit") openServerModal(server);
        if (action === "delete") {
          if (!confirm(`Delete server "${server?.name}"?`)) return;
          await window.OggoAPI.deleteServer(id);
          toast("Server deleted", "success");
        }
        if (action === "test") {
          const result = await window.OggoAPI.testServer(id);
          toast(result.success ? "Connection successful" : `Connection failed: ${result.message}`, result.success ? "success" : "error");
        }
        if (action === "terminal") {
          state.view = "terminal";
          state.activeTerminalServerId = id;
        }
        if (action === "jobs") {
          const jobs = await window.OggoAPI.getRemoteJobs(id);
          state.remoteJobs = jobs;
          toast(`Loaded ${jobs.length} remote jobs`, "info");
        }
        await refreshData();
        render();
        bindViewEvents();
        if (action === "terminal") connectTerminal(id);
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (state.view === "terminal") {
    if (state.activeTerminalServerId) {
      connectTerminal(state.activeTerminalServerId);
    }
    const list = el("terminal-server-list");
    if (list) {
      list.onclick = (event) => {
        const id = event.target.closest("[data-open-terminal]")?.dataset?.openTerminal;
        if (!id) return;
        state.activeTerminalServerId = id;
        connectTerminal(id);
        render();
        bindViewEvents();
      };
    }
    const clearBtn = el("terminal-clear-btn");
    if (clearBtn) clearBtn.onclick = () => terminalInstance?.clear();
    const explainBtn = el("terminal-explain-btn");
    if (explainBtn) explainBtn.onclick = () => explainLastTerminalCommand();
    const disconnectBtn = el("terminal-disconnect-btn");
    if (disconnectBtn) {
      disconnectBtn.onclick = () => {
        if (terminalSocket) terminalSocket.close();
        terminalSocket = null;
        if (terminalInstance) terminalInstance.writeln("\r\nDisconnected.\r\n");
      };
    }
  }

  if (state.view === "settings") {
    el("settings-form").onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.target);
      const next = JSON.parse(JSON.stringify(state.settings));

      [...event.target.querySelectorAll("input,select,textarea")].forEach((input) => {
        if (!input.name) return;
        const value =
          input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value || 0) : input.value;
        setByPath(next, input.name, value);
      });

      try {
        state.settings = await window.OggoAPI.saveSettings(next);
        localStorage.setItem("oggo-password", state.settings.password || "");
        window.OggoTheme.apply(state.settings.theme || "dark");
        toast("Settings saved", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    };

    el("test-email-btn").onclick = async () => {
      try {
        await window.OggoAPI.testEmail();
        toast("Test email sent", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    };
    el("danger-clear-logs").onclick = async () => {
      await window.OggoAPI.clearAllLogs();
      toast("All logs cleared", "success");
    };
    el("danger-reset").onclick = async () => {
      state.settings = await window.OggoAPI.resetSettings();
      toast("Settings reset to defaults", "success");
      render();
      bindViewEvents();
    };
  }
}

async function bootstrap() {
  try {
    window.humanizeCron = humanizeCron;
    window.toast = toast;
    await refreshData();
    window.OggoTheme.apply(state.settings.theme || window.OggoTheme.current || "dark");
    state.view = "dashboard";
    render();
    bindGlobalEvents();
    bindViewEvents();
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    toast(`Failed to load app: ${error.message}`, "error");
  }
}

bootstrap();
