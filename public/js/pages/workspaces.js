/**
 * workspaces.js
 *
 * Frontend page helpers for AWS Workspaces.
 * Keeps workspace rendering and modal logic isolated from app.js.
 */
(function initWorkspacesPage() {
  /**
   * Escape HTML entities in user-provided text.
   *
   * @param {string} value
   * @returns {string}
   */
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Build readable summary like "2 S3 · 1 RDS".
   *
   * @param {Object} counts
   * @returns {string}
   */
  function formatCountSummary(counts) {
    const order = [
      ["s3", "S3"],
      ["rds", "RDS"],
      ["ec2", "EC2"],
      ["lambda", "Lambda"],
      ["sns", "SNS"],
      ["ses", "SES"],
      ["cloudwatch", "CloudWatch"],
      ["secrets", "Secrets"],
    ];
    const parts = order
      .filter(([key]) => Number(counts?.[key] || 0) > 0)
      .map(([key, label]) => `${Number(counts[key] || 0)} ${label}`);
    return parts.length ? parts.join(" · ") : "No services attached";
  }

  /**
   * Render one workspace card.
   *
   * @param {Object} workspace
   * @returns {string}
   */
  function renderWorkspaceCard(workspace) {
    const counts = workspace.service_counts || {};
    const totalServices = Object.values(counts).reduce((sum, v) => sum + Number(v || 0), 0);
    const isHealthy = true;
    return `
      <div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm" style="border-left:4px solid ${workspace.color || "#f97316"};">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(workspace.name)}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(workspace.description || "No description")}</p>
            <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">Account: <span class="font-mono">${escapeHtml(workspace.primary_connection?.account_id || "Not linked")}</span></p>
            <p class="text-xs mt-1 text-gray-500 dark:text-gray-400">Region: <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${escapeHtml(workspace.default_region || "us-east-1")}</span></p>
          </div>
          <span class="inline-flex items-center text-[11px] px-2 py-1 rounded-full ${isHealthy ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}">${isHealthy ? "Healthy" : "Issues"}</span>
        </div>
        <p class="text-xs mt-3 text-gray-600 dark:text-gray-300">${escapeHtml(formatCountSummary(counts))}</p>
        <p class="text-xs mt-1 text-gray-500 dark:text-gray-400">Total services: ${totalServices}</p>
        <div class="mt-4 flex items-center gap-2">
          <button data-workspace-open="${workspace.id}" class="btn-secondary text-xs">Open</button>
          <button data-workspace-edit="${workspace.id}" class="btn-secondary text-xs">Edit</button>
          <button data-workspace-delete="${workspace.id}" class="text-red-600 dark:text-red-400 text-sm">Delete</button>
        </div>
      </div>
    `;
  }

  /**
   * Render all workspaces page.
   *
   * @returns {Promise<string>}
   */
  async function renderWorkspacesPage() {
    const rows = await window.OggoAPI.getWorkspaces();
    const cards = rows.map(renderWorkspaceCard).join("");
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">All Workspaces</h2>
        <button id="add-workspace-btn" class="btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Add Workspace</button>
      </div>
      ${
        rows.length
          ? `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>`
          : `<div class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
               <i data-lucide="folders" class="w-10 h-10 text-gray-400 mx-auto"></i>
               <h3 class="mt-3 text-lg font-semibold">No workspaces yet</h3>
               <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a workspace to group AWS services by project.</p>
               <button id="add-workspace-btn-empty" class="btn-primary mt-4">Add Workspace</button>
             </div>`
      }
    `;
  }

  /**
   * Render one service type section.
   *
   * @param {string} type
   * @param {Array<Object>} services
   * @param {string} workspaceId
   * @returns {string}
   */
  function renderServiceSection(type, services, workspaceId) {
    if (!Array.isArray(services) || !services.length) return "";
    const titleMap = {
      s3: "S3 Buckets",
      sns: "SNS Topics",
      ses: "SES Identities",
      cloudwatch: "CloudWatch",
      rds: "RDS Databases",
      ec2: "EC2 Instances",
      lambda: "Lambda Functions",
      secrets: "Secrets Manager",
    };
    const rows = services
      .map((service) => {
        const identifier = service.service_identifier || service.s3_config_id || service.name || service.bucket_name || service.id;
        return `<div class="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-sm flex items-center justify-between gap-2">
          <div>
            <div class="font-medium">${escapeHtml(identifier)}</div>
            <div class="text-xs text-gray-500 mt-1">${escapeHtml(service.friendly_name || service.label || service.region || "workspace service")}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-secondary text-xs" data-workspace-service-action="${type}" data-workspace-service-id="${service.id || service.s3_config_id}" data-workspace-id="${workspaceId}">Open</button>
            <button class="text-red-600 dark:text-red-400 text-xs" data-workspace-detach-service="${service.id}" data-workspace-id="${workspaceId}">Detach</button>
          </div>
        </div>`;
      })
      .join("");
    return `<section data-workspace-service-section="${type}" class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">${titleMap[type] || type}</h3>
      </div>
      <div class="space-y-2">${rows}</div>
      <div class="mt-3">
        <button class="btn-secondary text-xs" data-workspace-add-service="${type}" data-workspace-id="${workspaceId}">+ Add ${titleMap[type] || type}</button>
      </div>
    </section>`;
  }

  /**
   * Render workspace detail page.
   *
   * @param {string} id
   * @returns {Promise<string>}
   */
  async function renderWorkspaceDetailPage(id) {
    const workspace = await window.OggoAPI.getWorkspace(id);
    const services = workspace.services || {};
    const sections = ["s3", "sns", "ses", "cloudwatch", "rds", "ec2", "lambda", "secrets"]
      .map((type) => renderServiceSection(type, services[type] || [], id))
      .filter(Boolean)
      .join("");

    return `
      <div class="space-y-4">
        <header class="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm" style="border-left:4px solid ${workspace.color || "#f97316"};">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-2xl font-semibold">${escapeHtml(workspace.name)}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(workspace.description || "No description")}</p>
              <p class="text-xs mt-2 text-gray-500 dark:text-gray-400">AWS Account: <span class="font-mono">${escapeHtml(workspace.aws_connections?.[0]?.account_id || "Not linked")}</span></p>
              <p class="text-xs mt-1 text-gray-500 dark:text-gray-400">Region: <span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${escapeHtml(workspace.default_region || "us-east-1")}</span></p>
            </div>
            <div class="flex items-center gap-2">
              <button data-workspace-edit="${workspace.id}" class="btn-secondary text-xs">Edit</button>
              <button data-workspace-delete="${workspace.id}" class="text-red-600 dark:text-red-400 text-sm">Delete</button>
            </div>
          </div>
        </header>
        <div class="space-y-4">${sections}</div>
      </div>
    `;
  }

  /**
   * Open create/edit workspace modal.
   *
   * @param {Object|null} existingWorkspace
   * @param {{onSuccess?: Function}} options
   * @returns {Promise<void>}
   */
  async function openWorkspaceModal(existingWorkspace, options = {}) {
    if (typeof window.openWorkspaceModal === "function") {
      window.openWorkspaceModal(existingWorkspace, options);
      return;
    }
  }

  /**
   * Open attach-service modal.
   *
   * @param {string} workspaceId
   * @param {string} serviceType
   * @returns {Promise<void>}
   */
  async function openAttachServiceModal(workspaceId, serviceType) {
    const awsConnections = await window.OggoAPI.getAwsConnections();
    const awsConnectionId = awsConnections[0]?.id || "";
    const serviceIdentifier = prompt(`Enter ${serviceType} identifier`);
    if (!serviceIdentifier) return;
    await window.OggoAPI.attachServiceToWorkspace(workspaceId, {
      awsConnectionId,
      serviceType,
      serviceIdentifier,
      region: "us-east-1",
      friendlyName: "",
    });
  }

  /**
   * Delete a workspace after user confirmation.
   *
   * @param {string} id
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async function deleteWorkspace(id, name) {
    const ok = window.confirm(`Delete workspace "${name || id}"?`);
    if (!ok) return false;
    await window.OggoAPI.deleteWorkspace(id);
    return true;
  }

  /**
   * Render workspace switcher options.
   *
   * @param {Array<Object>} workspaces
   * @param {string} activeWorkspaceId
   * @returns {string}
   */
  function renderWorkspaceSwitcher(workspaces, activeWorkspaceId) {
    return (workspaces || [])
      .map((workspace) => `<option value="${workspace.id}" ${workspace.id === activeWorkspaceId ? "selected" : ""}>${escapeHtml(workspace.name)}</option>`)
      .join("");
  }

  window.WorkspacesPage = {
    renderWorkspacesPage,
    renderWorkspaceCard,
    renderWorkspaceDetailPage,
    renderServiceSection,
    openWorkspaceModal,
    openAttachServiceModal,
    deleteWorkspace,
    renderWorkspaceSwitcher,
  };
})();
