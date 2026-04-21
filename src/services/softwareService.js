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

function validatePackageName(name) {
  return /^[a-zA-Z0-9@._/+:-]+$/.test(String(name || ""));
}

function validatePackageVersion(version) {
  return /^[a-zA-Z0-9._:+-]+$/.test(String(version || ""));
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
  const candidates = ["npm", "pip", "pip3", "composer", "apt", "apt-get", "yum", "dnf", "gem", "cargo", "yarn", "brew"];
  if (target.targetType === "local" && process.platform === "win32") {
    const checks = await Promise.all(
      candidates.map(async (name) => {
        const res = await runOnTarget(target, `where ${name}`, 8000);
        return Number(res.exitCode) === 0 ? name : null;
      })
    );
    return checks.filter(Boolean);
  }
  const command = `set +e; for c in ${candidates.join(" ")}; do command -v "$c" >/dev/null 2>&1 && echo "$c"; done`;
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

async function getManagerPath(target, manager) {
  const cmd = target.targetType === "local" && process.platform === "win32" ? `where ${manager}` : `command -v ${manager}`;
  const result = await runOnTarget(target, cmd, 10000);
  const line = (result.output || "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .find(Boolean);
  return line || "";
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
    const [version, managerPath] = await Promise.all([
      getManagerVersion(target, manager),
      getManagerPath(target, manager),
    ]);
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
      managerPath,
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

async function streamScan(serverId, managerFilter = null, emit = () => {}) {
  const target = await resolveTarget(serverId);
  const managers = await detectManagers(target);
  const selectedManagers = managerFilter ? managers.filter((m) => m === managerFilter) : managers;
  const pinnedMap = await getPinnedMap(serverId);
  const sections = [];

  for (const manager of selectedManagers) {
    emit("progress", { type: "start", manager, total: null });

    const [version, managerPath] = await Promise.all([
      getManagerVersion(target, manager),
      getManagerPath(target, manager),
    ]);
    const scanned = await scanByManager(target, manager);
    const packages = (scanned.packages || []).map((pkg) => {
      const key = `${manager}:${pkg.name}`;
      return { ...pkg, manager, pinned: Boolean(pinnedMap[key]) };
    });

    for (const pkg of packages) {
      emit("progress", {
        type: "package",
        manager,
        name: pkg.name,
        installed: pkg.installedVersion || "",
        latest: pkg.latestVersion || "",
        updateType: String(pkg.updateType || "NONE").toLowerCase(),
      });
    }

    const outdatedCount = packages.filter((p) => p.latestVersion && p.latestVersion !== p.installedVersion).length;
    const vulnerableCount = packages.filter((p) => Number(p.vulnCount || 0) > 0).length;
    const section = {
      manager,
      managerLabel: MANAGER_DEFS[manager]?.label || manager,
      managerVersion: version,
      managerPath,
      packageCount: packages.length,
      outdatedCount,
      vulnerableCount,
      packages,
    };
    sections.push(section);
    emit("progress", {
      type: "complete",
      manager,
      count: packages.length,
      outdated: outdatedCount,
      vulnerable: vulnerableCount,
      section,
    });
  }

  const allPackages = sections.flatMap((section) => section.packages);
  const totalPackages = allPackages.length;
  const totalOutdated = allPackages.filter((pkg) => pkg.latestVersion && pkg.latestVersion !== pkg.installedVersion).length;
  const totalVulnerable = allPackages.reduce((sum, pkg) => sum + Number(pkg.vulnCount || 0), 0);
  const payload = {
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
  emit("done", {
    totalPackages,
    totalUpdates: totalOutdated,
    totalVulns: totalVulnerable,
    payload,
  });
  return payload;
}

function commandForOperation(action, manager, packageName, version, mode) {
  const pkg = String(packageName || "");
  const npmWithVersion = version ? `${pkg}@${version}` : pkg;
  const pipWithVersion = version ? `${pkg}==${version}` : pkg;
  const composerWithVersion = version ? `${pkg}:${version}` : pkg;
  const gemVersionArg = version ? ` -v ${version}` : "";
  const aptWithVersion = version ? `${pkg}=${version}` : pkg;
  if (action === "update") {
    if (manager === "npm") return `npm update -g ${pkg}`;
    if (manager === "yarn") return `yarn global add ${npmWithVersion}`;
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
    if (manager === "npm") return `npm install -g ${npmWithVersion}`;
    if (manager === "yarn") return `yarn global add ${npmWithVersion}`;
    if (manager === "pip" || manager === "pip3") return `${manager} install ${pipWithVersion}`;
    if (manager === "composer") return `composer global require ${composerWithVersion}`;
    if (manager === "apt" || manager === "apt-get") return `sudo apt-get install -y ${aptWithVersion}`;
    if (manager === "yum") return `sudo yum install -y ${pkg}`;
    if (manager === "dnf") return `sudo dnf install -y ${pkg}`;
    if (manager === "gem") return `gem install ${pkg}${gemVersionArg}`;
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
  if (version && !validatePackageVersion(version)) throw new Error("Invalid version");
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

async function listHistory(serverId, limit = 200, filter = "all", search = "") {
  const normalizedFilter = String(filter || "all").trim().toLowerCase();
  const clauses = ["server_id = ?"];
  const params = [serverId];
  if (normalizedFilter === "failed") {
    clauses.push("status = 'failed'");
  } else if (["update", "downgrade", "uninstall", "scan"].includes(normalizedFilter)) {
    clauses.push("action = ?");
    params.push(normalizedFilter);
  }
  if (String(search || "").trim()) {
    clauses.push("package_name LIKE ?");
    params.push(`%${String(search).trim()}%`);
  }
  params.push(Number(limit || 200));
  return all(
    `SELECT * FROM package_history WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    params
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

function normalizeSeverityFromOsv(v) {
  const scored = Array.isArray(v?.severity) ? v.severity[0] : null;
  const score = Number(scored?.score || 0);
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  if (score > 0) return "LOW";
  const level = String(v?.database_specific?.severity || "").toUpperCase();
  if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(level)) return level;
  return "UNKNOWN";
}

function firstTwoSentences(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ");
}

function extractAffectedAndFixed(vuln = {}) {
  const affectedRanges = [];
  let fixedVersion = "";
  (vuln.affected || []).forEach((aff) => {
    (aff.ranges || []).forEach((range) => {
      const introduced = [];
      const fixed = [];
      (range.events || []).forEach((event) => {
        if (event.introduced) introduced.push(event.introduced);
        if (event.fixed) fixed.push(event.fixed);
      });
      if (introduced.length || fixed.length) {
        affectedRanges.push(`${introduced[0] || "?"} -> ${fixed[0] || "unfixed"}`);
      }
      if (!fixedVersion && fixed[0]) fixedVersion = fixed[0];
    });
  });
  return { affectedRanges, fixedVersion };
}

async function fetchCVEs(serverId, manager, packageName, version) {
  await resolveTarget(serverId);
  const osv = await queryOsvVulnerabilities(manager, packageName, version);
  const vulnerabilities = Array.isArray(osv?.vulns) ? osv.vulns : Array.isArray(osv?.vulnerabilities) ? osv.vulnerabilities : [];
  return vulnerabilities.map((v) => {
    const { affectedRanges, fixedVersion } = extractAffectedAndFixed(v);
    return {
      id: v.id || "UNKNOWN",
      severity: normalizeSeverityFromOsv(v),
      cvss: Number(Array.isArray(v.severity) && v.severity[0]?.score ? v.severity[0].score : 0) || null,
      description: firstTwoSentences(v.summary || v.details || ""),
      affectedVersions: affectedRanges,
      fixedVersion: fixedVersion || "",
      referenceUrl: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v.id || "")}`,
    };
  });
}

/**
 * Returns recent published versions for a package manager.
 *
 * @param {string} serverId
 * @param {string} manager
 * @param {string} packageName
 * @param {number} [limit]
 * @returns {Promise<Array<{version: string, publishedAt: string}>>}
 */
async function listPublishedVersions(serverId, manager, packageName, limit = 5) {
  if (!validatePackageName(packageName)) throw new Error("Invalid package name");
  const target = await resolveTarget(serverId);
  const max = Math.max(1, Math.min(20, Number(limit || 5)));

  if (manager === "npm" || manager === "yarn") {
    const [versionsRes, timeRes] = await Promise.all([
      runOnTarget(target, `npm view ${packageName} versions --json`, 60000),
      runOnTarget(target, `npm view ${packageName} time --json`, 60000),
    ]);
    const versions = safeJson(versionsRes.output || "[]", []);
    const timeMap = safeJson(timeRes.output || "{}", {});
    return (Array.isArray(versions) ? versions : [])
      .slice(-max)
      .reverse()
      .map((version) => ({ version: String(version), publishedAt: String(timeMap?.[version] || "") }));
  }

  if (manager === "pip" || manager === "pip3") {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    if (!response.ok) throw new Error(`PyPI query failed: ${response.status}`);
    const data = await response.json();
    const releases = data?.releases || {};
    return Object.entries(releases)
      .map(([version, files]) => {
        const firstFile = Array.isArray(files) ? files[0] : null;
        const uploadTime = firstFile?.upload_time_iso_8601 || firstFile?.upload_time || "";
        const size = (Array.isArray(files) ? files : []).reduce((sum, f) => sum + Number(f?.size || 0), 0);
        return { version: String(version), publishedAt: String(uploadTime || ""), size };
      })
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, max);
  }

  if (manager === "composer") {
    const response = await fetch(`https://repo.packagist.org/p2/${encodeURIComponent(packageName)}.json`);
    if (!response.ok) throw new Error(`Packagist query failed: ${response.status}`);
    const data = await response.json();
    const packages = Array.isArray(data?.packages?.[packageName]) ? data.packages[packageName] : [];
    return packages
      .filter((p) => !String(p.version || "").toLowerCase().includes("dev"))
      .map((p) => ({
        version: String(p.version || ""),
        publishedAt: String(p.time || ""),
        size: Number(p.dist?.shasum ? 0 : 0),
      }))
      .filter((p) => p.version)
      .slice(0, max);
  }

  if (manager === "gem") {
    const result = await runOnTarget(target, `gem list --remote ${packageName} --all`, 60000);
    const line = (result.output || "")
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find((row) => row.startsWith(`${packageName} (`));
    if (!line) return [];
    const versions = line
      .replace(`${packageName} (`, "")
      .replace(")", "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, max);
    return versions.map((version) => ({ version, publishedAt: "", size: null }));
  }

  if (manager === "apt" || manager === "apt-get") {
    const result = await runOnTarget(target, `apt-cache madison ${packageName}`, 60000);
    const versions = (result.output || "")
      .split(/\r?\n/)
      .map((line) => line.split("|")[1]?.trim() || "")
      .filter(Boolean)
      .slice(0, max);
    return versions.map((version) => ({ version, publishedAt: "" }));
  }

  return [];
}

async function fetchVersions(serverId, manager, packageName, limit = 10) {
  const rows = await listPublishedVersions(serverId, manager, packageName, limit);
  return (rows || []).map((row) => ({
    version: row.version,
    date: row.publishedAt || row.date || "",
    size: row.size ?? null,
  }));
}

module.exports = {
  MANAGER_DEFS,
  resolveTarget,
  scanPackages,
  streamScan,
  executePackageOperation,
  runCustomInstall,
  upsertPin,
  removePin,
  listHistory,
  queryOsvVulnerabilities,
  fetchCVEs,
  listPublishedVersions,
  fetchVersions,
};
