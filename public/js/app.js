const state = {
  view: "dashboard",
  navSection: "dashboard",
  contextCollapsed: false,
  sectionLastView: {
    dashboard: "dashboard",
    jobs: "jobs",
    logs: "logs",
    servers: "servers",
    software: "software-package-manager",
    storage: "s3",
    "developer-tools": "health-checks",
    aws: "aws-connections",
    settings: "settings",
  },
  jobs: [],
  logs: [],
  settings: null,
  dashboard: null,
  servers: [],
  softwareServerId: "local",
  packageScan: null,
  packageHistory: [],
  packageFilter: "all",
  packageSearch: "",
  installerTab: "catalog",
  installerOutput: null,
  awsConnections: [],
  awsRegions: [],
  awsActiveConnectionId: "",
  awsViewData: [],
  sslMonitors: [],
  dnsMonitors: [],
  portMonitors: [],
  envVars: [],
  httpChecks: [],
  s3Connections: [],
  s3Regions: [],
  s3Browser: {
    connectionId: null,
    prefix: "",
    files: [],
    folders: [],
    continuationToken: null,
    loadingMore: false,
    viewMode: "grid",
    hasUserViewMode: false,
    typeFilter: "all",
    search: "",
    recursiveSearch: false,
    sortBy: "date",
    sortDir: "desc",
    selectedKeys: [],
    presignedCache: {},
    uploadQueue: [],
    thumbObserver: null,
    thumbQueueRunning: false,
  },
  remoteJobs: [],
  keys: [],
  activeTerminalServerId: null,
};

const NAV_STRUCTURE = {
  dashboard: {
    title: "Dashboard",
    items: [
      { view: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
      { view: "jobs", label: "Jobs", icon: "clock-3", badge: () => String(state.jobs.length || 0) },
      { view: "logs", label: "Logs", icon: "file-text" },
    ],
  },
  jobs: {
    title: "Jobs",
    items: [{ view: "jobs", label: "Jobs", icon: "clock-3", badge: () => String(state.jobs.length || 0) }],
  },
  logs: {
    title: "Logs",
    items: [{ view: "logs", label: "Logs", icon: "file-text" }],
  },
  servers: {
    title: "Servers",
    items: [
      { view: "servers", label: "All Servers", icon: "server", badge: () => `${state.servers.filter((s) => s.last_status === "online").length} online` },
      { view: "terminal", label: "SSH Terminal", icon: "terminal" },
      { view: "servers", label: "All Clients", icon: "users", badge: () => String(state.servers.length || 0) },
      { action: "add-server", label: "Add Server", icon: "plus-circle", secondary: true },
    ],
  },
  software: {
    title: "Software",
    items: [
      { view: "software-package-manager", label: "Package Manager", icon: "packages" },
      { view: "software-installer", label: "Software Installer", icon: "download" },
    ],
  },
  storage: {
    title: "Storage",
    items: [
      { view: "s3", label: "S3 Buckets", icon: "database", badge: () => String(state.s3Connections.length || 0) },
      { view: "s3-browser", label: "S3 File Browser", icon: "folder-open" },
      { action: "add-s3", label: "Add Bucket", icon: "plus-circle", secondary: true },
    ],
  },
  "developer-tools": {
    title: "Developer Tools",
    items: [
      {
        view: "health-checks",
        label: "Health Checks",
        icon: "heart-pulse",
        badge: () => {
          if (!state.httpChecks.length) return "0";
          const failing = state.httpChecks.filter((c) => (c.status || "").toLowerCase() === "down").length;
          return failing ? `${failing} failing` : "all up";
        },
      },
      { view: "ssl-monitor", label: "SSL Monitor", icon: "shield-check" },
      { view: "dns-monitor", label: "DNS Monitor", icon: "globe" },
      { view: "port-scanner", label: "Port Scanner", icon: "scan-search" },
      { view: "env-vars", label: "Env Variables", icon: "variable", badge: () => String(state.envVars.length || 0) },
      { view: "http-checks", label: "HTTP Checks", icon: "activity", badge: () => String(state.httpChecks.length || 0) },
    ],
  },
  aws: {
    title: "AWS Services",
    items: [
      { view: "aws-connections", label: "Connections", icon: "key-round", badge: () => (state.awsConnections.length ? String(state.awsConnections.length) : "setup") },
      { view: "s3", label: "S3 Browser", icon: "folder-open" },
      { view: "aws-cloudwatch", label: "CloudWatch Logs", icon: "scroll-text" },
      { view: "aws-rds", label: "RDS Databases", icon: "database-zap" },
      { view: "aws-ec2", label: "EC2 Instances", icon: "server-cog" },
      { view: "aws-lambda", label: "Lambda Functions", icon: "function-square" },
      { view: "aws-connections", label: "SES / SNS", icon: "bell-ring" },
      { view: "aws-secrets", label: "Secrets Manager", icon: "vault" },
    ],
  },
  settings: {
    title: "Settings",
    items: [
      { view: "settings", label: "Appearance", icon: "palette" },
      { view: "settings", label: "General", icon: "sliders-horizontal" },
      { view: "settings", label: "Notifications", icon: "mail" },
      { view: "settings", label: "S3 Storage", icon: "database" },
      { view: "settings", label: "Security", icon: "shield" },
      { view: "settings", label: "Danger Zone", icon: "triangle-alert" },
    ],
  },
};

const VIEW_TO_SECTION = {
  dashboard: "dashboard",
  jobs: "jobs",
  logs: "logs",
  servers: "servers",
  terminal: "servers",
  "software-package-manager": "software",
  "software-installer": "software",
  s3: "storage",
  "s3-browser": "storage",
  "health-checks": "developer-tools",
  "http-checks": "developer-tools",
  "ssl-monitor": "developer-tools",
  "dns-monitor": "developer-tools",
  "port-scanner": "developer-tools",
  "env-vars": "developer-tools",
  "aws-connections": "aws",
  "aws-cloudwatch": "aws",
  "aws-rds": "aws",
  "aws-ec2": "aws",
  "aws-lambda": "aws",
  "aws-secrets": "aws",
  settings: "settings",
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
  state.navSection = VIEW_TO_SECTION[state.view] || state.navSection || "dashboard";
  renderNavContext();
  document.querySelectorAll("[data-rail-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.railSection === state.navSection);
  });
  const breadcrumb = el("top-breadcrumb");
  if (breadcrumb) {
    const sectionTitle = NAV_STRUCTURE[state.navSection]?.title || "Section";
    const item = (NAV_STRUCTURE[state.navSection]?.items || []).find((i) => i.view === state.view);
    breadcrumb.textContent = `${sectionTitle} / ${item?.label || state.view}`;
  }
  updateRailStatusDots();
}

function updateRailStatusDots() {
  const serverDot = el("rail-dot-servers");
  const devDot = el("rail-dot-devtools");
  const awsDot = el("rail-dot-aws");
  if (serverDot) {
    const online = state.servers.some((s) => s.last_status === "online");
    serverDot.className = `rail-dot ${online ? "ok" : "hidden"}`;
  }
  if (devDot) {
    const checks = state.jobs.filter((j) => j.type === "http_health_check");
    if (!checks.length) {
      devDot.className = "rail-dot hidden";
    } else {
      const hasFail = checks.some((j) => (j.last_status || "").toLowerCase() === "failed");
      devDot.className = `rail-dot ${hasFail ? "error" : "ok"}`;
    }
  }
  if (awsDot) {
    awsDot.className = `rail-dot ${state.awsConnections.length ? "hidden" : "warn"}`;
  }
}

