const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SIDECAR_PORT = Number(process.env.WCC_SIDECAR_PORT || 47840);

let win = null;
let sidecar = null;
let healthTimer = null;
let restartAttempts = 0;
let lastProjectRoot = null;

function defaultProjectRoot() {
  const fromEnv = process.env.WCC_PROJECT_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const demo = path.join(REPO_ROOT, "examples", "demo-campaign");
  return fs.existsSync(demo) ? demo : REPO_ROOT;
}

function scheduleSidecarRestart() {
  if (restartAttempts >= 5) {
    console.error("[sidecar] max restart attempts reached");
    return;
  }
  const delay = Math.min(8000, 500 * 2 ** restartAttempts);
  restartAttempts += 1;
  setTimeout(() => startSidecar(lastProjectRoot || defaultProjectRoot()), delay);
}

function startHealthWatch() {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${SIDECAR_PORT}/health`);
      if (res.ok) {
        restartAttempts = 0;
        return;
      }
    } catch {
      /* down */
    }
    if (sidecar && sidecar.exitCode === null) return;
    scheduleSidecarRestart();
  }, 5000);
}

function startSidecar(projectRoot) {
  lastProjectRoot = projectRoot;
  if (sidecar) {
    try { sidecar.kill(); } catch { /* ignore */ }
    sidecar = null;
  }
  const serverJs = path.join(REPO_ROOT, "packages", "wcc-sidecar", "src", "server.js");
  const env = {
    ...process.env,
    WCC_SIDECAR_PORT: String(SIDECAR_PORT),
    WCC_PROJECT_ROOT: projectRoot,
    WCC_SKILL_ROOT: path.join(REPO_ROOT, "wcc-skill"),
  };
  // Dev: PATH node. Packaged: set WCC_NODE to embedded runtime.
  // When Electron ≥28: prefer utilityProcess.fork(serverJs, { env }) so no system Node is required.
  const nodeBin = process.env.WCC_NODE || "node";
  sidecar = spawn(nodeBin, [serverJs], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  sidecar.stdout?.on("data", (d) => console.log("[sidecar]", d.toString()));
  sidecar.stderr?.on("data", (d) => console.error("[sidecar]", d.toString()));
  sidecar.on("exit", (code, signal) => {
    console.warn(`[sidecar] exited code=${code} signal=${signal}`);
    scheduleSidecarRestart();
  });
  startHealthWatch();
  return sidecar;
}

async function sidecarFetch(pathname, init) {
  const res = await fetch(`http://127.0.0.1:${SIDECAR_PORT}${pathname}`, init);
  return res.json();
}

