const { exec } = require("child_process");
const { promisify } = require("util");
const { v4: uuidv4 } = require("uuid");
const { get, all, run } = require("../db/database");
const { executeRemoteCommand } = require("./sshService");

const execAsync = promisify(exec);

const MANAGER_DEFS = {
  npm: { label: "npm", kind: "node" },
  yarn: { label: "Yarn", kind: "node" },
  pip: { label: "pip", kind: "python" },
  pip3: { label: "pip3", kind: "python" },
  composer: { label: "Composer", kind: "php" },
  apt: { label: "apt", kind: "system" },
  "apt-get": { label: "apt-get", kind: "system" },
  yum: { label: "yum", kind: "system" },
  dnf: { label: "dnf", kind: "system" },
  gem: { label: "gem", kind: "ruby" },
  cargo: { label: "cargo", kind: "rust" },
  brew: { label: "Homebrew", kind: "system" },
};

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\"'\"'`)}'`;
}

function validatePackageName(name) {
  return /^[a-zA-Z0-9@._/+:-]+$/.test(String(name || ""));
}

function semverType(installed, latest) {
  if (!installed || !latest || installed === latest) return "NONE";
  const left = String(installed).match(/(\d+)\.(\d+)\.(\d+)/);
  const right = String(latest).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!left || !right) return "UNKNOWN";
  if (left[1] !== right[1]) return "MAJOR";
  if (left[2] !== right[2]) return "MINOR";
  if (left[3] !== right[3]) return "PATCH";
  return "NONE";
}

async function resolveTarget(serverId) {
  if (serverId === "local") {
    return { id: "local", name: "Local Machine", targetType: "local" };
  }
  const server = await get("SELECT * FROM servers WHERE id = ?", [serverId]);
  if (!server) throw new Error("Server not found");
  return { ...server, targetType: "ssh" };
}