function renderNavContext() {
  const context = el("nav-context");
  const titleNode = el("context-title");
  const listNode = el("context-list");
  if (!context || !titleNode || !listNode) return;
  const section = NAV_STRUCTURE[state.navSection] || NAV_STRUCTURE.dashboard;
  titleNode.textContent = section.title.toUpperCase();
  context.classList.toggle("collapsed", state.contextCollapsed);

  listNode.innerHTML = section.items
    .map((item) => {
      const isActive = item.view === state.view;
      const badge = typeof item.badge === "function" ? item.badge() : item.badge;
      return `
        <button class="context-item ${isActive ? "active" : ""} ${item.secondary ? "opacity-85" : ""}" ${
          item.view ? `data-context-view="${item.view}"` : ""
        } ${item.action ? `data-context-action="${item.action}"` : ""}>
          <span class="flex items-center gap-2"><i data-lucide="${item.icon}" class="w-4 h-4"></i>${item.label}</span>
          ${badge ? `<span class="badge">${badge}</span>` : ""}
        </button>
      `;
    })
    .join("");
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

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = Number(bytes);
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFileExt(name = "") {
  const part = String(name).split(".").pop();
  return part && part !== name ? part.toLowerCase() : "";
}

function getFileNameFromKey(key = "") {
  const clean = String(key || "").replace(/\/$/, "");
  const parts = clean.split("/");
  return parts[parts.length - 1] || clean;
}

function highlightSearch(value = "", query = "") {
  const safeValue = escapeHtml(value);
  const q = String(query || "").trim();
  if (!q) return safeValue;
  const regex = new RegExp(`(${escapeRegex(q)})`, "ig");
  return safeValue.replace(regex, '<mark class="s3-mark">$1</mark>');
}

function formatS3Modified(value) {
  if (!value) return "-";
  const dt = new Date(value);
  const diff = Date.now() - dt.getTime();
  if (diff < 1000 * 60 * 60 * 24 * 7) return timeAgo(value);
  return dt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getS3FileCategory(file) {
  const ext = getFileExt(file.name || file.key);
  const images = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff"];
  const videos = ["mp4", "mov", "avi", "mkv", "webm"];
  const docs = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "json", "yaml", "yml", "env", "sh", "js", "py", "php"];
  const archives = ["zip", "tar", "gz", "rar", "7z"];
  const audio = ["mp3", "wav", "flac", "aac", "ogg"];
  if (images.includes(ext)) return "images";
  if (videos.includes(ext)) return "videos";
  if (docs.includes(ext)) return "documents";
  if (archives.includes(ext)) return "archives";
  if (audio.includes(ext)) return "audio";
  return "other";
}

function getS3CategoryBadgeClass(category) {
  if (category === "images") return "bg-red-600/20 text-red-400";
  if (category === "videos") return "bg-purple-600/20 text-purple-400";
  if (category === "documents") return "bg-blue-600/20 text-blue-400";
  if (category === "archives") return "bg-amber-600/20 text-amber-400";
  if (category === "audio") return "bg-violet-600/20 text-violet-400";
  return "bg-gray-600/20 text-gray-300";
}

function getS3TypeLabel(category) {
  if (category === "images") return "Image";
  if (category === "videos") return "Video";
  if (category === "documents") return "Document";
  if (category === "archives") return "Archive";
  if (category === "audio") return "Audio";
  return "Other";
}

function getS3TypeVisual(file) {
  const ext = getFileExt(file.name || file.key);
  const category = file.category || getS3FileCategory(file);
  const badgeText = ext || category.slice(0, 3);
  if (category === "images") return { icon: "image", bgClass: "bg-red-600/20 text-red-300", badgeClass: "bg-red-500/20 text-red-200", badgeText };
  if (category === "videos") return { icon: "play-circle", bgClass: "bg-purple-600/20 text-purple-300", badgeClass: "bg-purple-500/20 text-purple-200", badgeText };
  if (category === "archives") return { icon: "archive", bgClass: "bg-amber-600/20 text-amber-200", badgeClass: "bg-amber-500/20 text-amber-100", badgeText };
  if (category === "audio") return { icon: "music-4", bgClass: "bg-violet-600/20 text-violet-200", badgeClass: "bg-violet-500/20 text-violet-100", badgeText };
  if (category === "documents") {
    if (ext === "pdf") return { icon: "file-text", bgClass: "bg-red-700/20 text-red-200", badgeClass: "bg-red-600/25 text-red-100", badgeText };
    if (["doc", "docx"].includes(ext)) return { icon: "file-text", bgClass: "bg-blue-700/20 text-blue-200", badgeClass: "bg-blue-600/25 text-blue-100", badgeText };
    if (["xls", "xlsx", "csv"].includes(ext)) return { icon: "file-spreadsheet", bgClass: "bg-green-700/20 text-green-200", badgeClass: "bg-green-600/25 text-green-100", badgeText };
    if (["ppt", "pptx"].includes(ext)) return { icon: "file-chart-column", bgClass: "bg-orange-700/20 text-orange-200", badgeClass: "bg-orange-600/25 text-orange-100", badgeText };
    if (["js", "py", "php", "md", "json", "yaml", "yml", "sh"].includes(ext)) return { icon: "file-code-2", bgClass: "bg-teal-700/20 text-teal-200", badgeClass: "bg-teal-600/25 text-teal-100", badgeText };
    if (["env", "ini", "conf", "toml"].includes(ext)) return { icon: "settings-2", bgClass: "bg-yellow-700/20 text-yellow-200", badgeClass: "bg-yellow-600/25 text-yellow-100", badgeText };
    return { icon: "file-text", bgClass: "bg-gray-600/20 text-gray-200", badgeClass: "bg-gray-600/25 text-gray-100", badgeText };
  }
  return { icon: "file", bgClass: "bg-gray-600/20 text-gray-200", badgeClass: "bg-gray-600/25 text-gray-100", badgeText };
}

function getS3StorageClassSummary(files = []) {
  const classes = Array.from(new Set(files.map((f) => String(f.storageClass || "STANDARD"))));
  if (!classes.length) return "-";
  if (classes.length === 1) return classes[0];
  return "mixed";
}

function getS3GridSizeClass() {
  const size = state.settings?.s3?.thumbnailSize || "medium";
  if (size === "small") return "s3-grid-sm";
  if (size === "large") return "s3-grid-lg";
  return "s3-grid-md";
}

function getVisibleS3Files() {
  let files = [...(state.s3Browser.files || [])].map((f) => ({
    ...f,
    name: getFileNameFromKey(f.key),
    category: getS3FileCategory(f),
  }));

  if (!state.settings?.s3?.showHiddenFiles) {
    files = files.filter((f) => !f.name.startsWith("."));
  }

  const q = (state.s3Browser.search || "").trim().toLowerCase();
  if (q) files = files.filter((f) => f.name.toLowerCase().includes(q));
  if (state.s3Browser.typeFilter !== "all") {
    files = files.filter((f) => f.category === state.s3Browser.typeFilter);
  }

  const dir = state.s3Browser.sortDir === "asc" ? 1 : -1;
  files.sort((a, b) => {
    if (state.s3Browser.sortBy === "name") return a.name.localeCompare(b.name) * dir;
    if (state.s3Browser.sortBy === "size") return (a.size - b.size) * dir;
    if (state.s3Browser.sortBy === "type") return a.category.localeCompare(b.category) * dir;
    if (state.s3Browser.sortBy === "storage") return String(a.storageClass || "").localeCompare(String(b.storageClass || "")) * dir;
    return (new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime()) * dir;
  });
  return files;
}

function s3ConnectionsHtml() {
  const cards = state.s3Connections
    .map((conn) => {
      const status = conn.last_test_result || "not tested";
      const statusColor =
        status === "success" ? "bg-green-500" : status === "failed" ? "bg-red-500" : "bg-gray-400";
      return `
        <div class="server-card bg-white dark:bg-[#1b1410] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm" style="border-left:3px solid ${conn.color || "#f97316"};">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold text-orange-500">${conn.name}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-300">${conn.region} • ${conn.bucket_name}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Prefix: ${conn.root_prefix || "/"}</p>
            </div>
            <span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"><span class="w-2.5 h-2.5 rounded-full ${statusColor}"></span>${status}</span>
          </div>
          <p class="text-xs mt-3 text-gray-500 dark:text-gray-400">Last tested: ${conn.last_tested_at ? new Date(conn.last_tested_at).toLocaleString() : "Never"}</p>
          <p class="text-xs mt-1 text-gray-500 dark:text-gray-400">Files: ${conn.file_count || 0} • Storage: ${formatBytes(conn.total_size_bytes || 0)}</p>
          <div class="mt-4 flex items-center gap-3">
            <button data-s3-action="browse" data-id="${conn.id}" class="btn-secondary"><i data-lucide="folder-open" class="w-4 h-4"></i>Browse Files</button>
            <button data-s3-action="test" data-id="${conn.id}" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test</button>
            <button data-s3-action="edit" data-id="${conn.id}" class="text-orange-500 dark:text-orange-400"><i data-lucide="edit" class="w-4 h-4"></i></button>
            <button data-s3-action="delete" data-id="${conn.id}" class="text-red-600 dark:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">All S3 Buckets</h2>
      <div class="flex gap-3">
        <input id="s3-search" class="input max-w-xs" placeholder="Search S3 connections..." />
        <button id="add-s3-btn" class="btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Add S3 Bucket</button>
      </div>
    </div>
    ${
      state.s3Connections.length
        ? `<div id="s3-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
        : `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
             <i data-lucide="database" class="w-10 h-10 text-gray-400 mx-auto"></i>
             <h3 class="mt-3 text-lg font-semibold">No S3 connections yet</h3>
             <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your first S3 bucket connection to manage storage from Oggo.</p>
             <button id="add-s3-btn-empty" class="btn-primary mt-4">Add S3 Bucket</button>
           </div>`
    }
  `;
}

function s3BrowserHtml() {
  const conn = state.s3Connections.find((c) => c.id === state.s3Browser.connectionId);
  if (!conn) {
    return `<div class="panel"><p class="text-sm text-gray-500">No S3 connection selected.</p></div>`;
  }
  const visibleFiles = getVisibleS3Files();
  const query = state.s3Browser.search || "";
  const filesTotalSize = visibleFiles.reduce((sum, f) => sum + Number(f.size || 0), 0);
  const storageClass = getS3StorageClassSummary(visibleFiles);
  const breadcrumbs = [conn.bucket_name, ...(state.s3Browser.prefix || "").split("/").filter(Boolean)];
  const pills = [
    ["all", "All files"],
    ["images", "Images"],
    ["videos", "Videos"],
    ["documents", "Documents"],
    ["archives", "Archives"],
    ["audio", "Audio"],
    ["other", "Other"],
  ];
  const uploads = (state.s3Browser.uploadQueue || []).filter((u) => String(u.key || "").startsWith(state.s3Browser.prefix || ""));
  const folderCards = (state.s3Browser.folders || [])
    .map((folder) => {
      const label = folder.key.replace(state.s3Browser.prefix || "", "").replace(/\/$/, "") || "/";
      return `
      <div data-s3-folder-open="${folder.key}" class="s3-card s3-folder-card group text-left bg-white dark:bg-[#1a1f2d] border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-orange-400 transition cursor-pointer">
        <div class="s3-thumb rounded-lg bg-amber-600/10 flex items-center justify-center mb-3">
          <i data-lucide="folder" class="w-9 h-9 text-amber-300"></i>
        </div>
        <div class="text-sm font-medium truncate">${escapeHtml(label)}</div>
        <div class="text-xs text-gray-500">Folder</div>
      </div>`;
    })
    .join("");
  const uploadCards = uploads
    .map((u) => `
      <div class="s3-card bg-white dark:bg-[#1a1f2d] border border-orange-400/50 rounded-xl p-3">
        <div class="s3-thumb rounded-lg bg-orange-500/10 flex items-center justify-center mb-3 relative overflow-hidden">
          <i data-lucide="upload-cloud" class="w-8 h-8 text-orange-300"></i>
          <div class="absolute left-0 right-0 bottom-0 h-1.5 bg-black/20"><span class="block h-full bg-orange-500" style="width:${Math.min(100, Math.max(0, u.progress || 0))}%"></span></div>
        </div>
        <div class="text-sm font-medium truncate">${escapeHtml(u.name)}</div>
        <div class="text-xs text-gray-500 flex justify-between">
          <span>${u.status === "failed" ? "Failed" : `${Math.round(u.progress || 0)}%`}</span>
          <span>${formatBytes(u.size)}</span>
        </div>
      </div>`)
    .join("");
  const fileCards = visibleFiles
    .map((file) => {
      const ext = getFileExt(file.name || file.key);
      const visual = getS3TypeVisual(file);
      const selected = state.s3Browser.selectedKeys.includes(file.key);
      return `
      <div class="s3-card s3-file-card group relative bg-white dark:bg-[#1a1f2d] border ${selected ? "border-orange-500 ring-1 ring-orange-500/40 s3-selected" : "border-gray-200 dark:border-gray-700"} rounded-xl p-3 transition cursor-pointer" data-s3-row-select="${file.key}">
        <label class="absolute top-2 left-2 z-20 s3-select-checkbox">
          <input type="checkbox" class="accent-orange-500" data-s3-select="${file.key}" ${selected ? "checked" : ""} />
        </label>
        <div class="s3-thumb rounded-lg ${visual.bgClass} flex items-center justify-center mb-3 relative overflow-hidden">
          ${
            file.category === "images"
              ? `<div class="s3-thumb-skeleton absolute inset-0"></div>
                 <img data-s3-thumb="${file.key}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover opacity-0 transition-opacity" loading="lazy" />
                 <div data-s3-thumb-fallback class="text-xl font-semibold uppercase">${escapeHtml(ext || "img")}</div>`
              : `<i data-lucide="${visual.icon}" class="w-9 h-9"></i>`
          }
          <span class="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded uppercase ${visual.badgeClass}">${escapeHtml(visual.badgeText)}</span>
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button data-s3-preview="${file.key}" class="p-1.5 rounded bg-white/20 hover:bg-white/30"><i data-lucide="eye" class="w-4 h-4 text-white"></i></button>
            <button data-s3-download="${file.key}" class="p-1.5 rounded bg-white/20 hover:bg-white/30"><i data-lucide="download" class="w-4 h-4 text-white"></i></button>
            <button data-s3-delete-file="${file.key}" class="p-1.5 rounded bg-red-500/70 hover:bg-red-500"><i data-lucide="trash-2" class="w-4 h-4 text-white"></i></button>
          </div>
        </div>
        <div class="text-sm font-medium truncate" title="${escapeHtml(file.name)}">${highlightSearch(file.name, query)}</div>
        <div class="text-xs text-gray-500 flex justify-between"><span>${formatBytes(file.size)}</span><span>${formatS3Modified(file.lastModified)}</span></div>
      </div>`;
    })
    .join("");
  const listRows = [
    ...(state.s3Browser.folders || []).map((folder) => `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30" data-s3-folder-open="${folder.key}">
        <td class="py-3 px-3"><input type="checkbox" disabled /></td>
        <td class="py-3 px-3"><button data-s3-folder="${folder.key}" class="text-orange-500 hover:underline flex items-center gap-2"><i data-lucide="folder" class="w-4 h-4"></i>${escapeHtml(folder.key.replace(state.s3Browser.prefix || "", "").replace(/\/$/, "") || "/")}</button></td>
        <td class="py-3 px-3">Folder</td><td class="py-3 px-3">-</td><td class="py-3 px-3">-</td><td class="py-3 px-3">-</td><td class="py-3 px-3 text-right">-</td>
      </tr>
    `),
    ...uploads.map(
      (u) => `
      <tr class="bg-orange-500/10">
        <td class="py-3 px-3"><input type="checkbox" disabled /></td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <span class="inline-flex w-8 h-8 items-center justify-center rounded bg-orange-500/20 text-orange-300"><i data-lucide="upload-cloud" class="w-4 h-4"></i></span>
            <span class="truncate max-w-[280px]">${escapeHtml(u.name)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300">${Math.round(u.progress || 0)}%</span>
          </div>
        </td>
        <td class="py-3 px-3">Uploading</td>
        <td class="py-3 px-3">${formatBytes(u.size)}</td>
        <td class="py-3 px-3">-</td>
        <td class="py-3 px-3">-</td>
        <td class="py-3 px-3 text-right">-</td>
      </tr>`
    ),
    ...visibleFiles.map((file) => {
      const selected = state.s3Browser.selectedKeys.includes(file.key);
      const visual = getS3TypeVisual(file);
      const ext = getFileExt(file.name || file.key);
      return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 ${selected ? "bg-orange-500/10" : ""}" data-s3-row-select="${file.key}">
        <td class="py-3 px-3"><input type="checkbox" class="accent-orange-500" data-s3-select="${file.key}" ${selected ? "checked" : ""}></td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <span class="inline-flex w-8 h-8 items-center justify-center rounded overflow-hidden ${visual.bgClass}">
              ${
                file.category === "images"
                  ? `<img data-s3-thumb="${file.key}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover opacity-0 transition-opacity" loading="lazy" /><span data-s3-thumb-fallback class="text-[9px] font-semibold uppercase">${escapeHtml(ext || "img")}</span>`
                  : `<i data-lucide="${visual.icon}" class="w-4 h-4"></i>`
              }
            </span>
            <span class="truncate max-w-[280px]">${highlightSearch(file.name, query)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full uppercase ${visual.badgeClass}">${escapeHtml(visual.badgeText)}</span>
          </div>
        </td>
        <td class="py-3 px-3">${getS3TypeLabel(file.category)}</td>
        <td class="py-3 px-3">${formatBytes(file.size)}</td>
        <td class="py-3 px-3">${formatS3Modified(file.lastModified)}</td>
        <td class="py-3 px-3">${file.storageClass || "STANDARD"}</td>
        <td class="py-3 px-3 text-right s3-row-actions">
          <button data-s3-preview="${file.key}" class="text-gray-600 dark:text-gray-300 hover:text-orange-500 mr-2"><i data-lucide="eye" class="w-4 h-4"></i></button>
          <button data-s3-copy-url="${file.key}" class="text-gray-600 dark:text-gray-300 hover:text-orange-500 mr-2"><i data-lucide="link" class="w-4 h-4"></i></button>
          <button data-s3-download="${file.key}" class="text-gray-600 dark:text-gray-300 hover:text-orange-500 mr-2"><i data-lucide="download" class="w-4 h-4"></i></button>
          <button data-s3-delete-file="${file.key}" class="text-red-600 dark:text-red-400 hover:text-red-700"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
      </tr>`;
    }),
  ].join("");
  return `
    <div class="space-y-3">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="flex items-center flex-wrap gap-2 text-sm">
          <button id="s3-go-up" class="btn-secondary px-2 py-1"><i data-lucide="corner-up-left" class="w-4 h-4"></i></button>
          ${breadcrumbs
            .map((part, i) => `<button data-s3-breadcrumb="${i}" class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">${part}</button>`)
            .join(`<span class="text-gray-400">/</span>`)}
        </div>
        <div class="flex items-center gap-2 flex-wrap justify-end">
          <div class="relative min-w-[220px]">
            <input id="s3-browser-search" value="${escapeHtml(state.s3Browser.search || "")}" placeholder="Search files..." class="input w-56 pr-6" />
            ${state.s3Browser.search ? '<button id="s3-clear-search" class="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">x</button>' : ""}
          </div>
          <button data-s3-view="grid" class="btn-secondary ${state.s3Browser.viewMode === "grid" ? "ring-1 ring-orange-500" : ""}"><i data-lucide="layout-grid" class="w-4 h-4"></i></button>
          <button data-s3-view="list" class="btn-secondary ${state.s3Browser.viewMode === "list" ? "ring-1 ring-orange-500" : ""}"><i data-lucide="list" class="w-4 h-4"></i></button>
          <button id="s3-create-folder" class="btn-secondary"><i data-lucide="folder-plus" class="w-4 h-4"></i>New folder</button>
          <input id="s3-upload-file" type="file" class="hidden" multiple />
          <button id="s3-upload-btn" class="btn-primary"><i data-lucide="upload" class="w-4 h-4"></i>Upload</button>
        </div>
      </div>
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="flex flex-wrap gap-2">
          ${pills
            .map(([key, label]) => `<button data-s3-type="${key}" class="px-3 py-1 text-xs rounded-full border ${state.s3Browser.typeFilter === key ? "bg-orange-500 text-white border-orange-500" : "border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300"}">${label}</button>`)
            .join("")}
        </div>
        <div class="flex items-center gap-2">
          <select id="s3-sort-by" class="input">
            <option value="date" ${state.s3Browser.sortBy === "date" ? "selected" : ""}>Sort by Date modified</option>
            <option value="name" ${state.s3Browser.sortBy === "name" ? "selected" : ""}>Sort by Name</option>
            <option value="size" ${state.s3Browser.sortBy === "size" ? "selected" : ""}>Sort by Size</option>
            <option value="type" ${state.s3Browser.sortBy === "type" ? "selected" : ""}>Sort by Type</option>
            <option value="storage" ${state.s3Browser.sortBy === "storage" ? "selected" : ""}>Sort by Storage class</option>
          </select>
          <button id="s3-sort-dir" class="btn-secondary"><i data-lucide="${state.s3Browser.sortDir === "asc" ? "arrow-up" : "arrow-down"}" class="w-4 h-4"></i></button>
          <label class="text-xs flex items-center gap-1 ml-2"><input id="s3-recursive-search" type="checkbox" ${state.s3Browser.recursiveSearch ? "checked" : ""}/> Recursive search</label>
        </div>
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <span>${visibleFiles.length} files</span>
        <span>Total size: ${formatBytes(filesTotalSize)}</span>
        <span>Storage class: ${storageClass}</span>
      </div>
      <div id="s3-folder-inline-create" class="hidden bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-2">
        <input id="s3-new-folder-input" class="input flex-1" placeholder="New folder name" />
        <button id="s3-create-folder-confirm" class="btn-primary text-xs px-3">Create</button>
        <button id="s3-create-folder-cancel" class="btn-secondary text-xs px-3">Cancel</button>
      </div>
      ${
        state.s3Browser.viewMode === "grid"
          ? `<div id="s3-drop-area" class="relative min-h-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
               <div id="s3-drop-overlay" class="s3-drop-overlay hidden"><div><i data-lucide="upload-cloud" class="w-8 h-8 mx-auto mb-2"></i>Drop files to upload into this folder</div></div>
               <div class="s3-grid ${getS3GridSizeClass()}">
                 ${folderCards}${uploadCards}${fileCards}
               </div>
               ${
                 !folderCards && !fileCards && !uploadCards
                   ? `<div class="py-16 text-center text-gray-500">
                        <i data-lucide="folder-open" class="w-10 h-10 mx-auto mb-3"></i>
                        <h3 class="text-base font-semibold text-gray-700 dark:text-gray-200">This folder is empty</h3>
                        <p class="text-sm mt-1">Drag files here or click Upload to add files.</p>
                        <button id="s3-empty-upload-btn" class="btn-primary mt-4">Upload</button>
                      </div>`
                   : ""
               }
             </div>`
          : `<div id="s3-drop-area" class="relative overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
               <div id="s3-drop-overlay" class="s3-drop-overlay hidden"><div><i data-lucide="upload-cloud" class="w-8 h-8 mx-auto mb-2"></i>Drop files to upload into this folder</div></div>
               <table class="w-full text-sm">
                 <thead class="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                   <tr><th class="py-3 px-3"><input id="s3-select-all" type="checkbox"></th><th class="py-3 px-3">Name</th><th class="py-3 px-3">Type</th><th class="py-3 px-3">Size</th><th class="py-3 px-3">Modified</th><th class="py-3 px-3">Storage class</th><th class="py-3 px-3 text-right">Actions</th></tr>
                 </thead>
                 <tbody class="divide-y divide-gray-200 dark:divide-gray-700">${listRows || `<tr><td colspan="7" class="py-8 text-center text-gray-500">No files</td></tr>`}</tbody>
               </table>
             </div>`
      }
      ${
        !visibleFiles.length && query
          ? `<div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500">
               <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2"></i>
               <h3 class="text-base font-semibold text-gray-700 dark:text-gray-200">No files match your search</h3>
               <p class="text-sm mt-1">Query: "${escapeHtml(query)}"</p>
               <button id="s3-clear-search-empty" class="btn-secondary mt-3">Clear search</button>
             </div>`
          : ""
      }
      ${
        state.s3Browser.continuationToken
          ? `<div class="text-center"><button id="s3-load-more" class="btn-secondary">${state.s3Browser.loadingMore ? "Loading..." : "Load more"}</button></div>`
          : ""
      }
      ${
        state.s3Browser.selectedKeys.length
          ? `<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#111827] border border-gray-700 text-gray-100 rounded-xl px-4 py-3 flex items-center gap-4 shadow-2xl">
               <span class="text-orange-400 text-sm">${state.s3Browser.selectedKeys.length} files selected</span>
               <button id="s3-clear-selection" class="text-xs text-gray-300 hover:text-white">Deselect all</button>
               <button id="s3-download-selected" class="btn-secondary text-xs"><i data-lucide="download" class="w-3 h-3"></i>Download selected</button>
               <button id="s3-move-selected" class="btn-secondary text-xs"><i data-lucide="folder-input" class="w-3 h-3"></i>Move to</button>
               <button id="s3-delete-selected" class="btn-secondary text-xs text-red-400"><i data-lucide="trash-2" class="w-3 h-3"></i>Delete selected</button>
             </div>`
          : ""
      }
    </div>
  `;
}

function awsConnectionsHtml() {
  const cards = state.awsConnections
    .map(
      (conn) => `
      <div class="server-card bg-white dark:bg-[#1b1410] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm" style="border-left:3px solid ${conn.color || "#f97316"};">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-lg font-semibold text-orange-500">${conn.name}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-300">${conn.default_region} • Account: ${conn.account_id || "-"}</p>
          </div>
          <span class="text-xs ${conn.last_test_result === "success" ? "text-green-500" : conn.last_test_result === "failed" ? "text-red-500" : "text-gray-500"}">${conn.last_test_result || "not tested"}</span>
        </div>
        <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">Last tested: ${conn.last_tested_at ? new Date(conn.last_tested_at).toLocaleString() : "Never"}</p>
        <div class="mt-4 flex items-center gap-3">
          <button data-aws-action="test" data-id="${conn.id}" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test</button>
          <button data-aws-action="edit" data-id="${conn.id}" class="text-orange-500 dark:text-orange-400"><i data-lucide="edit" class="w-4 h-4"></i></button>
          <button data-aws-action="delete" data-id="${conn.id}" class="text-red-600 dark:text-red-400"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>`
    )
    .join("");
  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">AWS Connections</h2>
      <button id="add-aws-btn" class="btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Add AWS Connection</button>
    </div>
    ${
      state.awsConnections.length
        ? `<div id="aws-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
        : `<div class="panel text-center">
             <i data-lucide="key-round" class="w-10 h-10 text-gray-400 mx-auto"></i>
             <h3 class="mt-3 text-lg font-semibold">No AWS connections yet</h3>
             <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Add one AWS connection and reuse it across S3, CloudWatch, RDS, EC2, Lambda and Secrets.</p>
             <button id="add-aws-btn-empty" class="btn-primary mt-4">Add AWS Connection</button>
           </div>`
    }
  `;
}

function awsServicePageHtml(title, subtitle, rows, columns) {
  const connOptions = state.awsConnections
    .map((c) => `<option value="${c.id}" ${state.awsActiveConnectionId === c.id ? "selected" : ""}>${c.name}</option>`)
    .join("");
  const head = columns.map((c) => `<th class="py-3 px-4">${c.label}</th>`).join("");
  const body = (rows || [])
    .map((row) => `<tr>${columns.map((c) => `<td class="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">${row[c.key] ?? "-"}</td>`).join("")}</tr>`)
    .join("");
  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">${title}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">${subtitle}</p>
      </div>
      <div class="flex items-center gap-3">
        <select id="aws-connection-select" class="input min-w-[260px] bg-white dark:bg-gray-800">
          <option value="">Select AWS connection</option>
          ${connOptions}
        </select>
        <button id="aws-service-refresh" class="btn-secondary"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Refresh</button>
      </div>
    </div>
    <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <table class="w-full text-sm">
        <thead class="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
          <tr>${head}</tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          ${body || `<tr><td colspan="${columns.length}" class="py-8 text-center text-gray-500">No data loaded yet</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function developerToolPlaceholderHtml(title, description) {
  return `
    <div class="panel">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">${title}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">${description}</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">This tool shell is added to navigation and ready for deeper implementation.</p>
    </div>
  `;
}

