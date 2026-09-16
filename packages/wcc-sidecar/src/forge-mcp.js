/**
 * wc3-forge MCP client — dual transport (official docs).
 * 1) stdio: spawn `<exe> --mcp` (Claude Code style)
 * 2) TCP: lockfile ~/.wc3-forge/mcp/<pid>.lock + NDJSON JSON-RPC + params._token
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";

function lockDir() {
  return process.env.WC3FORGE_MCP_LOCK_DIR || path.join(os.homedir(), ".wc3-forge", "mcp");
}

function findForgeExe() {
  if (process.env.WC3FORGE_EXE && fs.existsSync(process.env.WC3FORGE_EXE)) {
    return process.env.WC3FORGE_EXE;
  }
  // Version-managed install: D:\Program Files\wc3-forge\CURRENT + v*
  const managedRoot = "D:\\Program Files\\wc3-forge";
  try {
    const currentFile = path.join(managedRoot, "CURRENT");
    if (fs.existsSync(currentFile)) {
      const ver = fs.readFileSync(currentFile, "utf8").trim();
      const p = path.join(managedRoot, ver, "wc3-forge.exe");
      if (fs.existsSync(p)) return p;
    }
    if (fs.existsSync(managedRoot)) {
      const vers = fs
        .readdirSync(managedRoot)
        .filter((n) => n.startsWith("v") && fs.statSync(path.join(managedRoot, n)).isDirectory())
        .sort()
        .reverse();
      for (const v of vers) {
        const p = path.join(managedRoot, v, "wc3-forge.exe");
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {
    /* ignore */
  }
  const candidates = [
    "C:\\Program Files\\wc3-forge\\wc3-forge.exe",
    path.join(os.homedir(), "wc3-forge", "wc3-forge.exe"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function readLock(lockPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    return {
      lockPath,
      pid: raw.pid,
      port: Number(raw.port),
      token: raw.token || raw._token,
      label: raw.label || raw.windowTitle || raw.title || `pid-${raw.pid}`,
      raw,
    };
  } catch {
    return null;
  }
}

export function listForgeSessions() {
  const dir = lockDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".lock") && !name.endsWith(".json")) continue;
    const s = readLock(path.join(dir, name));
    if (s && s.port) out.push(s);
  }
  return out;
}