async function runOnTarget(target, command, timeoutMs = 120000) {
  if (target.targetType === "local") {
    try {
      const startedAt = Date.now();
      const result = await execAsync(command, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
      return {
        output: result.stdout || "",
        errorOutput: result.stderr || "",
        exitCode: 0,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        output: error.stdout || "",
        errorOutput: error.stderr || error.message,
        exitCode: typeof error.code === "number" ? error.code : 1,
        durationMs: 0,
      };
    }
  }
  return executeRemoteCommand(target, command, { timeoutMs });
}

async function detectManagers(target) {
  const command = `set +e; for c in npm pip pip3 composer apt apt-get yum dnf gem cargo yarn brew; do command -v "$c" >/dev/null 2>&1 && echo "$c"; done`;
  const result = await runOnTarget(target, command, 20000);
  const detected = (result.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Array.from(new Set(detected)).filter((name) => MANAGER_DEFS[name]);
}

function mapPackagesWithOutdated(packages, outdatedMap, manager) {
  return packages.map((pkg) => {
    const outdated = outdatedMap[pkg.name] || null;
    const latestVersion = outdated?.latestVersion || pkg.latestVersion || pkg.version || "";
    const installedVersion = pkg.version || pkg.installedVersion || "";
    return {
      manager,
      name: pkg.name,
      installedVersion,
      latestVersion,
      updateType: semverType(installedVersion, latestVersion),
      description: pkg.description || "",
      vulnCount: 0,
      pinned: false,
      lastUpdatedAt: null,
      changelogUrl: pkg.changelogUrl || "",
    };
  });
}

async function getManagerVersion(target, manager) {
  const versionCommand = `${manager} --version`;
  const result = await runOnTarget(target, versionCommand, 15000);
  const line = (result.output || result.errorOutput || "").split(/\r?\n/).find((v) => v.trim());
  return line ? line.trim() : "Unknown";
}

async function scanNpm(target) {
  const [listRes, outdatedRes, auditRes] = await Promise.all([
    runOnTarget(target, "npm list -g --depth=0 --json", 90000),
    runOnTarget(target, "npm outdated -g --json", 90000),
    runOnTarget(target, "npm audit --json", 120000),
  ]);
  const listed = safeJson(listRes.output, {});
  const deps = listed.dependencies || {};
  const basePackages = Object.entries(deps).map(([name, meta]) => ({
    name,
    version: meta?.version || "",
    description: meta?.description || "",
  }));
  const outdatedRaw = safeJson(outdatedRes.output || "{}", {});
  const outdatedMap = Object.entries(outdatedRaw || {}).reduce((acc, [name, row]) => {
    acc[name] = { latestVersion: row.latest || row.wanted || "" };
    return acc;
  }, {});
  const packages = mapPackagesWithOutdated(basePackages, outdatedMap, "npm");
  const vulnerabilities = safeJson(auditRes.output || "{}", {});
  const vulnMap = {};
  Object.entries(vulnerabilities.vulnerabilities || {}).forEach(([pkgName, details]) => {
    const via = Array.isArray(details?.via) ? details.via.filter((v) => typeof v === "object") : [];
    vulnMap[pkgName] = via.length || 1;
  });
  packages.forEach((pkg) => {
    pkg.vulnCount = vulnMap[pkg.name] || 0;
  });
  return { packages, vulnerabilitySummary: vulnMap };
}

async function scanPip(target, manager = "pip") {
  const [listRes, outdatedRes] = await Promise.all([
    runOnTarget(target, `${manager} list --format=json`, 90000),
    runOnTarget(target, `${manager} list --outdated --format=json`, 90000),
  ]);
  const listed = safeJson(listRes.output || "[]", []);
  const outdated = safeJson(outdatedRes.output || "[]", []);
  const outdatedMap = {};
  outdated.forEach((row) => {
    outdatedMap[row.name] = { latestVersion: row.latest_version || row.latest || "" };
  });
  const packages = mapPackagesWithOutdated(
    listed.map((row) => ({ name: row.name, version: row.version, description: "" })),
    outdatedMap,
    manager
  );
  return { packages, vulnerabilitySummary: {} };
}

async function scanComposer(target) {
  const [listRes, outdatedRes, auditRes] = await Promise.all([
    runOnTarget(target, "composer global show --format=json", 90000),
    runOnTarget(target, "composer global outdated --format=json", 90000),
    runOnTarget(target, "composer audit --format=json", 120000),
  ]);
  const listed = safeJson(listRes.output || "{}", {}).installed || [];
  const outdated = safeJson(outdatedRes.output || "{}", {}).installed || [];
  const outdatedMap = {};
  outdated.forEach((row) => {
    outdatedMap[row.name] = { latestVersion: row.latest || row.latest_status || "" };
  });
  const packages = mapPackagesWithOutdated(
    listed.map((row) => ({
      name: row.name,
      version: row.version,
      description: row.description || "",
    })),
    outdatedMap,
    "composer"
  );
  const advisories = safeJson(auditRes.output || "{}", {}).advisories || {};
  packages.forEach((pkg) => {
    pkg.vulnCount = Array.isArray(advisories[pkg.name]) ? advisories[pkg.name].length : 0;
  });
  return { packages, vulnerabilitySummary: advisories };
}

async function scanGem(target) {
  const [listRes, outdatedRes] = await Promise.all([
    runOnTarget(target, "gem list --local", 90000),
    runOnTarget(target, "gem outdated", 90000),
  ]);
  const basePackages = (listRes.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^\s(]+)\s+\(([^)]+)\)/);
      if (!match) return null;
      return { name: match[1], version: match[2].split(",")[0].trim(), description: "" };
    })
    .filter(Boolean);
  const outdatedMap = {};
  (outdatedRes.output || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^([^\s]+)\s+\(newest\s+([^,]+),\s+installed\s+([^)]+)\)/i);
      if (match) outdatedMap[match[1]] = { latestVersion: match[2].trim() };
    });
  return { packages: mapPackagesWithOutdated(basePackages, outdatedMap, "gem"), vulnerabilitySummary: {} };
}

async function scanYarn(target) {
  const listRes = await runOnTarget(target, "yarn global list --depth=0 --json", 90000);
  const lines = (listRes.output || "").split(/\r?\n/).filter(Boolean);
  let trees = [];
  lines.forEach((line) => {
    const parsed = safeJson(line, null);
    if (parsed?.type === "tree" && parsed?.data?.trees) trees = parsed.data.trees;
  });
  const packages = trees
    .map((row) => String(row.name || ""))
    .filter(Boolean)
    .map((nameWithVersion) => {
      const atIndex = nameWithVersion.lastIndexOf("@");
      const name = atIndex > 0 ? nameWithVersion.slice(0, atIndex) : nameWithVersion;
      const version = atIndex > 0 ? nameWithVersion.slice(atIndex + 1) : "";
      return {
        manager: "yarn",
        name,
        installedVersion: version,
        latestVersion: version,
        updateType: "NONE",
        description: "",
        vulnCount: 0,
        pinned: false,
        lastUpdatedAt: null,
        changelogUrl: "",
      };
    });
  return { packages, vulnerabilitySummary: {} };
}