function sslMonitorHtml() {
  const rows = state.sslMonitors
    .map((m) => {
      const days = Number(m.days_remaining ?? 0);
      const cls = days < 0 ? "text-red-800" : days < 10 ? "text-red-600" : days <= 30 ? "text-orange-500" : "text-green-500";
      return `<tr>
        <td class="py-3 px-3">${m.domain}:${m.port}</td>
        <td class="py-3 px-3">${m.issuer || "-"}</td>
        <td class="py-3 px-3">${m.issued_at ? new Date(m.issued_at).toLocaleDateString() : "-"}</td>
        <td class="py-3 px-3">${m.expires_at ? new Date(m.expires_at).toLocaleDateString() : "-"}</td>
        <td class="py-3 px-3 font-semibold ${cls}">${Number.isFinite(days) ? days : "-"} days</td>
        <td class="py-3 px-3">${m.status || "unknown"}</td>
        <td class="py-3 px-3">${m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "-"}</td>
        <td class="py-3 px-3 text-right">
          <button data-ssl-check="${m.id}" class="text-orange-500 mr-2"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
          <button data-ssl-delete="${m.id}" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
      </tr>`;
    })
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h2 class="text-xl font-semibold">SSL Monitor</h2>
          <button id="ssl-bulk-add-btn" class="btn-secondary text-xs">Bulk Add</button>
        </div>
        <form id="ssl-form" class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input class="input" name="domain" placeholder="api.myapp.com" required />
          <input class="input" name="port" type="number" value="443" />
          <select class="input" name="checkInterval"><option value="hourly">Every hour</option><option value="6h">Every 6 hours</option><option value="daily">Every day</option></select>
          <button class="btn-primary" type="submit">Add domain</button>
        </form>
      </div>
      <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-700/50"><tr><th class="py-3 px-3">Domain</th><th class="py-3 px-3">Issuer</th><th class="py-3 px-3">Issued</th><th class="py-3 px-3">Expires</th><th class="py-3 px-3">Days left</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">Last checked</th><th class="py-3 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="py-8 text-center text-gray-500">No monitored domains yet</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function dnsMonitorHtml() {
  const rows = state.dnsMonitors
    .map((m) => `<tr><td class="py-3 px-3">${m.domain}</td><td class="py-3 px-3">${m.record_type}</td><td class="py-3 px-3 truncate max-w-[260px]">${m.expected_value || "-"}</td><td class="py-3 px-3 truncate max-w-[260px] ${m.status === "changed" ? "text-red-500" : ""}">${m.current_value || "-"}</td><td class="py-3 px-3">${m.status}</td><td class="py-3 px-3">${m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "-"}</td><td class="py-3 px-3 text-right"><button data-dns-check="${m.id}" class="text-orange-500 mr-2"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button><button data-dns-delete="${m.id}" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`)
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <h2 class="text-xl font-semibold mb-3">DNS Monitor</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <input id="dns-lookup-domain" class="input" placeholder="example.com" />
          <select id="dns-lookup-type" class="input"><option>ALL</option><option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>NS</option><option>SOA</option><option>CAA</option><option>PTR</option></select>
          <button id="dns-lookup-btn" class="btn-secondary">Lookup now</button>
          <div id="dns-lookup-result" class="text-xs text-gray-500"></div>
        </div>
        <form id="dns-monitor-form" class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input class="input" name="domain" placeholder="Domain" required />
          <select class="input" name="recordType"><option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>NS</option></select>
          <input class="input" name="expectedValue" placeholder="Expected value" />
          <select class="input" name="checkInterval"><option value="15m">Every 15 min</option><option value="hourly">Every hour</option><option value="6h">Every 6 hours</option></select>
          <button class="btn-primary" type="submit">Add monitor</button>
        </form>
      </div>
      <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-700/50"><tr><th class="py-3 px-3">Domain</th><th class="py-3 px-3">Type</th><th class="py-3 px-3">Expected</th><th class="py-3 px-3">Current</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">Last checked</th><th class="py-3 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="py-8 text-center text-gray-500">No DNS monitors yet</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function portScannerHtml() {
  const rows = state.portMonitors
    .map((m) => `<tr><td class="py-3 px-3">${m.name}</td><td class="py-3 px-3">${m.host}:${m.port}</td><td class="py-3 px-3 uppercase">${m.protocol}</td><td class="py-3 px-3 ${m.status === "up" ? "text-green-500" : m.status === "slow" ? "text-yellow-500" : "text-red-500"}">${m.status}</td><td class="py-3 px-3">${m.response_time_ms || "-"} ms</td><td class="py-3 px-3">${m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : "-"}</td><td class="py-3 px-3 text-right"><button data-port-check="${m.id}" class="text-orange-500 mr-2"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button><button data-port-delete="${m.id}" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`)
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <h2 class="text-xl font-semibold mb-3">Port Scanner</h2>
        <form id="port-monitor-form" class="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input class="input" name="name" placeholder="Service name" required />
          <input class="input" name="host" placeholder="Host/IP" required />
          <input class="input" name="port" type="number" placeholder="Port" required />
          <select class="input" name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option></select>
          <select class="input" name="checkInterval"><option value="hourly">Every hour</option><option value="6h">Every 6 hours</option><option value="daily">Every day</option></select>
          <button class="btn-primary" type="submit">Add service</button>
        </form>
      </div>
      <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-700/50"><tr><th class="py-3 px-3">Service</th><th class="py-3 px-3">Endpoint</th><th class="py-3 px-3">Protocol</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">Response</th><th class="py-3 px-3">Last checked</th><th class="py-3 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="py-8 text-center text-gray-500">No monitored ports yet</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function envVarsHtml() {
  const rows = state.envVars
    .map((v) => `<tr><td class="py-3 px-3 font-medium">${v.name}</td><td class="py-3 px-3">${v.description || "-"}</td><td class="py-3 px-3">${v.scope_type}</td><td class="py-3 px-3">${v.valueMasked || "********"}</td><td class="py-3 px-3">${v.last_used_at ? new Date(v.last_used_at).toLocaleString() : "-"}</td><td class="py-3 px-3">${v.updated_at ? new Date(v.updated_at).toLocaleString() : "-"}</td><td class="py-3 px-3 text-right"><button data-env-delete="${v.id}" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`)
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <h2 class="text-xl font-semibold mb-3">Environment Variables</h2>
        <form id="env-var-form" class="grid grid-cols-1 md:grid-cols-7 gap-3">
          <input class="input" name="name" placeholder="API_KEY" required />
          <input class="input" name="description" placeholder="Description" />
          <select class="input" name="sourceType"><option value="manual">Manual value</option><option value="aws_secret">AWS Secrets Manager</option></select>
          <input class="input" name="value" placeholder="Value (manual)" />
          <input class="input" name="secretRef" placeholder="Secret ARN/Name (AWS)" />
          <select class="input" name="scopeType"><option value="global">Global</option><option value="local">Local only</option><option value="server">Specific server</option><option value="client">Specific client</option><option value="job">Specific job</option></select>
          <button class="btn-primary" type="submit">Add variable</button>
        </form>
      </div>
      <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-700/50"><tr><th class="py-3 px-3">Name</th><th class="py-3 px-3">Description</th><th class="py-3 px-3">Scope</th><th class="py-3 px-3">Value</th><th class="py-3 px-3">Last used</th><th class="py-3 px-3">Updated</th><th class="py-3 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="py-8 text-center text-gray-500">No variables yet</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function httpChecksHtml() {
  const rows = state.httpChecks
    .map((h) => `<tr><td class="py-3 px-3">${h.name}</td><td class="py-3 px-3 truncate max-w-[280px]">${h.url}</td><td class="py-3 px-3 uppercase">${h.method}</td><td class="py-3 px-3 ${h.status === "up" ? "text-green-500" : h.status === "degraded" ? "text-yellow-500" : "text-red-500"}">${h.status || "unknown"}</td><td class="py-3 px-3">${h.last_response_time_ms || "-"} ms</td><td class="py-3 px-3">${h.last_checked_at ? new Date(h.last_checked_at).toLocaleString() : "-"}</td><td class="py-3 px-3 text-right"><button data-http-check="${h.id}" class="text-orange-500 mr-2"><i data-lucide="play" class="w-4 h-4"></i></button><button data-http-delete="${h.id}" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`)
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <h2 class="text-xl font-semibold mb-3">HTTP Checks</h2>
        <form id="http-check-form" class="grid grid-cols-1 md:grid-cols-7 gap-3">
          <input class="input" name="name" placeholder="API health check" required />
          <input class="input md:col-span-2" name="url" placeholder="https://api.example.com/health" required />
          <select class="input" name="method"><option>GET</option><option>POST</option><option>HEAD</option><option>PUT</option><option>DELETE</option></select>
          <input class="input" name="timeoutSeconds" type="number" value="10" placeholder="Timeout sec" />
          <input class="input" name="statusCode" placeholder="Expected status (e.g. 200)" />
          <button class="btn-primary" type="submit">Add check</button>
        </form>
      </div>
      <div class="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-700/50"><tr><th class="py-3 px-3">Name</th><th class="py-3 px-3">URL</th><th class="py-3 px-3">Method</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">Response</th><th class="py-3 px-3">Last checked</th><th class="py-3 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="py-8 text-center text-gray-500">No HTTP checks yet</td></tr>`}</tbody></table>
      </div>
    </div>
  `;
}

function terminalHtml() {
  return `
    <div class="flex flex-col h-[calc(100vh-100px)]">
      <div class="flex-1 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl flex flex-col overflow-hidden relative shadow-lg">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#161b22]">
          <div class="flex items-center gap-2">
            <div id="terminal-tab-bar" class="flex items-center gap-2"></div>
              <button class="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700" title="New Connection" onclick="state.view='servers'; state.navSection='servers'; render(); bindViewEvents();">
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

      <section class="panel">
        <h3 class="section-title"><i data-lucide="database" class="w-5 h-5"></i> S3</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${field("Pre-signed URL expiry (hours)", `<input name="s3.defaultPresignedExpiryHours" class="input" type="number" value="${s.s3?.defaultPresignedExpiryHours || 1}">`)}
          ${field(
            "Default view mode",
            `<select name="s3.defaultViewMode" class="input">
              <option value="grid" ${(s.s3?.defaultViewMode || "grid") === "grid" ? "selected" : ""}>Grid</option>
              <option value="list" ${s.s3?.defaultViewMode === "list" ? "selected" : ""}>List</option>
            </select>`
          )}
          ${field(
            "Thumbnail size in grid",
            `<select name="s3.thumbnailSize" class="input">
              <option value="small" ${s.s3?.thumbnailSize === "small" ? "selected" : ""}>Small (120px)</option>
              <option value="medium" ${(s.s3?.thumbnailSize || "medium") === "medium" ? "selected" : ""}>Medium (160px)</option>
              <option value="large" ${s.s3?.thumbnailSize === "large" ? "selected" : ""}>Large (200px)</option>
            </select>`
          )}
          ${field(
            "Items per page",
            `<select name="s3.itemsPerPage" class="input">
              <option value="50" ${Number(s.s3?.itemsPerPage || 100) === 50 ? "selected" : ""}>50</option>
              <option value="100" ${Number(s.s3?.itemsPerPage || 100) === 100 ? "selected" : ""}>100</option>
              <option value="250" ${Number(s.s3?.itemsPerPage || 100) === 250 ? "selected" : ""}>250</option>
            </select>`
          )}
          ${field("Default storage class", `<select name="s3.defaultUploadStorageClass" class="input">
            <option value="STANDARD" ${(s.s3?.defaultUploadStorageClass || "STANDARD") === "STANDARD" ? "selected" : ""}>STANDARD</option>
            <option value="STANDARD_IA" ${s.s3?.defaultUploadStorageClass === "STANDARD_IA" ? "selected" : ""}>STANDARD_IA</option>
            <option value="GLACIER_IR" ${s.s3?.defaultUploadStorageClass === "GLACIER_IR" ? "selected" : ""}>GLACIER_IR</option>
          </select>`)}
          ${field("Multipart threshold (MB)", `<input name="s3.multipartThresholdMb" class="input" type="number" value="${s.s3?.multipartThresholdMb || 10}">`)}
          ${field("Concurrent upload limit", `<input name="s3.concurrentUploadLimit" class="input" type="number" value="${s.s3?.concurrentUploadLimit || 3}">`)}
          ${field(
            "Default S3 connection for logs",
            `<select name="s3.defaultConnectionId" class="input">
              <option value="">None</option>
              ${state.s3Connections.map((conn) => `<option value="${conn.id}" ${s.s3?.defaultConnectionId === conn.id ? "selected" : ""}>${conn.name}</option>`).join("")}
            </select>`
          )}
          ${field("Default log folder pattern", `<input name="s3.defaultLogFolderPattern" class="input" value="${s.s3?.defaultLogFolderPattern || "logs/{YYYY}/{MM}/{DD}/"}">`)}
          ${field(
            "Auto upload condition",
            `<select name="s3.defaultUploadCondition" class="input">
              <option value="always" ${s.s3?.defaultUploadCondition === "always" ? "selected" : ""}>Always</option>
              <option value="failure" ${(s.s3?.defaultUploadCondition || "failure") === "failure" ? "selected" : ""}>On failure only</option>
              <option value="success" ${s.s3?.defaultUploadCondition === "success" ? "selected" : ""}>On success only</option>
            </select>`
          )}
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Auto upload job logs</span>
            ${toggle("s3.autoUploadJobLogs", Boolean(s.s3?.autoUploadJobLogs))}
          </div>
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Show file previews</span>
            ${toggle("s3.showFilePreviews", s.s3?.showFilePreviews !== false)}
          </div>
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Show hidden files</span>
            ${toggle("s3.showHiddenFiles", Boolean(s.s3?.showHiddenFiles))}
          </div>
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Auto-load thumbnails</span>
            ${toggle("s3.autoLoadThumbnails", s.s3?.autoLoadThumbnails !== false)}
          </div>
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

function softwareServerOptionsHtml() {
  const options = [{ id: "local", name: "Local Machine", host: "127.0.0.1", username: "local" }, ...state.servers];
  return options
    .map((s) => `<option value="${s.id}" ${state.softwareServerId === s.id ? "selected" : ""}>${escapeHtml(s.name)} (${escapeHtml(s.username || "local")}@${escapeHtml(s.host || "localhost")})</option>`)
    .join("");
}

function packageRowsHtml(packages) {
  const q = String(state.packageSearch || "").trim().toLowerCase();
  const filtered = packages
    .filter((pkg) => {
      if (q && !String(pkg.name || "").toLowerCase().includes(q)) return false;
      if (state.packageFilter === "outdated") return pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion;
      if (state.packageFilter === "vulnerable") return Number(pkg.vulnCount || 0) > 0;
      if (state.packageFilter === "pinned") return Boolean(pkg.pinned);
      if (state.packageFilter === "uptodate") return !pkg.latestVersion || pkg.latestVersion === pkg.installedVersion;
      return true;
    })
    .slice(0, 500);

  return filtered
    .map((pkg) => {
      const hasUpdate = pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion;
      const updateTypeClass =
        pkg.updateType === "PATCH"
          ? "bg-green-500/20 text-green-500"
          : pkg.updateType === "MINOR"
            ? "bg-orange-500/20 text-orange-400"
            : pkg.updateType === "MAJOR"
              ? "bg-red-500/20 text-red-500"
              : "bg-gray-500/20 text-gray-400";
      return `
        <tr class="border-b border-gray-100 dark:border-gray-800">
          <td class="py-2 px-3 font-medium">${escapeHtml(pkg.name)}</td>
          <td class="py-2 px-3 text-xs">${escapeHtml(pkg.installedVersion || "-")}</td>
          <td class="py-2 px-3 text-xs ${hasUpdate ? "text-orange-500" : "text-gray-500"}">${escapeHtml(pkg.latestVersion || pkg.installedVersion || "-")}</td>
          <td class="py-2 px-3"><span class="px-2 py-1 rounded-full text-[11px] ${updateTypeClass}">${escapeHtml(pkg.updateType || "NONE")}</span></td>
          <td class="py-2 px-3">${Number(pkg.vulnCount || 0) > 0 ? `<span class="px-2 py-1 rounded-full text-[11px] bg-red-500/20 text-red-500">${Number(pkg.vulnCount)} CVE</span>` : `<span class="text-xs text-gray-500">-</span>`}</td>
          <td class="py-2 px-3 text-right">
            <div class="inline-flex gap-2">
              ${hasUpdate ? `<button class="btn-secondary text-xs" data-package-action="update" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-from="${escapeHtml(pkg.installedVersion || "")}" data-to="${escapeHtml(pkg.latestVersion || "")}">Update</button>` : ""}
              <button class="btn-secondary text-xs" data-package-action="${pkg.pinned ? "unpin" : "pin"}" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-version="${escapeHtml(pkg.installedVersion || "")}">${pkg.pinned ? "Unpin" : "Pin"}</button>
              <button class="btn-secondary text-xs text-red-500" data-package-action="uninstall" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}">Uninstall</button>
              <button class="btn-secondary text-xs" data-package-action="vulns" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-version="${escapeHtml(pkg.installedVersion || "")}">Vulns</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function softwarePackageManagerHtml() {
  const scan = state.packageScan;
  const hasScan = Boolean(scan && Array.isArray(scan.sections));
  const sections = hasScan
    ? scan.sections
        .map(
          (section) => `
      <div class="panel">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <div class="font-semibold">${escapeHtml(section.managerLabel)} <span class="text-xs text-gray-500">(${escapeHtml(section.managerVersion || "Unknown")})</span></div>
            <div class="text-xs text-gray-500">${section.packageCount} packages • ${section.outdatedCount} outdated • ${section.vulnerableCount} vulnerable</div>
          </div>
          <button class="btn-secondary text-xs" data-scan-manager="${section.manager}">Scan Section</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500">
                <th class="py-2 px-3">Name</th>
                <th class="py-2 px-3">Installed</th>
                <th class="py-2 px-3">Latest</th>
                <th class="py-2 px-3">Type</th>
                <th class="py-2 px-3">Security</th>
                <th class="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${packageRowsHtml(section.packages)}
            </tbody>
          </table>
        </div>
      </div>
    `
        )
        .join("")
    : `<div class="panel text-sm text-gray-500">Select a server and click "Scan now" to load installed packages.</div>`;

  return `
    <div class="space-y-4">
      <div class="panel">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[280px] flex-1">
            <div class="text-xs uppercase tracking-wide text-gray-500 mb-1">Server</div>
            <select id="software-server-select" class="input bg-white dark:bg-gray-800">${softwareServerOptionsHtml()}</select>
          </div>
          <button id="software-scan-btn" class="btn-primary">Scan now</button>
          <button id="software-history-btn" class="btn-secondary">History</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"><div class="text-xs text-gray-500">Total packages</div><div class="text-xl font-semibold">${scan?.stats?.totalPackages || 0}</div></div>
          <div class="bg-orange-500/10 rounded-lg px-3 py-2"><div class="text-xs text-orange-400">Updates available</div><div class="text-xl font-semibold text-orange-500">${scan?.stats?.updatesAvailable || 0}</div></div>
          <div class="bg-red-500/10 rounded-lg px-3 py-2"><div class="text-xs text-red-400">Vulnerabilities</div><div class="text-xl font-semibold text-red-500">${scan?.stats?.vulnerabilities || 0}</div></div>
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"><div class="text-xs text-gray-500">Last scan</div><div class="text-sm font-semibold">${scan?.scannedAt ? new Date(scan.scannedAt).toLocaleString() : "Not scanned"}</div></div>
        </div>
        <div class="flex flex-wrap gap-3 mt-4">
          <input id="software-package-search" class="input min-w-[220px] max-w-sm" placeholder="Search package..." value="${escapeHtml(state.packageSearch || "")}" />
          <select id="software-package-filter" class="input bg-white dark:bg-gray-800 max-w-[220px]">
            <option value="all" ${state.packageFilter === "all" ? "selected" : ""}>All</option>
            <option value="outdated" ${state.packageFilter === "outdated" ? "selected" : ""}>Outdated</option>
            <option value="vulnerable" ${state.packageFilter === "vulnerable" ? "selected" : ""}>Vulnerable</option>
            <option value="uptodate" ${state.packageFilter === "uptodate" ? "selected" : ""}>Up to date</option>
            <option value="pinned" ${state.packageFilter === "pinned" ? "selected" : ""}>Pinned</option>
          </select>
        </div>
      </div>
      ${sections}
    </div>
  `;
}

function softwareInstallerHtml() {
  const catalogItems = [
    { name: "Nginx", manager: "apt", packageName: "nginx", category: "Web Servers" },
    { name: "Apache", manager: "apt", packageName: "apache2", category: "Web Servers" },
    { name: "MySQL", manager: "apt", packageName: "mysql-server", category: "Databases" },
    { name: "Node.js", manager: "apt", packageName: "nodejs", category: "Language Runtimes" },
    { name: "Python", manager: "apt", packageName: "python3", category: "Language Runtimes" },
    { name: "Docker", manager: "apt", packageName: "docker.io", category: "Containerization" },
    { name: "PM2", manager: "npm", packageName: "pm2", category: "Process Managers" },
  ];
  const catalogHtml = catalogItems
    .map(
      (item) => `
    <button class="text-left border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-orange-500" data-install-catalog="${item.packageName}" data-install-manager="${item.manager}">
      <div class="text-xs text-gray-500">${item.category}</div>
      <div class="font-semibold mt-1">${item.name}</div>
      <div class="text-xs text-gray-500 mt-1">${item.manager} • ${item.packageName}</div>
    </button>
  `
    )
    .join("");
  return `
    <div class="space-y-4">
      <div class="panel">
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[280px] flex-1">
            <div class="text-xs uppercase tracking-wide text-gray-500 mb-1">Server</div>
            <select id="software-server-select" class="input bg-white dark:bg-gray-800">${softwareServerOptionsHtml()}</select>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary ${state.installerTab === "catalog" ? "ring-1 ring-orange-500" : ""}" data-installer-tab="catalog">Catalog</button>
            <button class="btn-secondary ${state.installerTab === "search" ? "ring-1 ring-orange-500" : ""}" data-installer-tab="search">Package Search</button>
            <button class="btn-secondary ${state.installerTab === "custom" ? "ring-1 ring-orange-500" : ""}" data-installer-tab="custom">Custom Command</button>
          </div>
        </div>
      </div>
      <div class="panel ${state.installerTab === "catalog" ? "" : "hidden"}" id="installer-tab-catalog">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${catalogHtml}</div>
      </div>
      <div class="panel ${state.installerTab === "search" ? "" : "hidden"}" id="installer-tab-search">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input id="installer-search-name" class="input" placeholder="Package name (e.g. redis)" />
          <select id="installer-search-manager" class="input bg-white dark:bg-gray-800">
            <option value="apt">apt</option><option value="yum">yum</option><option value="dnf">dnf</option><option value="npm">npm</option><option value="pip">pip</option><option value="composer">composer</option>
          </select>
          <input id="installer-search-version" class="input" placeholder="Version (optional)" />
        </div>
        <div class="pt-3"><button id="installer-search-install" class="btn-primary">Install Package</button></div>
      </div>
      <div class="panel ${state.installerTab === "custom" ? "" : "hidden"}" id="installer-tab-custom">
        <textarea id="installer-custom-command" class="input min-h-[120px] font-mono" placeholder="sudo apt-get install -y nginx"></textarea>
        <div class="pt-3"><button id="installer-custom-run" class="btn-primary">Run Install Command</button></div>
      </div>
      <div class="panel">
        <div class="section-title"><i data-lucide="terminal-square" class="w-5 h-5"></i> Installation Output</div>
        <pre class="bg-[#0d1117] text-gray-100 text-xs rounded-lg p-3 overflow-auto max-h-[340px]">${escapeHtml(state.installerOutput || "No installation output yet.")}</pre>
      </div>
    </div>
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
  const section = VIEW_TO_SECTION[state.view];
  if (section) state.sectionLastView[section] = state.view;
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
  } else if (state.view === "software-package-manager") {
    root.innerHTML = softwarePackageManagerHtml();
  } else if (state.view === "software-installer") {
    root.innerHTML = softwareInstallerHtml();
  } else if (state.view === "s3") {
    root.innerHTML = s3ConnectionsHtml();
  } else if (state.view === "s3-browser") {
    root.innerHTML = s3BrowserHtml();
  } else if (state.view === "aws-connections") {
    root.innerHTML = awsConnectionsHtml();
  } else if (state.view === "aws-cloudwatch") {
    root.innerHTML = awsServicePageHtml("CloudWatch Logs", "Browse log groups from the selected AWS connection", state.awsViewData, [
      { key: "name", label: "Log Group" },
      { key: "retentionInDays", label: "Retention (days)" },
      { key: "storedBytes", label: "Stored Bytes" },
    ]);
  } else if (state.view === "aws-rds") {
    root.innerHTML = awsServicePageHtml("RDS Databases", "Monitor RDS instances for the selected AWS connection", state.awsViewData, [
      { key: "identifier", label: "Identifier" },
      { key: "engine", label: "Engine" },
      { key: "status", label: "Status" },
      { key: "endpoint", label: "Endpoint" },
      { key: "port", label: "Port" },
    ]);
  } else if (state.view === "aws-ec2") {
    root.innerHTML = awsServicePageHtml("EC2 Instances", "List EC2 instances from the selected AWS connection", state.awsViewData, [
      { key: "instanceId", label: "Instance ID" },
      { key: "name", label: "Name" },
      { key: "instanceType", label: "Type" },
      { key: "state", label: "State" },
      { key: "publicIp", label: "Public IP" },
    ]);
  } else if (state.view === "aws-lambda") {
    root.innerHTML = awsServicePageHtml("Lambda Functions", "Inspect Lambda runtime configuration", state.awsViewData, [
      { key: "name", label: "Function" },
      { key: "runtime", label: "Runtime" },
      { key: "memorySize", label: "Memory MB" },
      { key: "timeout", label: "Timeout" },
      { key: "lastModified", label: "Last Modified" },
    ]);
  } else if (state.view === "aws-secrets") {
    root.innerHTML = awsServicePageHtml("Secrets Manager", "View secret metadata from AWS Secrets Manager", state.awsViewData, [
      { key: "name", label: "Name" },
      { key: "arn", label: "ARN" },
      { key: "lastChangedDate", label: "Last Changed" },
    ]);
  } else if (state.view === "health-checks") {
    root.innerHTML = httpChecksHtml();
  } else if (state.view === "ssl-monitor") {
    root.innerHTML = sslMonitorHtml();
  } else if (state.view === "dns-monitor") {
    root.innerHTML = dnsMonitorHtml();
  } else if (state.view === "port-scanner") {
    root.innerHTML = portScannerHtml();
  } else if (state.view === "env-vars") {
    root.innerHTML = envVarsHtml();
  } else if (state.view === "http-checks") {
    root.innerHTML = httpChecksHtml();
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
  const [
    jobs,
    logs,
    settings,
    dashboard,
    servers,
    keys,
    s3Connections,
    s3Regions,
    awsConnections,
    awsRegions,
    sslMonitors,
    dnsMonitors,
    portMonitors,
    envVars,
    httpChecks,
  ] = await Promise.all([
    window.OggoAPI.getJobs(),
    window.OggoAPI.getLogs({ limit: 100 }),
    window.OggoAPI.getSettings(),
    window.OggoAPI.getDashboard(),
    window.OggoAPI.getServers().catch(() => []),
    window.OggoAPI.getKeys().catch(() => []),
    window.OggoAPI.getS3Connections().catch(() => []),
    window.OggoAPI.getS3Regions().catch(() => []),
    window.OggoAPI.getAwsConnections().catch(() => []),
    window.OggoAPI.getAwsRegions().catch(() => []),
    window.OggoAPI.listSslMonitors().catch(() => []),
    window.OggoAPI.listDnsMonitors().catch(() => []),
    window.OggoAPI.listPortMonitors().catch(() => []),
    window.OggoAPI.listEnvVars().catch(() => []),
    window.OggoAPI.listHttpChecks().catch(() => []),
  ]);
  state.jobs = jobs;
  state.logs = logs;
  state.settings = settings;
  state.dashboard = dashboard;
  state.servers = servers;
  state.keys = keys;
  state.s3Connections = s3Connections;
  state.s3Regions = s3Regions;
  if (!state.s3Browser.hasUserViewMode) {
    const mode = settings?.s3?.defaultViewMode;
    state.s3Browser.viewMode = mode === "list" ? "list" : "grid";
  }
  state.awsConnections = awsConnections;
  state.awsRegions = awsRegions;
  state.sslMonitors = sslMonitors;
  state.dnsMonitors = dnsMonitors;
  state.portMonitors = portMonitors;
  state.envVars = envVars;
  state.httpChecks = httpChecks;
  if (!state.awsActiveConnectionId && awsConnections.length) {
    state.awsActiveConnectionId = awsConnections[0].id;
  }
}

async function scanSoftware(manager = "") {
  const scan = await window.OggoAPI.scanPackages(state.softwareServerId, manager);
  state.packageScan = scan;
}

async function refreshSoftwareHistory() {
  state.packageHistory = await window.OggoAPI.packageHistory(state.softwareServerId, 150);
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

      <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">S3 Log Upload</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Upload log to S3</span>
            ${toggle("s3UploadEnabled", Boolean(job?.s3UploadEnabled))}
          </div>
          ${field(
            "S3 connection",
            `<select name="s3ConnectionId" class="input bg-white dark:bg-gray-800">
              <option value="">Use default</option>
              ${state.s3Connections.map((conn) => `<option value="${conn.id}" ${job?.s3ConnectionId === conn.id ? "selected" : ""}>${conn.name}</option>`).join("")}
            </select>`
          )}
          ${field(
            "Upload condition",
            `<select name="s3UploadCondition" class="input bg-white dark:bg-gray-800">
              <option value="always" ${job?.s3UploadCondition === "always" ? "selected" : ""}>Always</option>
              <option value="failure" ${(!job?.s3UploadCondition || job?.s3UploadCondition === "failure") ? "selected" : ""}>On failure only</option>
              <option value="success" ${job?.s3UploadCondition === "success" ? "selected" : ""}>On success only</option>
            </select>`
          )}
          ${field("Log file pattern", `<input name="s3FilePattern" class="input" value="${job?.s3FilePattern || "{job}-{timestamp}.log"}">`)}
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
      s3UploadEnabled: form.get("s3UploadEnabled") === "on",
      s3ConnectionId: form.get("s3ConnectionId") || "",
      s3UploadCondition: form.get("s3UploadCondition") || "failure",
      s3FilePattern: form.get("s3FilePattern") || "{job}-{timestamp}.log",
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

function openS3Modal(connection = null) {
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const title = connection ? "Edit S3 Connection" : "Add S3 Bucket";
  const regionOptions = state.s3Regions
    .map((r) => `<option value="${r.code}" ${r.code === (connection?.region || "us-east-1") ? "selected" : ""}>${r.code} — ${r.name}</option>`)
    .join("");

  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
      <button type="button" id="s3-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="s3-form" class="space-y-5 p-6">
      <input type="hidden" name="id" value="${connection?.id || ""}">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${field("Connection name", `<input required name="name" class="input" value="${connection?.name || ""}" placeholder="Client Backups">`)}
        ${field("Description", `<input name="description" class="input" value="${connection?.description || ""}" placeholder="Optional notes">`)}
        ${field("Color", `<input class="input" name="color" type="color" value="${connection?.color || "#f97316"}" />`)}
        ${field("Bucket name", `<input required name="bucket_name" class="input" value="${connection?.bucket_name || ""}" placeholder="my-bucket">`)}
        ${field("Access Key ID", `<input required name="access_key_id" class="input" value="${connection?.access_key_id || ""}">`)}
        ${field("Secret Access Key", `<input ${connection ? "" : "required"} name="secret_access_key" class="input" type="password" placeholder="${connection ? "Leave empty to keep existing secret" : ""}">`)}
        ${field("Region", `<select name="region" class="input bg-white dark:bg-gray-800">${regionOptions}</select>`)}
        ${field("Root Prefix", `<input name="root_prefix" class="input" value="${connection?.root_prefix || ""}" placeholder="cronix/logs/">`)}
      </div>
      <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <i data-lucide="shield-check" class="w-4 h-4"></i>
        Credentials are encrypted before being saved locally.
      </div>
      <div class="flex gap-3 justify-between pt-2">
        <button type="button" id="s3-test-btn" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test Connection</button>
        <div class="flex gap-3">
          <button type="button" id="s3-cancel" class="btn-secondary px-6">Cancel</button>
          <button type="submit" class="btn-primary px-8">Save</button>
        </div>
      </div>
      <div id="s3-test-result" class="text-sm"></div>
    </form>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();

  const closeModal = () => modal.classList.add("hidden");
  el("s3-cancel").onclick = closeModal;
  el("s3-close").onclick = closeModal;

  el("s3-test-btn").onclick = async () => {
    const form = new FormData(el("s3-form"));
    const payload = {
      name: form.get("name"),
      description: form.get("description"),
      color: form.get("color"),
      bucket_name: form.get("bucket_name"),
      access_key_id: form.get("access_key_id"),
      secret_access_key: form.get("secret_access_key"),
      region: form.get("region"),
      root_prefix: form.get("root_prefix"),
    };
    try {
      const result = await window.OggoAPI.testS3DraftConnection(payload);
      el("s3-test-result").innerHTML = `<span class="text-green-500">Connected • ${result.region || payload.region} • ${result.fileCount || 0} files</span>`;
    } catch (error) {
      el("s3-test-result").innerHTML = `<span class="text-red-500">${error.message}</span>`;
    }
  };

  el("s3-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      name: form.get("name"),
      description: form.get("description"),
      color: form.get("color"),
      bucket_name: form.get("bucket_name"),
      access_key_id: form.get("access_key_id"),
      secret_access_key: form.get("secret_access_key"),
      region: form.get("region"),
      root_prefix: form.get("root_prefix"),
    };
    try {
      if (form.get("id")) {
        await window.OggoAPI.updateS3Connection(form.get("id"), payload);
        toast("S3 connection updated", "success");
      } else {
        await window.OggoAPI.createS3Connection(payload);
        toast("S3 connection added", "success");
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

function getS3ItemsPerPage() {
  const v = Number(state.settings?.s3?.itemsPerPage || 100);
  return Math.max(50, Math.min(250, v));
}

function getS3PresignExpirySeconds() {
  const hours = Number(state.settings?.s3?.defaultPresignedExpiryHours || 1);
  return Math.max(3600, Math.min(72 * 3600, hours * 3600));
}

function updateS3BrowserUrl(connectionId, prefix) {
  const params = new URLSearchParams(window.location.search);
  params.set("view", "s3-browser");
  params.set("s3Connection", connectionId);
  params.set("s3Prefix", prefix || "");
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

async function openS3Browser(connectionId, prefix = "", append = false) {
  try {
    const continuationToken = append ? state.s3Browser.continuationToken : null;
    const result = await window.OggoAPI.listS3Files(connectionId, {
      prefix,
      maxKeys: getS3ItemsPerPage(),
      delimiter: state.s3Browser.recursiveSearch ? "" : "/",
      continuationToken: continuationToken || undefined,
    });
    const nextFiles = result.files || [];
    const merged = append ? [...state.s3Browser.files, ...nextFiles] : nextFiles;
    const mergedKeys = new Set();
    const deduped = merged.filter((item) => {
      if (mergedKeys.has(item.key)) return false;
      mergedKeys.add(item.key);
      return true;
    });
    state.s3Browser = {
      ...state.s3Browser,
      connectionId,
      prefix: result.prefix || "",
      files: deduped,
      folders: append ? state.s3Browser.folders : result.folders || [],
      continuationToken: result.nextContinuationToken || null,
      loadingMore: false,
    };
    updateS3BrowserUrl(connectionId, result.prefix || "");
    state.view = "s3-browser";
    render();
    bindViewEvents();
  } catch (error) {
    state.s3Browser.loadingMore = false;
    toast(error.message, "error");
  }
}

async function ensureS3PresignedUrl(connectionId, key, expiresIn = getS3PresignExpirySeconds(), forceRefresh = false) {
  const cacheKey = `${connectionId}:${key}:${expiresIn}`;
  const cached = state.s3Browser.presignedCache[cacheKey];
  const now = Date.now();
  if (!forceRefresh && cached && cached.expiresAt > now + 10 * 1000) return cached.url;
  const res = await window.OggoAPI.getS3PresignedUrl(connectionId, key, expiresIn);
  state.s3Browser.presignedCache[cacheKey] = {
    url: res.url,
    expiresAt: now + Number(res.expiresIn || expiresIn) * 1000,
  };
  return res.url;
}

async function loadS3ThumbImage(img) {
  const key = img?.dataset?.s3Thumb;
  if (!key || img.dataset.loaded === "1") return;
  try {
    const url = await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds());
    img.onload = () => {
      img.dataset.loaded = "1";
      img.classList.remove("opacity-0");
      const fallback = img.parentElement?.querySelector("[data-s3-thumb-fallback]");
      const skeleton = img.parentElement?.querySelector(".s3-thumb-skeleton");
      if (fallback) fallback.remove();
      if (skeleton) skeleton.remove();
    };
    img.onerror = async () => {
      try {
        const nextUrl = await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds(), true);
        img.src = nextUrl;
      } catch (_error) {
        const skeleton = img.parentElement?.querySelector(".s3-thumb-skeleton");
        if (skeleton) skeleton.remove();
      }
    };
    img.src = url;
  } catch (_error) {
    const skeleton = img.parentElement?.querySelector(".s3-thumb-skeleton");
    if (skeleton) skeleton.remove();
  }
}

async function processS3ThumbBatch(nodes) {
  const chunk = nodes.splice(0, 10);
  if (!chunk.length) return;
  await Promise.all(chunk.map((node) => loadS3ThumbImage(node)));
  if (nodes.length) {
    setTimeout(() => processS3ThumbBatch(nodes), 0);
  }
}

function hydrateS3ImageThumbs() {
  if (state.settings?.s3?.autoLoadThumbnails === false) return;
  if (state.s3Browser.thumbObserver) {
    state.s3Browser.thumbObserver.disconnect();
  }
  const observer = new IntersectionObserver(
    (entries) => {
      const pending = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .filter((img) => img.dataset.loaded !== "1" && img.dataset.queued !== "1");
      pending.forEach((img) => {
        img.dataset.queued = "1";
      });
      if (pending.length) {
        processS3ThumbBatch(pending);
      }
    },
    { rootMargin: "200px 0px" }
  );
  state.s3Browser.thumbObserver = observer;
  document.querySelectorAll("[data-s3-thumb]").forEach((img) => observer.observe(img));
}

async function openS3Download(key) {
  try {
    const url = await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds());
    window.open(url, "_blank");
  } catch (_error) {
    const url = await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds(), true);
    window.open(url, "_blank");
  }
}

function toggleS3Selection(key) {
  if (!key) return;
  if (state.s3Browser.selectedKeys.includes(key)) {
    state.s3Browser.selectedKeys = state.s3Browser.selectedKeys.filter((k) => k !== key);
  } else {
    state.s3Browser.selectedKeys = [...state.s3Browser.selectedKeys, key];
  }
}

function updateUploadQueueItem(id, patch) {
  state.s3Browser.uploadQueue = (state.s3Browser.uploadQueue || []).map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function fileToBase64(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.round((event.loaded / event.total) * 70);
        onProgress(pct);
      }
    };
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  });
}