/** Stream POST /chat/stream and forward NDJSON SSE events to renderer. */
async function sidecarChatStream(message, onEvent) {
  const res = await fetch(`http://127.0.0.1:${SIDECAR_PORT}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`stream HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        onEvent(JSON.parse(data));
      } catch {
        /* skip */
      }
    }
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "WCC Desktop — 魔兽战役 AI Harness",
    backgroundColor: "#0f1419",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  startSidecar(defaultProjectRoot());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (sidecar) sidecar.kill();
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("wcc:status", async () => {
  try {
    return await sidecarFetch("/health");
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});
ipcMain.handle("wcc:session-list", async () => sidecarFetch("/session/list"));
ipcMain.handle("wcc:session-resume", async (_e, id) =>
  sidecarFetch("/session/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
);
ipcMain.handle("wcc:session-new", async () =>
  sidecarFetch("/session/new", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
);

ipcMain.handle("wcc:chat", async (_e, message) => {
  // Streaming: events pushed via webContents.send("wcc:chat-event")
  const webContents = _e.sender;
  try {
    let finalText = "";
    await sidecarChatStream(String(message || ""), (evt) => {
      webContents.send("wcc:chat-event", evt);
      if (evt.type === "done") finalText = evt.text || finalText;
    });
    return { reply: finalText };
  } catch (e) {
    return { error: String(e.message || e) };
  }
});

ipcMain.handle("wcc:tools", async () => sidecarFetch("/tools"));
ipcMain.handle("wcc:approval-pending", async () => sidecarFetch("/approval/pending"));
ipcMain.handle("wcc:approval-resolve", async (_e, allow) =>
  sidecarFetch("/approval/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allow: Boolean(allow) }),
  })
);
ipcMain.handle("wcc:forge-status", async () => sidecarFetch("/forge/status"));
ipcMain.handle("wcc:forge-sessions", async () => sidecarFetch("/forge/sessions"));
ipcMain.handle("wcc:maps-sources", async (_e, kind) => {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return sidecarFetch(`/maps/sources${q}`);
});
ipcMain.handle("wcc:maps-recommendations", async () => sidecarFetch("/maps/recommendations"));
ipcMain.handle("wcc:maps-rec-add", async (_e, payload) =>
  sidecarFetch("/maps/recommendations/custom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  })
);
ipcMain.handle("wcc:maps-rec-remove", async (_e, id) =>
  sidecarFetch("/maps/recommendations/custom", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
);
ipcMain.handle("wcc:maps-open-url", async (_e, url) => {
  if (!/^https?:\/\//i.test(String(url || ""))) {
    return { error: "invalid url" };
  }
  try {
    await shell.openExternal(url);
    return { ok: true, url };
  } catch (e) {
    return { error: String(e) };
  }
});
ipcMain.handle("wcc:maps-scan", async () => sidecarFetch("/maps/scan"));
ipcMain.handle("wcc:maps-open", async (_e, id) => {
  const r = await sidecarFetch("/maps/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (r?.url) {
    try {
      await shell.openExternal(r.url);
      return { ...r, opened: true };
    } catch (e) {
      return { ...r, opened: false, error: String(e) };
    }
  }
  return r;
});
ipcMain.handle("wcc:forge-connect", async (_e, pid) =>
  sidecarFetch("/forge/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid }),
  })
);
ipcMain.handle("wcc:config-get", async () => sidecarFetch("/config"));
ipcMain.handle("wcc:config-set", async (_e, patch) =>
  sidecarFetch("/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch || {}),
  })
);
ipcMain.handle("wcc:experts", async () => sidecarFetch("/experts"));
ipcMain.handle("wcc:providers", async () => sidecarFetch("/harness/providers"));
ipcMain.handle("wcc:harness-state", async () => sidecarFetch("/harness/state"));
ipcMain.handle("wcc:harness-steering", async (_e, intent, files) =>
  sidecarFetch(
    `/harness/steering?intent=${encodeURIComponent(intent || "")}` +
      `&files=${encodeURIComponent((files || []).join(","))}`
  )
);
ipcMain.handle("wcc:harness-tools", async (_e, intent) =>
  sidecarFetch(`/harness/tools?intent=${encodeURIComponent(intent || "")}`)
);
ipcMain.handle("wcc:lua-check", async (_e, subpath) =>
  sidecarFetch(`/check?subpath=${encodeURIComponent(subpath || "src")}`)
);
ipcMain.handle("wcc:workbench-tree", async () => sidecarFetch("/workbench/tree"));
ipcMain.handle("wcc:workbench-bible", async () => sidecarFetch("/workbench/bible"));
ipcMain.handle("wcc:workbench-bible-set", async (_e, patch) =>
  sidecarFetch("/workbench/bible", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch || {}),
  })
);
ipcMain.handle("wcc:workbench-overview", async () => sidecarFetch("/workbench/overview"));
ipcMain.handle("wcc:workbench-dialogues", async () => sidecarFetch("/workbench/dialogues"));
ipcMain.handle("wcc:workbench-quests", async () => sidecarFetch("/workbench/quests"));
ipcMain.handle("wcc:workbench-spawners", async () => sidecarFetch("/workbench/spawners"));
ipcMain.handle("wcc:build", async (_e, entry) =>
  sidecarFetch("/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: entry || "src.main" }),
  })
);
ipcMain.handle("wcc:onboarding-checklist", async () => sidecarFetch("/onboarding/checklist"));
ipcMain.handle("wcc:onboarding-done", async () =>
  sidecarFetch("/onboarding/done", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
);
ipcMain.handle("wcc:onboarding-reset", async () =>
  sidecarFetch("/onboarding/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
);

ipcMain.handle("wcc:pick-project", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  startSidecar(r.filePaths[0]);
  return r.filePaths[0];
});

ipcMain.handle("wcc:open-external", async (_e, url) => {
  shell.openExternal(url);
  return true;
});