async function scanCargo(target) {
  const listRes = await runOnTarget(target, "cargo install --list", 90000);
  const packages = (listRes.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" v"))
    .map((line) => {
      const match = line.match(/^([^\s]+)\s+v([^\s:]+):?$/);
      if (!match) return null;
      return {
        manager: "cargo",
        name: match[1],
        installedVersion: match[2],
        latestVersion: match[2],
        updateType: "NONE",
        description: "",
        vulnCount: 0,
        pinned: false,
        lastUpdatedAt: null,
        changelogUrl: "",
      };
    })
    .filter(Boolean);
  return { packages, vulnerabilitySummary: {} };
}

async function scanBrew(target) {
  const [listRes, outdatedRes] = await Promise.all([
    runOnTarget(target, "brew list --versions", 90000),
    runOnTarget(target, "brew outdated --json=v2", 90000),
  ]);
  const packages = (listRes.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const name = parts.shift();
      const version = parts[0] || "";
      return {
        manager: "brew",
        name,
        installedVersion: version,
        latestVersion: version,
        updateType: "NONE",
        description: "",
        vulnCount: 0,
        pinned: false,
        lastUpdatedAt: null,
        changelogUrl: "",
      };
    });
  const outdated = safeJson(outdatedRes.output || "{}", {});
  const formulae = outdated.formulae || [];
  const map = {};
  formulae.forEach((row) => {
    map[row.name] = row.current_version || row.version || "";
  });
  packages.forEach((pkg) => {
    if (map[pkg.name]) {
      pkg.latestVersion = map[pkg.name];
      pkg.updateType = semverType(pkg.installedVersion, pkg.latestVersion);
    }
  });
  return { packages, vulnerabilitySummary: {} };
}

function parseAptList(content) {
  return (content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Listing..."))
    .map((line) => {
      const parts = line.split(/\s+/);
      const pkgPart = parts[0] || "";
      const version = parts[1] || "";
      const pkg = pkgPart.split("/")[0];
      return pkg ? { name: pkg, version, description: "" } : null;
    })
    .filter(Boolean);
}

async function scanAptLike(target, manager) {
  const baseCmd = manager === "apt-get" ? "apt-get" : "apt";
  const [installedRes, upgradableRes] = await Promise.all([
    runOnTarget(target, `${baseCmd} list --installed`, 120000),
    runOnTarget(target, `${baseCmd} list --upgradable`, 120000),
  ]);
  const basePackages = parseAptList(installedRes.output);
  const upgradable = parseAptList(upgradableRes.output);
  const outdatedMap = {};
  upgradable.forEach((row) => {
    outdatedMap[row.name] = { latestVersion: row.version };
  });
  return { packages: mapPackagesWithOutdated(basePackages, outdatedMap, baseCmd), vulnerabilitySummary: {} };
}

async function scanYumLike(target, manager) {
  const [installedRes, updatesRes] = await Promise.all([
    runOnTarget(target, `${manager} list installed`, 120000),
    runOnTarget(target, `${manager} check-update`, 120000),
  ]);
  const basePackages = (installedRes.output || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const pkg = (parts[0] || "").split(".")[0];
      const version = parts[1] || "";
      return pkg ? { name: pkg, version, description: "" } : null;
    })
    .filter(Boolean);
  const outdatedMap = {};
  (updatesRes.output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((line) => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && /^[a-zA-Z0-9._+-]/.test(parts[0])) {
        const pkg = parts[0].split(".")[0];
        outdatedMap[pkg] = { latestVersion: parts[1] };
      }
    });
  return { packages: mapPackagesWithOutdated(basePackages, outdatedMap, manager), vulnerabilitySummary: {} };
}

async function scanByManager(target, manager) {
  if (manager === "npm") return scanNpm(target);
  if (manager === "pip" || manager === "pip3") return scanPip(target, manager);
  if (manager === "composer") return scanComposer(target);
  if (manager === "gem") return scanGem(target);
  if (manager === "yarn") return scanYarn(target);
  if (manager === "cargo") return scanCargo(target);
  if (manager === "brew") return scanBrew(target);
  if (manager === "apt" || manager === "apt-get") return scanAptLike(target, manager);
  if (manager === "yum" || manager === "dnf") return scanYumLike(target, manager);
  return { packages: [], vulnerabilitySummary: {} };
}

async function getPinnedMap(serverId) {
  const rows = await all("SELECT * FROM package_pins WHERE server_id = ?", [serverId]);
  return rows.reduce((acc, row) => {
    const key = `${row.package_manager}:${row.package_name}`;
    acc[key] = row;
    return acc;
  }, {});
}

