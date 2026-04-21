const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const {
  listFiles,
  listProcesses,
  killProcess,
  listServices,
  serviceAction,
  listLogSources,
  readLog,
  diskOverview,
  findLargeFiles,
  networkInfo,
  run,
} = require("../services/terminalGuiService");
const { getSessionByServerId } = require("../services/terminalSessionManager");
const { listDirectory, readFile, writeFile } = require("../services/sftpExplorerService");

const router = express.Router();

/**
 * Resolve session id from request payload/query.
 *
 * @param {import("express").Request} req
 * @returns {string}
 */
function getSessionId(req) {
  return String(req.body?.sessionId || req.query?.sessionId || "").trim();
}

function getExplorerSessionId(req) {
  const direct = getSessionId(req);
  if (direct) return direct;
  const serverId = String(req.body?.serverId || req.query?.serverId || "").trim();
  if (!serverId) return "";
  const session = getSessionByServerId(serverId);
  return session?.id || "";
}

router.get(
  "/session",
  asyncHandler(async (req, res) => {
    const serverId = String(req.query.serverId || "").trim();
    if (!serverId) {
      return res.status(400).json({ error: "serverId is required", code: "VALIDATION_ERROR" });
    }
    const session = getSessionByServerId(serverId);
    if (!session) {
      return res.status(404).json({ error: "No active session", code: "NOT_FOUND" });
    }
    res.json({ data: { sessionId: session.id } });
  })
);

router.post(
  "/command",
  asyncHandler(async (req, res) => {
    const command = String(req.body?.command || "").trim();
    if (!command) {
      return res.status(400).json({ error: "command is required", code: "VALIDATION_ERROR" });
    }
    const timeoutMs = Number(req.body?.timeoutMs || 15000);
    const stdin = req.body?.stdin === undefined ? undefined : String(req.body.stdin);
    const result = await run(getSessionId(req), command, { timeoutMs, stdin });
    res.json({ data: result });
  })
);

router.get(
  "/files",
  asyncHandler(async (req, res) => {
    const data = await listFiles(getSessionId(req), String(req.query.path || "~"), {
      showHidden: String(req.query.showHidden || "false") === "true",
    });
    res.json({ data });
  })
);

router.post(
  "/fs/list",
  asyncHandler(async (req, res) => {
    const { path, showHidden } = req.body || {};
    const sessionId = getExplorerSessionId(req);
    if (!sessionId) {
      return res.status(404).json({ error: "No active session", code: "NOT_FOUND" });
    }
    const data = await listDirectory(sessionId, String(path || "~"), { showHidden });
    res.json({ data });
  })
);

router.post(
  "/fs/read",
  asyncHandler(async (req, res) => {
    const sessionId = getExplorerSessionId(req);
    if (!sessionId) {
      return res.status(404).json({ error: "No active session", code: "NOT_FOUND" });
    }
    const data = await readFile(sessionId, String(req.body?.path || ""));
    res.json({ data });
  })
);

router.post(
  "/fs/write",
  asyncHandler(async (req, res) => {
    const sessionId = getExplorerSessionId(req);
    if (!sessionId) {
      return res.status(404).json({ error: "No active session", code: "NOT_FOUND" });
    }
    const sudoPassword = req.body?.sudoPassword === undefined ? undefined : String(req.body.sudoPassword);
    const sudoUser = req.body?.sudoUser === undefined ? undefined : String(req.body.sudoUser);
    const data = await writeFile(
      sessionId,
      String(req.body?.path || ""),
      String(req.body?.content || ""),
      { sudoPassword, sudoUser }
    );
    res.json({ data });
  })
);

router.get(
  "/processes",
  asyncHandler(async (req, res) => {
    res.json({ data: await listProcesses(getSessionId(req)) });
  })
);

router.post(
  "/processes/kill",
  asyncHandler(async (req, res) => {
    const data = await killProcess(getSessionId(req), req.body?.pid, req.body?.signal || 15);
    res.json({ data });
  })
);

router.get(
  "/services",
  asyncHandler(async (req, res) => {
    res.json({ data: await listServices(getSessionId(req)) });
  })
);

router.post(
  "/services/action",
  asyncHandler(async (req, res) => {
    const data = await serviceAction(
      getSessionId(req),
      String(req.body?.service || ""),
      String(req.body?.action || "")
    );
    res.json({ data });
  })
);

router.get(
  "/logs/sources",
  asyncHandler(async (req, res) => {
    res.json({ data: await listLogSources(getSessionId(req)) });
  })
);

router.get(
  "/logs/read",
  asyncHandler(async (req, res) => {
    const data = await readLog(
      getSessionId(req),
      String(req.query.path || ""),
      Number(req.query.lines || 100)
    );
    res.json({ data });
  })
);

router.get(
  "/disk",
  asyncHandler(async (req, res) => {
    res.json({ data: await diskOverview(getSessionId(req), String(req.query.path || "/")) });
  })
);

router.get(
  "/disk/find-large",
  asyncHandler(async (req, res) => {
    res.json({ data: await findLargeFiles(getSessionId(req)) });
  })
);

router.get(
  "/network",
  asyncHandler(async (req, res) => {
    res.json({ data: await networkInfo(getSessionId(req)) });
  })
);

module.exports = router;