/** TCP transport: NDJSON JSON-RPC + params._token */
function createTcpTransport(session) {
  let sock = null;
  let buf = "";
  let nextId = 1;
  const pending = new Map();
  let connected = false;

  function connect() {
    if (sock && connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      sock = net.connect({ host: "127.0.0.1", port: session.port }, () => {
        connected = true;
        resolve();
      });
      sock.on("error", (e) => {
        connected = false;
        reject(e);
      });
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.id != null && pending.has(msg.id)) {
            const { resolve: res, reject: rej } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
            else res(msg.result);
          }
        }
      });
      sock.on("close", () => {
        connected = false;
      });
      sock.setTimeout(15000, () => {
        if (!connected) sock?.destroy(new Error("forge connect timeout"));
      });
    });
  }

  async function rpc(method, params = {}, { timeoutMs = 20000 } = {}) {
    await connect();
    const id = nextId++;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params: { ...params, _token: session.token },
    };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`forge rpc timeout: ${method}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      sock.write(JSON.stringify(payload) + "\n");
    });
  }

  function close() {
    try {
      sock?.end();
      sock?.destroy();
    } catch {
      /* ignore */
    }
    connected = false;
  }

  return { kind: "tcp", session, connect, rpc, close, get connected() { return connected; } };
}

/** stdio transport: spawn wc3-forge --mcp (official Claude Code path) */
function createStdioTransport(exePath) {
  let child = null;
  let buf = "";
  let nextId = 1;
  const pending = new Map();
  let initialized = false;
  let toolCache = [];

  function ensureSpawn() {
    if (child && !child.killed) return;
    child = spawn(exePath, ["--mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id != null && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      }
    });
    child.stderr.on("data", (d) => {
      console.warn("[wc3-forge --mcp]", d.toString());
    });
    child.on("exit", (code) => {
      initialized = false;
      for (const [, p] of pending) p.reject(new Error(`forge mcp exit ${code}`));
      pending.clear();
    });
  }

  function rpc(method, params = {}, { timeoutMs = 20000, id: forcedId } = {}) {
    ensureSpawn();
    const id = forcedId ?? nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`forge stdio timeout: ${method}`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      child.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  async function initialize() {
    if (initialized) return;
    // MCP initialize (notification-capable servers still accept request form)
    await rpc(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "wcc-desktop", version: "0.1.0" },
      },
      { id: 0 }
    );
    // initialized notification (no id)
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );
    initialized = true;
  }

  function close() {
    try {
      child?.kill();
    } catch {
      /* ignore */
    }
    child = null;
    initialized = false;
  }

  return {
    kind: "stdio",
    exePath,
    async connect() {
      ensureSpawn();
      await initialize();
    },
    rpc,
    close,
    get connected() {
      return Boolean(child && !child.killed && initialized);
    },
  };
}

export function createForgeClientFromSession(session) {
  const transport = createTcpTransport(session);
  return wrapTransport(transport, session);
}

export function createForgeClientStdio(exePath) {
  const transport = createStdioTransport(exePath);
  return wrapTransport(transport, { pid: "stdio", label: exePath });
}

function wrapTransport(transport, session) {
  let cachedTools = [];

  async function listTools() {
    const r = await transport.rpc("tools/list", {});
    const list = r?.tools || [];
    cachedTools = list.map((t) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || { type: "object", properties: {} },
    }));
    return cachedTools;
  }

  async function callTool(name, args = {}) {
    const r = await transport.rpc("tools/call", { name, arguments: args });
    if (typeof r === "string") return r;
    if (r?.content && Array.isArray(r.content)) {
      return r.content
        .map((c) => (typeof c === "string" ? c : c.text || JSON.stringify(c)))
        .join("\n");
    }
    return JSON.stringify(r, null, 2);
  }

  return {
    session,
    transportKind: transport.kind,
    connect: () => transport.connect(),
    listTools,
    callTool,
    close: () => transport.close(),
    get tools() {
      return cachedTools;
    },
    get connected() {
      return Boolean(transport.connected);
    },
  };
}

/**
 * Prefer stdio if exe known; else first live TCP session.
 */
export function createForgeManager() {
  let sessions = [];
  let active = null;
  let client = null;
  let mode = "none";

  function refresh() {
    sessions = listForgeSessions();
    return sessions;
  }

  async function selectSession(idOrPort) {
    refresh();
    const exe = findForgeExe();

    // stdio path when user configured / installed forge
    if (exe && (!idOrPort || idOrPort === "stdio")) {
      try {
        client?.close();
        client = createForgeClientStdio(exe);
        await client.connect();
        await client.listTools();
        active = { pid: "stdio", port: 0, label: exe };
        mode = "stdio";
        return {
          mode,
          pid: "stdio",
          label: exe,
          tools: client.tools.length,
        };
      } catch (e) {
        client = null;
        // fall through to TCP
        console.warn("[forge] stdio failed, trying lockfile TCP:", e.message);
      }
    }

    const s =
      sessions.find((x) => String(x.pid) === String(idOrPort)) ||
      sessions.find((x) => String(x.port) === String(idOrPort)) ||
      sessions[0];
    if (!s) {
      client = null;
      active = null;
      mode = "none";
      return null;
    }
    client?.close();
    client = createForgeClientFromSession(s);
    active = s;
    try {
      await client.listTools();
      mode = "tcp";
    } catch (e) {
      return { ...s, mode: "tcp", toolsError: String(e.message || e) };
    }
    return {
      mode,
      pid: s.pid,
      port: s.port,
      label: s.label,
      tools: client.tools.length,
    };
  }

  async function status() {
    refresh();
    const exe = findForgeExe();
    if (!client) {
      return {
        connected: false,
        mode: "none",
        exeFound: Boolean(exe),
        sessions: sessions.map((s) => ({ pid: s.pid, port: s.port, label: s.label })),
        hint: sessions.length || exe
          ? "发现 forge；可 forge_connect（优先 --mcp stdio）"
          : "未安装/未运行 wc3-forge。下载后保持编辑器打开并加载地图；或设置 WC3FORGE_EXE",
      };
    }
    try {
      const tools = await client.listTools();
      return {
        connected: true,
        mode,
        pid: active?.pid,
        port: active?.port,
        label: active?.label,
        toolCount: tools.length,
        exeFound: Boolean(exe),
      };
    } catch (e) {
      client.close();
      client = null;
      mode = "none";
      return { connected: false, mode: "none", error: String(e.message || e) };
    }
  }

  function getToolsForAgent() {
    if (!client) return [];
    return client.tools.map((t) => ({
      name: `forge_${t.name}`,
      description: `[wc3-forge] ${t.description}`,
      needsApproval: true,
      forgeName: t.name,
      schema: t.inputSchema,
    }));
  }

  async function callForgeTool(name, args) {
    if (!client) throw new Error("forge not connected");
    return client.callTool(name, args);
  }

  return {
    refresh,
    selectSession,
    status,
    getToolsForAgent,
    callForgeTool,
    listSessions: () => sessions,
    get client() {
      return client;
    },
  };
}