async function scanPackages(serverId, managerFilter = null) {
  const target = await resolveTarget(serverId);
  const managers = await detectManagers(target);
  const selectedManagers = managerFilter ? managers.filter((m) => m === managerFilter) : managers;
  const pinnedMap = await getPinnedMap(serverId);

  const sections = [];
  for (const manager of selectedManagers) {
    const version = await getManagerVersion(target, manager);
    const scanned = await scanByManager(target, manager);
    const packages = (scanned.packages || []).map((pkg) => {
      const key = `${manager}:${pkg.name}`;
      return {
        ...pkg,
        manager,
        pinned: Boolean(pinnedMap[key]),
      };
    });
    const outdatedCount = packages.filter((p) => p.latestVersion && p.latestVersion !== p.installedVersion).length;
    const vulnerableCount = packages.filter((p) => Number(p.vulnCount || 0) > 0).length;
    sections.push({
      manager,
      managerLabel: MANAGER_DEFS[manager]?.label || manager,
      managerVersion: version,
      packageCount: packages.length,
      outdatedCount,
      vulnerableCount,
      packages,
    });
  }

  const allPackages = sections.flatMap((section) => section.packages);
  const totalPackages = allPackages.length;
  const totalOutdated = allPackages.filter((pkg) => pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion).length;
  const totalVulnerable = allPackages.reduce((sum, pkg) => sum + Number(pkg.vulnCount || 0), 0);
  return {
    serverId,
    serverName: target.name || target.host || "Server",
    scannedAt: new Date().toISOString(),
    detectedManagers: selectedManagers,
    stats: {
      totalPackages,
      updatesAvailable: totalOutdated,
      vulnerabilities: totalVulnerable,
    },
    sections,
  };
}

function commandForOperation(action, manager, packageName, version, mode) {
  const pkg = shellQuote(packageName);
  const withVersion = version ? `${shellQuote(`${packageName}@${version}`)}` : pkg;
  if (action === "update") {
    if (manager === "npm") return `npm update -g ${pkg}`;
    if (manager === "yarn") return `yarn global add ${withVersion}`;
    if (manager === "pip" || manager === "pip3") return `${manager} install --upgrade ${pkg}`;
    if (manager === "composer") return `composer global update ${pkg}`;
    if (manager === "apt" || manager === "apt-get") return `sudo apt-get install --only-upgrade -y ${pkg}`;
    if (manager === "yum") return `sudo yum update -y ${pkg}`;
    if (manager === "dnf") return `sudo dnf update -y ${pkg}`;
    if (manager === "gem") return `gem update ${pkg}`;
    if (manager === "cargo") return `cargo install ${pkg} --force`;
    if (manager === "brew") return `brew upgrade ${pkg}`;
  }
  if (action === "uninstall") {
    if (manager === "npm") return `npm uninstall -g ${pkg}`;
    if (manager === "yarn") return `yarn global remove ${pkg}`;
    if (manager === "pip" || manager === "pip3") return `${manager} uninstall -y ${pkg}`;
    if (manager === "composer") return `composer global remove ${pkg}`;
    if (manager === "apt" || manager === "apt-get") return `sudo apt-get remove -y ${pkg}`;
    if (manager === "yum") return `sudo yum remove -y ${pkg}`;
    if (manager === "dnf") return `sudo dnf remove -y ${pkg}`;
    if (manager === "gem") return `gem uninstall ${pkg}`;
    if (manager === "cargo") return `cargo uninstall ${pkg}`;
    if (manager === "brew") return `brew uninstall ${pkg}`;
  }
  if (action === "install") {
    if (manager === "npm") return `npm install -g ${withVersion}`;
    if (manager === "yarn") return `yarn global add ${withVersion}`;
    if (manager === "pip" || manager === "pip3") return `${manager} install ${withVersion}`;
    if (manager === "composer") return `composer global require ${withVersion}`;
    if (manager === "apt" || manager === "apt-get") return `sudo apt-get install -y ${pkg}`;
    if (manager === "yum") return `sudo yum install -y ${pkg}`;
    if (manager === "dnf") return `sudo dnf install -y ${pkg}`;
    if (manager === "gem") return `gem install ${pkg}`;
    if (manager === "cargo") return `cargo install ${pkg}`;
    if (manager === "brew") return `brew install ${pkg}`;
  }
  if (action === "bulk-update") {
    if (manager === "npm") return `npm update -g`;
    if (manager === "pip" || manager === "pip3") return `${manager} list --outdated --format=json`;
  }
  throw new Error(`Unsupported operation for manager: ${manager}`);
}

