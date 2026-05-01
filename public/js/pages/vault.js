/**
 * vault.js
 *
 * Handles Vault page UI: listing, filtering, create/edit, copy/reveal,
 * linked services, rotation, and password generation.
 */
(function initVaultPage() {
  const ui = {
    copyCountdown: {},
    revealed: {},
    serviceCount: {},
    filter: "all",
    search: "",
    serviceCountInFlight: false,
    serviceCountRequested: {},
  };
  let awsRegions = null;
  let awsRegionsInFlight = null;

  async function ensureAwsRegions() {
    if (Array.isArray(awsRegions) && awsRegions.length) return awsRegions;
    if (awsRegionsInFlight) return awsRegionsInFlight;
    awsRegionsInFlight = window.OggoAPI.getAwsRegions()
      .then((rows) => {
        awsRegions = Array.isArray(rows) ? rows : [];
        return awsRegions;
      })
      .catch(() => {
        awsRegions = [];
        return awsRegions;
      })
      .finally(() => {
        awsRegionsInFlight = null;
      });
    return awsRegionsInFlight;
  }

  function awsRegionTuples() {
    if (!Array.isArray(awsRegions) || !awsRegions.length) return [["us-east-1", "US East (N. Virginia)"]];
    return awsRegions.map((r) => [r.code, r.name || r.label || r.code]);
  }

  function esc(v) {
    return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toBool(v) { return String(v || "").toLowerCase() === "true" || v === true || v === 1 || v === "1"; }
  function markSecret(entry) {
    return entry ? `<div class="text-[11px] text-gray-500 mt-1">Leave blank to keep existing value - type to replace</div>` : "";
  }
  function selectOptions(options, value) {
    return options.map((row) => {
      const val = Array.isArray(row) ? row[0] : row;
      const label = Array.isArray(row) ? `${row[0]} - ${row[1]}` : row;
      return `<option value="${esc(val)}" ${String(value || "") === String(val) ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
  }
  function parsePemCertificate(pem) {
    const text = String(pem || "");
    if (!text.includes("BEGIN CERTIFICATE")) return null;
    const b64 = text.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, "");
    if (!b64) return null;
    let raw = "";
    try { raw = atob(b64); } catch (_e) { return null; }
    const dateMatches = raw.match(/\d{12}Z|\d{14}Z/g) || [];
    const parseDate = (v) => {
      if (!v) return "";
      if (v.length === 13) {
        const yy = Number(v.slice(0, 2));
        const year = yy >= 70 ? 1900 + yy : 2000 + yy;
        return `${year}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
      }
      if (v.length === 15) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      return "";
    };
    const expiry = parseDate(dateMatches[1] || dateMatches[0]);
    const domains = raw.match(/([*]?\.)?[a-z0-9-]+\.[a-z]{2,}/gi) || [];
    const domain = domains.find((d) => !d.includes("BEGIN")) || "";
    const issuerCn = /Let's Encrypt|DigiCert|GlobalSign|ZeroSSL|Sectigo|Amazon|Cloudflare/i.exec(raw)?.[0] || "";
    return expiry || domain || issuerCn ? { expiry, domain, issuer: issuerCn } : null;
  }
  function renderCategoryFields(category, cfg = {}, entry = null) {
    const c = category || "ssh";
    if (c === "ssh") {
      return `
      <div class="space-y-3">
        <input class="input" name="ssh_host" placeholder="192.168.1.1 or hostname" required value="${esc(cfg.host || "")}" />
        <div class="grid grid-cols-2 gap-2">
          <input class="input" type="number" name="ssh_port" required value="${esc(cfg.port || 22)}" />
          <input class="input" name="ssh_username" placeholder="ubuntu" required value="${esc(cfg.username || "")}" />
        </div>
        <select class="input" name="ssh_auth_type">${selectOptions([["password", "Password"], ["ssh_key", "SSH Key"]], cfg.authType || "password")}</select>
        <div id="vault-auth-subfields"></div>
      </div>`;
    }
    if (c === "database") {
      return `
      <div class="space-y-3">
        <select class="input" name="db_engine">${selectOptions([["mysql", "MySQL"], ["postgresql", "PostgreSQL"], ["mongodb", "MongoDB"], ["mssql", "Microsoft SQL Server"], ["sqlite", "SQLite"], ["other", "Other"]], cfg.engine || "mysql")}</select>
        <div class="grid grid-cols-2 gap-2">
          <input class="input" name="db_host" placeholder="localhost or db.example.com" required value="${esc(cfg.host || "")}" />
          <input class="input" type="number" name="db_port" value="${esc(cfg.port || 3306)}" />
        </div>
        <input class="input" name="db_name" placeholder="my_database" required value="${esc(cfg.databaseName || "")}" />
        <input class="input" name="db_username" placeholder="root" value="${esc(cfg.username || "")}" />
        <input class="input" type="password" name="db_password" placeholder="Password" />${markSecret(entry)}
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="db_ssl" value="true" ${toBool(cfg.ssl) ? "checked" : ""}/> SSL</label>
        <div id="vault-db-ssl-subfields"></div>
      </div>`;
    }
    if (c === "aws") {
      return `
      <div class="space-y-3">
        <select class="input" name="aws_auth_type">${selectOptions([["access_key", "Access Key"], ["iam_role", "IAM Role ARN"], ["temporary", "Temporary credentials"]], cfg.authType || "access_key")}</select>
        <div id="vault-aws-auth-subfields"></div>
        <select class="input" name="aws_region">${selectOptions(awsRegionTuples(), cfg.region || "us-east-1")}</select>
        <input class="input" name="aws_account_id" placeholder="123456789012" value="${esc(cfg.accountId || "")}" />
      </div>`;
    }
    if (c === "redis") {
      const dbOptions = Array.from({ length: 16 }).map((_, i) => [String(i), String(i)]);
      return `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <input class="input" name="redis_host" placeholder="localhost" required value="${esc(cfg.host || "")}" />
          <input class="input" type="number" name="redis_port" required value="${esc(cfg.port || 6379)}" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <select class="input" name="redis_db">${selectOptions(dbOptions, cfg.database || 0)}</select>
          <input class="input" name="redis_username" placeholder="default" value="${esc(cfg.username || "")}" />
        </div>
        <div class="text-[11px] text-gray-500 -mt-2">Username (Redis 6+ ACL)</div>
        <input class="input" type="password" name="redis_password" placeholder="Password" />${markSecret(entry)}
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="redis_tls" value="true" ${toBool(cfg.tls) ? "checked" : ""}/> TLS</label>
        <select class="input" name="redis_connection_type">${selectOptions([["standalone", "Standalone"], ["sentinel", "Sentinel"], ["cluster", "Cluster"]], cfg.connectionType || "standalone")}</select>
        <div id="vault-redis-conn-subfields"></div>
      </div>`;
    }
    if (c === "api_key") {
      return `
      <div class="space-y-3">
        <select class="input" name="api_type">${selectOptions([["bearer", "Bearer Token"], ["basic", "Basic Auth"], ["key_secret", "API Key and Secret"], ["oauth2", "OAuth 2.0"], ["custom_header", "Custom Header"]], cfg.apiType || "bearer")}</select>
        <div id="vault-api-type-subfields"></div>
      </div>`;
    }
    if (c === "certificate") {
      return `
      <div class="space-y-3">
        <select class="input" name="cert_type">${selectOptions([["tls_ssl", "TLS/SSL"], ["code_signing", "Code Signing"], ["client", "Client Certificate"], ["ca", "CA Certificate"]], cfg.certType || "tls_ssl")}</select>
        <textarea class="input font-mono min-h-[120px]" name="cert_content" placeholder="-----BEGIN CERTIFICATE-----">${esc(cfg.cert || "")}</textarea>
        <div id="vault-cert-parsed-info"></div>
        <textarea class="input font-mono min-h-[120px]" name="cert_private_key" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>${markSecret(entry)}
        <input class="input" type="password" name="cert_passphrase" placeholder="Key passphrase (if encrypted)" />${markSecret(entry)}
        <input class="input" name="cert_domain" placeholder="example.com" value="${esc(cfg.domain || "")}" />
        <input class="input" type="date" name="cert_expiry" value="${esc((cfg.expiry || "").slice(0, 10))}" />
        <input class="input" name="cert_issuer" placeholder="Issuer (auto-detected if possible)" value="${esc(cfg.issuer || "")}" />
      </div>`;
    }
    return `
    <div class="space-y-3">
      <input class="input" name="other_key_label" placeholder="What is this credential called e.g. API_KEY or TOKEN" required value="${esc(cfg.keyLabel || "")}" />
      <input class="input" type="password" name="other_value" placeholder="Value" required />${markSecret(entry)}
    </div>`;
  }
  function renderAuthSubfields(category, form, cfg = {}, entry = null) {
    const setHtml = (id, html) => { const node = form.querySelector(id); if (node) node.innerHTML = html; };
    if (category === "ssh") {
      const authType = form.querySelector('[name="ssh_auth_type"]')?.value || "password";
      if (authType === "password") {
        setHtml("#vault-auth-subfields", `<input class="input" type="password" name="ssh_password" placeholder="Password" ${entry ? "" : "required"} />${markSecret(entry)}`);
      } else {
        setHtml("#vault-auth-subfields", `<textarea class="input font-mono min-h-[120px]" name="ssh_private_key" placeholder="Paste your private key content here (-----BEGIN...)" ${entry ? "" : "required"}></textarea>${markSecret(entry)}<input class="input mt-2" type="password" name="ssh_passphrase" placeholder="Leave empty if key has no passphrase" />${markSecret(entry)}`);
      }
    }
    if (category === "database") {
      const sslOn = form.querySelector('[name="db_ssl"]')?.checked;
      const caValue = cfg.caCert || "";
      setHtml("#vault-db-ssl-subfields", sslOn ? `<textarea class="input min-h-[100px]" name="db_ca_cert" placeholder="CA certificate content (optional)">${esc(caValue)}</textarea>` : "");
      const defaults = { mysql: 3306, postgresql: 5432, mongodb: 27017, mssql: 1433, sqlite: "", other: "" };
      const engine = form.querySelector('[name="db_engine"]')?.value || "mysql";
      const port = form.querySelector('[name="db_port"]');
      if (port && !String(port.dataset.touched || "")) port.value = defaults[engine];
      if (port) port.oninput = () => { port.dataset.touched = "1"; };
    }
    if (category === "aws") {
      const type = form.querySelector('[name="aws_auth_type"]')?.value || "access_key";
      if (type === "access_key") {
        setHtml("#vault-aws-auth-subfields", `<input class="input" name="aws_access_key_id" placeholder="AKIAIOSFODNN7EXAMPLE" required value="${esc(cfg.accessKeyId || "")}" /><input class="input mt-2" type="password" name="aws_secret_access_key" placeholder="Secret Access Key" ${entry ? "" : "required"} />${markSecret(entry)}`);
      } else if (type === "iam_role") {
        setHtml("#vault-aws-auth-subfields", `<input class="input" name="aws_role_arn" placeholder="arn:aws:iam::123456789012:role/MyRole" required value="${esc(cfg.roleArn || "")}" /><input class="input mt-2" name="aws_external_id" placeholder="External ID (optional)" value="${esc(cfg.externalId || "")}" />`);
      } else {
        setHtml("#vault-aws-auth-subfields", `<input class="input" name="aws_access_key_id" placeholder="Access Key ID" required value="${esc(cfg.accessKeyId || "")}" /><input class="input mt-2" type="password" name="aws_secret_access_key" placeholder="Secret Access Key" ${entry ? "" : "required"} />${markSecret(entry)}<textarea class="input mt-2 min-h-[100px]" name="aws_session_token" placeholder="Paste session token here" ${entry ? "" : "required"}></textarea>${markSecret(entry)}`);
      }
    }
    if (category === "redis") {
      const type = form.querySelector('[name="redis_connection_type"]')?.value || "standalone";
      if (type === "sentinel") {
        setHtml("#vault-redis-conn-subfields", `<textarea class="input min-h-[90px]" name="redis_sentinel_hosts" placeholder="One host:port per line e.g. sentinel1.example.com:26379" required>${esc(cfg.sentinelHosts || "")}</textarea><input class="input mt-2" name="redis_master_name" placeholder="mymaster" required value="${esc(cfg.masterName || "")}" />`);
      } else if (type === "cluster") {
        setHtml("#vault-redis-conn-subfields", `<textarea class="input min-h-[90px]" name="redis_cluster_nodes" placeholder="One host:port per line" required>${esc(cfg.clusterNodes || "")}</textarea>`);
      } else {
        setHtml("#vault-redis-conn-subfields", "");
      }
    }
    if (category === "api_key") {
      const type = form.querySelector('[name="api_type"]')?.value || "bearer";
      const base = `<input class="input mt-2" name="api_base_url" placeholder="https://api.example.com" value="${esc(cfg.baseUrl || "")}" />`;
      if (type === "bearer") setHtml("#vault-api-type-subfields", `<input class="input" type="password" name="api_token" placeholder="Token" ${entry ? "" : "required"} />${markSecret(entry)}${base}`);
      if (type === "basic") setHtml("#vault-api-type-subfields", `<input class="input" name="api_username" placeholder="Username" required value="${esc(cfg.username || "")}" /><input class="input mt-2" type="password" name="api_password" placeholder="Password" ${entry ? "" : "required"} />${markSecret(entry)}${base}`);
      if (type === "key_secret") setHtml("#vault-api-type-subfields", `<input class="input" name="api_key" placeholder="API Key" required value="${esc(cfg.apiKey || "")}" /><input class="input mt-2" type="password" name="api_secret" placeholder="API Secret" ${entry ? "" : "required"} />${markSecret(entry)}${base}`);
      if (type === "oauth2") setHtml("#vault-api-type-subfields", `<input class="input" name="api_client_id" placeholder="Client ID" required value="${esc(cfg.clientId || "")}" /><input class="input mt-2" type="password" name="api_client_secret" placeholder="Client Secret" ${entry ? "" : "required"} />${markSecret(entry)}<input class="input mt-2" name="api_token_url" placeholder="https://auth.example.com/oauth/token" required value="${esc(cfg.tokenUrl || "")}" /><input class="input mt-2" name="api_scopes" placeholder="read write" value="${esc(cfg.scopes || "")}" />`);
      if (type === "custom_header") setHtml("#vault-api-type-subfields", `<input class="input" name="api_header_name" placeholder="X-API-Key" required value="${esc(cfg.headerName || "")}" /><input class="input mt-2" type="password" name="api_header_value" placeholder="Header value" ${entry ? "" : "required"} />${markSecret(entry)}${base}`);
    }
    if (category === "certificate") {
      const certInput = form.querySelector('[name="cert_content"]');
      const info = form.querySelector("#vault-cert-parsed-info");
      const expiryInput = form.querySelector('[name="cert_expiry"]');
      const domainInput = form.querySelector('[name="cert_domain"]');
      const issuerInput = form.querySelector('[name="cert_issuer"]');
      if (certInput) {
        certInput.oninput = () => {
          const parsed = parsePemCertificate(certInput.value);
          if (!parsed) {
            if (info) info.innerHTML = "";
            return;
          }
          if (parsed.expiry && expiryInput && !expiryInput.value) expiryInput.value = parsed.expiry.slice(0, 10);
          if (parsed.domain && domainInput && !domainInput.value) domainInput.value = parsed.domain;
          if (parsed.issuer && issuerInput && !issuerInput.value) issuerInput.value = parsed.issuer;
          if (info) {
            info.innerHTML = `<div class="text-xs rounded border border-teal-500/40 bg-teal-500/10 text-teal-200 px-3 py-2">Expires: ${esc(parsed.expiry || "-")} · Domain: ${esc(parsed.domain || "-")} · Issued by: ${esc(parsed.issuer || "-")}</div>`;
          }
        };
      }
    }
  }
  function categoryTone(c) {
    return {
      ssh: "bg-blue-500/15 text-blue-400", database: "bg-green-500/15 text-green-400", aws: "bg-orange-500/15 text-orange-400",
      redis: "bg-red-500/15 text-red-400", api_key: "bg-purple-500/15 text-purple-400", certificate: "bg-teal-500/15 text-teal-400",
      other: "bg-gray-500/15 text-gray-400",
    }[c] || "bg-gray-500/15 text-gray-400";
  }
  function strength(v) {
    const s = String(v || "");
    let score = 0;
    if (s.length >= 10) score += 1;
    if (/[A-Z]/.test(s)) score += 1;
    if (/[0-9]/.test(s)) score += 1;
    if (/[^A-Za-z0-9]/.test(s)) score += 1;
    const tone = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"][Math.max(0, score - 1)] || "bg-red-500";
    const text = ["Weak", "Fair", "Good", "Strong"][Math.max(0, score - 1)] || "Weak";
    const tip = score < 4 ? "Use 12+ chars with upper/lower, numbers, symbols." : "Good entropy.";
    return { pct: Math.max(10, score * 25), tone, text, tip };
  }
  function isExpiring(date) {
    if (!date) return 0;
    const ms = new Date(date).getTime();
    if (!Number.isFinite(ms)) return 0;
    return Math.ceil((ms - Date.now()) / 86400000);
  }
  function filters(entries) {
    const counts = { all: entries.length, ssh: 0, database: 0, aws: 0, redis: 0, api_key: 0, other: 0, shared: 0, expiring: 0 };
    entries.forEach((e) => {
      if (counts[e.category] !== undefined) counts[e.category] += 1;
      if (Number(e.is_shared || 0) === 1 || Number(e.rotation_count || 0) > 0) counts.shared += 1;
      if (e.expiry_date && isExpiring(e.expiry_date) <= 30) counts.expiring += 1;
    });
    return counts;
  }
  function applyFilter(entries, appState) {
    ui.filter = appState.vaultFilter || ui.filter;
    ui.search = appState.vaultSearch || ui.search;
    const q = ui.search.toLowerCase().trim();
    return entries.filter((e) => {
      if (q && !`${e.name} ${e.username || ""} ${e.tags || ""}`.toLowerCase().includes(q)) return false;
      if (ui.filter === "all") return true;
      if (ui.filter === "shared") return Number(e.is_shared || 0) === 1 || Number(e.rotation_count || 0) > 0;
      if (ui.filter === "expiring") return e.expiry_date && isExpiring(e.expiry_date) <= 30;
      return e.category === ui.filter;
    });
  }
  function toolbar(entries, appState) {
    const c = filters(entries);
    const pill = (k, l) => `<button data-vault-filter="${k}" class="px-3 py-1.5 rounded-full text-xs border ${ui.filter === k ? "border-orange-500 text-orange-500 bg-orange-500/10" : "border-gray-300 dark:border-gray-700 text-gray-500"}">${l} (${c[k] || 0})</button>`;
    return `<div class="panel mb-4">
      <div class="flex items-center gap-2 flex-wrap">
        <input id="vault-search" class="input min-w-[220px]" placeholder="Search passwords..." value="${esc(ui.search)}" />
        ${pill("all", "All")}${pill("ssh", "SSH")}${pill("database", "Database")}${pill("aws", "AWS")}${pill("redis", "Redis")}${pill("api_key", "API Key")}${pill("other", "Other")}${pill("shared", "Shared")}${pill("expiring", "Expiring")}
        <button id="vault-add-btn" class="btn-primary ml-auto">Add password</button>
      </div>
    </div>`;
  }
  function table(entries) {
    const rows = entries.map((e) => {
      const d = ui.copyCountdown[e.id] || 0;
      const reveal = ui.revealed[e.id] || "";
      const used = Number(ui.serviceCount[e.id] || 0);
      const days = isExpiring(e.expiry_date);
      const expiry = !e.expiry_date ? `<span class="text-gray-500">-</span>` : days < 0 ? `<span class="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">Expired</span>` : days <= 30 ? `<span class="text-orange-400 text-xs">${new Date(e.expiry_date).toLocaleDateString()}</span>` : `<span class="text-xs">${new Date(e.expiry_date).toLocaleDateString()}</span>`;
      return `<tr class="border-b border-gray-100 dark:border-gray-800">
        <td class="py-2 px-3 font-medium">${esc(e.name)}</td>
        <td class="py-2 px-3"><span class="px-2 py-1 rounded-full text-[11px] ${categoryTone(e.category)}">${esc(e.category)}</span></td>
        <td class="py-2 px-3 text-xs">${esc(e.username || "-")}</td>
        <td class="py-2 px-3 text-xs text-gray-500">${esc(e.tags || "-")}</td>
        <td class="py-2 px-3 text-xs">${used ? `<span class="text-orange-500">${used} services</span>` : `<span class="text-gray-500">-</span>`}</td>
        <td class="py-2 px-3">${expiry}</td>
        <td class="py-2 px-3 text-xs">${new Date(e.updated_at).toLocaleString()}</td>
        <td class="py-2 px-3 text-right"><div class="inline-flex gap-1">
          <button class="btn-secondary text-xs" data-vault-action="copy" data-id="${e.id}" ${d ? "disabled" : ""}>${d ? `${d}s` : "Copy"}</button>
          <button class="btn-secondary text-xs" data-vault-action="reveal" data-id="${e.id}">Reveal</button>
          <button class="btn-secondary text-xs" data-vault-action="services" data-id="${e.id}" data-name="${esc(e.name)}">Services</button>
          <button class="btn-secondary text-xs" data-vault-action="rotate" data-id="${e.id}" data-name="${esc(e.name)}">Rotate</button>
          <button class="btn-secondary text-xs" data-vault-action="edit" data-id="${e.id}">Edit</button>
          <button class="btn-secondary text-xs text-red-500" data-vault-action="delete" data-id="${e.id}" data-name="${esc(e.name)}">Delete</button>
        </div>${reveal ? `<div class="text-[11px] mt-1 text-green-400 font-mono">${esc(reveal)}</div>` : ""}</td></tr>`;
    }).join("");
    return `<div class="panel overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs text-gray-500 uppercase"><th class="py-2 px-3">Name</th><th class="py-2 px-3">Category</th><th class="py-2 px-3">Username</th><th class="py-2 px-3">Tags</th><th class="py-2 px-3">Used in</th><th class="py-2 px-3">Expiry</th><th class="py-2 px-3">Updated</th><th class="py-2 px-3 text-right">Actions</th></tr></thead><tbody>${rows || `<tr><td class="py-6 px-3 text-gray-500" colspan="8">No entries found.</td></tr>`}</tbody></table></div>`;
  }
  async function openEditor(entry, hooks) {
    const modal = document.getElementById("job-modal");
    const body = document.getElementById("job-modal-body");
    const cfg = entry?.config_json || {};
    const initialCategory = entry?.category || "ssh";
    const awsRegionsPromise = initialCategory === "aws" ? ensureAwsRegions() : null;
    body.innerHTML = `<form id="vault-form" class="p-4 space-y-3">
      <input type="hidden" name="id" value="${esc(entry?.id || "")}" />
      <input class="input" name="name" required placeholder="Name" value="${esc(entry?.name || "")}" />
      <select class="input" name="category">${["ssh","database","aws","redis","api_key","certificate","other"].map((c) => `<option value="${c}" ${initialCategory === c ? "selected" : ""}>${c}</option>`).join("")}</select>
      <div id="vault-category-fields"></div>
      <textarea class="input" name="notes" placeholder="Notes">${esc(entry?.notes || "")}</textarea>
      <input class="input" name="tags" placeholder="tag1,tag2" value="${esc(entry?.tags || "")}" />
      <div class="flex justify-end gap-2"><button type="button" id="vault-cancel-btn" class="btn-secondary">Cancel</button><button class="btn-primary">Save</button></div>
    </form>`;
    modal.classList.remove("hidden");
    const form = body.querySelector("#vault-form");
    const categorySelect = form.querySelector('[name="category"]');
    const dynamicNode = form.querySelector("#vault-category-fields");
    const renderCategory = (category, prefill) => {
      dynamicNode.innerHTML = renderCategoryFields(category, prefill || {}, entry);
      renderAuthSubfields(category, form, prefill || {}, entry);
      if (category === "aws") {
        ensureAwsRegions().then(() => {
          const regionSelect = form.querySelector('[name="aws_region"]');
          if (!regionSelect) return;
          const current = regionSelect.value || prefill?.region || "us-east-1";
          regionSelect.innerHTML = selectOptions(awsRegionTuples(), current);
          regionSelect.value = current;
        });
      }
      const bindChanges = () => {
        ["ssh_auth_type", "db_ssl", "db_engine", "aws_auth_type", "redis_connection_type", "api_type"].forEach((name) => {
          const n = form.querySelector(`[name="${name}"]`);
          if (n) n.onchange = () => renderAuthSubfields(category, form, prefill || {}, entry);
        });
      };
      bindChanges();
      dynamicNode.querySelectorAll('input[type="password"]').forEach((node, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "relative";
        node.parentNode.insertBefore(wrap, node);
        wrap.appendChild(node);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "absolute right-2 top-2 text-xs text-gray-500";
        btn.textContent = "Show";
        btn.onclick = () => { node.type = node.type === "password" ? "text" : "password"; btn.textContent = node.type === "password" ? "Show" : "Hide"; };
        wrap.appendChild(btn);
        if (!idx && ["ssh", "database", "aws", "redis", "api_key", "certificate", "other"].includes(category)) {
          const row = document.createElement("div");
          row.className = "mt-1";
          const gen = document.createElement("button");
          gen.type = "button";
          gen.className = "btn-secondary text-xs";
          gen.textContent = "Generate";
          gen.onclick = async () => {
            const r = await window.OggoAPI.generateVaultPassword({ length: 24, uppercase: true, numbers: true, symbols: true });
            node.value = r.password;
            await navigator.clipboard.writeText(r.password);
            hooks.toast("Generated and copied", "success");
          };
          row.appendChild(gen);
          wrap.parentNode.insertBefore(row, wrap.nextSibling);
        }
      });
    };
    renderCategory(initialCategory, cfg);
    if (awsRegionsPromise) {
      awsRegionsPromise.then(() => {
        const regionSelect = form.querySelector('[name="aws_region"]');
        if (!regionSelect) return;
        const current = regionSelect.value || cfg.region || "us-east-1";
        regionSelect.innerHTML = selectOptions(awsRegionTuples(), current);
        regionSelect.value = current;
      });
    }
    categorySelect.onchange = () => {
      if (entry && categorySelect.value !== initialCategory) {
        const ok = confirm("Changing category resets category-specific fields. Continue?");
        if (!ok) {
          categorySelect.value = initialCategory;
          return;
        }
      }
      renderCategory(categorySelect.value, {});
    };
    body.querySelector("#vault-cancel-btn").onclick = () => modal.classList.add("hidden");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const payload = { ...f };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") delete payload[key];
      });
      if (form.querySelector('[name="db_ssl"]') && !("db_ssl" in payload)) payload.db_ssl = "false";
      if (form.querySelector('[name="redis_tls"]') && !("redis_tls" in payload)) payload.redis_tls = "false";
      if (payload.cert_expiry) payload.expiry_date = payload.cert_expiry;
      if (f.id) await window.OggoAPI.updateVaultEntry(f.id, payload); else await window.OggoAPI.createVaultEntry(payload);
      modal.classList.add("hidden"); await hooks.reload();
    };
  }
  async function openServices(id, name) {
    const rows = await window.OggoAPI.getVaultEntryServices(id);
    const modal = document.getElementById("job-modal");
    const body = document.getElementById("job-modal-body");
    body.innerHTML = `<div class="p-4"><div class="text-lg font-semibold mb-3">Services using ${esc(name)}</div><div class="space-y-2">${rows.map((r) => `<div class="border border-gray-700 rounded p-2 flex justify-between items-center"><div><div class="font-medium">${esc(r.service_name || r.service_id)}</div><div class="text-xs text-gray-500">${esc(r.service_type)} • ${esc(r.field_name)}</div></div><button data-unlink="${r.id}" class="btn-secondary text-xs text-red-500">Unlink</button></div>`).join("") || `<div class="text-sm text-gray-500">No links.</div>`}</div><div class="mt-3 text-xs text-gray-500">Add links from service forms via "Use from Vault".</div></div>`;
    modal.classList.remove("hidden");
    body.querySelectorAll("[data-unlink]").forEach((b) => b.onclick = async () => { await window.OggoAPI.unlinkVaultService(id, b.dataset.unlink); b.closest("div.border")?.remove(); });
  }
  async function openRotate(id, name, hooks) {
    const links = await window.OggoAPI.getVaultEntryServices(id);
    const modal = document.getElementById("job-modal");
    const body = document.getElementById("job-modal-body");
    body.innerHTML = `<form id="vault-rotate-form" class="p-4 space-y-3"><div class="text-lg font-semibold">Rotate: ${esc(name)}</div><div class="text-xs text-gray-500">Linked services: ${links.length}</div><input id="vault-rotate-input" class="input" placeholder="New password" /><div class="flex gap-2"><button type="button" id="vault-rotate-generate" class="btn-secondary text-xs">Generate</button><button class="btn-primary">Confirm rotate</button></div></form>`;
    modal.classList.remove("hidden");
    body.querySelector("#vault-rotate-generate").onclick = async () => { const r = await window.OggoAPI.generateVaultPassword({ length: 24 }); body.querySelector("#vault-rotate-input").value = r.password; };
    body.querySelector("#vault-rotate-form").onsubmit = async (e) => { e.preventDefault(); const v = body.querySelector("#vault-rotate-input").value; await window.OggoAPI.rotateVaultEntry(id, v); modal.classList.add("hidden"); hooks.toast(`Rotated and updated ${links.length} linked services`, "success"); await hooks.reload(); };
  }
  function startCopyCountdown(id, hooks) {
    ui.copyCountdown[id] = 30; hooks.refresh();
    const t = setInterval(() => { ui.copyCountdown[id] -= 1; if (ui.copyCountdown[id] <= 0) { clearInterval(t); delete ui.copyCountdown[id]; } hooks.refresh(); }, 1000);
  }
  async function ensureServiceCount(entries, hooks) {
    if (ui.serviceCountInFlight) return;
    const pending = entries.slice(0, 50).filter((e) => ui.serviceCount[e.id] === undefined && !ui.serviceCountRequested[e.id]);
    if (!pending.length) return;
    ui.serviceCountInFlight = true;
    let changed = false;
    try {
      await Promise.all(
        pending.map(async (e) => {
          ui.serviceCountRequested[e.id] = true;
          try {
            ui.serviceCount[e.id] = (await window.OggoAPI.getVaultEntryServices(e.id)).length;
          } catch (_error) {
            ui.serviceCount[e.id] = 0;
          }
          changed = true;
        })
      );
    } finally {
      ui.serviceCountInFlight = false;
    }
    if (changed) hooks.refresh();
  }

  function render(appState) {
    const entries = Array.isArray(appState.vaultEntries) ? appState.vaultEntries : [];
    const filtered = applyFilter(entries, appState);
    return `<div><div class="mb-3"><h2 class="text-2xl font-semibold">Vault Passwords</h2><div class="text-xs text-gray-500 mt-1">Secure credential manager</div></div>${toolbar(entries, appState)}${table(filtered)}</div>`;
  }

  function bind(appState, hooks) {
    ensureServiceCount(appState.vaultEntries || [], hooks).catch(() => {});
    const q = document.getElementById("vault-search");
    if (q) q.oninput = () => { appState.vaultSearch = q.value; hooks.refresh(); };
    document.querySelectorAll("[data-vault-filter]").forEach((b) => b.onclick = () => { appState.vaultFilter = b.dataset.vaultFilter; hooks.refresh(); });
    const add = document.getElementById("vault-add-btn");
    if (add) add.onclick = () => openEditor(null, hooks);
    document.getElementById("app-content").onclick = async (e) => {
      const a = e.target.closest("[data-vault-action]"); if (!a) return;
      const id = a.dataset.id; const entry = (appState.vaultEntries || []).find((x) => x.id === id); if (!entry) return;
      if (a.dataset.vaultAction === "copy") { const r = await window.OggoAPI.copyVaultEntry(id); await navigator.clipboard.writeText(r.value); hooks.toast("Copied to clipboard", "success"); startCopyCountdown(id, hooks); }
      if (a.dataset.vaultAction === "reveal") { const r = await window.OggoAPI.copyVaultEntry(id); ui.revealed[id] = r.value; hooks.refresh(); setTimeout(() => { delete ui.revealed[id]; hooks.refresh(); }, 10000); }
      if (a.dataset.vaultAction === "services") await openServices(id, a.dataset.name);
      if (a.dataset.vaultAction === "edit") await openEditor(entry, hooks);
      if (a.dataset.vaultAction === "rotate") await openRotate(id, a.dataset.name, hooks);
      if (a.dataset.vaultAction === "delete") {
        if (!confirm(`Delete "${a.dataset.name}"?`)) return;
        try { await window.OggoAPI.deleteVaultEntry(id, false); } catch (err) { if (!confirm(`${err.message}\n\nForce delete?`)) return; await window.OggoAPI.deleteVaultEntry(id, true); }
        await hooks.reload();
      }
    };
  }

  window.VaultPage = { render, bind, openCreate: (hooks) => openEditor(null, hooks) };
})();