async function uploadFilesToS3CurrentFolder(files) {
  if (!files.length) return;
  const connId = state.s3Browser.connectionId;
  const prefix = state.s3Browser.prefix || "";
  const queueItems = files.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    key: `${prefix}${file.name}`,
    size: file.size || 0,
    progress: 0,
    status: "uploading",
  }));
  state.s3Browser.uploadQueue = [...(state.s3Browser.uploadQueue || []), ...queueItems];
  render();
  bindViewEvents();
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const queue = queueItems[i];
    try {
      updateUploadQueueItem(queue.id, { progress: 8 });
      render();
      bindViewEvents();
      const contentBase64 = await fileToBase64(file, (pct) => {
        updateUploadQueueItem(queue.id, { progress: Math.max(8, pct) });
      });
      updateUploadQueueItem(queue.id, { progress: 80 });
      render();
      bindViewEvents();
      await window.OggoAPI.uploadS3File(connId, {
        key: queue.key,
        contentBase64,
        contentType: file.type || "application/octet-stream",
      });
      updateUploadQueueItem(queue.id, { progress: 100, status: "done" });
      render();
      bindViewEvents();
    } catch (error) {
      updateUploadQueueItem(queue.id, { status: "failed", error: error.message, progress: 100 });
      toast(`Upload failed: ${file.name} (${error.message})`, "error");
    }
  }
  state.s3Browser.uploadQueue = (state.s3Browser.uploadQueue || []).filter((item) => item.status !== "done");
  toast("Upload complete", "success");
  await openS3Browser(connId, prefix);
}

