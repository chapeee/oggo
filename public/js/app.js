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
    aws: "all-workspaces",
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
  packageOps: [],
  packageRowOps: {},
  packageCollapsed: {},
  packageSelected: {},
  packageLastSelectedByManager: {},
  packageScanInProgress: false,
  packageSectionScanningManager: "",
  packageScanTerminal: [],
  packageScanProgress: { completed: 0, total: 0 },
  packageStatDisplay: { totalPackages: 0, updatesAvailable: 0, vulnerabilities: 0 },
  packagePanel: { type: "", key: "", loading: false, data: null, manager: "", packageName: "", version: "" },
  packageHistoryPanel: { open: false, filter: "all", search: "", limit: 100 },
  packageUpdatedToday: {},
  packageDescCache: {},
  packageAutoScanTimer: null,
  packageAutoScanLastRunAt: 0,
  installerTab: "catalog",
  installerOutput: null,
  awsConnections: [],
  awsRegions: [],
  awsActiveConnectionId: "",
  awsViewData: [],
  workspaces: [],
  activeWorkspaceId: "",
  workspaceDetail: null,
  workspaceServiceTesting: {},
  workspaceSwitcherOpen: false,
  globalSearch: {
    open: false,
    query: "",
    selectedIndex: 0,
    flatResults: [],
    groupedResults: [],
    indexBuiltAt: null,
    indexItems: [],
    recent: JSON.parse(localStorage.getItem("oggo.globalSearch.recent") || "[]"),
    pinned: JSON.parse(localStorage.getItem("oggo.globalSearch.pinned") || "[]"),
  },
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
  terminalGui: {
    activeTab: "files",
    path: "~",
    showHidden: false,
    search: "",
    splitByServer: {},
    files: null,
    editor: null,
    processes: null,
    services: null,
    logs: { sources: [], selected: "", content: "" },
    disk: null,
    network: null,
    loading: false,
  },
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
      { view: "servers", label: "Server Inventory", icon: "users", badge: () => String(state.servers.length || 0) },
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
    items: [],
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
  workspaces: "aws",
  "all-workspaces": "aws",
  "workspace-detail": "aws",
  "aws-cloudwatch": "aws",
  "aws-rds": "aws",
  "aws-ec2": "aws",
  "aws-lambda": "aws",
  "aws-secrets": "aws",
  settings: "settings",
};

let terminalInstance = null;
let terminalSocket = null;
let terminalSessionId = null;
let terminalSocketServerId = null;
let terminalFitAddon = null;
let terminalSearchAddon = null;
let monacoLoadPromise = null;
let guiMonacoEditor = null;
let terminalGuiReady = false;
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