async function logOperation(payload) {
  const row = {
    id: uuidv4(),
    server_id: payload.serverId,
    package_manager: payload.manager,
    package_name: payload.packageName,
    action: payload.action,
    from_version: payload.fromVersion || "",
    to_version: payload.toVersion || "",
    status: payload.status,
    output: payload.output || "",
    triggered_by: payload.triggeredBy || "system",
    created_at: new Date().toISOString(),
  };
  await run(
    `INSERT INTO package_history (id, server_id, package_manager, package_name, action, from_version, to_version, status, output, triggered_by, created_at)
     VALUES (@id, @server_id, @package_manager, @package_name, @action, @from_version, @to_version, @status, @output, @triggered_by, @created_at)`,
    row
  );
  return row;
}

async function executePackageOperation(serverId, payload) {
  const { manager, packageName, action, version, fromVersion, toVersion, triggeredBy } = payload || {};
  if (!manager || !action) throw new Error("manager and action are required");
  if (!validatePackageName(packageName || "x")) throw new Error("Invalid package name");
  const target = await resolveTarget(serverId);
  const command = commandForOperation(action, manager, packageName, version);
  const result = await runOnTarget(target, command, 180000);
  const status = Number(result.exitCode) === 0 ? "success" : "failed";
  await logOperation({
    serverId,
    manager,
    packageName,
    action,
    fromVersion,
    toVersion,
    status,
    output: [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n"),
    triggeredBy,
  });
  return {
    command,
    status,
    exitCode: result.exitCode,
    output: result.output,
    errorOutput: result.errorOutput,
    durationMs: result.durationMs,
  };
}

async function runCustomInstall(serverId, command, triggeredBy = "system") {
  if (!String(command || "").trim()) throw new Error("command is required");
  const target = await resolveTarget(serverId);
  const result = await runOnTarget(target, command, 5 * 60 * 1000);
  const status = Number(result.exitCode) === 0 ? "success" : "failed";
  await logOperation({
    serverId,
    manager: "custom",
    packageName: "custom-command",
    action: "install",
    status,
    output: [result.output || "", result.errorOutput || ""].filter(Boolean).join("\n"),
    triggeredBy,
  });
  return {
    status,
    exitCode: result.exitCode,
    output: result.output,
    errorOutput: result.errorOutput,
    durationMs: result.durationMs,
  };
}

async function upsertPin(serverId, manager, packageName, version) {
  if (!validatePackageName(packageName)) throw new Error("Invalid package name");
  const existing = await get(
    "SELECT id FROM package_pins WHERE server_id = ? AND package_manager = ? AND package_name = ?",
    [serverId, manager, packageName]
  );
  const now = new Date().toISOString();
  if (existing) {
    await run("UPDATE package_pins SET version = ?, updated_at = ? WHERE id = ?", [version || "", now, existing.id]);
    return { id: existing.id, server_id: serverId, package_manager: manager, package_name: packageName, version, updated_at: now };
  }
  const id = uuidv4();
  await run(
    `INSERT INTO package_pins (id, server_id, package_manager, package_name, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, serverId, manager, packageName, version || "", now, now]
  );
  return { id, server_id: serverId, package_manager: manager, package_name: packageName, version, created_at: now, updated_at: now };
}

async function removePin(serverId, manager, packageName) {
  await run("DELETE FROM package_pins WHERE server_id = ? AND package_manager = ? AND package_name = ?", [
    serverId,
    manager,
    packageName,
  ]);
}

async function listHistory(serverId, limit = 200) {
  return all(
    "SELECT * FROM package_history WHERE server_id = ? ORDER BY created_at DESC LIMIT ?",
    [serverId, Number(limit || 200)]
  );
}

async function queryOsvVulnerabilities(manager, packageName, version) {
  const ecosystemMap = {
    npm: "npm",
    yarn: "npm",
    pip: "PyPI",
    pip3: "PyPI",
    composer: "Packagist",
    gem: "RubyGems",
    cargo: "crates.io",
    brew: "Homebrew",
    apt: "Debian",
    "apt-get": "Debian",
    yum: "OSS-Fuzz",
    dnf: "OSS-Fuzz",
  };
  const ecosystem = ecosystemMap[manager];
  if (!ecosystem) return { vulnerabilities: [] };
  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      package: { name: packageName, ecosystem },
      version: version || undefined,
    }),
  });
  if (!response.ok) throw new Error(`OSV query failed: ${response.status}`);
  return response.json();
}

module.exports = {
  MANAGER_DEFS,
  resolveTarget,
  scanPackages,
  executePackageOperation,
  runCustomInstall,
  upsertPin,
  removePin,
  listHistory,
  queryOsvVulnerabilities,
};