async function openS3PreviewModal(key) {
  const file = (state.s3Browser.files || []).find((f) => f.key === key);
  if (!file) return;
  const connection = state.s3Connections.find((c) => c.id === state.s3Browser.connectionId);
  if (!connection) return;
  const category = getS3FileCategory(file);
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const url = await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds(), true);
  const ext = getFileExt(file.key);
  let preview = `<div class="p-8 text-center text-gray-500">Preview not available for this file type.</div>`;
  if (category === "images") {
    preview = `<a href="${url}" target="_blank" class="h-[420px] flex items-center justify-center bg-black/80 rounded-lg overflow-hidden"><img src="${url}" alt="${file.key}" class="max-w-full max-h-full object-contain"/></a>`;
  } else if (category === "videos") {
    preview = `<video controls class="w-full max-h-[420px] rounded-lg bg-black"><source src="${url}" /></video>`;
  } else if (category === "audio") {
    preview = `<div class="p-8 bg-gray-100 dark:bg-gray-800 rounded-lg"><audio controls class="w-full"><source src="${url}" /></audio></div>`;
  } else if (ext === "pdf") {
    preview = `<iframe src="${url}" class="w-full h-[460px] rounded-lg bg-white"></iframe>`;
  } else if (["txt", "json", "csv", "md", "yaml", "yml", "env", "sh", "js", "py", "php"].includes(ext)) {
    try {
      const response = await fetch(url);
      const fullText = await response.text();
      const text = fullText.slice(0, 5000);
      const truncated = fullText.length > 5000 ? `<div class="text-[11px] text-amber-500 mt-2">File truncated to first 5000 characters.</div>` : "";
      preview = `<div><pre class="h-[420px] overflow-auto bg-gray-900 text-gray-100 p-4 rounded-lg text-xs leading-relaxed whitespace-pre-wrap">${text.replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]))}</pre>${truncated}</div>`;
    } catch (_error) {}
  }

  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">${getFileNameFromKey(file.key)}</h3>
      <button type="button" id="s3-preview-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="p-6 space-y-4">
      ${preview}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
        <div><span class="font-semibold">Full path:</span> ${file.key}</div>
        <div><span class="font-semibold">Type:</span> ${ext || "unknown"}</div>
        <div><span class="font-semibold">Size:</span> ${formatBytes(file.size)}</div>
        <div><span class="font-semibold">Modified:</span> ${file.lastModified ? new Date(file.lastModified).toLocaleString() : "-"}</div>
        <div><span class="font-semibold">Storage class:</span> ${file.storageClass || "STANDARD"}</div>
        <div><span class="font-semibold">Bucket:</span> ${connection.bucket_name}</div>
        <div><span class="font-semibold">ETag:</span> ${file.etag || "-"}</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="s3-copy-presigned" class="btn-secondary text-xs"><i data-lucide="link" class="w-4 h-4"></i>Copy pre-signed URL</button>
        <button id="s3-copy-path" class="btn-secondary text-xs"><i data-lucide="copy" class="w-4 h-4"></i>Copy S3 path</button>
        <button id="s3-preview-download" class="btn-secondary text-xs"><i data-lucide="download" class="w-4 h-4"></i>Download</button>
        <button id="s3-preview-delete" class="btn-secondary text-xs text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i>Delete</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
  el("s3-preview-close").onclick = () => modal.classList.add("hidden");
  el("s3-copy-presigned").onclick = async () => {
    await navigator.clipboard.writeText(url);
    toast("Copied URL", "success");
  };
  el("s3-copy-path").onclick = async () => {
    await navigator.clipboard.writeText(`s3://${connection.bucket_name}/${file.key}`);
    toast("Copied S3 path", "success");
  };
  el("s3-preview-download").onclick = () => openS3Download(file.key);
  el("s3-preview-delete").onclick = async () => {
    if (!confirm(`Delete ${file.key}?`)) return;
    await window.OggoAPI.deleteS3File(state.s3Browser.connectionId, file.key);
    modal.classList.add("hidden");
    toast("File deleted", "success");
    await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "");
  };
}