async function openSimpleModal(options = {}) {
  return new Promise((resolve) => {
    const modal = el("job-modal");
    const body = el("job-modal-body");
    const title = options.title || "Confirm";
    const message = options.message || "";
    const showInput = Boolean(options.input);
    const inputType = options.inputType || "text";
    const inputPlaceholder = options.inputPlaceholder || "";
    const inputValue = options.inputValue || "";
    const okLabel = options.okLabel || "Confirm";
    const cancelLabel = options.cancelLabel || "Cancel";
    const danger = Boolean(options.danger);
    body.innerHTML = `
      <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${escapeHtml(title)}</h3>
        <button type="button" id="simple-modal-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <div class="p-6">
        <p class="text-sm text-gray-500 dark:text-gray-300">${escapeHtml(message)}</p>
        ${showInput ? `<input id="simple-modal-input" class="input mt-3" type="${escapeHtml(inputType)}" placeholder="${escapeHtml(inputPlaceholder)}" value="${escapeHtml(inputValue)}" />` : ""}
        <div class="pt-4 flex gap-2 justify-end">
          <button id="simple-modal-cancel" class="btn-secondary">${escapeHtml(cancelLabel)}</button>
          <button id="simple-modal-ok" class="${danger ? "btn-danger" : "btn-primary"}">${escapeHtml(okLabel)}</button>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
    const close = (result) => {
      modal.classList.add("hidden");
      resolve(result);
    };
    el("simple-modal-close").onclick = () => close({ ok: false });
    el("simple-modal-cancel").onclick = () => close({ ok: false });
    el("simple-modal-ok").onclick = () => {
      close({
        ok: true,
        value: showInput ? String(el("simple-modal-input")?.value || "") : "",
      });
    };
    if (showInput && el("simple-modal-input")) {
      const input = el("simple-modal-input");
      input.focus();
      input.select();
      input.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          el("simple-modal-ok").click();
        }
      };
    }
  });
}

async function uiConfirm(message, options = {}) {
  const result = await openSimpleModal({
    title: options.title || "Confirm Action",
    message,
    okLabel: options.okLabel || "Confirm",
    cancelLabel: options.cancelLabel || "Cancel",
    danger: options.danger !== false,
  });
  return Boolean(result?.ok);
}

async function uiPrompt(message, options = {}) {
  const result = await openSimpleModal({
    title: options.title || "Input Required",
    message,
    okLabel: options.okLabel || "Continue",
    cancelLabel: options.cancelLabel || "Cancel",
    input: true,
    inputType: options.inputType || "text",
    inputPlaceholder: options.placeholder || "",
    inputValue: options.defaultValue || "",
    danger: false,
  });
  if (!result?.ok) return null;
  return String(result.value || "");
}

function isPermissionDeniedError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("permission denied") || msg.includes("eacces") || msg.includes("not permitted");
}

function promptSudoAuth() {
  const modal = el("sudo-modal");
  const userInput = el("sudo-user");
  const passInput = el("sudo-password");
  const cancelBtn = el("sudo-cancel");
  const closeBtn = el("sudo-close");
  const confirmBtn = el("sudo-confirm");
  if (!modal || !passInput || !cancelBtn || !confirmBtn) {
    return Promise.resolve(null);
  }
  modal.classList.remove("hidden");
  passInput.value = "";
  if (userInput) userInput.value = "";
  passInput.focus();
  return new Promise((resolve) => {
    const cleanup = () => {
      modal.classList.add("hidden");
      cancelBtn.onclick = null;
      confirmBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      modal.onclick = null;
      passInput.onkeydown = null;
    };
    const accept = () => {
      const sudoUser = String(userInput?.value || "").trim();
      const sudoPassword = String(passInput.value || "");
      cleanup();
      resolve({ sudoUser, sudoPassword });
    };
    const cancel = () => {
      cleanup();
      resolve(null);
    };
    cancelBtn.onclick = cancel;
    if (closeBtn) closeBtn.onclick = cancel;
    modal.onclick = (e) => {
      if (e.target === modal) cancel();
    };
    confirmBtn.onclick = accept;
    passInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        accept();
      }
      if (e.key === "Escape") cancel();
    };
  });
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

function updateTopWorkspaceSwitcher() {
  const switcher = el("top-workspace-switcher");
  if (!switcher) return;
  const show =
    state.navSection === "aws" &&
    ["workspaces", "all-workspaces", "workspace-detail", "s3-browser", "aws-cloudwatch", "aws-rds", "aws-ec2", "aws-lambda", "aws-secrets"].includes(state.view);
  switcher.classList.toggle("hidden", !show);
  if (!show) return;
  if (window.WorkspacesPage?.renderWorkspaceSwitcher) {
    switcher.innerHTML = window.WorkspacesPage.renderWorkspaceSwitcher(
      state.workspaces || [],
      state.activeWorkspaceId
    );
    return;
  }
  switcher.innerHTML = (state.workspaces || [])
    .map((workspace) => `<option value="${workspace.id}" ${workspace.id === state.activeWorkspaceId ? "selected" : ""}>${workspace.name}</option>`)
    .join("");
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
    const items = state.navSection === "aws" ? getAwsContextItems() : NAV_STRUCTURE[state.navSection]?.items || [];
    const item = items.find(
      (entry) =>
        (entry.workspaceId && state.view === "workspace-detail" && entry.workspaceId === state.activeWorkspaceId) ||
        (!entry.workspaceId && entry.view === state.view)
    );
    breadcrumb.textContent = `${sectionTitle} / ${item?.label || state.view}`;
  }
  updateTopWorkspaceSwitcher();
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

function getAwsContextItems() {
  const workspaceItems = (state.workspaces || []).map((workspace) => ({
    view: "workspace-detail",
    workspaceId: workspace.id,
    label: workspace.name,
    icon: "circle",
    iconClass: "text-xs",
    color: workspace.color || "#f97316",
    badge: workspace.total_services ? String(workspace.total_services) : "",
  }));
  return [
    { view: "all-workspaces", label: "All Workspaces", icon: "folders", badge: String(state.workspaces.length || 0) },
    ...workspaceItems,
    { view: "aws-connections", label: "AWS Connections", icon: "key-round", badge: state.awsConnections.length ? String(state.awsConnections.length) : "setup" },
    { action: "new-workspace", label: "New Workspace", icon: "plus-circle", secondary: true },
  ];
}

function renderNavContext() {
  const context = el("nav-context");
  const titleNode = el("context-title");
  const listNode = el("context-list");
  if (!context || !titleNode || !listNode) return;
  const section = NAV_STRUCTURE[state.navSection] || NAV_STRUCTURE.dashboard;
  const items = state.navSection === "aws" ? getAwsContextItems() : section.items;
  titleNode.textContent = section.title.toUpperCase();
  context.classList.toggle("collapsed", state.contextCollapsed);

  listNode.innerHTML = items
    .map((item) => {
      const isActive =
        (item.workspaceId && state.view === "workspace-detail" && state.activeWorkspaceId === item.workspaceId) ||
        (!item.workspaceId && item.view === state.view);
      const badge = typeof item.badge === "function" ? item.badge() : item.badge;
      const icon = item.workspaceId
        ? `<span class="inline-flex w-2 h-2 rounded-full" style="background:${item.color || "#f97316"}"></span>`
        : `<i data-lucide="${item.icon}" class="w-4 h-4 ${item.iconClass || ""}"></i>`;
      return `
        <button class="context-item ${isActive ? "active" : ""} ${item.secondary ? "opacity-85" : ""}" ${
          item.view ? `data-context-view="${item.view}"` : ""
        } ${item.action ? `data-context-action="${item.action}"` : ""} ${
          item.workspaceId ? `data-context-workspace-id="${item.workspaceId}"` : ""
        }>
          <span class="flex items-center gap-2">${icon}${item.label}</span>
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
      <div data-s3-folder-open="${folder.key}" class="s3-card s3-folder-card group relative text-left bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-lg p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-orange-500/50 transition-all cursor-pointer">
        <div class="aspect-[4/3] rounded-md bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center mb-2 border border-gray-100 dark:border-gray-800 group-hover:bg-orange-50/50 dark:group-hover:bg-orange-500/5 transition-colors">
          <i data-lucide="folder" class="w-10 h-10 text-amber-400/70 group-hover:text-amber-400 transition-colors fill-amber-400/10 group-hover:fill-amber-400/20"></i>
        </div>
        <div class="px-1">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200 truncate group-hover:text-orange-500 transition-colors">${escapeHtml(label)}</div>
          <div class="text-xs text-gray-500 mt-0.5">Folder</div>
        </div>
      </div>`;
    })
    .join("");
  const uploadCards = uploads
    .map((u) => `
      <div class="s3-card bg-white dark:bg-gray-800/40 border border-orange-400/50 rounded-lg p-2.5 relative overflow-hidden">
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" style="height:${Math.min(100, Math.max(0, u.progress || 0))}%"></div>
        <div class="aspect-[4/3] rounded-md bg-orange-50 dark:bg-orange-500/5 flex items-center justify-center mb-2 border border-orange-100 dark:border-orange-500/10">
          <i data-lucide="upload-cloud" class="w-10 h-10 text-orange-400/70 animate-pulse"></i>
        </div>
        <div class="px-1">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">${escapeHtml(u.name)}</div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-0.5">
            <span class="text-orange-500 font-medium">${u.status === "failed" ? "Failed" : `${Math.round(u.progress || 0)}%`}</span>
            <span>${formatBytes(u.size)}</span>
          </div>
        </div>
      </div>`)
    .join("");
  const fileCards = visibleFiles
    .map((file) => {
      const ext = getFileExt(file.name || file.key);
      const visual = getS3TypeVisual(file);
      const selected = state.s3Browser.selectedKeys.includes(file.key);
      return `
      <div class="s3-card s3-file-card group relative bg-white dark:bg-gray-800/40 border ${selected ? "border-orange-500 bg-orange-50/50 dark:bg-orange-500/5 ring-1 ring-orange-500/40 s3-selected" : "border-gray-200 dark:border-gray-700/60"} rounded-lg p-2.5 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer" data-s3-row-select="${file.key}">
        <label class="absolute top-3 left-3 z-20 s3-select-checkbox opacity-0 group-hover:opacity-100 transition-opacity ${selected ? "opacity-100" : ""}">
          <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-800" data-s3-select="${file.key}" ${selected ? "checked" : ""} />
        </label>
        <div class="aspect-[4/3] rounded-md ${visual.bgClass} flex items-center justify-center mb-2 relative overflow-hidden border border-gray-100 dark:border-gray-800">
          ${
            file.category === "images"
              ? `<div class="s3-thumb-skeleton absolute inset-0"></div>
                 <img data-s3-thumb="${file.key}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover opacity-0 transition-opacity" loading="lazy" />
                 <div data-s3-thumb-fallback class="text-xl font-bold uppercase tracking-wider text-gray-400/50 dark:text-gray-500/50">${escapeHtml(ext || "IMG")}</div>`
              : `<i data-lucide="${visual.icon}" class="w-10 h-10 opacity-70"></i>`
          }
          <div class="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
            <button data-s3-preview="${file.key}" class="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors" title="Preview"><i data-lucide="eye" class="w-4 h-4"></i></button>
            <button data-s3-download="${file.key}" class="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors" title="Download"><i data-lucide="download" class="w-4 h-4"></i></button>
            <button data-s3-delete-file="${file.key}" class="p-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </div>
        <div class="px-1">
          <div class="text-sm font-medium text-gray-900 dark:text-gray-200 truncate" title="${escapeHtml(file.name)}">${highlightSearch(file.name, query)}</div>
          <div class="flex items-center justify-between text-xs text-gray-500 mt-0.5">
            <span>${formatBytes(file.size)}</span>
            <span class="uppercase text-[10px] tracking-wider font-semibold ${visual.badgeClass}">${escapeHtml(visual.badgeText)}</span>
          </div>
        </div>
      </div>`;
    })
    .join("");
  const listRows = [
    ...(state.s3Browser.folders || []).map((folder) => `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors" data-s3-folder-open="${folder.key}">
        <td class="py-3 px-4"><input type="checkbox" disabled class="rounded border-gray-300 bg-gray-100 dark:bg-gray-800 opacity-50" /></td>
        <td class="py-3 px-4">
          <button data-s3-folder="${folder.key}" class="text-gray-900 dark:text-gray-200 group-hover:text-orange-500 font-medium flex items-center gap-2.5 transition-colors">
            <i data-lucide="folder" class="w-4 h-4 text-amber-400 fill-amber-400/20"></i>
            ${escapeHtml(folder.key.replace(state.s3Browser.prefix || "", "").replace(/\/$/, "") || "/")}
          </button>
        </td>
        <td class="py-3 px-4 text-gray-500">Folder</td><td class="py-3 px-4 text-gray-500">-</td><td class="py-3 px-4 text-gray-500">-</td><td class="py-3 px-4 text-gray-500">-</td><td class="py-3 px-4 text-right">-</td>
      </tr>
    `),
    ...uploads.map(
      (u) => `
      <tr class="bg-orange-50/50 dark:bg-orange-500/5">
        <td class="py-3 px-4"><input type="checkbox" disabled class="rounded border-gray-300 bg-gray-100 dark:bg-gray-800 opacity-50" /></td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <span class="inline-flex w-8 h-8 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-500/10 text-orange-500"><i data-lucide="upload-cloud" class="w-4 h-4 animate-pulse"></i></span>
            <div class="flex flex-col">
              <span class="truncate max-w-[280px] font-medium text-gray-900 dark:text-gray-200">${escapeHtml(u.name)}</span>
              <div class="w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden"><div class="h-full bg-orange-500 rounded-full" style="width:${Math.round(u.progress || 0)}%"></div></div>
            </div>
            <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded text-orange-500 ml-2">${Math.round(u.progress || 0)}%</span>
          </div>
        </td>
        <td class="py-3 px-4 text-gray-500">Uploading</td>
        <td class="py-3 px-4 text-gray-500">${formatBytes(u.size)}</td>
        <td class="py-3 px-4 text-gray-500">-</td>
        <td class="py-3 px-4 text-gray-500">-</td>
        <td class="py-3 px-4 text-right">-</td>
      </tr>`
    ),
    ...visibleFiles.map((file) => {
      const selected = state.s3Browser.selectedKeys.includes(file.key);
      const visual = getS3TypeVisual(file);
      const ext = getFileExt(file.name || file.key);
      return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group ${selected ? "bg-orange-50/50 dark:bg-orange-500/5" : ""}" data-s3-row-select="${file.key}">
        <td class="py-3 px-4"><input type="checkbox" class="rounded border-gray-300 text-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-800" data-s3-select="${file.key}" ${selected ? "checked" : ""}></td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <span class="inline-flex w-8 h-8 items-center justify-center rounded-md overflow-hidden ${visual.bgClass} border border-gray-100 dark:border-gray-700/50">
              ${
                file.category === "images"
                  ? `<img data-s3-thumb="${file.key}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover opacity-0 transition-opacity" loading="lazy" /><span data-s3-thumb-fallback class="text-[9px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-500">${escapeHtml(ext || "IMG")}</span>`
                  : `<i data-lucide="${visual.icon}" class="w-4 h-4 opacity-70"></i>`
              }
            </span>
            <span class="truncate max-w-[280px] font-medium text-gray-900 dark:text-gray-200 group-hover:text-orange-500 transition-colors">${highlightSearch(file.name, query)}</span>
            <span class="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase ${visual.badgeClass}">${escapeHtml(visual.badgeText)}</span>
          </div>
        </td>
        <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${getS3TypeLabel(file.category)}</td>
        <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${formatBytes(file.size)}</td>
        <td class="py-3 px-4 text-gray-600 dark:text-gray-400">${formatS3Modified(file.lastModified)}</td>
        <td class="py-3 px-4 text-gray-600 dark:text-gray-400"><span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-medium tracking-wide">${file.storageClass || "STANDARD"}</span></td>
        <td class="py-3 px-4 text-right s3-row-actions">
          <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button data-s3-preview="${file.key}" class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="Preview"><i data-lucide="eye" class="w-4 h-4"></i></button>
            <button data-s3-copy-url="${file.key}" class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="Copy URL"><i data-lucide="link" class="w-4 h-4"></i></button>
            <button data-s3-download="${file.key}" class="p-1.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors" title="Download"><i data-lucide="download" class="w-4 h-4"></i></button>
            <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
            <button data-s3-delete-file="${file.key}" class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </td>
      </tr>`;
    }),
  ].join("");
  return `
    <div class="flex flex-col border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] rounded-xl overflow-hidden mb-4 shadow-sm">
      <!-- Top Toolbar -->
      <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
        <div class="flex items-center gap-1 text-sm font-medium">
          <button id="s3-go-up" class="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><i data-lucide="corner-up-left" class="w-4 h-4"></i></button>
          <div class="flex items-center px-2">
            ${breadcrumbs
              .map((part, i) => `<button data-s3-breadcrumb="${i}" class="px-1.5 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">${part}</button>`)
              .join(`<span class="text-gray-400 dark:text-gray-600 mx-0.5">/</span>`)}
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <div class="relative group hidden sm:block">
            <i data-lucide="search" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors"></i>
            <input id="s3-browser-search" value="${escapeHtml(state.s3Browser.search || "")}" placeholder="Search files..." class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm rounded-md pl-8 pr-6 py-1.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 w-56 transition-all placeholder:text-gray-400" />
            ${state.s3Browser.search ? '<button id="s3-clear-search" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>' : ""}
          </div>
          <div class="h-4 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block mx-0.5"></div>
          <div class="flex items-center bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
            <button data-s3-view="grid" class="p-1 rounded flex items-center justify-center transition-all ${state.s3Browser.viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow-sm text-orange-500" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}"><i data-lucide="layout-grid" class="w-4 h-4"></i></button>
            <button data-s3-view="list" class="p-1 rounded flex items-center justify-center transition-all ${state.s3Browser.viewMode === "list" ? "bg-white dark:bg-gray-700 shadow-sm text-orange-500" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}"><i data-lucide="list" class="w-4 h-4"></i></button>
          </div>
          <div class="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
          <button id="s3-create-folder" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors shadow-sm"><i data-lucide="folder-plus" class="w-4 h-4 text-gray-500"></i><span class="hidden sm:inline">New folder</span></button>
          <input id="s3-upload-file" type="file" class="hidden" multiple />
          <button id="s3-upload-btn" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors shadow-sm"><i data-lucide="upload-cloud" class="w-4 h-4"></i><span class="hidden sm:inline">Upload</span></button>
        </div>
      </div>

      <!-- Filter & Sort Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-800 text-sm gap-3 sm:gap-0">
        <div class="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
          ${pills
            .map(([key, label]) => `<button data-s3-type="${key}" class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${state.s3Browser.typeFilter === key ? "bg-orange-500/10 text-orange-500" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}">${label}</button>`)
            .join("")}
        </div>
        <div class="flex items-center gap-3 text-xs pl-1">
          <label class="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer select-none">
            <input id="s3-recursive-search" type="checkbox" class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 bg-transparent" ${state.s3Browser.recursiveSearch ? "checked" : ""}/> 
            Recursive
          </label>
          <div class="h-3 w-px bg-gray-300 dark:bg-gray-700"></div>
          <div class="flex items-center relative group">
            <select id="s3-sort-by" class="bg-transparent border-none text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 focus:ring-0 py-1 pl-2 pr-6 cursor-pointer text-xs font-medium appearance-none outline-none">
              <option value="date" class="dark:bg-gray-800" ${state.s3Browser.sortBy === "date" ? "selected" : ""}>Date modified</option>
              <option value="name" class="dark:bg-gray-800" ${state.s3Browser.sortBy === "name" ? "selected" : ""}>Name</option>
              <option value="size" class="dark:bg-gray-800" ${state.s3Browser.sortBy === "size" ? "selected" : ""}>Size</option>
              <option value="type" class="dark:bg-gray-800" ${state.s3Browser.sortBy === "type" ? "selected" : ""}>Type</option>
              <option value="storage" class="dark:bg-gray-800" ${state.s3Browser.sortBy === "storage" ? "selected" : ""}>Storage class</option>
            </select>
            <i data-lucide="chevron-down" class="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"></i>
          </div>
          <button id="s3-sort-dir" class="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"><i data-lucide="${state.s3Browser.sortDir === "asc" ? "arrow-up" : "arrow-down"}" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="flex items-center justify-between px-4 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-[#0a0f16]">
        <span>${visibleFiles.length} items found</span>
        <div class="flex items-center gap-5">
          <span>Total size: ${formatBytes(filesTotalSize)}</span>
          <span class="hidden sm:inline">Storage class: ${storageClass}</span>
        </div>
      </div>
    </div>
      <div id="s3-folder-inline-create" class="hidden bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center gap-2 mb-4 shadow-sm">
        <input id="s3-new-folder-input" class="input flex-1" placeholder="New folder name" />
        <button id="s3-create-folder-confirm" class="btn-primary text-xs px-4 py-1.5">Create</button>
        <button id="s3-create-folder-cancel" class="btn-secondary text-xs px-4 py-1.5">Cancel</button>
      </div>
      ${
        state.s3Browser.viewMode === "grid"
          ? `<div id="s3-drop-area" class="relative min-h-[320px] bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
               <div id="s3-drop-overlay" class="s3-drop-overlay hidden rounded-xl backdrop-blur-sm"><div><i data-lucide="upload-cloud" class="w-8 h-8 mx-auto mb-2 text-orange-500"></i><span class="font-medium text-gray-700 dark:text-gray-200">Drop files to upload into this folder</span></div></div>
               <div class="s3-grid ${getS3GridSizeClass()}">
                 ${folderCards}${uploadCards}${fileCards}
               </div>
               ${
                 !folderCards && !fileCards && !uploadCards
                   ? `<div class="py-20 text-center text-gray-500 dark:text-gray-400">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center border border-gray-100 dark:border-gray-800">
                          <i data-lucide="folder-open" class="w-8 h-8 text-gray-400"></i>
                        </div>
                        <h3 class="text-base font-medium text-gray-900 dark:text-gray-200">This folder is empty</h3>
                        <p class="text-sm mt-1 max-w-sm mx-auto">Drag files here or click Upload to add files.</p>
                        <button id="s3-empty-upload-btn" class="btn-primary mt-6"><i data-lucide="upload-cloud" class="w-4 h-4 mr-2"></i>Upload Files</button>
                      </div>`
                   : ""
               }
             </div>`
          : `<div id="s3-drop-area" class="relative overflow-x-auto bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
               <div id="s3-drop-overlay" class="s3-drop-overlay hidden rounded-xl backdrop-blur-sm"><div><i data-lucide="upload-cloud" class="w-8 h-8 mx-auto mb-2 text-orange-500"></i><span class="font-medium text-gray-700 dark:text-gray-200">Drop files to upload into this folder</span></div></div>
               <table class="w-full text-sm">
                 <thead class="text-left text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-[#0a0f16] border-b border-gray-200 dark:border-gray-800">
                   <tr><th class="py-3 px-4 font-medium"><input id="s3-select-all" type="checkbox" class="rounded border-gray-300 text-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-800"></th><th class="py-3 px-4 font-medium">Name</th><th class="py-3 px-4 font-medium">Type</th><th class="py-3 px-4 font-medium">Size</th><th class="py-3 px-4 font-medium">Modified</th><th class="py-3 px-4 font-medium">Storage class</th><th class="py-3 px-4 font-medium text-right">Actions</th></tr>
                 </thead>
                 <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">${listRows || `<tr><td colspan="7" class="py-12 text-center text-gray-500"><div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center border border-gray-100 dark:border-gray-800"><i data-lucide="folder-open" class="w-5 h-5 text-gray-400"></i></div><p>This folder is empty</p></td></tr>`}</tbody>
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

function formatWorkspaceServicesSummary(counts = {}) {
  const items = [
    ["s3", "S3"],
    ["rds", "RDS"],
    ["ec2", "EC2"],
    ["lambda", "Lambda"],
    ["sns", "SNS"],
    ["ses", "SES"],
    ["cloudwatch", "CloudWatch"],
    ["secrets", "Secrets"],
  ]
    .filter(([key]) => Number(counts[key] || 0) > 0)
    .map(([key, label]) => `${counts[key]} ${label}`);
  return items.length ? items.join(" · ") : "No services attached";
}

const WORKSPACE_SERVICE_META = {
  s3: { label: "S3 Buckets", icon: "database", resourceLabel: "Bucket" },
  sns: { label: "SNS Topics", icon: "bell-ring", resourceLabel: "Topic ARN" },
  ses: { label: "SES Identities", icon: "mail", resourceLabel: "Identity" },
  cloudwatch: { label: "CloudWatch", icon: "scroll-text", resourceLabel: "Log group / prefix" },
  rds: { label: "RDS", icon: "database-zap", resourceLabel: "Instance endpoint" },
  ec2: { label: "EC2", icon: "server-cog", resourceLabel: "Instance ID" },
  lambda: { label: "Lambda", icon: "function-square", resourceLabel: "Function" },
  secrets: { label: "Secrets Manager", icon: "vault", resourceLabel: "Secret ARN / name" },
};

function workspaceStatusDot(status) {
  const s = String(status || "untested").toLowerCase();
  if (s === "ok") return `<span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>`;
  if (s === "error") return `<span class="inline-block w-2 h-2 rounded-full bg-red-500" title="Last test failed"></span>`;
  return `<span class="inline-block w-2 h-2 rounded-full bg-gray-400"></span>`;
}

function workspacesOverviewHtml() {
  const cards = (state.workspaces || [])
    .map((workspace) => {
      const healthError = Number(workspace?.health?.error || 0) > 0;
      const summary = formatWorkspaceServicesSummary(workspace.serviceCounts || workspace.service_counts || {});
      return `
        <div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm" style="border-left:3px solid ${workspace.color || "#f97316"};">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(workspace.name)}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(workspace.description || "No description")}</p>
              <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">Region: <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${escapeHtml(workspace.defaultRegion || workspace.default_region || "us-east-1")}</span></p>
            </div>
            <span class="inline-flex items-center text-[11px] px-2 py-1 rounded-full ${healthError ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-500"}">${healthError ? "Issues" : "Healthy"}</span>
          </div>
          <p class="text-xs mt-3 text-gray-600 dark:text-gray-300">${escapeHtml(summary)}</p>
          <p class="text-xs mt-1 text-gray-500 dark:text-gray-400">Last activity: ${timeAgo(workspace.updatedAt || workspace.updated_at || workspace.created_at)}</p>
          <div class="mt-4 flex items-center gap-2">
            <button data-workspace-open="${workspace.id}" class="btn-secondary text-xs">Open</button>
            <button data-workspace-edit="${workspace.id}" class="btn-secondary text-xs">Edit</button>
            <button data-workspace-delete="${workspace.id}" class="text-red-600 dark:text-red-400 text-sm">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">All Workspaces</h2>
      <button id="add-workspace-btn" class="btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>New Workspace</button>
    </div>
    ${
      state.workspaces.length
        ? `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
        : `<div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
             <i data-lucide="folders" class="w-10 h-10 text-gray-400 mx-auto"></i>
             <h3 class="mt-3 text-lg font-semibold">No workspaces yet</h3>
             <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a workspace to group AWS services by project.</p>
             <button id="add-workspace-btn-empty" class="btn-primary mt-4">Create Workspace</button>
           </div>`
    }
  `;
}

function workspaceDetailHtml() {
  const workspace = state.workspaceDetail;
  if (!workspace) {
    return `<div class="panel"><p class="text-sm text-gray-500">Workspace not found.</p></div>`;
  }
  const services = workspace.services || {};
  const serviceSections = Object.keys(WORKSPACE_SERVICE_META).map((key) => ({ key, ...WORKSPACE_SERVICE_META[key] }));

  return `
    <div class="space-y-4">
      <div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm" style="border-left:3px solid ${workspace.color || "#f97316"};">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-semibold">${escapeHtml(workspace.name)}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(workspace.description || "No description")}</p>
            <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">Region: <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${escapeHtml(workspace.defaultRegion || workspace.default_region || "us-east-1")}</span></p>
          </div>
          <div class="flex items-center gap-2">
            <button data-workspace-edit="${workspace.id}" class="btn-secondary text-xs">Edit</button>
            <button data-workspace-delete="${workspace.id}" class="text-red-600 dark:text-red-400 text-sm">Delete</button>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Default credentials</h3>
          <button class="btn-secondary text-xs" data-workspace-default-credentials="1">Edit defaults</button>
        </div>
        <p class="text-xs text-gray-500 mt-1">These credentials can be reused when adding services. They are stored encrypted.</p>
        <div class="text-xs mt-2 ${workspace.hasDefaultCredentials ? "text-green-500" : "text-gray-500"}">${workspace.hasDefaultCredentials ? "Configured" : "Not configured"}</div>
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        ${serviceSections
          .map((section) => {
            const rows = services[section.key] || [];
            if (!rows.length) {
              return `<div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="font-semibold flex items-center gap-2"><i data-lucide="${section.icon}" class="w-4 h-4"></i>${section.label}</h3>
                    <p class="text-xs text-gray-500 mt-1">No services attached yet.</p>
                  </div>
                  <button data-workspace-add-service="${section.key}" class="btn-secondary text-xs">Add</button>
                </div>
                <p class="text-xs text-gray-500 mt-3">Attach ${section.label.toLowerCase()} with per-service credentials.</p>
              </div>`;
            }
            return `<div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold flex items-center gap-2"><i data-lucide="${section.icon}" class="w-4 h-4"></i>${section.label}</h3>
                  <p class="text-xs text-gray-500 mt-1">${rows.length} attached</p>
                </div>
                <button data-workspace-add-service="${section.key}" class="btn-secondary text-xs">Add</button>
              </div>
              <div class="mt-3 space-y-2">
                ${rows.map((row) => `<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-sm">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="font-medium">${escapeHtml(row.friendlyName || row.friendly_name || "Service")}</div>
                        <div class="text-xs text-gray-500 mt-1 font-mono truncate max-w-[340px]" title="${escapeHtml(row.resourceIdentifier || row.resource_identifier || "")}">${escapeHtml(row.resourceIdentifier || row.resource_identifier || "")}</div>
                        <div class="text-xs text-gray-500 mt-1">
                          <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${escapeHtml(row.region || "us-east-1")}</span>
                          <span class="ml-2 inline-flex items-center gap-1">${workspaceStatusDot(row.status)} ${escapeHtml((row.status || "untested").toLowerCase())}</span>
                          ${row.lastTestedAt ? `<span class="ml-2">Tested ${timeAgo(row.lastTestedAt)}</span>` : ""}
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <button class="btn-secondary text-xs" data-workspace-service-test="${row.id}">${state.workspaceServiceTesting[row.id] ? "Testing..." : "Test"}</button>
                        <button class="btn-secondary text-xs" data-workspace-service-edit="${row.id}" data-workspace-service-type="${section.key}">Edit</button>
                        <button class="text-red-500 text-xs" data-workspace-service-delete="${row.id}">Remove</button>
                      </div>
                    </div>
                    ${row.status === "error" && row.errorMessage ? `<div class="text-[11px] text-red-400 mt-1">${escapeHtml(row.errorMessage)}</div>` : ""}
                  </div>`).join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </div>
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

function formatDnsLookupResult(result) {
  if (!result || typeof result !== "object") return String(result || "");
  if (Array.isArray(result)) {
    return result.length ? JSON.stringify(result) : "No records found";
  }
  const entries = Object.entries(result);
  if (!entries.length) return "No records found";
  const parts = entries.map(([type, value]) => {
    if (value && typeof value === "object" && value.error) {
      return `${type}: error (${value.code || "DNS_ERROR"})`;
    }
    if (Array.isArray(value) && value.length === 0) {
      return `${type}: no records`;
    }
    return `${type}: ${JSON.stringify(value)}`;
  });
  return parts.join(" | ");
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
  const serverId = state.activeTerminalServerId || "default";
  if (state.terminalGui.splitByServer[serverId] === undefined) {
    const persisted = Number(localStorage.getItem(`oggo.terminal.split.${serverId}`) || 55);
    state.terminalGui.splitByServer[serverId] = Number.isFinite(persisted) ? persisted : 55;
  }
  const split = Number(state.terminalGui.splitByServer[serverId] || 55);
  const tabs = [
    ["files", "Files"],
    ["processes", "Processes"],
    ["services", "Services"],
    ["logs", "Logs"],
    ["disk", "Disk"],
    ["network", "Network"],
  ];
  const tabButtons = tabs
    .map(
      ([key, label]) => `
      <button data-gui-tab="${key}" class="px-2 py-1 rounded-md text-xs ${
        state.terminalGui.activeTab === key
          ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
          : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 border border-transparent"
      }">${label}</button>
    `
    )
    .join("");
  return `
    <div class="flex flex-col h-[calc(100vh-100px)] gap-3">
      <div class="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 flex items-center justify-between">
        <div class="flex items-center gap-3 text-xs">
          <span class="font-semibold">SSH Manager</span>
          <span class="w-2 h-2 rounded-full ${terminalSocket ? "bg-green-500" : "bg-gray-500"}"></span>
          <span>${escapeHtml(state.servers.find((item) => item.id === state.activeTerminalServerId)?.name || "No server selected")}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span id="terminal-session-id" class="font-mono">${terminalSessionId || "-"}</span>
        </div>
      </div>
      <div class="flex-1 min-h-0 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden relative shadow-lg">
        <div class="h-full flex min-h-0">
          <section id="terminal-gui-panel" class="min-w-[300px] border-r border-gray-200 dark:border-gray-800 flex flex-col" style="width:${split}%;">
            <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111318] flex items-center justify-between">
              <div class="flex items-center gap-1">${tabButtons}</div>
              <button id="terminal-gui-refresh" class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md">Refresh</button>
            </div>
            <div id="terminal-gui-content" class="flex-1 overflow-auto p-3 text-xs"></div>
          </section>
          <div id="terminal-panel-resizer" class="w-1.5 cursor-col-resize bg-transparent hover:bg-orange-500/30"></div>
          <section class="flex-1 min-w-[280px] flex flex-col">
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
            <div class="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161b22]">
              <div class="flex items-center justify-between text-xs text-gray-500">
                <div id="terminal-status-bar" class="flex items-center gap-3">
                  <span id="terminal-status" class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-gray-500"></span>Disconnected</span>
                </div>
                <span>Shared session</span>
              </div>
              <div id="saved-commands-panel" class="mt-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white/60 dark:bg-black/20">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex gap-1 text-[11px]">
                    <button data-saved-scope="global" class="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700">Global</button>
                    <button data-saved-scope="server" class="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700">This server</button>
                  </div>
                  <button id="saved-command-add" class="text-[11px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700">Add</button>
                </div>
                <div id="saved-commands-list" class="space-y-1 text-[11px]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function detectMonacoLanguage(filePath) {
  const value = String(filePath || "").toLowerCase();
  const map = {
    ".js": "javascript",
    ".ts": "typescript",
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".py": "python",
    ".php": "php",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".sql": "sql",
    ".html": "html",
    ".css": "css",
    ".md": "markdown",
    ".xml": "xml",
    ".ini": "ini",
  };
  const ext = Object.keys(map).find((key) => value.endsWith(key));
  return ext ? map[ext] : "plaintext";
}

async function ensureMonacoLoaded() {
  if (window.monaco?.editor) return window.monaco;
  if (monacoLoadPromise) return monacoLoadPromise;
  monacoLoadPromise = new Promise((resolve, reject) => {
    if (!window.require) {
      reject(new Error("Monaco loader unavailable"));
      return;
    }
    window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs" } });
    window.require(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
  });
  return monacoLoadPromise;
}

async function mountGuiMonacoEditor() {
  const editorState = state.terminalGui.editor;
  const mountNode = el("gui-monaco-editor");
  if (!editorState?.path || !mountNode) return;
  const monaco = await ensureMonacoLoaded();
  if (guiMonacoEditor) {
    guiMonacoEditor.dispose();
    guiMonacoEditor = null;
  }
  guiMonacoEditor = monaco.editor.create(mountNode, {
    value: editorState.content || "",
    language: detectMonacoLanguage(editorState.path),
    theme: document.documentElement.classList.contains("dark") ? "vs-dark" : "vs",
    automaticLayout: true,
    minimap: { enabled: true },
    wordWrap: "on",
  });
}

function renderGuiContent() {
  const node = el("terminal-gui-content");
  if (!node) return;
  if (!terminalGuiReady) {
    node.innerHTML = `<div class="text-gray-500">Connecting to selected server...</div>`;
    return;
  }
  const tab = state.terminalGui.activeTab;
  if (state.terminalGui.loading) {
    node.innerHTML = `<div class="text-gray-500">Loading ${tab}...</div>`;
    return;
  }
  if (tab === "files") {
    if (state.terminalGui.editor?.path) {
      node.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-mono truncate">${escapeHtml(state.terminalGui.editor.path)}</div>
            <div class="flex gap-2">
              <button id="gui-editor-back" class="btn-secondary !py-1 !px-2 text-xs">Back</button>
              <button id="gui-editor-save" class="btn-secondary !py-1 !px-2 text-xs">Save</button>
            </div>
          </div>
          <div id="gui-monaco-editor" class="h-[420px] border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"></div>
        </div>
      `;
      setTimeout(() => {
        mountGuiMonacoEditor().catch((error) => toast(error.message, "error"));
      }, 0);
      return;
    }
    const data = state.terminalGui.files;
    const rows = Array.isArray(data?.entries) ? data.entries : [];
    const fileRows = rows.length
      ? rows
          .map((entry) => {
            const isDir = entry.type === "directory";
            const icon = isDir 
              ? `<svg class="w-3.5 h-3.5 text-[var(--info)] fill-current opacity-80" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>` 
              : `<svg class="w-3.5 h-3.5 text-[var(--t3)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>`;
            const size = Number(entry.size || 0);
            const sizeLabel =
              size > 1024 * 1024
                ? `${(size / (1024 * 1024)).toFixed(1)}M`
                : size > 1024
                  ? `${Math.round(size / 1024)}K`
                  : `${size}B`;
            return `<div data-gui-file-open="${escapeHtml(entry.name)}" data-gui-file-type="${entry.type}" class="flex items-center justify-between px-2 py-1.5 cursor-pointer text-[11.5px] font-mono text-[var(--t3)] hover:bg-[var(--bg4)] hover:text-[var(--t2)] transition-colors group select-none">
              <div class="flex items-center gap-2 min-w-0">
                ${icon}
                <span class="truncate group-hover:text-[var(--t)] transition-colors">${escapeHtml(entry.name)}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                <span class="text-[10px]">${escapeHtml(entry.permissions || "")}</span>
                <span class="w-10 text-right">${isDir ? '--' : escapeHtml(sizeLabel)}</span>
              </div>
            </div>`;
          })
          .join("")
      : `<div class="text-[11px] text-[var(--t3)] p-4 text-center">Empty directory</div>`;
    node.innerHTML = `
      <div class="flex flex-col h-full gap-2">
        <div class="flex items-center gap-1 bg-[var(--bg4)] p-1 rounded-lg border border-[var(--b)]">
          <button id="gui-files-up" class="p-1 text-[var(--t3)] hover:text-[var(--t)] hover:bg-[var(--bg5)] rounded transition-colors" title="Up one level">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <input id="gui-files-path" class="flex-1 bg-transparent border-none text-[11.5px] font-mono text-[var(--t)] px-1 outline-none w-0" value="${escapeHtml(state.terminalGui.path || "~")}" spellcheck="false" />
          <button id="gui-files-open" class="p-1 text-[var(--t3)] hover:text-[var(--ac)] hover:bg-[var(--acd)] rounded transition-colors" title="Go">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <div class="w-px h-4 bg-[var(--b)] mx-1"></div>
          <button id="gui-files-new-file" class="p-1 text-[var(--t3)] hover:text-[var(--t)] hover:bg-[var(--bg5)] rounded transition-colors" title="New File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15h6"/></svg>
          </button>
          <button id="gui-files-new-dir" class="p-1 text-[var(--t3)] hover:text-[var(--t)] hover:bg-[var(--bg5)] rounded transition-colors" title="New Folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><path d="M12 11v6M9 14h6"/></svg>
          </button>
        </div>
        <div class="flex items-center justify-between px-1">
          <label class="flex items-center gap-1.5 text-[10px] text-[var(--t3)] uppercase font-semibold tracking-wider cursor-pointer hover:text-[var(--t2)] transition-colors">
            <input id="gui-files-hidden" type="checkbox" class="accent-[var(--ac)] w-3 h-3 rounded" ${state.terminalGui.showHidden ? "checked" : ""} />
            Show hidden
          </label>
          <span class="text-[10px] text-[var(--t3)] font-mono">${rows.length} items</span>
        </div>
        <div id="gui-file-list" class="flex-1 overflow-y-auto overflow-x-hidden border border-[var(--b)] rounded-lg bg-[var(--bg3)] py-1 relative">
          ${fileRows}
        </div>
      </div>
    `;
    return;
  }
  if (tab === "processes") {
    node.innerHTML = `
      <div class="space-y-2">
        <div class="flex gap-2">
          <button id="gui-proc-refresh" class="btn-secondary !py-1 !px-2 text-xs">Refresh</button>
          <input id="gui-proc-kill-pid" class="input text-xs !py-1 !px-2" placeholder="PID" />
          <select id="gui-proc-signal" class="input text-xs !py-1 !px-2"><option value="15">SIGTERM</option><option value="9">SIGKILL</option><option value="1">SIGHUP</option></select>
          <button id="gui-proc-kill" class="btn-secondary !py-1 !px-2 text-xs">Kill</button>
        </div>
        <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[420px]">${escapeHtml(
          state.terminalGui.processes?.output || "No process data."
        )}</pre>
      </div>
    `;
    return;
  }
  if (tab === "services") {
    node.innerHTML = `
      <div class="space-y-2">
        <div class="flex gap-2">
          <button id="gui-svc-refresh" class="btn-secondary !py-1 !px-2 text-xs">Refresh</button>
          <input id="gui-svc-name" class="input text-xs !py-1 !px-2" placeholder="nginx.service" />
          <select id="gui-svc-action" class="input text-xs !py-1 !px-2"><option>restart</option><option>start</option><option>stop</option><option>reload</option><option>enable</option><option>disable</option></select>
          <button id="gui-svc-run" class="btn-secondary !py-1 !px-2 text-xs">Run</button>
        </div>
        <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[420px]">${escapeHtml(
          state.terminalGui.services?.output || "No service data."
        )}</pre>
      </div>
    `;
    return;
  }
  if (tab === "logs") {
    const sources = state.terminalGui.logs.sources || [];
    const options = sources
      .map((item) => `<option value="${escapeHtml(item)}" ${item === state.terminalGui.logs.selected ? "selected" : ""}>${escapeHtml(item)}</option>`)
      .join("");
    node.innerHTML = `
      <div class="space-y-2">
        <div class="flex gap-2">
          <button id="gui-logs-sources" class="btn-secondary !py-1 !px-2 text-xs">Detect sources</button>
          <select id="gui-logs-path" class="input text-xs !py-1 !px-2 flex-1"><option value="">Choose log file</option>${options}</select>
          <button id="gui-logs-open" class="btn-secondary !py-1 !px-2 text-xs">Tail 100</button>
        </div>
        <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[420px]">${escapeHtml(
          state.terminalGui.logs.content || "No logs loaded."
        )}</pre>
      </div>
    `;
    return;
  }
  if (tab === "disk") {
    node.innerHTML = `
      <div class="space-y-2">
        <div class="flex gap-2">
          <input id="gui-disk-path" class="input text-xs !py-1 !px-2" value="/" />
          <button id="gui-disk-refresh" class="btn-secondary !py-1 !px-2 text-xs">Refresh</button>
          <button id="gui-disk-large" class="btn-secondary !py-1 !px-2 text-xs">Find large files</button>
        </div>
        <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[200px]">${escapeHtml(
          state.terminalGui.disk?.overview?.output || "No disk overview."
        )}</pre>
        <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[200px]">${escapeHtml(
          state.terminalGui.disk?.usage?.output || "No folder usage."
        )}</pre>
      </div>
    `;
    return;
  }
  node.innerHTML = `
    <div class="space-y-2">
      <button id="gui-net-refresh" class="btn-secondary !py-1 !px-2 text-xs">Refresh</button>
      <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[180px]">${escapeHtml(
        state.terminalGui.network?.interfaces?.output || "No interface data."
      )}</pre>
      <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[180px]">${escapeHtml(
        state.terminalGui.network?.connections?.output || "No connection data."
      )}</pre>
      <pre class="text-[11px] bg-black/70 text-gray-100 p-2 rounded-md overflow-auto max-h-[180px]">${escapeHtml(
        state.terminalGui.network?.ports?.output || "No open ports."
      )}</pre>
    </div>
  `;
}

async function loadActiveTerminalGuiTab(force = false) {
  if (!terminalSessionId) return;
  const tab = state.terminalGui.activeTab;
  if (!force && tab === "files" && state.terminalGui.files) {
    renderGuiContent();
    return;
  }
  state.terminalGui.loading = true;
  renderGuiContent();
  const sessionId = terminalSessionId;
  try {
    if (tab === "files") {
      state.terminalGui.files = await window.OggoAPI.guiFsList({
        sessionId,
        serverId: state.activeTerminalServerId,
        path: state.terminalGui.path || "~",
        showHidden: Boolean(state.terminalGui.showHidden),
      });
    } else if (tab === "processes") {
      state.terminalGui.processes = await window.OggoAPI.guiListProcesses({ sessionId });
    } else if (tab === "services") {
      state.terminalGui.services = await window.OggoAPI.guiListServices({ sessionId });
    } else if (tab === "logs") {
      const sources = await window.OggoAPI.guiLogSources({ sessionId });
      state.terminalGui.logs.sources = sources.paths || [];
    } else if (tab === "disk") {
      state.terminalGui.disk = await window.OggoAPI.guiDisk({ sessionId, path: "/" });
    } else if (tab === "network") {
      state.terminalGui.network = await window.OggoAPI.guiNetwork({ sessionId });
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.terminalGui.loading = false;
    renderGuiContent();
  }
}

async function loadSavedCommands(scope = "global") {
  const listNode = el("saved-commands-list");
  if (!listNode) return;
  const serverId = scope === "server" ? state.activeTerminalServerId : "";
  try {
    const data = await window.OggoAPI.listSavedCommands(scope, serverId);
    const commands = data.commands || [];
    if (!commands.length) {
      listNode.innerHTML = `<div class="text-gray-500">No saved commands.</div>`;
      return;
    }
    const grouped = commands.reduce((acc, item) => {
      const key = String(item.category || "Uncategorized").trim() || "Uncategorized";
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    const sections = Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([category, items]) => `<details open class="p-1 border border-gray-200 dark:border-gray-700 rounded">
          <summary class="cursor-pointer text-[11px] font-semibold">${escapeHtml(category)} (${items.length})</summary>
          <div class="mt-1 space-y-1">
            ${items
              .map(
                (item) => `<div class="p-1 border border-gray-200 dark:border-gray-700 rounded">
                  <div class="font-medium">${escapeHtml(item.name || "")}</div>
                  <div class="font-mono text-gray-500 truncate">${escapeHtml(item.command || "")}</div>
                  <div class="mt-1 flex gap-1">
                    <button data-saved-run="${item.id}" class="px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded">Run</button>
                    <button data-saved-delete="${item.id}" class="px-2 py-0.5 border border-gray-300 dark:border-gray-700 rounded">Delete</button>
                  </div>
                </div>`
              )
              .join("")}
          </div>
        </details>`
      )
      .join("");
    listNode.innerHTML = sections;
  } catch (error) {
    listNode.innerHTML = `<div class="text-red-500">${escapeHtml(error.message)}</div>`;
  }
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
        <h3 class="section-title"><i data-lucide="package-search" class="w-5 h-5"></i> Package Monitor</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="pt-4 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">Auto-scan daily for vulnerabilities</span>
            ${toggle("software.autoScanDaily", Boolean(s.software?.autoScanDaily))}
          </div>
          ${field("Auto-scan server", `<select name="software.autoScanServerId" class="input bg-white dark:bg-gray-800"><option value="local" ${String(s.software?.autoScanServerId || "local") === "local" ? "selected" : ""}>Local Machine</option>${state.servers.map((srv) => `<option value="${srv.id}" ${String(s.software?.autoScanServerId || "") === srv.id ? "selected" : ""}>${escapeHtml(srv.name)}</option>`).join("")}</select>`)}
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

function getFilteredPackages(packages) {
  const q = String(state.packageSearch || "").trim().toLowerCase();
  return packages
    .filter((pkg) => {
      if (q && !String(pkg.name || "").toLowerCase().includes(q)) return false;
      if (state.packageFilter === "outdated") return pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion;
      if (state.packageFilter === "vulnerable") return Number(pkg.vulnCount || 0) > 0;
      if (state.packageFilter === "pinned") return Boolean(pkg.pinned);
      return true;
    })
    .slice(0, 500);
}

function packageCounts(packages) {
  return packages.reduce(
    (acc, pkg) => {
      if (pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion) acc.outdated += 1;
      if (Number(pkg.vulnCount || 0) > 0) acc.vulnerable += 1;
      if (pkg.pinned) acc.pinned += 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, outdated: 0, vulnerable: 0, pinned: 0 }
  );
}

function packageRowStateClass(pkg) {
  const key = packageKey(pkg.manager, pkg.name);
  return state.packageUpdatedToday[key] ? "pkg-row-updated-today" : "";
}

function updateTypeClass(type) {
  if (type === "PATCH") return "pkg-badge pkg-badge-patch";
  if (type === "MINOR") return "pkg-badge pkg-badge-minor";
  if (type === "MAJOR") return "pkg-badge pkg-badge-major";
  return "pkg-badge pkg-badge-none";
}

function latestVersionClass(pkg) {
  if (!pkg.latestVersion || pkg.latestVersion === pkg.installedVersion) return "text-gray-500";
  if (pkg.updateType === "PATCH") return "text-green-500";
  if (pkg.updateType === "MINOR") return "text-orange-400";
  if (pkg.updateType === "MAJOR") return "text-red-500";
  return "text-orange-500";
}

function renderPackageOperationRow(pkg) {
  const op = state.packageRowOps[packageKey(pkg.manager, pkg.name)];
  if (!op) return "";
  const toneClass = op.status === "failed" ? "pkg-op-failed" : op.status === "success" ? "pkg-op-success" : "";
  const lines = (op.lines || [])
    .map((line) => `<div class="pkg-op-line pkg-op-${escapeHtml(line.tone || "muted")}">${escapeHtml(line.text || "")}</div>`)
    .join("");
  return `
    <tr class="pkg-op-row">
      <td colspan="7">
        <div class="pkg-op-panel ${toneClass}">
          <div class="pkg-op-head">
            <div class="pkg-op-title">${escapeHtml(op.title || "Running operation")}</div>
            <div class="pkg-op-status">${escapeHtml(String(op.status || "running").toUpperCase())}</div>
          </div>
          <div class="pkg-op-progress"><div class="pkg-op-progress-fill ${toneClass}" style="width:${Math.max(0, Math.min(100, Number(op.progress || 0)))}%"></div></div>
          <div class="pkg-op-terminal">${lines || '<div class="pkg-op-line pkg-op-muted">Running...</div>'}</div>
          ${op.status === "failed" ? `<div class="pkg-op-actions"><button class="btn-secondary text-xs" data-package-row-retry="${escapeHtml(op.id)}">Retry</button><button class="btn-secondary text-xs" data-package-copy-error="${escapeHtml(op.id)}">Copy error</button></div>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function renderVersionPanelRow(pkg) {
  if (state.packagePanel.type !== "versions" || state.packagePanel.key !== packageKey(pkg.manager, pkg.name)) return "";
  const rows = Array.isArray(state.packagePanel.data) ? state.packagePanel.data : [];
  const installed = String(state.packagePanel.version || "");
  const top = rows[0]?.version || "";
  return `
    <tr class="pkg-inline-row">
      <td colspan="7">
        <div class="pkg-inline-panel">
          <div class="pkg-inline-head">
            <div class="font-semibold">Version history — ${escapeHtml(pkg.name)}</div>
            <button class="btn-secondary text-xs" data-package-panel-close="1">Close</button>
          </div>
          ${state.packagePanel.loading ? '<div class="text-xs text-gray-500">Loading versions...</div>' : ""}
          ${state.packagePanel.error ? `<div class="text-xs text-red-500">${escapeHtml(state.packagePanel.error)}</div>` : ""}
          ${
            !state.packagePanel.loading
              ? `<div class="overflow-x-auto"><table class="w-full text-xs">
                   <thead><tr><th class="py-1 text-left">Version</th><th class="py-1 text-left">Date</th><th class="py-1 text-left">Age</th><th class="py-1 text-left">Size</th><th class="py-1 text-right">Action</th></tr></thead>
                   <tbody>
                     ${
                       rows
                         .map((row) => {
                           const version = String(row.version || "");
                           const isCurrent = version === installed;
                           const isLatest = version === top;
                           const isDowngrade = olderVersionThan(version, installed);
                           const actionLabel = isDowngrade ? "Downgrade" : "Install";
                           return `<tr class="border-b border-gray-100 dark:border-gray-800">
                             <td class="py-2">
                               <span class="font-semibold">${escapeHtml(version)}</span>
                               ${isCurrent ? '<span class="pkg-mini-badge">current</span>' : ""}
                               ${isLatest ? '<span class="pkg-mini-badge pkg-mini-badge-latest">latest</span>' : ""}
                             </td>
                             <td class="py-2">${row.date ? escapeHtml(new Date(row.date).toLocaleDateString()) : "-"}</td>
                             <td class="py-2">${row.date ? escapeHtml(toRelativeDays(row.date)) : "-"}</td>
                             <td class="py-2">${Number(row.size || 0) > 0 ? `${Math.round(Number(row.size || 0) / 1024)} KB` : "-"}</td>
                             <td class="py-2 text-right">${isCurrent ? '<span class="text-gray-500">current</span>' : `<button class="btn-secondary text-xs ${isDowngrade ? "text-orange-500" : ""}" data-package-install-version="${escapeHtml(version)}" data-manager="${escapeHtml(pkg.manager)}" data-name="${escapeHtml(pkg.name)}" data-installed="${escapeHtml(installed)}">${actionLabel}</button>`}</td>
                           </tr>`;
                         })
                         .join("") || '<tr><td class="py-2 text-gray-500" colspan="5">No versions found.</td></tr>'
                     }
                   </tbody>
                 </table></div>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

function renderCvePanelRow(pkg) {
  if (state.packagePanel.type !== "cves" || state.packagePanel.key !== packageKey(pkg.manager, pkg.name)) return "";
  const rows = Array.isArray(state.packagePanel.data) ? state.packagePanel.data : [];
  return `
    <tr class="pkg-inline-row">
      <td colspan="7">
        <div class="pkg-inline-panel pkg-inline-cve">
          <div class="pkg-inline-head">
            <div class="font-semibold">CVE details — ${escapeHtml(pkg.name)}</div>
            <button class="btn-secondary text-xs" data-package-panel-close="1">Close</button>
          </div>
          ${state.packagePanel.loading ? '<div class="text-xs text-gray-500">Loading CVEs...</div>' : ""}
          ${state.packagePanel.error ? `<div class="text-xs text-red-500">${escapeHtml(state.packagePanel.error)}</div>` : ""}
          ${
            !state.packagePanel.loading
              ? `<div class="space-y-2 max-h-64 overflow-auto">
                   ${
                     rows
                       .map((cve) => {
                         const sev = String(cve.severity || "UNKNOWN").toUpperCase();
                         const sevClass = sev === "CRITICAL" ? "pkg-sev-critical" : sev === "HIGH" ? "pkg-sev-high" : sev === "MEDIUM" ? "pkg-sev-medium" : sev === "LOW" ? "pkg-sev-low" : "";
                         return `<div class="pkg-cve-item">
                           <div class="flex items-center justify-between gap-2">
                             <a href="${escapeHtml(cve.referenceUrl || "#")}" target="_blank" rel="noreferrer" class="font-semibold text-orange-400 hover:underline">${escapeHtml(cve.id || "CVE")}</a>
                             <span class="pkg-cve-sev ${sevClass}">${escapeHtml(sev)}${cve.cvss ? ` ${escapeHtml(String(cve.cvss))}` : ""}</span>
                           </div>
                           <div class="text-xs text-gray-400 mt-1">${escapeHtml(cve.description || "")}</div>
                           <div class="text-xs text-gray-500 mt-1">Affected: ${escapeHtml((cve.affectedVersions || []).join(", ") || "-")}</div>
                           <div class="text-xs text-green-500 mt-1">Fixed in: ${escapeHtml(cve.fixedVersion || "n/a")}</div>
                           ${cve.fixedVersion ? `<button class="btn-secondary text-xs mt-2" data-package-fix-cve="${escapeHtml(cve.fixedVersion)}" data-manager="${escapeHtml(pkg.manager)}" data-name="${escapeHtml(pkg.name)}" data-installed="${escapeHtml(pkg.installedVersion || "")}">Update to ${escapeHtml(cve.fixedVersion)} to fix this</button>` : ""}
                         </div>`;
                       })
                       .join("") || '<div class="text-xs text-gray-500">No CVEs returned.</div>'
                   }
                 </div>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

function packageRowsHtml(section) {
  const filtered = getFilteredPackages(section.packages || []);
  const manager = section.manager;
  const selectedMap = state.packageSelected[manager] || {};
  return filtered
    .map((pkg) => {
      const key = packageKey(pkg.manager, pkg.name);
      const hasUpdate = pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion;
      const description = state.packageDescCache[key] || pkg.description || "No description available";
      const selected = Boolean(selectedMap[pkg.name]);
      const nameDot = pkg.pinned ? '<span class="pkg-pin-dot"></span>' : "";
      const todayBadge = state.packageUpdatedToday[key] ? '<span class="pkg-mini-badge pkg-mini-badge-updated">updated today</span>' : "";
      const row = `
        <tr class="border-b border-gray-100 dark:border-gray-800 ${packageRowStateClass(pkg)}" data-pkg-row="${escapeHtml(pkg.name)}" data-manager="${escapeHtml(pkg.manager)}">
          <td class="py-2 px-3"><input type="checkbox" data-package-select-row="1" data-manager="${escapeHtml(pkg.manager)}" data-name="${escapeHtml(pkg.name)}" ${selected ? "checked" : ""} /></td>
          <td class="py-2 px-3">
            <div class="font-medium font-mono truncate" title="${escapeHtml(pkg.name)}">${nameDot}${escapeHtml(pkg.name)} ${todayBadge}</div>
            <div class="text-[11px] text-gray-500 mt-0.5 truncate" title="${escapeHtml(description)}">${escapeHtml(description)}</div>
          </td>
          <td class="py-2 px-3 text-xs font-mono ${pkg.installedVersion ? "" : "text-red-400"}">${escapeHtml(pkg.installedVersion || "unknown")}</td>
          <td class="py-2 px-3 text-xs font-mono ${latestVersionClass(pkg)}">${escapeHtml(pkg.latestVersion || pkg.installedVersion || "-")}</td>
          <td class="py-2 px-3"><span class="${updateTypeClass(pkg.updateType || "NONE")}" ${pkg.updateType === "MAJOR" ? 'title="This is a major version jump. Check the migration guide before updating."' : ""}>${escapeHtml(pkg.updateType || "NONE")}</span></td>
          <td class="py-2 px-3">${Number(pkg.vulnCount || 0) > 0 ? `<button class="px-2 py-1 rounded-full text-[11px] bg-red-500/20 text-red-500 hover:bg-red-500/30" data-package-action="vulns" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-version="${escapeHtml(pkg.installedVersion || "")}">⚠ ${Number(pkg.vulnCount)} CVE</button>` : `<span class="text-xs text-gray-500">-</span>`}</td>
          <td class="py-2 px-3 text-right">
            <div class="inline-flex gap-2 pkg-row-actions">
              ${hasUpdate ? `<button class="btn-secondary text-xs" data-package-action="update" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-from="${escapeHtml(pkg.installedVersion || "")}" data-to="${escapeHtml(pkg.latestVersion || "")}" data-type="${escapeHtml(pkg.updateType || "UNKNOWN")}" data-pinned="${pkg.pinned ? "1" : "0"}">Update</button>` : ""}
              <button class="btn-secondary text-xs ${pkg.pinned ? "text-orange-500" : ""}" data-package-action="${pkg.pinned ? "unpin" : "pin"}" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-version="${escapeHtml(pkg.installedVersion || "")}">${pkg.pinned ? "📌 Unpin" : "Pin"}</button>
              <button class="btn-secondary text-xs" data-package-action="versions" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}" data-version="${escapeHtml(pkg.installedVersion || "")}">Versions</button>
              <button class="btn-secondary text-xs text-red-500" data-package-action="uninstall" data-manager="${pkg.manager}" data-name="${escapeHtml(pkg.name)}">Uninstall</button>
            </div>
          </td>
        </tr>
      `;
      return `${row}${renderPackageOperationRow(pkg, filtered.length)}${renderVersionPanelRow(pkg)}${renderCvePanelRow(pkg)}`;
    })
    .join("");
}

function softwarePackageManagerHtml() {
  const scan = state.packageScan;
  const hasScan = Boolean(scan && Array.isArray(scan.sections));
  const counts = packageCounts((scan?.sections || []).flatMap((section) => section.packages || []));
  const statDisplay = state.packageStatDisplay || {};
  const statTotal = Math.max(1, Number(statDisplay.totalPackages || counts.total || 0));
  const updatesPct = Math.round(((Number(statDisplay.updatesAvailable || counts.outdated || 0)) / statTotal) * 100);
  const vulnPct = Math.min(100, Number(statDisplay.vulnerabilities || counts.vulnerable || 0) * 20);
  const scanAt = scan?.scannedAt ? new Date(scan.scannedAt) : null;
  const outdatedScan = scanAt ? (Date.now() - scanAt.getTime()) > (7 * 24 * 60 * 60 * 1000) : false;
  const globalProgressTotal = Math.max(1, Number(state.packageScanProgress.total || 1));
  const globalProgressPct = Math.round((Number(state.packageScanProgress.completed || 0) / globalProgressTotal) * 100);
  const filterPill = (key, label, count) =>
    `<button data-package-filter-pill="${key}" class="px-3 py-1.5 rounded-full border text-xs ${state.packageFilter === key ? "border-orange-500 text-orange-500 bg-orange-500/10" : "border-gray-300 dark:border-gray-700 text-gray-500 hover:text-gray-200"}">${label} (${count})</button>`;
  const sections = hasScan
    ? scan.sections
        .filter((section) => getFilteredPackages(section.packages || []).length > 0)
        .map(
          (section) => `
      <div class="panel pkg-section-card ${state.packageCollapsed[section.manager] ? "pkg-section-collapsed" : ""} ${state.packageScanInProgress && state.packageSectionScanningManager === section.manager ? "pkg-section-scanning" : ""}">
        <div class="flex items-center justify-between gap-3 mb-3 pkg-section-head" data-toggle-section="${section.manager}">
          <div>
            <div class="font-semibold font-mono">${escapeHtml(section.managerLabel)} <span class="text-xs text-gray-500">(${escapeHtml(section.managerVersion || "Unknown")})</span> ${state.packageScanInProgress && state.packageSectionScanningManager === section.manager ? '<span class="ml-2 text-orange-400 text-xs">⏳ scanning</span>' : ""}</div>
            ${section.managerPath ? `<div class="text-[11px] text-gray-500 font-mono truncate max-w-[360px]" title="${escapeHtml(section.managerPath)}">${escapeHtml(section.managerPath.length > 60 ? `${section.managerPath.slice(0, 60)}...` : section.managerPath)}</div>` : ""}
            <div class="text-xs text-gray-500">${section.packageCount} packages • ${section.outdatedCount} outdated • ${section.vulnerableCount} vulnerable</div>
          </div>
          <div class="inline-flex gap-2">
            ${section.outdatedCount > 0 ? `<button class="btn-secondary text-xs" data-package-action="bulk-update" data-manager="${section.manager}">Bulk update</button>` : ""}
            <button class="btn-secondary text-xs" data-scan-manager="${section.manager}">Scan Section</button>
            <button class="btn-secondary text-xs" data-toggle-section="${section.manager}">${state.packageCollapsed[section.manager] ? "Expand" : "Collapse"}</button>
          </div>
        </div>
        <div class="overflow-x-auto ${state.packageCollapsed[section.manager] ? "hidden" : ""}">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500">
                <th class="py-2 px-3"><input type="checkbox" data-package-select-all="1" data-manager="${section.manager}" /></th>
                <th class="py-2 px-3">Name</th>
                <th class="py-2 px-3">Installed</th>
                <th class="py-2 px-3">Latest</th>
                <th class="py-2 px-3">Update Type</th>
                <th class="py-2 px-3">Security</th>
                <th class="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${packageRowsHtml(section)}
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
          <button id="software-scan-btn" class="btn-primary">${state.packageScanInProgress ? '<span class="pkg-spin">⏳</span> Scanning...' : "Scan now"}</button>
          <button id="software-history-btn" class="btn-secondary">History</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <div class="text-xs text-gray-500">Total packages</div><div class="text-xl font-semibold">${Number(statDisplay.totalPackages || scan?.stats?.totalPackages || 0)}</div>
            <div class="h-1.5 rounded bg-gray-200 dark:bg-gray-700 mt-2 overflow-hidden"><div class="h-full bg-blue-500" style="width:100%"></div></div>
          </div>
          <div class="bg-orange-500/10 rounded-lg px-3 py-2">
            <div class="text-xs text-orange-400">Updates available</div><div class="text-xl font-semibold text-orange-500">${Number(statDisplay.updatesAvailable || scan?.stats?.updatesAvailable || 0)}</div>
            <div class="h-1.5 rounded bg-orange-900/30 mt-2 overflow-hidden"><div class="h-full bg-orange-500" style="width:${updatesPct}%"></div></div>
          </div>
          <div class="bg-red-500/10 rounded-lg px-3 py-2">
            <div class="text-xs text-red-400">Vulnerabilities</div><div class="text-xl font-semibold text-red-500">${Number(statDisplay.vulnerabilities || scan?.stats?.vulnerabilities || 0)}</div>
            <div class="h-1.5 rounded bg-red-900/30 mt-2 overflow-hidden"><div class="h-full bg-red-500" style="width:${vulnPct}%"></div></div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"><div class="text-xs text-gray-500">Last scan</div><div class="text-sm font-semibold">${scan?.scannedAt ? new Date(scan.scannedAt).toLocaleString() : "Not scanned"} ${outdatedScan ? '<span class="pkg-mini-badge pkg-mini-badge-outdated">Scan outdated</span>' : ""}</div></div>
        </div>
        ${state.packageScanInProgress || state.packageScanTerminal.length ? `
          <div class="pkg-scan-terminal-wrap mt-4">
            <div class="pkg-scan-progress"><div class="pkg-scan-progress-fill ${!state.packageScanInProgress ? "pkg-scan-progress-done" : ""}" style="width:${state.packageScanInProgress ? globalProgressPct : 100}%"></div></div>
            <div class="pkg-scan-terminal">
              ${
                state.packageScanTerminal
                  .map((line) => `<div class="pkg-op-line pkg-op-${escapeHtml(line.tone || "muted")}">${escapeHtml(line.text)}</div>`)
                  .join("") || '<div class="pkg-op-line pkg-op-muted">Ready.</div>'
              }
            </div>
          </div>` : ""}
        <div class="flex flex-wrap gap-3 mt-4 items-center">
          <input id="software-package-search" class="input min-w-[220px] max-w-sm" placeholder="Search package..." value="${escapeHtml(state.packageSearch || "")}" />
          <div class="flex flex-wrap gap-2">
            ${filterPill("all", "All", counts.total)}
            ${filterPill("outdated", "Updates", counts.outdated)}
            ${filterPill("vulnerable", "Vulnerable", counts.vulnerable)}
            ${filterPill("pinned", "Pinned", counts.pinned)}
          </div>
        </div>
      </div>
      ${sections}
      ${state.packageHistoryPanel.open ? '<div id="package-history-overlay" class="pkg-history-overlay"></div>' : ""}
      ${state.packageHistoryPanel.open ? `<aside class="pkg-history-panel">
        <div class="pkg-history-head"><div class="font-semibold">Operation history</div><button class="btn-secondary text-xs" data-history-close="1">Close</button></div>
        <div class="pkg-history-filters">
          ${["all", "update", "downgrade", "uninstall", "scan", "failed"].map((f) => `<button class="btn-secondary text-xs ${state.packageHistoryPanel.filter === f ? "ring-1 ring-orange-500" : ""}" data-history-filter="${f}">${f}</button>`).join("")}
        </div>
        <div class="flex gap-2 mt-2"><input id="package-history-search" class="input" placeholder="Search package name" value="${escapeHtml(state.packageHistoryPanel.search || "")}" /><button class="btn-secondary text-xs" data-history-export="1">Export CSV</button></div>
        <div class="pkg-history-list">
          ${
            (state.packageHistory || []).map((row) => `
              <details class="pkg-history-item">
                <summary><span>${escapeHtml(row.action || "op")} · ${escapeHtml(row.package_name || "-")} <span class="pkg-mini-badge">${escapeHtml(row.package_manager || "")}</span></span><span class="${row.status === "success" ? "text-green-500" : "text-red-500"}">${escapeHtml(row.status || "")}</span></summary>
                <div class="text-xs text-gray-500 mt-1">${escapeHtml(new Date(row.created_at).toLocaleString())} · ${escapeHtml(row.from_version || "-")} -> ${escapeHtml(row.to_version || "-")}</div>
                <pre class="pkg-history-output">${escapeHtml(row.output || "")}</pre>
              </details>
            `).join("") || '<div class="text-xs text-gray-500">No history entries.</div>'
          }
        </div>
      </aside>` : ""}
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
  } else if (state.view === "workspaces" || state.view === "all-workspaces") {
    root.innerHTML = workspacesOverviewHtml();
  } else if (state.view === "workspace-detail") {
    root.innerHTML = workspaceDetailHtml();
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
    workspaces,
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
    window.OggoAPI.getWorkspaces().catch(() => []),
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
  state.workspaces = workspaces;
  if (!state.activeWorkspaceId && workspaces.length) {
    state.activeWorkspaceId = workspaces[0].id;
  }
  state.sslMonitors = sslMonitors;
  state.dnsMonitors = dnsMonitors;
  state.portMonitors = portMonitors;
  state.envVars = envVars;
  state.httpChecks = httpChecks;
  if (!state.awsActiveConnectionId && awsConnections.length) {
    state.awsActiveConnectionId = awsConnections[0].id;
  }
}

async function maybeRunSoftwareAutoScan(force = false) {
  if (!state.settings?.software?.autoScanDaily) return;
  const now = Date.now();
  if (!force && now - Number(state.packageAutoScanLastRunAt || 0) < 24 * 60 * 60 * 1000) return;
  const serverId = String(state.settings?.software?.autoScanServerId || "local");
  try {
    const previousVulns = Number(localStorage.getItem(`oggo.software.vulns.${serverId}`) || "0");
    const scan = await window.OggoAPI.scanPackages(serverId);
    const nextVulns = Number(scan?.stats?.vulnerabilities || 0);
    localStorage.setItem(`oggo.software.vulns.${serverId}`, String(nextVulns));
    state.packageAutoScanLastRunAt = now;
    if (nextVulns > previousVulns) {
      toast(`Auto-scan: ${nextVulns - previousVulns} new vulnerabilities found`, "error");
    }
  } catch (_error) {
    // Ignore autoscan errors to avoid interrupting app boot.
  }
}

function configureSoftwareAutoScan() {
  if (state.packageAutoScanTimer) {
    clearInterval(state.packageAutoScanTimer);
    state.packageAutoScanTimer = null;
  }
  if (!state.settings?.software?.autoScanDaily) return;
  maybeRunSoftwareAutoScan(false).catch(() => {});
  state.packageAutoScanTimer = setInterval(() => {
    maybeRunSoftwareAutoScan(false).catch(() => {});
  }, 60 * 60 * 1000);
}

async function loadWorkspaceDetail(workspaceId) {
  if (!workspaceId) return;
  state.workspaceDetail = await window.OggoAPI.getWorkspace(workspaceId);
  state.activeWorkspaceId = workspaceId;
  const stale = [];
  const services = state.workspaceDetail?.services || {};
  for (const key of Object.keys(services)) {
    for (const service of services[key] || []) {
      const tested = service.lastTestedAt ? new Date(service.lastTestedAt).getTime() : 0;
      if (!tested || Date.now() - tested > 24 * 60 * 60 * 1000) {
        stale.push(service.id);
      }
    }
  }
  if (stale.length) {
    stale.slice(0, 4).forEach(async (serviceId) => {
      try {
        state.workspaceServiceTesting[serviceId] = true;
        render();
        bindViewEvents();
        await window.OggoAPI.testWorkspaceService(workspaceId, serviceId);
      } catch (_error) {
        // no-op
      } finally {
        delete state.workspaceServiceTesting[serviceId];
        state.workspaceDetail = await window.OggoAPI.getWorkspace(workspaceId);
        render();
        bindViewEvents();
      }
    });
  }
}

function openWorkspaceModal(workspace = null) {
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const hasDefaults = Boolean(workspace?.hasDefaultCredentials);
  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${workspace ? "Edit Workspace" : "New Workspace"}</h3>
      <button type="button" id="workspace-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="workspace-form" class="space-y-5 p-6">
      <input type="hidden" name="id" value="${workspace?.id || ""}" />
      ${field("Workspace name", `<input required name="name" class="input" value="${escapeHtml(workspace?.name || "")}" placeholder="Farmland India" />`)}
      ${field("Description", `<textarea name="description" class="input min-h-[80px]" placeholder="Project notes">${escapeHtml(workspace?.description || "")}</textarea>`)}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${field("Color", `<input name="color" type="color" class="input h-11 p-2" value="${workspace?.color || "#f97316"}" />`)}
        ${field(
          "Default region",
          `<select name="default_region" class="input">${state.awsRegions
            .map((r) => `<option value="${r.id}" ${(workspace?.defaultRegion || workspace?.default_region || "us-east-1") === r.id ? "selected" : ""}>${r.name} (${r.id})</option>`)
            .join("")}</select>`
        )}
      </div>
      <div class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div class="text-sm font-medium mb-2">Default credentials (optional)</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input name="default_access_key_id" class="input" placeholder="${hasDefaults ? "•••••••• (leave blank to keep)" : "AKIA..."}" />
          <input name="default_secret_access_key" type="password" class="input" placeholder="${hasDefaults ? "•••••••• (leave blank to keep)" : "Secret Access Key"}" />
        </div>
        <p class="text-xs text-gray-500 mt-2">These credentials can be reused when adding services. They are stored encrypted.</p>
      </div>
      <div class="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
        <button type="button" id="workspace-cancel" class="btn-secondary px-6">Cancel</button>
        <button type="submit" class="btn-primary px-8">Save Workspace</button>
      </div>
    </form>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
  const close = () => modal.classList.add("hidden");
  el("workspace-close").onclick = close;
  el("workspace-cancel").onclick = close;
  el("workspace-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const defaultAccessKeyId = String(form.get("default_access_key_id") || "").trim();
    const defaultSecretAccessKey = String(form.get("default_secret_access_key") || "").trim();
    const payload = {
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      color: String(form.get("color") || "#f97316"),
      defaultRegion: String(form.get("default_region") || "us-east-1"),
    };
    if (defaultAccessKeyId) payload.defaultAccessKeyId = defaultAccessKeyId;
    if (defaultSecretAccessKey) payload.defaultSecretAccessKey = defaultSecretAccessKey;
    try {
      const id = String(form.get("id") || "").trim();
      const saved = id
        ? await window.OggoAPI.updateWorkspace(id, payload)
        : await window.OggoAPI.createWorkspace(payload);
      await refreshData();
      if (saved?.id) {
        state.activeWorkspaceId = saved.id;
        await loadWorkspaceDetail(saved.id);
        state.view = "workspace-detail";
      } else {
        state.view = "all-workspaces";
      }
      render();
      bindViewEvents();
      close();
      toast(`Workspace ${id ? "updated" : "created"}`, "success");
    } catch (error) {
      toast(error.message, "error");
    }
  };
}

function getWorkspaceServiceById(serviceId) {
  const services = state.workspaceDetail?.services || {};
  for (const key of Object.keys(services)) {
    const found = (services[key] || []).find((row) => row.id === serviceId);
    if (found) return { ...found, serviceType: key };
  }
  return null;
}

function serviceConfigFields(serviceType, config = {}) {
  if (serviceType === "s3") {
    return `
      ${field("Path prefix", `<input name="cfg_prefix" class="input" value="${escapeHtml(config.prefix || "")}" placeholder="uploads/" />`)}
      ${field("Path style", `<select name="cfg_pathStyle" class="input"><option value="false" ${(String(config.pathStyle || "false") === "false") ? "selected" : ""}>Disabled</option><option value="true" ${(String(config.pathStyle || "false") === "true") ? "selected" : ""}>Enabled</option></select>`)}
    `;
  }
  if (serviceType === "sns") return field("Protocol", `<input name="cfg_protocol" class="input" value="${escapeHtml(config.protocol || "")}" placeholder="https" />`);
  if (serviceType === "ses") return field("From Name", `<input name="cfg_fromName" class="input" value="${escapeHtml(config.fromName || "")}" placeholder="Cronix Alerts" />`);
  if (serviceType === "cloudwatch") return field("Log Stream Prefix", `<input name="cfg_logStreamPrefix" class="input" value="${escapeHtml(config.logStreamPrefix || "")}" />`);
  if (serviceType === "rds") {
    return `
      ${field("Port", `<input name="cfg_port" type="number" class="input" value="${escapeHtml(String(config.port || "3306"))}" />`)}
      ${field("Database engine", `<select name="cfg_engine" class="input"><option value="mysql" ${String(config.engine || "mysql") === "mysql" ? "selected" : ""}>MySQL</option><option value="postgresql" ${String(config.engine || "") === "postgresql" ? "selected" : ""}>PostgreSQL</option><option value="mariadb" ${String(config.engine || "") === "mariadb" ? "selected" : ""}>MariaDB</option></select>`)}
    `;
  }
  return "";
}

function collectServiceConfig(serviceType, form) {
  if (serviceType === "s3") return { prefix: String(form.get("cfg_prefix") || "").trim(), pathStyle: String(form.get("cfg_pathStyle") || "false") === "true" };
  if (serviceType === "sns") return { protocol: String(form.get("cfg_protocol") || "").trim() };
  if (serviceType === "ses") return { fromName: String(form.get("cfg_fromName") || "").trim() };
  if (serviceType === "cloudwatch") return { logStreamPrefix: String(form.get("cfg_logStreamPrefix") || "").trim() };
  if (serviceType === "rds") return { port: Number(form.get("cfg_port") || 3306), engine: String(form.get("cfg_engine") || "mysql") };
  return {};
}

function validateServiceIdentifier(serviceType, resourceIdentifier) {
  if (!resourceIdentifier) return `${WORKSPACE_SERVICE_META[serviceType]?.resourceLabel || "Identifier"} is required`;
  if (serviceType === "sns" && !/^arn:aws:sns:[^:]+:\d+:.+/.test(resourceIdentifier)) return "Topic ARN format is invalid";
  if (serviceType === "ec2" && !/^i-[a-zA-Z0-9]+/.test(resourceIdentifier)) return "EC2 instance ID format is invalid";
  return "";
}

function openWorkspaceServiceModal(serviceType, existingService = null) {
  const workspace = state.workspaceDetail;
  if (!workspace) return;
  const modal = el("job-modal");
  const body = el("job-modal-body");
  const meta = WORKSPACE_SERVICE_META[serviceType] || { label: serviceType, resourceLabel: "Identifier" };
  const regionValue = existingService?.region || workspace.defaultRegion || "us-east-1";
  const config = existingService?.configJson || existingService?.config_json || {};
  const hasDefaults = Boolean(workspace.hasDefaultCredentials);
  body.innerHTML = `
    <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${existingService ? "Edit" : "Add"} ${meta.label} to ${escapeHtml(workspace.name)}</h3>
      <button type="button" id="ws-service-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="ws-service-form" class="space-y-5 p-6">
      <input type="hidden" name="service_type" value="${escapeHtml(serviceType)}" />
      ${existingService ? `<input type="hidden" name="service_id" value="${escapeHtml(existingService.id)}" />` : ""}
      <div>
        <div class="text-sm font-semibold mb-2">Identity</div>
        ${field("Friendly name", `<input name="friendly_name" class="input" required value="${escapeHtml(existingService?.friendlyName || existingService?.friendly_name || "")}" placeholder="Profile photos bucket" />`)}
      </div>
      <div>
        <div class="text-sm font-semibold mb-2">AWS Credentials</div>
        <div class="flex items-center gap-4 text-sm mb-2">
          ${hasDefaults ? `<label><input type="radio" name="credentials_mode" value="default" ${!existingService ? "checked" : ""} /> Use workspace default credentials</label>` : ""}
          <label><input type="radio" name="credentials_mode" value="specific" ${existingService || !hasDefaults ? "checked" : ""} /> Use specific credentials</label>
        </div>
        ${hasDefaults ? `<p class="text-xs text-gray-500 mb-2">Will use the saved default credentials for this workspace.</p>` : ""}
        <div id="ws-service-creds-fields" class="${hasDefaults && !existingService ? "hidden" : ""}">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="access_key_id" class="input" placeholder="${existingService ? "•••••••• (leave blank to keep)" : "Access Key ID"}" />
            <input name="secret_access_key" type="password" class="input" placeholder="${existingService ? "•••••••• (leave blank to keep)" : "Secret Access Key"}" />
          </div>
          ${existingService ? `<p class="text-xs text-gray-500 mt-1">Leave blank to keep existing credentials.</p>` : ""}
        </div>
      </div>
      <div>
        <div class="text-sm font-semibold mb-2">Service Configuration</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${field("AWS Region", `<select name="region" class="input">${state.awsRegions.map((r) => `<option value="${r.id}" ${regionValue === r.id ? "selected" : ""}>${r.name} (${r.id})</option>`).join("")}</select>`)}
          ${field(meta.resourceLabel, `<input name="resource_identifier" class="input" required value="${escapeHtml(existingService?.resourceIdentifier || existingService?.resource_identifier || "")}" />`)}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">${serviceConfigFields(serviceType, config)}</div>
      </div>
      <div>
        <div class="text-sm font-semibold mb-2">Test Connection</div>
        <button type="button" id="ws-service-test" class="btn-secondary">Test connection</button>
        <div id="ws-service-test-result" class="text-xs mt-2 text-gray-500">Optional but recommended.</div>
      </div>
      <div class="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
        <button type="button" id="ws-service-cancel" class="btn-secondary px-6">Cancel</button>
        <button type="submit" class="btn-primary px-8">Save</button>
      </div>
    </form>
  `;
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
  const close = () => modal.classList.add("hidden");
  el("ws-service-close").onclick = close;
  el("ws-service-cancel").onclick = close;
  const credsModeEls = Array.from(body.querySelectorAll("input[name='credentials_mode']"));
  credsModeEls.forEach((node) => {
    node.onchange = () => {
      const mode = body.querySelector("input[name='credentials_mode']:checked")?.value || "specific";
      el("ws-service-creds-fields").classList.toggle("hidden", mode === "default");
    };
  });

  el("ws-service-test").onclick = async () => {
    const resultEl = el("ws-service-test-result");
    const form = new FormData(el("ws-service-form"));
    const mode = form.get("credentials_mode") || "specific";
    const accessKeyId = String(form.get("access_key_id") || "").trim();
    const secretAccessKey = String(form.get("secret_access_key") || "").trim();
    const payload = {
      serviceType,
      friendlyName: String(form.get("friendly_name") || "").trim(),
      region: String(form.get("region") || "").trim(),
      resourceIdentifier: String(form.get("resource_identifier") || "").trim(),
      accessKeyId,
      secretAccessKey,
      configJson: collectServiceConfig(serviceType, form),
    };
    if (mode === "default" && workspace.hasDefaultCredentials) {
      const fake = await uiConfirm("Use workspace default credentials for test? This will test after save.", { title: "Test with defaults", okLabel: "OK", cancelLabel: "Back", danger: false });
      if (!fake) return;
      resultEl.className = "text-xs mt-2 text-gray-500";
      resultEl.textContent = "Default credentials selected. Save first, then use row Test.";
      return;
    }
    resultEl.className = "text-xs mt-2 text-gray-500";
    resultEl.textContent = "Testing...";
    try {
      const test = await window.OggoAPI.testWorkspaceServiceDraft(workspace.id, payload);
      resultEl.className = `text-xs mt-2 ${test.success ? "text-green-500" : "text-red-500"}`;
      resultEl.textContent = test.message || (test.success ? "Connection successful" : "Connection failed");
    } catch (error) {
      resultEl.className = "text-xs mt-2 text-red-500";
      resultEl.textContent = error.message || "Test failed";
    }
  };

  el("ws-service-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const mode = form.get("credentials_mode") || (workspace.hasDefaultCredentials ? "default" : "specific");
    const resourceIdentifier = String(form.get("resource_identifier") || "").trim();
    const validationMessage = validateServiceIdentifier(serviceType, resourceIdentifier);
    if (validationMessage) {
      toast(validationMessage, "error");
      return;
    }
    const payload = {
      serviceType,
      friendlyName: String(form.get("friendly_name") || "").trim(),
      region: String(form.get("region") || "").trim(),
      resourceIdentifier,
      configJson: collectServiceConfig(serviceType, form),
    };
    const serviceId = String(form.get("service_id") || "").trim();
    if (mode === "specific") {
      payload.accessKeyId = String(form.get("access_key_id") || "").trim();
      payload.secretAccessKey = String(form.get("secret_access_key") || "").trim();
      if (!serviceId && (!payload.accessKeyId || !payload.secretAccessKey)) {
        toast("Access Key ID and Secret Access Key are required", "error");
        return;
      }
    }
    try {
      let saved;
      if (serviceId) {
        saved = await window.OggoAPI.updateWorkspaceService(workspace.id, serviceId, payload);
      } else {
        saved = await window.OggoAPI.attachServiceToWorkspace(workspace.id, payload);
      }
      if ((mode === "default" || (!payload.accessKeyId && !payload.secretAccessKey)) && workspace.hasDefaultCredentials) {
        await window.OggoAPI.useWorkspaceDefaultCredentials(workspace.id, saved.id);
      }
      await refreshData();
      await loadWorkspaceDetail(workspace.id);
      render();
      bindViewEvents();
      close();
      toast(`Service ${serviceId ? "updated" : "attached"}`, "success");
    } catch (error) {
      toast(error.message, "error");
    }
  };
}

window.openWorkspaceServiceModal = openWorkspaceServiceModal;
window.uiConfirm = uiConfirm;
window.uiPrompt = uiPrompt;

async function scanSoftware(manager = "") {
  const scan = await window.OggoAPI.scanPackages(state.softwareServerId, manager);
  if (manager && state.packageScan?.sections?.length) {
    const incoming = Array.isArray(scan.sections) ? scan.sections : [];
    const nextSections = [...(state.packageScan.sections || [])];
    incoming.forEach((section) => {
      const idx = nextSections.findIndex((s) => s.manager === section.manager);
      if (idx >= 0) nextSections[idx] = section;
      else nextSections.push(section);
    });
    state.packageScan = { ...state.packageScan, ...scan, sections: nextSections };
  } else {
    state.packageScan = scan;
  }
  state.packageStatDisplay = { ...(scan.stats || state.packageStatDisplay) };
}

async function refreshSoftwareHistory() {
  const panel = state.packageHistoryPanel || {};
  const rows = await window.OggoAPI.packageHistoryV2(
    state.softwareServerId,
    panel.limit || 100,
    panel.filter || "all",
    panel.search || ""
  );
  state.packageHistory = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const map = {};
  state.packageHistory.forEach((row) => {
    if (row.status !== "success") return;
    if (!["update", "install"].includes(String(row.action || "").toLowerCase())) return;
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts) || now - ts > 24 * 60 * 60 * 1000) return;
    map[`${row.package_manager}:${row.package_name}`] = true;
  });
  state.packageUpdatedToday = map;
}

function changelogUrlForPackage(manager, packageName) {
  if (manager === "npm" || manager === "yarn") return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
  if (manager === "pip" || manager === "pip3") return `https://pypi.org/project/${encodeURIComponent(packageName)}/`;
  if (manager === "composer") return `https://packagist.org/packages/${encodeURIComponent(packageName)}`;
  if (manager === "gem") return `https://rubygems.org/gems/${encodeURIComponent(packageName)}`;
  return "";
}

function packageKey(manager, packageName) {
  return `${manager}:${packageName}`;
}

function classifyOutputLine(line) {
  const s = String(line || "");
  if (/\b(error|err)\b/i.test(s)) return "error";
  if (/\bwarn(ing)?\b/i.test(s)) return "warn";
  if (/\b(added|updated|success|installed)\b/i.test(s)) return "success";
  return "muted";
}

function closePackagePanels() {
  state.packagePanel = { type: "", key: "", loading: false, data: null, manager: "", packageName: "", version: "" };
  state.packageHistoryPanel.open = false;
  const floating = el("pkg-update-confirm");
  if (floating) floating.remove();
}

function animatePackageStats(targetStats = {}) {
  const start = { ...(state.packageStatDisplay || {}) };
  const target = {
    totalPackages: Number(targetStats.totalPackages || 0),
    updatesAvailable: Number(targetStats.updatesAvailable || 0),
    vulnerabilities: Number(targetStats.vulnerabilities || 0),
  };
  const started = Date.now();
  const duration = 600;
  const tick = () => {
    const pct = Math.min(1, (Date.now() - started) / duration);
    state.packageStatDisplay = {
      totalPackages: Math.round(start.totalPackages + (target.totalPackages - start.totalPackages) * pct),
      updatesAvailable: Math.round(start.updatesAvailable + (target.updatesAvailable - start.updatesAvailable) * pct),
      vulnerabilities: Math.round(start.vulnerabilities + (target.vulnerabilities - start.vulnerabilities) * pct),
    };
    render();
    bindViewEvents();
    if (pct < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function queueScanTerminalLine(text, tone = "muted") {
  const delay = 80;
  return new Promise((resolve) => {
    setTimeout(() => {
      state.packageScanTerminal.push({ text, tone, at: Date.now() });
      state.packageScanTerminal = state.packageScanTerminal.slice(-250);
      render();
      bindViewEvents();
      resolve();
    }, delay);
  });
}

function updateSectionFromStreaming(section) {
  if (!section) return;
  if (!state.packageScan) {
    state.packageScan = {
      serverId: state.softwareServerId,
      serverName: "",
      scannedAt: new Date().toISOString(),
      detectedManagers: [],
      stats: { totalPackages: 0, updatesAvailable: 0, vulnerabilities: 0 },
      sections: [],
    };
  }
  const nextSections = [...(state.packageScan.sections || [])];
  const idx = nextSections.findIndex((s) => s.manager === section.manager);
  if (idx >= 0) nextSections[idx] = section;
  else nextSections.push(section);
  state.packageScan.sections = nextSections;
}

async function startStreamingScan(manager = "") {
  if (state.packageScanInProgress) return;
  state.packageScanInProgress = true;
  state.packageSectionScanningManager = manager || "";
  state.packageScanTerminal = [];
  state.packageScanProgress = { completed: 0, total: 0 };
  if (!manager) {
    state.packageScan = {
      serverId: state.softwareServerId,
      serverName: "",
      scannedAt: new Date().toISOString(),
      detectedManagers: [],
      stats: { totalPackages: 0, updatesAvailable: 0, vulnerabilities: 0 },
      sections: [],
    };
  }
  render();
  bindViewEvents();

  const source = window.OggoAPI.streamPackageScan(state.softwareServerId, manager);
  const managerStarts = {};
  const safeClose = () => {
    try { source.close(); } catch (_e) {}
  };

  const fail = async (msg) => {
    await queueScanTerminalLine(`✗ ${msg || "Scan failed"}`, "error");
    state.packageScanInProgress = false;
    state.packageSectionScanningManager = "";
    safeClose();
    render();
    bindViewEvents();
  };

  source.addEventListener("progress", async (event) => {
    const data = JSON.parse(event.data || "{}");
    if (data.type === "start") {
      managerStarts[data.manager] = true;
      state.packageScanProgress.total = Object.keys(managerStarts).length;
      await queueScanTerminalLine(`Scanning ${data.manager}...`, "muted");
      return;
    }
    if (data.type === "package") {
      const update = data.latest && data.latest !== data.installed
        ? ` -> ${data.latest} (${String(data.updateType || "none").toUpperCase()})`
        : "";
      const tone = String(data.updateType || "").toLowerCase() === "major"
        ? "error"
        : String(data.updateType || "").toLowerCase() === "minor"
          ? "warn"
          : String(data.updateType || "").toLowerCase() === "patch"
            ? "success"
            : "muted";
      await queueScanTerminalLine(`  ✓ ${data.name} ${data.installed || "-"}${update}`, tone);
      return;
    }
    if (data.type === "complete") {
      state.packageScanProgress.completed += 1;
      updateSectionFromStreaming(data.section);
      await queueScanTerminalLine(`✓ Done: ${data.count || 0} packages, ${data.outdated || 0} updates`, "success");
      render();
      bindViewEvents();
    }
  });

  source.addEventListener("done", async (event) => {
    const data = JSON.parse(event.data || "{}");
    const payload = data.payload || null;
    if (payload) {
      if (manager && state.packageScan?.sections?.length) {
        (payload.sections || []).forEach((section) => updateSectionFromStreaming(section));
        state.packageScan = { ...state.packageScan, scannedAt: payload.scannedAt, stats: payload.stats };
      } else {
        state.packageScan = payload;
      }
      animatePackageStats(payload.stats || {});
    } else {
      animatePackageStats({
        totalPackages: data.totalPackages || 0,
        updatesAvailable: data.totalUpdates || 0,
        vulnerabilities: data.totalVulns || 0,
      });
    }
    state.packageScanProgress = {
      completed: Math.max(state.packageScanProgress.completed, state.packageScanProgress.total || 0),
      total: Math.max(state.packageScanProgress.total, state.packageScanProgress.completed || 0),
    };
    await queueScanTerminalLine(`Scan complete: ${data.totalPackages || 0} packages found, ${data.totalUpdates || 0} updates available`, "success");
    state.packageScanInProgress = false;
    state.packageSectionScanningManager = "";
    safeClose();
    await refreshSoftwareHistory();
    render();
    bindViewEvents();
  });

  source.addEventListener("error", async () => {
    await fail("Streaming connection failed");
  });
}

function buildUpdateConfirmHtml(pkg, type) {
  const banner = pkg.pinned
    ? `<div class="pkg-confirm-banner">This package is pinned. Updating will not affect its pinned status.</div>`
    : "";
  if (type === "PATCH") {
    return `
      ${banner}
      <div class="pkg-confirm-title">${escapeHtml(pkg.name)}</div>
      <div class="pkg-confirm-sub">${escapeHtml(pkg.fromVersion || "?")} -> ${escapeHtml(pkg.toVersion || "latest")}</div>
      <div class="pkg-badge pkg-badge-patch">Safe — patch update</div>
      <p class="pkg-confirm-copy">Patch updates fix bugs. No breaking changes expected.</p>
      <div class="pkg-confirm-actions">
        <button class="btn-secondary text-xs" data-pkg-confirm-cancel="1">Cancel</button>
        <button class="btn-primary text-xs" data-pkg-confirm-ok="1">Confirm</button>
      </div>
    `;
  }
  if (type === "MINOR") {
    return `
      ${banner}
      <div class="pkg-confirm-title">${escapeHtml(pkg.name)}</div>
      <div class="pkg-confirm-sub">${escapeHtml(pkg.fromVersion || "?")} -> ${escapeHtml(pkg.toVersion || "latest")}</div>
      <div class="pkg-badge pkg-badge-minor">Review recommended</div>
      <p class="pkg-confirm-copy">Minor updates add features. Existing code should work but review the changelog.</p>
      ${pkg.changelogUrl ? `<a class="pkg-changelog-link" href="${escapeHtml(pkg.changelogUrl)}" target="_blank" rel="noreferrer">View changelog -></a>` : ""}
      <div class="pkg-confirm-actions">
        <button class="btn-secondary text-xs" data-pkg-confirm-cancel="1">Cancel</button>
        <button class="btn-primary text-xs pkg-confirm-minor" data-pkg-confirm-ok="1">Confirm</button>
      </div>
    `;
  }
  return `
    ${banner}
    <div class="pkg-confirm-major-head"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Breaking changes likely</div>
    <div class="pkg-confirm-title">${escapeHtml(pkg.name)}</div>
    <div class="pkg-confirm-sub">${escapeHtml(pkg.fromVersion || "?")} -> ${escapeHtml(pkg.toVersion || "latest")}</div>
    <p class="pkg-confirm-copy pkg-confirm-copy-danger">Major updates often contain breaking changes. Test on staging first.</p>
    ${pkg.changelogUrl ? `<a class="pkg-changelog-link pkg-changelog-major" href="${escapeHtml(pkg.changelogUrl)}" target="_blank" rel="noreferrer">View changelog -></a>` : ""}
    <input class="input mt-2" id="pkg-major-confirm-input" placeholder="Type package name to confirm" />
    <div class="pkg-confirm-actions">
      <button class="btn-secondary text-xs" data-pkg-confirm-cancel="1">Cancel</button>
      <button class="btn-danger text-xs" id="pkg-major-confirm-btn" data-pkg-confirm-ok="1" disabled>Confirm</button>
    </div>
  `;
}

function showUpdateConfirm(pkg, type, onConfirm, anchorEl = null) {
  const existing = el("pkg-update-confirm");
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id = "pkg-update-confirm";
  host.className = "pkg-update-confirm";
  host.innerHTML = buildUpdateConfirmHtml(pkg, type);
  document.body.appendChild(host);
  const rect = anchorEl?.getBoundingClientRect?.();
  const top = rect ? rect.bottom + window.scrollY + 6 : window.scrollY + 120;
  const left = rect ? Math.min(rect.left + window.scrollX, window.innerWidth - 420) : Math.max((window.innerWidth - 420) / 2, 24);
  host.style.top = `${top}px`;
  host.style.left = `${Math.max(24, left)}px`;
  if (window.lucide) window.lucide.createIcons();
  const close = () => host.remove();
  host.querySelector("[data-pkg-confirm-cancel]")?.addEventListener("click", close);
  host.querySelector("[data-pkg-confirm-ok]")?.addEventListener("click", async () => {
    if (type === "MAJOR") {
      const typed = String(host.querySelector("#pkg-major-confirm-input")?.value || "");
      if (typed !== pkg.name) return;
    }
    close();
    await onConfirm();
  });
  if (type === "MAJOR") {
    const input = host.querySelector("#pkg-major-confirm-input");
    const btn = host.querySelector("#pkg-major-confirm-btn");
    if (input && btn) {
      input.addEventListener("input", () => {
        btn.disabled = String(input.value || "") !== pkg.name;
      });
    }
  }
  const outside = (event) => {
    if (!host.contains(event.target)) {
      document.removeEventListener("mousedown", outside);
      close();
    }
  };
  setTimeout(() => document.addEventListener("mousedown", outside), 0);
}

async function runPackageOperationWithProgress(manager, packageName, action, extra = {}) {
  const key = packageKey(manager, packageName);
  const op = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    manager,
    packageName,
    action,
    status: "running",
    progress: 0,
    title: `${action === "uninstall" ? "Uninstalling" : action === "install" ? "Installing" : "Updating"} ${packageName} ${extra.fromVersion || ""}${extra.toVersion ? ` -> ${extra.toVersion}` : ""}`.trim(),
    lines: [{ text: "Starting operation...", tone: "muted" }],
    payload: { manager, packageName, action, ...extra, triggeredBy: "ui" },
  };
  state.packageRowOps[key] = op;
  render();
  bindViewEvents();
  const timer = setInterval(() => {
    const row = state.packageRowOps[key];
    if (!row || row.status !== "running") return clearInterval(timer);
    row.progress = Math.min(85, Number(row.progress || 0) + 6);
    render();
    bindViewEvents();
  }, 350);
  try {
    const result = await window.OggoAPI.packageOperation(state.softwareServerId, {
      manager,
      packageName,
      action,
      ...extra,
      triggeredBy: "ui",
    });
    clearInterval(timer);
    const text = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
    const lines = String(text || "").split(/\r?\n/).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      op.lines.push({ text: lines[i], tone: classifyOutputLine(lines[i]) });
      op.progress = Math.min(95, op.progress + 5);
      render();
      bindViewEvents();
    }
    op.status = result?.status === "success" ? "success" : "failed";
    op.progress = 100;
    op.lines.push({
      text: op.status === "success" ? "✓ Updated successfully" : "✗ Failed",
      tone: op.status === "success" ? "success" : "error",
    });
    render();
    bindViewEvents();
    if (op.status === "success") {
      setTimeout(() => {
        if (state.packageRowOps[key]?.id === op.id) {
          delete state.packageRowOps[key];
          render();
          bindViewEvents();
        }
      }, 3000);
    }
    state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
    return result;
  } catch (error) {
    clearInterval(timer);
    op.status = "failed";
    op.progress = 100;
    op.lines.push({ text: String(error?.message || "Operation failed"), tone: "error" });
    render();
    bindViewEvents();
    throw error;
  }
}

function olderVersionThan(a, b) {
  const sa = String(a || "").split(".").map((n) => Number(n));
  const sb = String(b || "").split(".").map((n) => Number(n));
  for (let i = 0; i < Math.max(sa.length, sb.length); i += 1) {
    const av = Number.isFinite(sa[i]) ? sa[i] : 0;
    const bv = Number.isFinite(sb[i]) ? sb[i] : 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

async function openPackageVersionsPanel(manager, packageName, installedVersion) {
  state.packagePanel = {
    type: "versions",
    key: packageKey(manager, packageName),
    loading: true,
    data: [],
    manager,
    packageName,
    version: installedVersion || "",
  };
  render();
  bindViewEvents();
  try {
    const rows = await window.OggoAPI.packageVersionsV2(state.softwareServerId, manager, packageName, 10);
    state.packagePanel.loading = false;
    state.packagePanel.data = Array.isArray(rows) ? rows : [];
    render();
    bindViewEvents();
  } catch (error) {
    state.packagePanel.loading = false;
    state.packagePanel.data = [];
    state.packagePanel.error = error.message || "Failed to load versions";
    render();
    bindViewEvents();
  }
}

async function openPackageCvePanel(manager, packageName, installedVersion) {
  state.packagePanel = {
    type: "cves",
    key: packageKey(manager, packageName),
    loading: true,
    data: [],
    manager,
    packageName,
    version: installedVersion || "",
  };
  render();
  bindViewEvents();
  try {
    const rows = await window.OggoAPI.packageCVEs(state.softwareServerId, manager, packageName, installedVersion || "");
    state.packagePanel.loading = false;
    state.packagePanel.data = Array.isArray(rows) ? rows : [];
    render();
    bindViewEvents();
  } catch (error) {
    state.packagePanel.loading = false;
    state.packagePanel.data = [];
    state.packagePanel.error = error.message || "Failed to load CVE details";
    render();
    bindViewEvents();
  }
}

function toRelativeDays(dateStr) {
  const ts = new Date(dateStr || "").getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const days = Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
  return `${days}d ago`;
}

function exportPackageHistoryCsv(rows = []) {
  const header = ["time", "manager", "package", "action", "from", "to", "status", "output"];
  const escape = (s) => `"${String(s || "").replaceAll('"', '""')}"`;
  const csv = [
    header.join(","),
    ...rows.map((row) => [
      escape(row.created_at),
      escape(row.package_manager),
      escape(row.package_name),
      escape(row.action),
      escape(row.from_version),
      escape(row.to_version),
      escape(row.status),
      escape(row.output),
    ].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cronix-package-history-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchMissingPackageDescriptions() {
  const scan = state.packageScan;
  if (!scan?.sections?.length) return;
  const queue = [];
  scan.sections.forEach((section) => {
    (section.packages || []).forEach((pkg) => {
      const desc = String(pkg.description || "").trim();
      if (desc && desc !== "No description available") return;
      if (pkg.manager !== "npm") return;
      if (state.packageDescCache[packageKey(pkg.manager, pkg.name)]) return;
      queue.push(pkg);
    });
  });
  const targets = queue.slice(0, 20);
  await Promise.all(
    targets.map(async (pkg) => {
      try {
        const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/latest`);
        if (!response.ok) return;
        const data = await response.json();
        const desc = String(data?.description || "").trim();
        if (desc) {
          state.packageDescCache[packageKey(pkg.manager, pkg.name)] = desc;
        }
      } catch (_error) {
        // noop
      }
    })
  );
  render();
  bindViewEvents();
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
    if (!(await uiConfirm(`Delete ${file.key}?`, { title: "Delete File", okLabel: "Delete", danger: true }))) return;
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

  if (
    terminalSocket &&
    terminalSocketServerId === serverId &&
    (terminalSocket.readyState === WebSocket.OPEN || terminalSocket.readyState === WebSocket.CONNECTING) &&
    terminalInstance
  ) {
    return;
  }

  state.activeTerminalServerId = serverId;
  statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Connecting...`;
  terminalGuiReady = false;
  state.terminalGui.loading = false;
  state.terminalGui.files = null;
  state.terminalGui.editor = null;
  renderGuiContent();

  if (terminalSocket) {
    terminalSocket.close();
    terminalSocket = null;
  }
  terminalSessionId = null;
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
  const fit = window.FitAddon ? new window.FitAddon.FitAddon() : null;
  const webLinksAddon = window.WebLinksAddon ? new window.WebLinksAddon.WebLinksAddon() : null;
  const searchAddon = window.SearchAddon ? new window.SearchAddon.SearchAddon() : null;
  if (fit) term.loadAddon(fit);
  if (webLinksAddon) term.loadAddon(webLinksAddon);
  if (searchAddon) term.loadAddon(searchAddon);
  term.open(container);
  if (fit) fit.fit();
  term.writeln("\r\n  Connecting to server...\r\n");

  const overlay = el("terminal-animation-overlay");
  if (overlay) overlay.classList.remove("hidden");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/terminal/${serverId}`);
  terminalSocket = ws;
  terminalSocketServerId = serverId;
  terminalInstance = term;
  terminalFitAddon = fit;
  terminalSearchAddon = searchAddon || null;
  terminalCurrentLine = "";
  terminalSuggestions = [];
  terminalSuggestionIndex = -1;

  ws.onopen = () => {
    terminalGuiReady = true;
    renderGuiContent();
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
        terminalSessionId = msg.sessionId || terminalSessionId;
        const sessionNode = el("terminal-session-id");
        if (sessionNode) sessionNode.textContent = terminalSessionId || "-";
        term.writeln("\r\nConnected.\r\n");
        const prefill = localStorage.getItem("oggo.terminal.prefill");
        if (prefill) {
          term.write(prefill);
          terminalCurrentLine = prefill;
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "data", data: prefill }));
          localStorage.removeItem("oggo.terminal.prefill");
        }
        if (overlay) overlay.classList.add("hidden");
        loadActiveTerminalGuiTab(true).catch(() => {});
        loadSavedCommands("global").catch(() => {});
      }
    } catch (_error) {
      term.write(event.data);
    }
  };
  ws.onclose = () => {
    statusNode.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-500"></span>Disconnected: ${server.name}`;
    terminalSessionId = null;
    terminalSocketServerId = null;
    terminalGuiReady = false;
    state.terminalGui.files = null;
    state.terminalGui.editor = null;
    const sessionNode = el("terminal-session-id");
    if (sessionNode) sessionNode.textContent = "-";
    if (overlay) overlay.classList.add("hidden");
    renderGuiContent();
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
      if (!terminalSearchAddon) {
        toast("Search addon not loaded in this browser session", "info");
        return false;
      }
      openSimpleModal({
        title: "Terminal Search",
        message: "Search in terminal",
        input: true,
        okLabel: "Find",
        cancelLabel: "Cancel",
      }).then((res) => {
        const q = res?.ok ? String(res.value || "") : "";
        if (q) terminalSearchAddon.findNext(q);
      });
      return false;
    }
    return true;
  });
  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
    if (terminalFitAddon) terminalFitAddon.fit();
  });
  window.addEventListener("resize", () => {
    if (terminalFitAddon) terminalFitAddon.fit();
  });
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
  const query = await uiPrompt("History search (Ctrl+R):", { title: "Terminal History Search", okLabel: "Search", defaultValue: "" });
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

function persistGlobalSearchRecent(item) {
  const next = [item, ...(state.globalSearch.recent || []).filter((entry) => entry.id !== item.id)].slice(0, 5);
  state.globalSearch.recent = next;
  localStorage.setItem("oggo.globalSearch.recent", JSON.stringify(next));
}

function getQuickSearchActions() {
  return [
    { id: "quick:add-job", title: "Add job", description: "Open new job form", action: "add-job", icon: "plus-circle" },
    { id: "quick:add-server", title: "Add server", description: "Open new server form", action: "add-server", icon: "server" },
    { id: "quick:new-workspace", title: "New workspace", description: "Create workspace", action: "new-workspace", icon: "folders" },
    { id: "quick:terminal", title: "Open terminal", description: "Go to SSH terminal", action: "terminal", icon: "terminal" },
    { id: "quick:settings", title: "Settings", description: "Open settings page", action: "settings", icon: "settings" },
  ];
}

function flattenGroupedSearchResults(grouped) {
  const flat = [];
  for (const group of grouped || []) {
    for (const item of group.results || []) {
      flat.push(item);
    }
  }
  return flat;
}

function renderGlobalSearchOverlay() {
  const overlay = el("global-search-overlay");
  const input = el("global-search-input");
  const results = el("global-search-results");
  if (!overlay || !input || !results) return;

  overlay.classList.toggle("hidden", !state.globalSearch.open);
  if (!state.globalSearch.open) return;

  const query = String(state.globalSearch.query || "").trim();
  if (!query) {
    const recent = state.globalSearch.recent || [];
    const quick = getQuickSearchActions();
    const pinned = state.globalSearch.pinned || [];
    state.globalSearch.flatResults = [...recent, ...quick, ...pinned];
    state.globalSearch.selectedIndex = Math.min(
      state.globalSearch.selectedIndex,
      Math.max(state.globalSearch.flatResults.length - 1, 0)
    );
    results.innerHTML = `
      <div class="space-y-4">
        <div>
          <div class="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Recent</div>
          ${(recent.length
            ? recent
                .map(
                  (item, index) => `<button data-global-search-pick="${index}" class="w-full text-left px-3 py-2 rounded-md ${
                    state.globalSearch.selectedIndex === index
                      ? "bg-orange-500/10 text-orange-500"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }">
                  <div class="text-sm font-medium">${escapeHtml(item.title || item.name || "Recent item")}</div>
                  <div class="text-xs text-gray-500">${escapeHtml(item.description || "")}</div>
                </button>`
                )
                .join("")
            : '<p class="text-xs text-gray-500">No recent pages yet.</p>')}
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Quick actions</div>
          ${quick
            .map(
              (item, index) => `<button data-global-search-pick="${recent.length + index}" class="w-full text-left px-3 py-2 rounded-md ${
                state.globalSearch.selectedIndex === recent.length + index
                  ? "bg-orange-500/10 text-orange-500"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }">
              <div class="text-sm font-medium flex items-center gap-2"><i data-lucide="${item.icon}" class="w-4 h-4"></i>${escapeHtml(item.title)}</div>
              <div class="text-xs text-gray-500">${escapeHtml(item.description || "")}</div>
            </button>`
            )
            .join("")}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const grouped = state.globalSearch.groupedResults || [];
  state.globalSearch.flatResults = flattenGroupedSearchResults(grouped);
  state.globalSearch.selectedIndex = Math.min(
    state.globalSearch.selectedIndex,
    Math.max(state.globalSearch.flatResults.length - 1, 0)
  );
  let cursor = 0;
  results.innerHTML = grouped.length
    ? grouped
        .map((group) => {
          const head = `
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] uppercase tracking-wide text-gray-500">${escapeHtml(group.category)} (${group.total})</span>
              ${group.hasMore ? '<span class="text-[11px] text-orange-500">Show all</span>' : ""}
            </div>
          `;
          const rows = (group.results || [])
            .map((item) => {
              const index = cursor++;
              return `<button data-global-search-pick="${index}" class="w-full text-left px-3 py-2 rounded-md ${
                state.globalSearch.selectedIndex === index
                  ? "bg-orange-500/10 text-orange-500"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }">
                <div class="text-sm font-medium">${escapeHtml(item.title || item.name || "")}</div>
                <div class="text-xs text-gray-500">${escapeHtml(item.description || "")}</div>
              </button>`;
            })
            .join("");
          return `<div class="mb-3">${head}${rows}</div>`;
        })
        .join("")
    : '<p class="text-sm text-gray-500">No matches found.</p>';
}

async function performGlobalSearch() {
  const query = String(state.globalSearch.query || "").trim();
  if (!query) {
    state.globalSearch.groupedResults = [];
    renderGlobalSearchOverlay();
    return;
  }
  try {
    const result = await window.OggoAPI.search(query, {
      workspaceId: state.activeWorkspaceId || "",
      maxPerGroup: 20,
    });
    state.globalSearch.groupedResults = result.grouped || [];
    state.globalSearch.indexBuiltAt = result.builtAt || null;
  } catch (error) {
    state.globalSearch.groupedResults = [];
    toast(error.message || "Search failed", "error");
  }
  state.globalSearch.selectedIndex = 0;
  renderGlobalSearchOverlay();
}

async function applyGlobalSearchSelection(item) {
  if (!item) return;
  if (item.action === "add-job") {
    closeGlobalSearch();
    openJobModal();
    return;
  }
  if (item.action === "add-server") {
    closeGlobalSearch();
    openServerModal();
    return;
  }
  if (item.action === "new-workspace") {
    closeGlobalSearch();
    openWorkspaceModal();
    return;
  }
  if (item.action === "terminal") {
    state.view = "terminal";
    state.navSection = "servers";
  } else if (item.action === "settings") {
    state.view = "settings";
    state.navSection = "settings";
  } else if (item.route === "workspace-detail") {
    state.view = "workspace-detail";
    state.navSection = "aws";
    state.activeWorkspaceId = item.entityId;
    await loadWorkspaceDetail(item.entityId);
  } else if (item.route === "s3-browser") {
    state.view = "s3-browser";
    state.navSection = "storage";
    await openS3Browser(item.entityId, "");
  } else if (item.route === "terminal" && item.entityId) {
    state.view = "terminal";
    state.navSection = "servers";
    state.activeTerminalServerId = item.entityId;
    localStorage.setItem("oggo.terminal.prefill", String(item.title || ""));
  } else {
    state.view = item.route || "dashboard";
    state.navSection = VIEW_TO_SECTION[state.view] || state.navSection;
  }

  persistGlobalSearchRecent(item);
  closeGlobalSearch();
  render();
  bindViewEvents();
  if (state.view === "terminal" && state.activeTerminalServerId) {
    connectTerminal(state.activeTerminalServerId);
  }
}

function openGlobalSearch() {
  state.globalSearch.open = true;
  state.globalSearch.query = "";
  state.globalSearch.selectedIndex = 0;
  renderGlobalSearchOverlay();
  const input = el("global-search-input");
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 0);
  }
}

function closeGlobalSearch() {
  state.globalSearch.open = false;
  renderGlobalSearchOverlay();
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
      const nextView =
        state.sectionLastView[section] ||
        (section === "aws" ? "all-workspaces" : NAV_STRUCTURE[section]?.items?.find((i) => i.view)?.view) ||
        "dashboard";
      state.view = nextView;
      await refreshData();
      if (state.view === "workspace-detail" && state.activeWorkspaceId) {
        await loadWorkspaceDetail(state.activeWorkspaceId);
      }
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
      const workspaceId = event.target.closest("[data-context-workspace-id]")?.dataset?.contextWorkspaceId;
      if (action === "add-server") {
        openServerModal();
        return;
      }
      if (action === "add-s3") {
        openS3Modal();
        return;
      }
      if (action === "new-workspace") {
        openWorkspaceModal();
        return;
      }
      if (!view) return;
      state.view = view;
      if (workspaceId) {
        state.activeWorkspaceId = workspaceId;
      }
      state.sectionLastView[state.navSection] = view;
      await refreshData();
      if (state.view === "workspace-detail" && state.activeWorkspaceId) {
        await loadWorkspaceDetail(state.activeWorkspaceId);
      }
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

  const workspaceSwitcher = el("top-workspace-switcher");
  if (workspaceSwitcher) {
    workspaceSwitcher.onchange = async () => {
      state.activeWorkspaceId = workspaceSwitcher.value;
      if (state.activeWorkspaceId) {
        await loadWorkspaceDetail(state.activeWorkspaceId);
        state.view = "workspace-detail";
        state.navSection = "aws";
      }
      render();
      bindViewEvents();
    };
  }

  const searchBtn = el("global-search-btn");
  if (searchBtn) searchBtn.onclick = () => openGlobalSearch();

  const searchOverlay = el("global-search-overlay");
  const searchInput = el("global-search-input");
  const searchResults = el("global-search-results");
  if (searchOverlay) {
    searchOverlay.onclick = (event) => {
      if (event.target.id === "global-search-overlay") closeGlobalSearch();
    };
  }
  if (searchInput) {
    searchInput.oninput = async (event) => {
      state.globalSearch.query = event.target.value;
      await performGlobalSearch();
    };
    searchInput.onkeydown = async (event) => {
      const max = Math.max((state.globalSearch.flatResults || []).length - 1, 0);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        state.globalSearch.selectedIndex = Math.min(max, state.globalSearch.selectedIndex + 1);
        renderGlobalSearchOverlay();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        state.globalSearch.selectedIndex = Math.max(0, state.globalSearch.selectedIndex - 1);
        renderGlobalSearchOverlay();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const picked = state.globalSearch.flatResults[state.globalSearch.selectedIndex];
        if (picked) await applyGlobalSearchSelection(picked);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeGlobalSearch();
      }
    };
  }
  if (searchResults) {
    searchResults.onclick = async (event) => {
      const idx = Number(event.target.closest("[data-global-search-pick]")?.dataset?.globalSearchPick);
      if (Number.isFinite(idx)) {
        const picked = state.globalSearch.flatResults[idx];
        if (picked) await applyGlobalSearchSelection(picked);
      }
    };
  }

  document.addEventListener("keydown", async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openGlobalSearch();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && state.view === "software-package-manager" && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!state.packageScanInProgress) {
        try {
          await startStreamingScan();
        } catch (_error) {
          // no-op
        }
      }
      return;
    }
    if (event.key === "Escape" && state.globalSearch.open) {
      event.preventDefault();
      closeGlobalSearch();
      return;
    }
    if (event.key === "Escape") {
      const modal = el("job-modal");
      if (modal && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
      }
      closePackagePanels();
      render();
      bindViewEvents();
    }
  });

  const restartBtn = el("server-restart-btn");
  if (restartBtn) {
    restartBtn.onclick = async () => {
      if (await uiConfirm("Restart the oggo-server?", { title: "Restart Server", okLabel: "Restart", danger: true })) {
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
      if (await uiConfirm("Stop the oggo-server? You will need to start it manually from the terminal.", { title: "Stop Server", okLabel: "Stop", danger: true })) {
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

  if (state.view === "workspaces" || state.view === "all-workspaces") {
    const addBtn = el("add-workspace-btn");
    const addBtnEmpty = el("add-workspace-btn-empty");
    if (addBtn) addBtn.onclick = () => openWorkspaceModal();
    if (addBtnEmpty) addBtnEmpty.onclick = () => openWorkspaceModal();
    el("app-content").onclick = async (event) => {
      const openId = event.target.closest("[data-workspace-open]")?.dataset?.workspaceOpen;
      const editId = event.target.closest("[data-workspace-edit]")?.dataset?.workspaceEdit;
      const deleteId = event.target.closest("[data-workspace-delete]")?.dataset?.workspaceDelete;
      try {
        if (openId) {
          state.activeWorkspaceId = openId;
          await loadWorkspaceDetail(openId);
          state.view = "workspace-detail";
          render();
          bindViewEvents();
          return;
        }
        if (editId) {
          const detail = await window.OggoAPI.getWorkspace(editId);
          openWorkspaceModal(detail);
          return;
        }
        if (deleteId) {
          if (!(await uiConfirm("Delete this workspace?", { title: "Delete Workspace", okLabel: "Delete", danger: true }))) return;
          await window.OggoAPI.deleteWorkspace(deleteId);
          await refreshData();
          state.view = "all-workspaces";
          toast("Workspace deleted", "success");
          render();
          bindViewEvents();
        }
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

  if (state.view === "workspace-detail") {
    el("app-content").onclick = async (event) => {
      const editId = event.target.closest("[data-workspace-edit]")?.dataset?.workspaceEdit;
      const deleteId = event.target.closest("[data-workspace-delete]")?.dataset?.workspaceDelete;
      const addServiceType = event.target.closest("[data-workspace-add-service]")?.dataset?.workspaceAddService;
      try {
        if (editId) {
          const detail = await window.OggoAPI.getWorkspace(editId);
          openWorkspaceModal(detail);
          return;
        }
        if (deleteId) {
          if (!(await uiConfirm("Delete this workspace?", { title: "Delete Workspace", okLabel: "Delete", danger: true }))) return;
          await window.OggoAPI.deleteWorkspace(deleteId);
          await refreshData();
          state.workspaceDetail = null;
          state.view = "all-workspaces";
          toast("Workspace deleted", "success");
          render();
          bindViewEvents();
          return;
        }
        if (addServiceType && state.activeWorkspaceId) {
          openWorkspaceServiceModal(addServiceType);
          return;
        }
        const defaultCreds = event.target.closest("[data-workspace-default-credentials]");
        if (defaultCreds && state.workspaceDetail?.id) {
          openWorkspaceModal(state.workspaceDetail);
          return;
        }
        const testServiceId = event.target.closest("[data-workspace-service-test]")?.dataset?.workspaceServiceTest;
        if (testServiceId && state.activeWorkspaceId) {
          state.workspaceServiceTesting[testServiceId] = true;
          render();
          bindViewEvents();
          const result = await window.OggoAPI.testWorkspaceService(state.activeWorkspaceId, testServiceId);
          delete state.workspaceServiceTesting[testServiceId];
          toast(result.success ? "Service test successful" : `Service test failed: ${result.message}`, result.success ? "success" : "error");
          await loadWorkspaceDetail(state.activeWorkspaceId);
          render();
          bindViewEvents();
          return;
        }
        const editServiceId = event.target.closest("[data-workspace-service-edit]")?.dataset?.workspaceServiceEdit;
        if (editServiceId && state.activeWorkspaceId) {
          const existing = getWorkspaceServiceById(editServiceId);
          if (existing) openWorkspaceServiceModal(existing.serviceType, existing);
          return;
        }
        const deleteServiceId = event.target.closest("[data-workspace-service-delete]")?.dataset?.workspaceServiceDelete;
        if (deleteServiceId && state.activeWorkspaceId) {
          const confirmed = await uiConfirm("Remove this service attachment?", { title: "Remove Service", okLabel: "Remove", danger: true });
          if (!confirmed) return;
          await window.OggoAPI.detachServiceFromWorkspace(state.activeWorkspaceId, deleteServiceId);
          await refreshData();
          await loadWorkspaceDetail(state.activeWorkspaceId);
          toast("Service removed", "success");
          render();
          bindViewEvents();
          return;
        }
      } catch (error) {
        toast(error.message, "error");
      }
    };
  }

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
          if (!(await uiConfirm(`Delete server "${server?.name}"?`, { title: "Delete Server", okLabel: "Delete", danger: true }))) return;
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
    if (searchInput) {
      searchInput.oninput = () => {
        state.packageSearch = searchInput.value;
        render();
        bindViewEvents();
      };
    }
    if (scanBtn) {
      scanBtn.onclick = async () => {
        if (state.packageScanInProgress) return;
        try {
          await startStreamingScan();
          toast("Package scan completed", "success");
          await fetchMissingPackageDescriptions();
        } catch (error) {
          toast(error.message, "error");
        }
      };
      scanBtn.disabled = state.packageScanInProgress;
    }
    if (historyBtn) {
      historyBtn.onclick = async () => {
        try {
          state.packageHistoryPanel.open = true;
          await refreshSoftwareHistory();
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }
    el("app-content").onclick = async (event) => {
      const retryId = event.target.closest("[data-package-row-retry]")?.dataset?.packageRowRetry;
      if (retryId) {
        const op = Object.values(state.packageRowOps || {}).find((item) => item.id === retryId);
        if (op) {
          try {
            await runPackageOperationWithProgress(op.manager, op.packageName, op.action, op.payload || {});
            await scanSoftware();
            await refreshSoftwareHistory();
            render();
            bindViewEvents();
          } catch (error) {
            toast(error.message, "error");
          }
        }
        return;
      }
      const copyErr = event.target.closest("[data-package-copy-error]")?.dataset?.packageCopyError;
      if (copyErr) {
        const op = Object.values(state.packageRowOps || {}).find((item) => item.id === copyErr);
        if (op) {
          const text = (op.lines || []).map((line) => line.text).join("\n");
          await navigator.clipboard.writeText(text);
          toast("Error copied", "success");
        }
        return;
      }
      const pill = event.target.closest("[data-package-filter-pill]")?.dataset?.packageFilterPill;
      if (pill) {
        state.packageFilter = pill;
        render();
        bindViewEvents();
        return;
      }
      const toggleSection = event.target.closest("[data-toggle-section]")?.dataset?.toggleSection;
      if (toggleSection) {
        state.packageCollapsed[toggleSection] = !state.packageCollapsed[toggleSection];
        render();
        bindViewEvents();
        return;
      }
      const managerScan = event.target.closest("[data-scan-manager]")?.dataset?.scanManager;
      if (managerScan) {
        if (state.packageScanInProgress) return;
        try {
          await startStreamingScan(managerScan);
          await fetchMissingPackageDescriptions();
        } catch (error) {
          toast(error.message, "error");
        }
        return;
      }
      const panelClose = event.target.closest("[data-package-panel-close]");
      if (panelClose) {
        closePackagePanels();
        render();
        bindViewEvents();
        return;
      }
      const historyClose = event.target.closest("[data-history-close]");
      if (historyClose) {
        state.packageHistoryPanel.open = false;
        render();
        bindViewEvents();
        return;
      }
      const historyFilter = event.target.closest("[data-history-filter]")?.dataset?.historyFilter;
      if (historyFilter) {
        state.packageHistoryPanel.filter = historyFilter;
        await refreshSoftwareHistory();
        render();
        bindViewEvents();
        return;
      }
      const historyExport = event.target.closest("[data-history-export]");
      if (historyExport) {
        exportPackageHistoryCsv(state.packageHistory || []);
        return;
      }
      const selectAll = event.target.closest("[data-package-select-all]")?.dataset?.manager;
      if (selectAll) {
        const section = state.packageScan?.sections?.find((s) => s.manager === selectAll);
        const visible = getFilteredPackages(section?.packages || []);
        const checked = Boolean(event.target.checked);
        state.packageSelected[selectAll] = state.packageSelected[selectAll] || {};
        visible.forEach((pkg) => {
          state.packageSelected[selectAll][pkg.name] = checked;
        });
        render();
        bindViewEvents();
        return;
      }
      const rowSelect = event.target.closest("[data-package-select-row]");
      if (rowSelect) {
        const managerKey = rowSelect.dataset.manager;
        const packageKeyName = rowSelect.dataset.name;
        state.packageSelected[managerKey] = state.packageSelected[managerKey] || {};
        const checked = Boolean(rowSelect.checked);
        if (event.shiftKey && state.packageLastSelectedByManager[managerKey]) {
          const section = state.packageScan?.sections?.find((s) => s.manager === managerKey);
          const visible = getFilteredPackages(section?.packages || []).map((p) => p.name);
          const from = visible.indexOf(state.packageLastSelectedByManager[managerKey]);
          const to = visible.indexOf(packageKeyName);
          if (from >= 0 && to >= 0) {
            const [a, b] = from < to ? [from, to] : [to, from];
            visible.slice(a, b + 1).forEach((name) => {
              state.packageSelected[managerKey][name] = checked;
            });
          }
        } else {
          if (!event.ctrlKey && !event.metaKey) state.packageSelected[managerKey] = {};
          state.packageSelected[managerKey][packageKeyName] = checked;
        }
        state.packageLastSelectedByManager[managerKey] = packageKeyName;
        render();
        bindViewEvents();
        return;
      }
      const installVersion = event.target.closest("[data-package-install-version]");
      if (installVersion) {
        const version = installVersion.dataset.packageInstallVersion;
        const pkgManager = installVersion.dataset.manager;
        const pkgName = installVersion.dataset.name;
        const installed = installVersion.dataset.installed || "";
        const isDowngrade = olderVersionThan(version, installed);
        const msg = isDowngrade
          ? `Downgrade ${pkgName} from ${installed} to ${version}? Downgrading may remove features added since ${installed}.`
          : `Install ${pkgName}@${version}?`;
        if (!(await uiConfirm(msg, { title: isDowngrade ? "Confirm Downgrade" : "Confirm Install", okLabel: "Confirm", danger: isDowngrade }))) return;
        try {
          const result = await runPackageOperationWithProgress(pkgManager, pkgName, "install", {
            version,
            fromVersion: installed,
            toVersion: version,
          });
          toast(result.status === "success" ? (isDowngrade ? "Downgrade complete" : "Install complete") : "Operation failed", result.status === "success" ? "success" : "error");
          closePackagePanels();
          await scanSoftware(pkgManager);
          await refreshSoftwareHistory();
          render();
          bindViewEvents();
        } catch (error) {
          toast(error.message, "error");
        }
        return;
      }
      const fixCve = event.target.closest("[data-package-fix-cve]");
      if (fixCve) {
        const version = fixCve.dataset.packageFixCve;
        const pkgManager = fixCve.dataset.manager;
        const pkgName = fixCve.dataset.name;
        const installed = fixCve.dataset.installed || "";
        showUpdateConfirm(
          {
            manager: pkgManager,
            name: pkgName,
            fromVersion: installed,
            toVersion: version,
            pinned: false,
            changelogUrl: changelogUrlForPackage(pkgManager, pkgName),
          },
          "MINOR",
          async () => {
            const result = await runPackageOperationWithProgress(pkgManager, pkgName, "install", {
              version,
              fromVersion: installed,
              toVersion: version,
            });
            toast(result.status === "success" ? "Updated to CVE fix version" : "Operation failed", result.status === "success" ? "success" : "error");
            await scanSoftware(pkgManager);
            await refreshSoftwareHistory();
            render();
            bindViewEvents();
          },
          event.target
        );
        return;
      }
      const actionNode = event.target.closest("[data-package-action]");
      if (!actionNode) return;
      const action = actionNode.dataset.packageAction;
      const manager = actionNode.dataset.manager;
      const packageName = actionNode.dataset.name;
      const fromVersion = actionNode.dataset.from || "";
      const toVersion = actionNode.dataset.to || "";
      const installedVersion = actionNode.dataset.version || "";
      const updateType = actionNode.dataset.type || "UNKNOWN";
      try {
        if (action === "bulk-update") {
          const section = state.packageScan?.sections?.find((row) => row.manager === manager);
          const selected = state.packageSelected[manager] || {};
          const visible = getFilteredPackages(section?.packages || []);
          const base = Object.keys(selected).length
            ? visible.filter((pkg) => selected[pkg.name])
            : visible;
          const candidates = base.filter((pkg) => pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion);
          if (!candidates.length) {
            toast("No updatable packages in current filter", "info");
            return;
          }
          const pinnedSkipped = candidates.filter((pkg) => pkg.pinned).length;
          const list = candidates.filter((pkg) => !pkg.pinned);
          const majors = list.filter((pkg) => pkg.updateType === "MAJOR");
          const minors = list.filter((pkg) => pkg.updateType === "MINOR");
          const patches = list.filter((pkg) => pkg.updateType === "PATCH");
          const modal = el("job-modal");
          const body = el("job-modal-body");
          const rowHtml = (arr, title, cls) => arr.length ? `<div class="mb-3"><div class="text-xs ${cls} font-semibold mb-1">${title}</div>${arr.map((pkg) => `<label class="block text-xs py-1"><input type="checkbox" data-bulk-pkg="1" data-name="${escapeHtml(pkg.name)}" checked /> ${escapeHtml(pkg.name)} ${escapeHtml(pkg.installedVersion || "?")} -> ${escapeHtml(pkg.latestVersion || "latest")}</label>`).join("")}</div>` : "";
          body.innerHTML = `
            <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Bulk update (${list.length})</h3>
              <button type="button" id="bulk-close" class="text-gray-400 hover:text-gray-500"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>
            <div class="p-4 max-h-[70vh] overflow-auto">
              ${pinnedSkipped ? `<div class="text-xs text-orange-400 mb-2">${pinnedSkipped} pinned packages were skipped.</div>` : ""}
              <div class="text-xs text-gray-500 mb-3">${patches.length} safe updates, ${minors.length} minor updates, ${majors.length} breaking updates</div>
              ${rowHtml(majors, "MAJOR", "text-red-500")}
              ${rowHtml(minors, "MINOR", "text-orange-400")}
              ${rowHtml(patches, "PATCH", "text-green-500")}
              <div class="flex gap-2 mt-3">
                <button class="btn-primary text-xs" id="bulk-all">Update all</button>
                <button class="btn-secondary text-xs" id="bulk-safe">Update safe only (skip MAJOR)</button>
              </div>
            </div>`;
          modal.classList.remove("hidden");
          if (window.lucide) window.lucide.createIcons();
          el("bulk-close").onclick = () => modal.classList.add("hidden");
          const runBulk = async (safeOnly) => {
            const checkedNames = new Set(Array.from(body.querySelectorAll("[data-bulk-pkg='1']:checked")).map((n) => n.dataset.name));
            modal.classList.add("hidden");
            let ok = 0;
            let runList = list.filter((pkg) => checkedNames.has(pkg.name));
            if (safeOnly) runList = runList.filter((pkg) => pkg.updateType !== "MAJOR");
            for (const pkg of runList) {
              const result = await runPackageOperationWithProgress(manager, pkg.name, "update", {
                fromVersion: pkg.installedVersion || "",
                toVersion: pkg.latestVersion || "",
              });
              if (result.status === "success") ok += 1;
            }
            toast(`Bulk update finished: ${ok}/${runList.length} succeeded${pinnedSkipped ? `, ${pinnedSkipped} pinned skipped` : ""}`, ok === runList.length ? "success" : "error");
            await scanSoftware(manager);
            await refreshSoftwareHistory();
            render();
            bindViewEvents();
          };
          el("bulk-all").onclick = () => runBulk(false);
          el("bulk-safe").onclick = () => runBulk(true);
          return;
        }
        if (action === "update") {
          showUpdateConfirm(
            {
              manager,
              name: packageName,
              fromVersion,
              toVersion,
              pinned: actionNode.dataset.pinned === "1",
              changelogUrl: changelogUrlForPackage(manager, packageName),
            },
            updateType === "MAJOR" ? "MAJOR" : updateType === "MINOR" ? "MINOR" : "PATCH",
            async () => {
              const result = await runPackageOperationWithProgress(manager, packageName, "update", { fromVersion, toVersion });
              state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
              toast(result.status === "success" ? "Operation succeeded" : "Operation failed", result.status === "success" ? "success" : "error");
              await scanSoftware(manager);
              await refreshSoftwareHistory();
              await fetchMissingPackageDescriptions();
              render();
              bindViewEvents();
            },
            actionNode
          );
          return;
        }
        if (action === "uninstall") {
          if (!(await uiConfirm(`Uninstall ${packageName}?`, { title: "Uninstall Package", okLabel: "Uninstall", danger: true }))) return;
          const result = await runPackageOperationWithProgress(manager, packageName, "uninstall", { fromVersion, toVersion });
          state.installerOutput = [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n");
          toast(result.status === "success" ? "Operation succeeded" : "Operation failed", result.status === "success" ? "success" : "error");
          await scanSoftware(manager);
          await refreshSoftwareHistory();
          render();
          bindViewEvents();
          return;
        }
        if (action === "pin") {
          await window.OggoAPI.pinPackage(state.softwareServerId, { manager, packageName, version: actionNode.dataset.version || "" });
          toast("Package pinned", "success");
          await scanSoftware(manager);
          render();
          bindViewEvents();
          return;
        }
        if (action === "unpin") {
          await window.OggoAPI.unpinPackage(state.softwareServerId, { manager, packageName });
          toast("Package unpinned", "success");
          await scanSoftware(manager);
          render();
          bindViewEvents();
          return;
        }
        if (action === "versions") {
          await openPackageVersionsPanel(manager, packageName, installedVersion);
          return;
        }
        if (action === "vulns") {
          await openPackageCvePanel(manager, packageName, installedVersion);
        }
      } catch (error) {
        toast(error.message, "error");
      }
    };
    const historySearch = el("package-history-search");
    if (historySearch) {
      historySearch.oninput = async () => {
        state.packageHistoryPanel.search = historySearch.value;
        await refreshSoftwareHistory();
        render();
        bindViewEvents();
      };
    }
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
        if (!(await uiConfirm(`Install ${packageName} via ${manager}?`, { title: "Install Package", okLabel: "Install", danger: false }))) return;
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
        if (!(await uiConfirm("Run this custom install command on selected server?", { title: "Run Custom Command", okLabel: "Run", danger: true }))) return;
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
          if (!(await uiConfirm(`Delete S3 connection "${conn?.name}"?`, { title: "Delete S3 Connection", okLabel: "Delete", danger: true }))) return;
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
        if (!(await uiConfirm(`Delete file ${keyDelete}?`, { title: "Delete File", okLabel: "Delete", danger: true }))) return;
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
        if (!(await uiConfirm(`Delete ${state.s3Browser.selectedKeys.length} selected files?`, { title: "Delete Files", okLabel: "Delete", danger: true }))) return;
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
          if (!(await uiConfirm(`Delete AWS connection "${conn?.name}"?`, { title: "Delete AWS Connection", okLabel: "Delete", danger: true }))) return;
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
          const raw = await uiPrompt("Paste one domain per line (optional :port supported)", { title: "Bulk Add SSL Domains", okLabel: "Add", defaultValue: "" });
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
            if (!(await uiConfirm("Delete this SSL monitor?", { title: "Delete SSL Monitor", okLabel: "Delete", danger: true }))) return;
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
              resultNode.textContent = formatDnsLookupResult(result).slice(0, 280);
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
            if (!(await uiConfirm("Delete this DNS monitor?", { title: "Delete DNS Monitor", okLabel: "Delete", danger: true }))) return;
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
            if (!(await uiConfirm("Delete this port monitor?", { title: "Delete Port Monitor", okLabel: "Delete", danger: true }))) return;
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
          if (!(await uiConfirm("Delete this environment variable?", { title: "Delete Environment Variable", okLabel: "Delete", danger: true }))) return;
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
            if (!(await uiConfirm("Delete this HTTP check?", { title: "Delete HTTP Check", okLabel: "Delete", danger: true }))) return;
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
    if (!state.activeTerminalServerId && state.servers.length) {
      state.activeTerminalServerId = state.servers[0].id;
    }
    if (
      state.activeTerminalServerId &&
      (!terminalSocket ||
        terminalSocketServerId !== state.activeTerminalServerId ||
        terminalSocket.readyState === WebSocket.CLOSING ||
        terminalSocket.readyState === WebSocket.CLOSED)
    ) {
      connectTerminal(state.activeTerminalServerId);
    }
    renderGuiContent();
    loadSavedCommands("global").catch(() => {});
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
    document.querySelectorAll("[data-gui-tab]").forEach((button) => {
      button.onclick = async () => {
        state.terminalGui.activeTab = button.dataset.guiTab || "files";
        await loadActiveTerminalGuiTab(true);
      };
    });
    const guiRefresh = el("terminal-gui-refresh");
    if (guiRefresh) guiRefresh.onclick = () => loadActiveTerminalGuiTab(true);
    const guiRetry = el("gui-connect-retry");
    if (guiRetry) {
      guiRetry.onclick = () => {
        if (!state.activeTerminalServerId && state.servers.length) {
          state.activeTerminalServerId = state.servers[0].id;
        }
        if (state.activeTerminalServerId) {
          connectTerminal(state.activeTerminalServerId);
        }
      };
    }

    const guiPanel = el("terminal-gui-panel");
    const resizer = el("terminal-panel-resizer");
    if (guiPanel && resizer) {
      const serverKey = state.activeTerminalServerId || "default";
      resizer.onmousedown = (event) => {
        event.preventDefault();
        const rootRect = guiPanel.parentElement.getBoundingClientRect();
        const moveHandler = (moveEvent) => {
          const pct = ((moveEvent.clientX - rootRect.left) / rootRect.width) * 100;
          const next = Math.max(20, Math.min(65, pct));
          guiPanel.style.width = `${next}%`;
          guiPanel.style.flex = "0 0 auto";
          state.terminalGui.splitByServer[serverKey] = next;
          localStorage.setItem(`oggo.terminal.split.${serverKey}`, String(next));
          if (terminalFitAddon) terminalFitAddon.fit();
        };
        const upHandler = () => {
          window.removeEventListener("mousemove", moveHandler);
          window.removeEventListener("mouseup", upHandler);
        };
        window.addEventListener("mousemove", moveHandler);
        window.addEventListener("mouseup", upHandler);
      };
    }

    const guiRoot = el("terminal-gui-content");
    if (guiRoot) {
      guiRoot.oncontextmenu = (event) => {
        const row = event.target.closest("[data-gui-file-open]");
        if (!row) return;
        event.preventDefault();
        const cm = el("gui-context-menu");
        if (!cm) return;
        cm.dataset.fileName = row.dataset.guiFileOpen;
        cm.dataset.fileType = row.dataset.guiFileType;
        cm.style.left = `${event.clientX}px`;
        cm.style.top = `${event.clientY}px`;
        cm.classList.remove("hidden");
      };
      
      const cm = el("gui-context-menu");
      if (cm && !cm.dataset.bound) {
        cm.dataset.bound = "true";
        document.addEventListener("click", (e) => {
          if (!cm.contains(e.target)) cm.classList.add("hidden");
        });
        cm.onclick = async (e) => {
          const actionBtn = e.target.closest("[data-ctx-action]");
          if (!actionBtn) return;
          const action = actionBtn.dataset.ctxAction;
          const fileName = cm.dataset.fileName;
          const fileType = cm.dataset.fileType;
          cm.classList.add("hidden");
          
          if (!fileName) return;
          
          const current = String(state.terminalGui.path || "~");
          const base = current.endsWith("/") ? current.slice(0, -1) : current;
          const filePath = base === "/" ? `/${fileName}` : `${base || "~"}/${fileName}`;
          
          try {
            const runCmd = async (cmd, allowSudo = true) => {
              const res = await window.OggoAPI.guiRunCommand({ command: cmd, sessionId: terminalSessionId });
              if (res && res.exitCode === 0) return res;
              const errText = String(res?.errorOutput || res?.output || "").toLowerCase();
              if (!allowSudo || (!errText.includes("permission denied") && !errText.includes("not permitted") && !errText.includes("password"))) {
                throw new Error(res?.errorOutput || res?.output || "Command failed");
              }
              const auth = await promptSudoAuth();
              if (!auth) throw new Error(res?.errorOutput || res?.output || "Permission denied");
              const sudoUser = String(auth.sudoUser || "").trim();
              const sudoUserArg = sudoUser ? `-u ${sudoUser}` : "";
              const sudoRes = await window.OggoAPI.guiRunCommand({
                command: `sudo -S ${sudoUserArg} ${cmd}`,
                sessionId: terminalSessionId,
                stdin: `${auth.sudoPassword}\n`,
                timeoutMs: 30000,
              });
              if (sudoRes && sudoRes.exitCode !== 0) throw new Error(sudoRes.errorOutput || sudoRes.output || "sudo failed");
              return sudoRes;
            };
            if (action === "open") {
              const row = document.querySelector(`[data-gui-file-open="${fileName.replace(/"/g, '\\"')}"]`);
              if (row) row.click();
            } else if (action === "delete") {
              if (!(await uiConfirm(`Delete ${fileType} "${fileName}"?`, { title: "Delete Item", okLabel: "Delete", danger: true }))) return;
              const cmd = fileType === "directory" ? `rm -rf "${filePath}"` : `rm "${filePath}"`;
              await runCmd(cmd, true);
              toast("Deleted successfully", "success");
              await loadActiveTerminalGuiTab(true);
            } else if (action === "rename") {
              const newName = await uiPrompt(`Rename ${fileName} to:`, { title: "Rename", okLabel: "Rename", defaultValue: fileName });
              if (!newName || newName === fileName) return;
              const newPath = base === "/" ? `/${newName}` : `${base || "~"}/${newName}`;
              await runCmd(`mv "${filePath}" "${newPath}"`, true);
              toast("Renamed successfully", "success");
              await loadActiveTerminalGuiTab(true);
            } else if (action === "chmod") {
              const newPerms = await uiPrompt(`Change permissions for ${fileName} (e.g. 755 or 644):`, { title: "Change Permissions", okLabel: "Apply", defaultValue: "755" });
              if (!newPerms) return;
              await runCmd(`chmod ${newPerms} "${filePath}"`, true);
              toast("Permissions updated", "success");
              await loadActiveTerminalGuiTab(true);
            }
          } catch (error) {
            toast(error.message, "error");
          }
        };
      }

      guiRoot.onclick = async (event) => {
        try {
          const runCmd = async (cmd) => {
            const res = await window.OggoAPI.guiRunCommand({ command: cmd, sessionId: terminalSessionId });
            if (res && res.exitCode === 0) return res;
            const errText = String(res?.errorOutput || res?.output || "").toLowerCase();
            if (!errText.includes("permission denied") && !errText.includes("not permitted") && !errText.includes("password")) {
              throw new Error(res?.errorOutput || res?.output || "Command failed");
            }
            const auth = await promptSudoAuth();
            if (!auth) throw new Error(res?.errorOutput || res?.output || "Permission denied");
            const sudoUser = String(auth.sudoUser || "").trim();
            const sudoUserArg = sudoUser ? `-u ${sudoUser}` : "";
            const sudoRes = await window.OggoAPI.guiRunCommand({
              command: `sudo -S ${sudoUserArg} ${cmd}`,
              sessionId: terminalSessionId,
              stdin: `${auth.sudoPassword}\n`,
              timeoutMs: 30000,
            });
            if (sudoRes && sudoRes.exitCode !== 0) throw new Error(sudoRes.errorOutput || sudoRes.output || "sudo failed");
            return sudoRes;
          };
          if (event.target.closest("#gui-files-new-file")) {
            const name = await uiPrompt("New file name:", { title: "Create File", okLabel: "Create", defaultValue: "" });
            if (!name) return;
            const current = String(state.terminalGui.path || "~");
            const base = current.endsWith("/") ? current.slice(0, -1) : current;
            const filePath = base === "/" ? `/${name}` : `${base || "~"}/${name}`;
            await runCmd(`touch "${filePath}"`);
            toast("File created", "success");
            await loadActiveTerminalGuiTab(true);
          }
          if (event.target.closest("#gui-files-new-dir")) {
            const name = await uiPrompt("New folder name:", { title: "Create Folder", okLabel: "Create", defaultValue: "" });
            if (!name) return;
            const current = String(state.terminalGui.path || "~");
            const base = current.endsWith("/") ? current.slice(0, -1) : current;
            const dirPath = base === "/" ? `/${name}` : `${base || "~"}/${name}`;
            await runCmd(`mkdir -p "${dirPath}"`);
            toast("Folder created", "success");
            await loadActiveTerminalGuiTab(true);
          }
          if (event.target.closest("#gui-files-open")) {
            state.terminalGui.path = String(el("gui-files-path")?.value || "~").trim() || "~";
            state.terminalGui.showHidden = Boolean(el("gui-files-hidden")?.checked);
            state.terminalGui.editor = null;
            await loadActiveTerminalGuiTab(true);
          }
          if (event.target.closest("#gui-files-up")) {
            const current = String(state.terminalGui.path || "~");
            const normalized = current === "~" ? "/" : current;
            const parent = normalized === "/" ? "/" : normalized.split("/").slice(0, -1).join("/") || "/";
            state.terminalGui.path = parent;
            state.terminalGui.editor = null;
            await loadActiveTerminalGuiTab(true);
          }
          const openName = event.target.closest("[data-gui-file-open]")?.dataset?.guiFileOpen;
          const openType = event.target.closest("[data-gui-file-open]")?.dataset?.guiFileType;
          if (openName) {
            if (openType === "directory") {
              const current = String(state.terminalGui.path || "~");
              const base = current.endsWith("/") ? current.slice(0, -1) : current;
              state.terminalGui.path =
                base === "/" ? `/${openName}` : `${base || "~"}/${openName}`;
              state.terminalGui.editor = null;
              await loadActiveTerminalGuiTab(true);
            } else {
              const current = String(state.terminalGui.path || "~");
              const base = current.endsWith("/") ? current.slice(0, -1) : current;
              const filePath = base === "/" ? `/${openName}` : `${base || "~"}/${openName}`;
              const result = await window.OggoAPI.guiFsRead({
                sessionId: terminalSessionId,
                serverId: state.activeTerminalServerId,
                path: filePath,
              });
              if (result.tooLarge) {
                toast("File is too large for browser editor (>10MB).", "warning");
                return;
              }
              if (result.isBinary) {
                toast("Binary file detected; editor is text-only.", "warning");
                return;
              }
              if (result.warnLarge) {
                toast("Large file warning (>2MB). Editing may be slower.", "info");
              }
              state.terminalGui.editor = { path: result.path, content: result.content || "" };
              renderGuiContent();
            }
          }
          if (event.target.closest("#gui-editor-back")) {
            state.terminalGui.editor = null;
            renderGuiContent();
          }
          if (event.target.closest("#gui-editor-save")) {
            const editorContent = guiMonacoEditor ? guiMonacoEditor.getValue() : state.terminalGui.editor?.content || "";
            const path = String(state.terminalGui.editor?.path || "");
            if (!path) {
              toast("No editor file path selected", "warning");
            } else {
              try {
                await window.OggoAPI.guiFsWrite({
                  sessionId: terminalSessionId,
                  serverId: state.activeTerminalServerId,
                  path,
                  content: editorContent,
                });
                toast("File saved", "success");
              } catch (error) {
                if (!isPermissionDeniedError(error)) throw error;
                const auth = await promptSudoAuth();
                if (!auth) throw error;
                await window.OggoAPI.guiFsWrite({
                  sessionId: terminalSessionId,
                  serverId: state.activeTerminalServerId,
                  path,
                  content: editorContent,
                  sudoUser: auth.sudoUser,
                  sudoPassword: auth.sudoPassword,
                });
                toast("File saved (sudo)", "success");
              }
            }
          }
          if (event.target.closest("#gui-proc-refresh")) await loadActiveTerminalGuiTab(true);
          if (event.target.closest("#gui-proc-kill")) {
            await window.OggoAPI.guiKillProcess({
              sessionId: terminalSessionId,
              pid: Number(el("gui-proc-kill-pid")?.value || 0),
              signal: Number(el("gui-proc-signal")?.value || 15),
            });
            await loadActiveTerminalGuiTab(true);
          }
          if (event.target.closest("#gui-svc-refresh")) await loadActiveTerminalGuiTab(true);
          if (event.target.closest("#gui-svc-run")) {
            await window.OggoAPI.guiServiceAction({
              sessionId: terminalSessionId,
              service: String(el("gui-svc-name")?.value || "").trim(),
              action: String(el("gui-svc-action")?.value || "restart"),
            });
            await loadActiveTerminalGuiTab(true);
          }
          if (event.target.closest("#gui-logs-sources")) {
            const result = await window.OggoAPI.guiLogSources({ sessionId: terminalSessionId });
            state.terminalGui.logs.sources = result.paths || [];
            renderGuiContent();
          }
          if (event.target.closest("#gui-logs-open")) {
            const path = String(el("gui-logs-path")?.value || "").trim();
            if (path) {
              state.terminalGui.logs.selected = path;
              const output = await window.OggoAPI.guiReadLog({ sessionId: terminalSessionId, path, lines: 100 });
              state.terminalGui.logs.content = output.output || "";
              renderGuiContent();
            }
          }
          if (event.target.closest("#gui-disk-refresh")) {
            state.terminalGui.disk = await window.OggoAPI.guiDisk({
              sessionId: terminalSessionId,
              path: String(el("gui-disk-path")?.value || "/"),
            });
            renderGuiContent();
          }
          if (event.target.closest("#gui-disk-large")) {
            const result = await window.OggoAPI.guiFindLargeFiles({ sessionId: terminalSessionId });
            toast(`Large files loaded (${(result.output || "").split(/\n/).filter(Boolean).length})`, "success");
          }
          if (event.target.closest("#gui-net-refresh")) {
            state.terminalGui.network = await window.OggoAPI.guiNetwork({ sessionId: terminalSessionId });
            renderGuiContent();
          }
        } catch (error) {
          toast(error.message, "error");
        }
      };
    }

    const savedPanel = el("saved-commands-panel");
    if (savedPanel) {
      let savedScope = "global";
      savedPanel.onclick = async (event) => {
        const scope = event.target.closest("[data-saved-scope]")?.dataset?.savedScope;
        const runId = event.target.closest("[data-saved-run]")?.dataset?.savedRun;
        const deleteId = event.target.closest("[data-saved-delete]")?.dataset?.savedDelete;
        if (scope) {
          savedScope = scope;
          await loadSavedCommands(savedScope);
          return;
        }
        if (runId) {
          const data = await window.OggoAPI.listSavedCommands(
            savedScope,
            savedScope === "server" ? state.activeTerminalServerId : ""
          );
          const item = (data.commands || []).find((row) => row.id === runId);
          if (item && terminalSocket?.readyState === WebSocket.OPEN) {
            const cmd = `${item.command}\r`;
            terminalSocket.send(JSON.stringify({ type: "data", data: cmd }));
            await window.OggoAPI.markSavedCommandUsed(runId);
          }
          return;
        }
        if (deleteId) {
          await window.OggoAPI.deleteSavedCommand(deleteId);
          await loadSavedCommands(savedScope);
          return;
        }
      };
    }
    const savedAdd = el("saved-command-add");
    if (savedAdd) {
      savedAdd.onclick = async () => {
        const name = await uiPrompt("Saved command name", { title: "Save Command", okLabel: "Next", defaultValue: "" });
        if (!name) return;
        const command = await uiPrompt("Command", { title: "Save Command", okLabel: "Save", defaultValue: "" });
        if (!command) return;
        const useServerScope = await uiConfirm("Save only for this server? Choose Cancel for global.", { title: "Command Scope", okLabel: "Server Only", cancelLabel: "Global", danger: false });
        await window.OggoAPI.createSavedCommand({
          name,
          command,
          scope: useServerScope ? "server" : "global",
          serverId: useServerScope ? state.activeTerminalServerId : null,
        });
        await loadSavedCommands(useServerScope ? "server" : "global");
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
        terminalSessionId = null;
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
        configureSoftwareAutoScan();
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
      configureSoftwareAutoScan();
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
    configureSoftwareAutoScan();
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