function openAwsConnectionModal(connection = null) {
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const title = connection ? "Edit AWS Connection" : "Add AWS Connection";
  const regionOptions = state.awsRegions
    .map((r) => `<option value="${r.code}" ${r.code === (connection?.default_region || "us-east-1") ? "selected" : ""}>${r.code} — ${r.name}</option>`)
    .join("");
  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
      <button type="button" id="aws-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="aws-form" class="space-y-5 p-6">
      <input type="hidden" name="id" value="${connection?.id || ""}">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${field("Connection name", `<input required name="name" class="input" value="${connection?.name || ""}" placeholder="Production AWS">`)}
        ${field("Description", `<input name="description" class="input" value="${connection?.description || ""}" placeholder="Optional notes">`)}
        ${field("Color", `<input class="input" name="color" type="color" value="${connection?.color || "#f97316"}" />`)}
        ${field("Default region", `<select name="default_region" class="input bg-white dark:bg-gray-800">${regionOptions}</select>`)}
        ${field("Access Key ID", `<input required name="access_key_id" class="input" value="${connection?.access_key_id || ""}">`)}
        ${field("Secret Access Key", `<input ${connection ? "" : "required"} name="secret_access_key" class="input" type="password" placeholder="${connection ? "Leave empty to keep existing secret" : ""}">`)}
        ${field("Session Token (optional)", `<input name="session_token" class="input" placeholder="${connection?.hasSessionToken ? "Leave empty to keep existing token" : ""}">`)}
      </div>
      <div class="flex gap-3 justify-between pt-2">
        <button type="button" id="aws-test-btn" class="btn-secondary"><i data-lucide="activity" class="w-4 h-4"></i>Test Permissions</button>
        <div class="flex gap-3">
          <button type="button" id="aws-cancel" class="btn-secondary px-6">Cancel</button>
          <button type="submit" class="btn-primary px-8">Save</button>
        </div>
      </div>
      <div id="aws-test-result" class="text-sm"></div>
    </form>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
  const closeModal = () => modal.classList.add("hidden");
  el("aws-cancel").onclick = closeModal;
  el("aws-close").onclick = closeModal;

  el("aws-test-btn").onclick = async () => {
    const id = el("aws-form").elements.id.value;
    if (!id) {
      toast("Save connection first, then run full permission test.", "info");
      return;
    }
    try {
      const result = await window.OggoAPI.testAwsConnection(id);
      const summary = Object.entries(result.serviceAccess || {})
        .map(([k, v]) => `${k}: ${v.ok ? "yes" : "no"}`)
        .join(" • ");
      el("aws-test-result").innerHTML = `<span class="text-green-500">Account: ${result.accountId || "-"} • ${summary}</span>`;
      await refreshData();
    } catch (error) {
      el("aws-test-result").innerHTML = `<span class="text-red-500">${error.message}</span>`;
    }
  };

  el("aws-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      name: form.get("name"),
      description: form.get("description"),
      color: form.get("color"),
      default_region: form.get("default_region"),
      access_key_id: form.get("access_key_id"),
      secret_access_key: form.get("secret_access_key"),
      session_token: form.get("session_token"),
    };
    try {
      if (form.get("id")) {
        await window.OggoAPI.updateAwsConnection(form.get("id"), payload);
        toast("AWS connection updated", "success");
      } else {
        await window.OggoAPI.createAwsConnection(payload);
        toast("AWS connection created", "success");
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

async function loadAwsServiceData(view) {
  if (!state.awsActiveConnectionId) {
    state.awsViewData = [];
    return;
  }
  if (view === "aws-cloudwatch") {
    state.awsViewData = await window.OggoAPI.listCloudWatchLogGroups(state.awsActiveConnectionId);
  } else if (view === "aws-rds") {
    state.awsViewData = await window.OggoAPI.listRdsInstances(state.awsActiveConnectionId);
  } else if (view === "aws-ec2") {
    state.awsViewData = await window.OggoAPI.listEc2Instances(state.awsActiveConnectionId);
  } else if (view === "aws-lambda") {
    state.awsViewData = await window.OggoAPI.listLambdaFunctions(state.awsActiveConnectionId);
  } else if (view === "aws-secrets") {
    state.awsViewData = await window.OggoAPI.listAwsSecrets(state.awsActiveConnectionId);
  }
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
  document.querySelectorAll("[data-rail-section]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const section = btn.dataset.railSection;
      if (!section) return;
      if (state.navSection === section) {
        state.contextCollapsed = !state.contextCollapsed;
      } else {
        state.contextCollapsed = false;
        state.navSection = section;
      }
      const nextView = state.sectionLastView[section] || NAV_STRUCTURE[section]?.items?.find((i) => i.view)?.view || "dashboard";
      state.view = nextView;
      await refreshData();
      if (["aws-cloudwatch", "aws-rds", "aws-ec2", "aws-lambda", "aws-secrets"].includes(state.view)) {
        await loadAwsServiceData(state.view);
      }
      render();
      bindViewEvents();
      if (window.lucide) window.lucide.createIcons();
      if (state.view === "terminal" && state.activeTerminalServerId) {
        connectTerminal(state.activeTerminalServerId);
      }
    })
  );

  const contextList = el("context-list");
  if (contextList) {
    contextList.onclick = async (event) => {
      const action = event.target.closest("[data-context-action]")?.dataset?.contextAction;
      const view = event.target.closest("[data-context-view]")?.dataset?.contextView;
      if (action === "add-server") {
        openServerModal();
        return;
      }
      if (action === "add-s3") {
        openS3Modal();
        return;
      }
      if (!view) return;
      state.view = view;
      state.sectionLastView[state.navSection] = view;
      await refreshData();
      if (["aws-cloudwatch", "aws-rds", "aws-ec2", "aws-lambda", "aws-secrets"].includes(state.view)) {
        await loadAwsServiceData(state.view);
      }
      render();
      bindViewEvents();
      if (window.lucide) window.lucide.createIcons();
      if (state.view === "terminal") {
        if (!state.activeTerminalServerId && state.servers.length > 0) state.activeTerminalServerId = state.servers[0].id;
        if (state.activeTerminalServerId) connectTerminal(state.activeTerminalServerId);
      }
    };
  }

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

  if (state.view === "software-package-manager" || state.view === "software-installer") {
    const serverSelect = el("software-server-select");
    if (serverSelect) {
      serverSelect.onchange = () => {
        state.softwareServerId = serverSelect.value;
        state.packageScan = null;
        render();
        bindViewEvents();
      };
    }
  }

  if (state.view === "software-package-manager") {
    const scanBtn = el("software-scan-btn");
    const historyBtn = el("software-history-btn");
    const searchInput = el("software-package-search");
    const filterInput = el("software-package-filter");
    if (searchInput) {
      searchInput.oninput = () => {
        state.packageSearch = searchInput.value;
        render();
        bindViewEvents();
      };
    }
    if (filterInput) {
      filterInput.onchange = () => {
        state.packageFilter = filterInput.value;
        render();
        bindViewEvents();
      };
    }
    if (scanBtn) {
      scanBtn.onclick = async () => {
        try {
          scanBtn.disabled = true;
          scanBtn.textContent = "Scanning...";
          await scanSoftware();
          toast("Package scan completed", "success");
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        } finally {
          scanBtn.disabled = false;
          scanBtn.textContent = "Scan now";
        }
      };
    }
    if (historyBtn) {
      historyBtn.onclick = async () => {
        try {
          await refreshSoftwareHistory();
          const modal = el("job-modal");
          const body = el("job-modal-body");
          body.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Package History</h3>
              <button type="button" id="software-history-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="p-4 max-h-[70vh] overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th class="py-2 px-2">Time</th><th class="py-2 px-2">Manager</th><th class="py-2 px-2">Package</th><th class="py-2 px-2">Action</th><th class="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    state.packageHistory
                      .map(
                        (row) => `
                    <tr class="border-b border-gray-100 dark:border-gray-800">
                      <td class="py-2 px-2 text-xs">${new Date(row.created_at).toLocaleString()}</td>
                      <td class="py-2 px-2">${escapeHtml(row.package_manager)}</td>
                      <td class="py-2 px-2">${escapeHtml(row.package_name)}</td>
                      <td class="py-2 px-2">${escapeHtml(row.action)}</td>
                      <td class="py-2 px-2 ${row.status === "success" ? "text-green-500" : "text-red-500"}">${escapeHtml(row.status)}</td>
                    </tr>
                  `
                      )
                      .join("") || `<tr><td class="py-4 px-2 text-gray-500" colspan="5">No history found.</td></tr>`
                  }
                </tbody>
              </table>
            </div>
          `;
          modal.classList.remove("hidden");
          if (window.lucide) window.lucide.createIcons();
          el("software-history-close").onclick = () => modal.classList.add("hidden");
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }
    el("app-content").onclick = async (event) => {
      const managerScan = event.target.closest("[data-scan-manager]")?.dataset?.scanManager;
      if (managerScan) {
        try {
          await scanSoftware(managerScan);
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
        return;
      }
      const actionNode = event.target.closest("[data-package-action]");
      if (!actionNode) return;
      const action = actionNode.dataset.packageAction;
      const manager = actionNode.dataset.manager;
      const packageName = actionNode.dataset.name;
      const fromVersion = actionNode.dataset.from || "";
      const toVersion = actionNode.dataset.to || "";
      try {
        if (action === "update" || action === "uninstall") {
          const confirmText =
            action === "update"
              ? `Update ${packageName} (${fromVersion || "?"} -> ${toVersion || "latest"})?`
              : `Uninstall ${packageName}?`;
          if (!confirm(confirmText)) return;
          const result = await window.OggoAPI.packageOperation(state.softwareServerId, {
            manager,
            packageName,
            action,
            fromVersion,
            toVersion,
            triggeredBy: "ui",
          });
          state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
          toast(result.status === "success" ? "Operation succeeded" : "Operation failed", result.status === "success" ? "success" : "error");
          await scanSoftware();
          render();
          bindViewEvents();
          return;
        }
        if (action === "pin") {
          await window.OggoAPI.pinPackage(state.softwareServerId, { manager, packageName, version: actionNode.dataset.version || "" });
          toast("Package pinned", "success");
          await scanSoftware();
          render();
          bindViewEvents();
          return;
        }
        if (action === "unpin") {
          await window.OggoAPI.unpinPackage(state.softwareServerId, { manager, packageName });
          toast("Package unpinned", "success");
          await scanSoftware();
          render();
          bindViewEvents();
          return;
        }
        if (action === "vulns") {
          const data = await window.OggoAPI.packageVulnerabilities(state.softwareServerId, {
            manager,
            packageName,
            version: actionNode.dataset.version || "",
          });
          const vulns = data.vulns || data.vulnerabilities || [];
          const modal = el("job-modal");
          const body = el("job-modal-body");
          body.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Vulnerabilities: ${escapeHtml(packageName)}</h3>
              <button type="button" id="software-vuln-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="p-4 max-h-[70vh] overflow-auto space-y-3">
              ${
                (vulns || [])
                  .map((v) => `<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div class="font-semibold text-sm">${escapeHtml(v.id || "Unknown CVE")}</div>
                    <div class="text-xs text-gray-500 mt-1">${escapeHtml(v.summary || v.details || "")}</div>
                  </div>`)
                  .join("") || '<div class="text-sm text-gray-500">No vulnerabilities returned by OSV.</div>'
              }
            </div>
          `;
          modal.classList.remove("hidden");
          if (window.lucide) window.lucide.createIcons();
          el("software-vuln-close").onclick = () => modal.classList.add("hidden");
        }
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (state.view === "software-installer") {
    document.querySelectorAll("[data-installer-tab]").forEach((btn) => {
      btn.onclick = () => {
        state.installerTab = btn.dataset.installerTab;
        render();
        bindViewEvents();
      };
    });
    document.querySelectorAll("[data-install-catalog]").forEach((btn) => {
      btn.onclick = async () => {
        const manager = btn.dataset.installManager;
        const packageName = btn.dataset.installCatalog;
        if (!confirm(`Install ${packageName} via ${manager}?`)) return;
        try {
          const result = await window.OggoAPI.runInstaller(state.softwareServerId, { manager, packageName, triggeredBy: "ui" });
          state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
          toast(result.status === "success" ? "Install completed" : "Install failed", result.status === "success" ? "success" : "error");
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    });
    const searchInstallBtn = el("installer-search-install");
    if (searchInstallBtn) {
      searchInstallBtn.onclick = async () => {
        const packageName = String(el("installer-search-name")?.value || "").trim();
        const manager = String(el("installer-search-manager")?.value || "apt");
        const version = String(el("installer-search-version")?.value || "").trim();
        if (!packageName) return;
        try {
          const result = await window.OggoAPI.runInstaller(state.softwareServerId, { manager, packageName, version, triggeredBy: "ui" });
          state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
          toast(result.status === "success" ? "Install completed" : "Install failed", result.status === "success" ? "success" : "error");
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }
    const customRunBtn = el("installer-custom-run");
    if (customRunBtn) {
      customRunBtn.onclick = async () => {
        const customCommand = String(el("installer-custom-command")?.value || "").trim();
        if (!customCommand) return;
        if (!confirm("Run this custom install command on selected server?")) return;
        try {
          const result = await window.OggoAPI.runInstaller(state.softwareServerId, { customCommand, triggeredBy: "ui" });
          state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
          toast(result.status === "success" ? "Command completed" : "Command failed", result.status === "success" ? "success" : "error");
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }
  }

  if (state.view === "s3") {
    const addBtn = el("add-s3-btn");
    const addBtnEmpty = el("add-s3-btn-empty");
    if (addBtn) addBtn.onclick = () => openS3Modal();
    if (addBtnEmpty) addBtnEmpty.onclick = () => openS3Modal();

    const search = el("s3-search");
    if (search) {
      search.oninput = (event) => {
        const q = event.target.value.toLowerCase().trim();
        document.querySelectorAll("#s3-grid > div").forEach((card) => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? "" : "none";
        });
      };
    }

    el("app-content").onclick = async (event) => {
      const id = event.target.closest("[data-id]")?.dataset?.id;
      const action = event.target.closest("[data-s3-action]")?.dataset?.s3Action;
      if (!id || !action) return;
      const conn = state.s3Connections.find((s) => s.id === id);
      try {
        if (action === "edit") openS3Modal(conn);
        if (action === "delete") {
          if (!confirm(`Delete S3 connection "${conn?.name}"?`)) return;
          await window.OggoAPI.deleteS3Connection(id);
          toast("S3 connection deleted", "success");
        }
        if (action === "test") {
          const result = await window.OggoAPI.testS3Connection(id);
          toast(result.success ? "S3 connection successful" : `S3 failed: ${result.message}`, result.success ? "success" : "error");
        }
        if (action === "browse") {
          await openS3Browser(id, "");
          return;
        }
        await refreshData();
        render();
        bindViewEvents();
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (state.view === "s3-browser") {
    const activeConn = state.s3Connections.find((c) => c.id === state.s3Browser.connectionId);
    hydrateS3ImageThumbs();
    const uploadBtn = el("s3-upload-btn");
    const emptyUploadBtn = el("s3-empty-upload-btn");
    const uploadInput = el("s3-upload-file");
    const createFolderBtn = el("s3-create-folder");
    const goUpBtn = el("s3-go-up");
    const clearSearchBtn = el("s3-clear-search");
    const clearSearchEmptyBtn = el("s3-clear-search-empty");
    const loadMoreBtn = el("s3-load-more");
    const searchInput = el("s3-browser-search");
    const sortSelect = el("s3-sort-by");
    const sortDirBtn = el("s3-sort-dir");
    const recursiveCheck = el("s3-recursive-search");
    const inlineFolderBar = el("s3-folder-inline-create");
    const newFolderInput = el("s3-new-folder-input");
    const createFolderConfirm = el("s3-create-folder-confirm");
    const createFolderCancel = el("s3-create-folder-cancel");

    if (searchInput) {
      searchInput.oninput = () => {
        state.s3Browser.search = searchInput.value;
        render();
        bindViewEvents();
      };
    }
    if (clearSearchBtn) {
      clearSearchBtn.onclick = () => {
        state.s3Browser.search = "";
        render();
        bindViewEvents();
      };
    }
    if (clearSearchEmptyBtn) {
      clearSearchEmptyBtn.onclick = () => {
        state.s3Browser.search = "";
        render();
        bindViewEvents();
      };
    }
    if (sortSelect) {
      sortSelect.onchange = () => {
        state.s3Browser.sortBy = sortSelect.value;
        render();
        bindViewEvents();
      };
    }
    if (sortDirBtn) {
      sortDirBtn.onclick = () => {
        state.s3Browser.sortDir = state.s3Browser.sortDir === "asc" ? "desc" : "asc";
        render();
        bindViewEvents();
      };
    }
    if (recursiveCheck) {
      recursiveCheck.onchange = async () => {
        state.s3Browser.recursiveSearch = recursiveCheck.checked;
        await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "");
      };
    }
    if (goUpBtn) {
      goUpBtn.onclick = async () => {
        const parts = (state.s3Browser.prefix || "").split("/").filter(Boolean);
        parts.pop();
        const nextPrefix = parts.length ? `${parts.join("/")}/` : "";
        await openS3Browser(state.s3Browser.connectionId, nextPrefix);
      };
    }
    if (loadMoreBtn) {
      loadMoreBtn.onclick = async () => {
        if (!state.s3Browser.continuationToken || state.s3Browser.loadingMore) return;
        state.s3Browser.loadingMore = true;
        render();
        bindViewEvents();
        await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "", true);
      };
    }
    if (uploadBtn && uploadInput) {
      uploadBtn.onclick = () => uploadInput.click();
      if (emptyUploadBtn) emptyUploadBtn.onclick = () => uploadInput.click();
      uploadInput.onchange = async () => {
        const files = Array.from(uploadInput.files || []);
        if (!files.length) return;
        await uploadFilesToS3CurrentFolder(files);
        uploadInput.value = "";
      };
    }
    document.querySelectorAll("[data-s3-view]").forEach((btn) => {
      btn.onclick = () => {
        state.s3Browser.viewMode = btn.dataset.s3View;
        state.s3Browser.hasUserViewMode = true;
        render();
        bindViewEvents();
      };
    });
    document.querySelectorAll("[data-s3-type]").forEach((btn) => {
      btn.onclick = () => {
        state.s3Browser.typeFilter = btn.dataset.s3Type;
        render();
        bindViewEvents();
      };
    });
    document.querySelectorAll("[data-s3-breadcrumb]").forEach((btn) => {
      btn.onclick = async () => {
        const index = Number(btn.dataset.s3Breadcrumb || 0);
        const parts = [activeConn?.bucket_name, ...(state.s3Browser.prefix || "").split("/").filter(Boolean)];
        const targetParts = parts.slice(1, index + 1);
        const nextPrefix = targetParts.length ? `${targetParts.join("/")}/` : "";
        await openS3Browser(state.s3Browser.connectionId, nextPrefix);
      };
    });
    if (createFolderBtn) {
      createFolderBtn.onclick = () => {
        inlineFolderBar?.classList.remove("hidden");
        newFolderInput?.focus();
      };
    }
    if (createFolderCancel) {
      createFolderCancel.onclick = () => inlineFolderBar?.classList.add("hidden");
    }
    if (createFolderConfirm) {
      createFolderConfirm.onclick = async () => {
        const name = String(newFolderInput?.value || "").trim();
        if (!name) return;
        await window.OggoAPI.createS3Folder(state.s3Browser.connectionId, `${state.s3Browser.prefix || ""}${name}/`);
        toast("Folder created", "success");
        if (newFolderInput) newFolderInput.value = "";
        inlineFolderBar?.classList.add("hidden");
        await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "");
      };
    }
    if (newFolderInput) {
      newFolderInput.onkeydown = async (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        createFolderConfirm?.click();
      };
    }
    const selectAll = el("s3-select-all");
    if (selectAll) {
      const visible = getVisibleS3Files();
      const selectedCount = visible.filter((f) => state.s3Browser.selectedKeys.includes(f.key)).length;
      selectAll.checked = visible.length > 0 && selectedCount === visible.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < visible.length;
      selectAll.onchange = () => {
        const visibleKeys = getVisibleS3Files().map((f) => f.key);
        if (selectAll.checked) {
          state.s3Browser.selectedKeys = Array.from(new Set([...state.s3Browser.selectedKeys, ...visibleKeys]));
        } else {
          state.s3Browser.selectedKeys = state.s3Browser.selectedKeys.filter((k) => !visibleKeys.includes(k));
        }
        render();
        bindViewEvents();
      };
    }
    const dropArea = el("s3-drop-area");
    const dropOverlay = el("s3-drop-overlay");
    if (dropArea) {
      dropArea.ondragover = (e) => {
        e.preventDefault();
        dropOverlay?.classList.remove("hidden");
      };
      dropArea.ondragleave = () => dropOverlay?.classList.add("hidden");
      dropArea.ondrop = async (e) => {
        e.preventDefault();
        dropOverlay?.classList.add("hidden");
        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;
        await uploadFilesToS3CurrentFolder(files);
      };
    }
    el("app-content").onclick = async (event) => {
      const folder = event.target.closest("[data-s3-folder]")?.dataset?.s3Folder;
      const keyDelete = event.target.closest("[data-s3-delete-file]")?.dataset?.s3DeleteFile;
      const keyDownload = event.target.closest("[data-s3-download]")?.dataset?.s3Download;
      const keyCopyUrl = event.target.closest("[data-s3-copy-url]")?.dataset?.s3CopyUrl;
      const keyPreview = event.target.closest("[data-s3-preview]")?.dataset?.s3Preview;
      const keySelect = event.target.closest("[data-s3-select]")?.dataset?.s3Select;
      const keyRowSelect = event.target.closest("[data-s3-row-select]")?.dataset?.s3RowSelect;
      const breadcrumb = event.target.closest("[data-s3-breadcrumb]")?.dataset?.s3Breadcrumb;
      if (folder) {
        await openS3Browser(state.s3Browser.connectionId, folder);
        return;
      }
      if (typeof breadcrumb !== "undefined") return;
      if (keySelect) {
        toggleS3Selection(keySelect);
        render();
        bindViewEvents();
        return;
      }
      if (keyRowSelect && !event.target.closest("button,a,input,label")) {
        toggleS3Selection(keyRowSelect);
        render();
        bindViewEvents();
        return;
      }
      if (keyPreview) {
        await openS3PreviewModal(keyPreview);
        return;
      }
      if (keyDelete) {
        if (!confirm(`Delete file ${keyDelete}?`)) return;
        await window.OggoAPI.deleteS3File(state.s3Browser.connectionId, keyDelete);
        toast("File deleted", "success");
        await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "");
        return;
      }
      if (keyDownload) {
        await openS3Download(keyDownload);
        return;
      }
      if (keyCopyUrl) {
        const url = await ensureS3PresignedUrl(state.s3Browser.connectionId, keyCopyUrl, getS3PresignExpirySeconds(), true);
        await navigator.clipboard.writeText(url);
        toast("Copied pre-signed URL", "success");
        return;
      }
      const clearSelection = event.target.closest("#s3-clear-selection");
      if (clearSelection) {
        state.s3Browser.selectedKeys = [];
        render();
        bindViewEvents();
        return;
      }
      const deleteSelected = event.target.closest("#s3-delete-selected");
      if (deleteSelected) {
        if (!state.s3Browser.selectedKeys.length) return;
        if (!confirm(`Delete ${state.s3Browser.selectedKeys.length} selected files?`)) return;
        for (const key of state.s3Browser.selectedKeys) {
          await window.OggoAPI.deleteS3File(state.s3Browser.connectionId, key);
        }
        state.s3Browser.selectedKeys = [];
        toast("Selected files deleted", "success");
        await openS3Browser(state.s3Browser.connectionId, state.s3Browser.prefix || "");
        return;
      }
      const moveSelected = event.target.closest("#s3-move-selected");
      if (moveSelected) {
        toast("Move requires Copy + Delete workflow and is coming next.", "info");
        return;
      }
      const downloadSelected = event.target.closest("#s3-download-selected");
      if (downloadSelected) {
        const keys = [...state.s3Browser.selectedKeys];
        if (!keys.length) return;
        if (keys.length > 10) {
          toast("Large bulk download: generating URLs in clipboard", "info");
          const urls = [];
          for (const key of keys) {
            urls.push(await ensureS3PresignedUrl(state.s3Browser.connectionId, key, getS3PresignExpirySeconds(), true));
          }
          await navigator.clipboard.writeText(urls.join("\n"));
          toast("Pre-signed URLs copied", "success");
        } else {
          for (const key of keys) {
            await openS3Download(key);
          }
        }
      }
    };
    el("app-content").ondblclick = async (event) => {
      const folderOpen = event.target.closest("[data-s3-folder-open]")?.dataset?.s3FolderOpen;
      if (!folderOpen) return;
      await openS3Browser(state.s3Browser.connectionId, folderOpen);
    };
  }

  if (state.view === "aws-connections") {
    const addBtn = el("add-aws-btn");
    const addBtnEmpty = el("add-aws-btn-empty");
    if (addBtn) addBtn.onclick = () => openAwsConnectionModal();
    if (addBtnEmpty) addBtnEmpty.onclick = () => openAwsConnectionModal();
    el("app-content").onclick = async (event) => {
      const id = event.target.closest("[data-id]")?.dataset?.id;
      const action = event.target.closest("[data-aws-action]")?.dataset?.awsAction;
      if (!id || !action) return;
      const conn = state.awsConnections.find((c) => c.id === id);
      try {
        if (action === "edit") openAwsConnectionModal(conn);
        if (action === "delete") {
          if (!confirm(`Delete AWS connection "${conn?.name}"?`)) return;
          await window.OggoAPI.deleteAwsConnection(id);
          toast("AWS connection deleted", "success");
        }
        if (action === "test") {
          const result = await window.OggoAPI.testAwsConnection(id);
          const okCount = Object.values(result.serviceAccess || {}).filter((s) => s.ok).length;
          toast(`Test complete. ${okCount} services accessible.`, "success");
        }
        await refreshData();
        render();
        bindViewEvents();
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (["aws-cloudwatch", "aws-rds", "aws-ec2", "aws-lambda", "aws-secrets"].includes(state.view)) {
    const select = el("aws-connection-select");
    const refreshBtn = el("aws-service-refresh");
    if (select) {
      select.onchange = async () => {
        state.awsActiveConnectionId = select.value;
        await loadAwsServiceData(state.view);
        render();
        bindViewEvents();
      };
    }
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        await loadAwsServiceData(state.view);
        render();
        bindViewEvents();
      };
    }
  }

  if (["health-checks", "ssl-monitor", "dns-monitor", "port-scanner", "env-vars", "http-checks"].includes(state.view)) {
    const rerenderDevtools = async () => {
      await refreshData();
      render();
      bindViewEvents();
    };

    if (state.view === "ssl-monitor") {
      const sslForm = el("ssl-form");
      if (sslForm) {
        sslForm.onsubmit = async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          try {
            const created = await window.OggoAPI.createSslMonitor({
              domain: String(form.get("domain") || "").trim(),
              port: Number(form.get("port") || 443),
              checkInterval: form.get("checkInterval") || "daily",
              thresholds: [30, 14, 7, 1],
              channels: [],
            });
            await window.OggoAPI.checkSslMonitor(created.id);
            toast("SSL domain added and checked", "success");
            await rerenderDevtools();
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      const bulkBtn = el("ssl-bulk-add-btn");
      if (bulkBtn) {
        bulkBtn.onclick = async () => {
          const raw = prompt("Paste one domain per line (optional :port supported)");
          if (!raw) return;
          const lines = raw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (!lines.length) return;
          let added = 0;
          for (const line of lines) {
            try {
              const [domain, port] = line.split(":");
              const created = await window.OggoAPI.createSslMonitor({
                domain: String(domain || "").trim(),
                port: Number(port || 443),
                checkInterval: "daily",
                thresholds: [30, 14, 7, 1],
                channels: [],
              });
              await window.OggoAPI.checkSslMonitor(created.id);
              added += 1;
            } catch (_error) {}
          }
          toast(`Added ${added}/${lines.length} SSL monitor(s)`, added ? "success" : "error");
          await rerenderDevtools();
        };
      }
      el("app-content").onclick = async (event) => {
        const checkId = event.target.closest("[data-ssl-check]")?.dataset?.sslCheck;
        const deleteId = event.target.closest("[data-ssl-delete]")?.dataset?.sslDelete;
        if (!checkId && !deleteId) return;
        try {
          if (checkId) {
            await window.OggoAPI.checkSslMonitor(checkId);
            toast("SSL check completed", "success");
          }
          if (deleteId) {
            if (!confirm("Delete this SSL monitor?")) return;
            await window.OggoAPI.deleteSslMonitor(deleteId);
            toast("SSL monitor deleted", "success");
          }
          await rerenderDevtools();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }

    if (state.view === "dns-monitor") {
      const dnsLookupBtn = el("dns-lookup-btn");
      if (dnsLookupBtn) {
        dnsLookupBtn.onclick = async () => {
          const domain = String(el("dns-lookup-domain")?.value || "").trim();
          const recordType = String(el("dns-lookup-type")?.value || "ALL");
          if (!domain) return;
          try {
            const result = await window.OggoAPI.dnsLookup({ domain, recordType });
            const resultNode = el("dns-lookup-result");
            if (resultNode) {
              resultNode.textContent = JSON.stringify(result).slice(0, 240);
              resultNode.title = JSON.stringify(result, null, 2);
            }
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      const dnsForm = el("dns-monitor-form");
      if (dnsForm) {
        dnsForm.onsubmit = async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          try {
            const created = await window.OggoAPI.createDnsMonitor({
              domain: String(form.get("domain") || "").trim(),
              recordType: form.get("recordType") || "A",
              expectedValue: String(form.get("expectedValue") || "").trim(),
              checkInterval: form.get("checkInterval") || "hourly",
              channels: [],
            });
            await window.OggoAPI.checkDnsMonitor(created.id);
            toast("DNS monitor added", "success");
            await rerenderDevtools();
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      el("app-content").onclick = async (event) => {
        const checkId = event.target.closest("[data-dns-check]")?.dataset?.dnsCheck;
        const deleteId = event.target.closest("[data-dns-delete]")?.dataset?.dnsDelete;
        if (!checkId && !deleteId) return;
        try {
          if (checkId) {
            await window.OggoAPI.checkDnsMonitor(checkId);
            toast("DNS check completed", "success");
          }
          if (deleteId) {
            if (!confirm("Delete this DNS monitor?")) return;
            await window.OggoAPI.deleteDnsMonitor(deleteId);
            toast("DNS monitor deleted", "success");
          }
          await rerenderDevtools();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }

    if (state.view === "port-scanner") {
      const portForm = el("port-monitor-form");
      if (portForm) {
        portForm.onsubmit = async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          try {
            const created = await window.OggoAPI.createPortMonitor({
              name: String(form.get("name") || "").trim(),
              host: String(form.get("host") || "").trim(),
              port: Number(form.get("port") || 0),
              protocol: String(form.get("protocol") || "tcp"),
              checkInterval: form.get("checkInterval") || "hourly",
              channels: [],
            });
            await window.OggoAPI.checkPortMonitor(created.id);
            toast("Port monitor added", "success");
            await rerenderDevtools();
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      el("app-content").onclick = async (event) => {
        const checkId = event.target.closest("[data-port-check]")?.dataset?.portCheck;
        const deleteId = event.target.closest("[data-port-delete]")?.dataset?.portDelete;
        if (!checkId && !deleteId) return;
        try {
          if (checkId) {
            await window.OggoAPI.checkPortMonitor(checkId);
            toast("Port check completed", "success");
          }
          if (deleteId) {
            if (!confirm("Delete this port monitor?")) return;
            await window.OggoAPI.deletePortMonitor(deleteId);
            toast("Port monitor deleted", "success");
          }
          await rerenderDevtools();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }

    if (state.view === "env-vars") {
      const envForm = el("env-var-form");
      if (envForm) {
        envForm.onsubmit = async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          try {
            await window.OggoAPI.createEnvVar({
              name: String(form.get("name") || "").trim().toUpperCase(),
              description: String(form.get("description") || "").trim(),
              sourceType: form.get("sourceType") || "manual",
              value: String(form.get("value") || ""),
              secretRef: String(form.get("secretRef") || "").trim(),
              scopeType: form.get("scopeType") || "global",
              sensitive: true,
            });
            toast("Environment variable saved", "success");
            await rerenderDevtools();
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      el("app-content").onclick = async (event) => {
        const deleteId = event.target.closest("[data-env-delete]")?.dataset?.envDelete;
        if (!deleteId) return;
        try {
          if (!confirm("Delete this environment variable?")) return;
          await window.OggoAPI.deleteEnvVar(deleteId);
          toast("Variable deleted", "success");
          await rerenderDevtools();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }

    if (state.view === "health-checks" || state.view === "http-checks") {
      const httpForm = el("http-check-form");
      if (httpForm) {
        httpForm.onsubmit = async (event) => {
          event.preventDefault();
          const form = new FormData(event.target);
          const statusCode = Number(form.get("statusCode") || 0);
          try {
            const created = await window.OggoAPI.createHttpCheck({
              name: String(form.get("name") || "").trim(),
              url: String(form.get("url") || "").trim(),
              method: form.get("method") || "GET",
              timeoutSeconds: Number(form.get("timeoutSeconds") || 10),
              assertions: statusCode ? { statusCode } : {},
              channels: [],
            });
            await window.OggoAPI.runHttpCheck(created.id);
            toast("HTTP check added", "success");
            await rerenderDevtools();
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }
      el("app-content").onclick = async (event) => {
        const checkId = event.target.closest("[data-http-check]")?.dataset?.httpCheck;
        const deleteId = event.target.closest("[data-http-delete]")?.dataset?.httpDelete;
        if (!checkId && !deleteId) return;
        try {
          if (checkId) {
            await window.OggoAPI.runHttpCheck(checkId);
            toast("HTTP check completed", "success");
          }
          if (deleteId) {
            if (!confirm("Delete this HTTP check?")) return;
            await window.OggoAPI.deleteHttpCheck(deleteId);
            toast("HTTP check deleted", "success");
          }
          await rerenderDevtools();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }
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
