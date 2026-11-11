#!/usr/bin/env node
/**
 * WCC Sidecar HTTP server (localhost) with SSE chat + forge endpoints.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createToolRegistry } from "./tools.js";
import { createAgent } from "./agent.js";
import { createForgeManager } from "./forge-mcp.js";
import { createConfigStore, EXPERTS } from "./config-store.js";
import { createWorkbench } from "./workbench.js";
import { bundleCampaign } from "./build-map.js";
import { createOnboarding } from "./onboarding.js";
import { createMapSources } from "./map-sources.js";
import { createSessionStore } from "./session-store.js";
import { createHarness, listProviders, providerPatch } from "../../../harness/src/index.js";

const PORT = Number(process.env.WCC_SIDECAR_PORT || 47840);
// packages/wcc-sidecar/src -> repo root (three levels up). Used to locate the
// ONE repo-level AGENTS.md; never copy it into a project dir (single source).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PROJECT = process.env.WCC_PROJECT_ROOT || process.cwd();
const SKILL = path.resolve(REPO_ROOT, process.env.WCC_SKILL_ROOT || "wcc-skill");
const AGENTS_FILE = path.join(REPO_ROOT, "AGENTS.md");

let pendingApproval = null;

const approval = {
  request({ name, args }) {
    if (process.env.WCC_AUTO_APPROVE === "1") return Promise.resolve(true);
    return new Promise((resolve) => {
      pendingApproval = { name, args, resolve };
      setTimeout(() => {
        if (pendingApproval?.resolve === resolve) {
          pendingApproval = null;
          resolve(false);
        }
      }, 60000);
    });
  },
};

const forgeManager = createForgeManager();
const configStore = createConfigStore({ projectRoot: PROJECT });
const workbench = createWorkbench({ projectRoot: PROJECT });

// Apply saved config into env for agent
configStore.save({});

try {
  forgeManager.refresh();
  if (forgeManager.listSessions().length) {
    await forgeManager.selectSession();
  }
} catch {
  /* forge optional */
}

const mapSources = createMapSources({ projectRoot: PROJECT });

const tools = createToolRegistry({
  projectRoot: PROJECT,
  skillRoot: SKILL,
  approval,
  forgeManager,
  workbench,
  buildMap: (opts) => bundleCampaign({ projectRoot: PROJECT, ...opts }),
  mapSources,
});

const onboarding = createOnboarding({ projectRoot: PROJECT, configStore, forgeManager });
const sessionStore = createSessionStore({ projectRoot: PROJECT });
sessionStore.newSession();

// ONE harness instance shared by the agent and the /harness/* endpoints.
// 双表面可以，双数据源不行: within THIS process the renderer reads this object.
// The standalone CLI TUI runs in another process and builds its own instance;
// it is not a second live state store for the product.
const harness = createHarness({
  projectRoot: PROJECT,
  skillRoot: SKILL,
  // WCC_PROJECT_ROOT is often a campaign dir (e.g. examples/demo-campaign)
  // with no AGENTS.md. Always inject the single repo-root contract instead.
  agentsFile: AGENTS_FILE,
  config: configStore.getRaw(),
  catalog: tools.list(),
  steeringBudget: 8000,
  maxTools: 14,
});

const agent = createAgent({
  tools,
  projectRoot: PROJECT,
  skillRoot: SKILL,
  harness,
  getConfig: () => configStore.getRaw(),
  sessionStore,
});

/** Real runtime probe (WP6): not a hard-coded `true`. */
function probeHarnessWired() {
  const state = agent.harnessState();
  return Boolean(state.wired && agent.harnessInstance === harness);
}

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function sseInit(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}

function sseSend(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    });
    return res.end();
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") {
    const model = agent.modelConfig();
    let forge = { connected: false };
    try {
      forge = await forgeManager.status();
    } catch {
      /* ignore */
    }
    return json(res, 200, {
      ok: true,
      projectRoot: PROJECT,
      tools: tools.list().length,
      modelConfigured: model.configured,
      provider: model.provider,
      harnessWired: probeHarnessWired(),
      harnessLayers: harness.layers().length,
      harnessAgentsFile: harness.steering.docs.some((d) => d.rel === "AGENTS.md") ? "AGENTS.md" : null,
      forgeConnected: Boolean(forge.connected),
    });
  }
  if (url.pathname === "/tools") {
    const expert = configStore.getRaw().expert;
    return json(res, 200, tools.list({ expert }));
  }
  if (url.pathname === "/approval/pending" && req.method === "GET") {
    return json(
      res,
      200,
      pendingApproval ? { name: pendingApproval.name, args: pendingApproval.args } : null
    );
  }
  if (url.pathname === "/approval/resolve" && req.method === "POST") {
    const body = await readBody(req);
    try {
      const { allow } = JSON.parse(body || "{}");
      if (pendingApproval) {
        pendingApproval.resolve(Boolean(allow));
        pendingApproval = null;
      }
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { error: String(e) });
    }
    return;
  }

  if (url.pathname === "/chat/stream" && req.method === "POST") {
    const raw = await readBody(req);
    let message = "";
    try {
      message = String(JSON.parse(raw || "{}").message || "");
    } catch {
      message = "";
    }
    sseInit(res);
    try {
      await agent.runTurnStream(message, (evt) => sseSend(res, evt));
    } catch (e) {
      sseSend(res, { type: "error", message: String(e.message || e) });
    }
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  if (url.pathname === "/chat" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const { message } = JSON.parse(raw || "{}");
      const reply = await agent.runTurn(String(message || ""));
      json(res, 200, { reply });
    } catch (e) {
      json(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (url.pathname === "/history") {
    return json(res, 200, agent.getHistory());
  }

  if (url.pathname === "/session/list") {
    return json(res, 200, {
      current: sessionStore.currentId(),
      sessions: sessionStore.listSessions(),
    });
  }
  if (url.pathname === "/session/resume" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const { id } = JSON.parse(raw || "{}");
      if (!id) return json(res, 400, { error: "id required" });
      const prior = sessionStore.resume(id);
      const n = agent.resumeFromHistory(prior);
      return json(res, 200, { ok: true, id, restored: n });
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
  }
  if (url.pathname === "/session/new" && req.method === "POST") {
    const id = sessionStore.newSession();
    return json(res, 200, { id });
  }

  if (url.pathname === "/forge/status") {
    try {
      return json(res, 200, await forgeManager.status());
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }
  if (url.pathname === "/forge/sessions") {
    return json(res, 200, forgeManager.listSessions().map((s) => ({ pid: s.pid, port: s.port, label: s.label })));
  }
  if (url.pathname === "/forge/connect" && req.method === "POST") {
    const raw = await readBody(req);
    let pid;
    try {
      pid = JSON.parse(raw || "{}").pid;
    } catch {}
    try {
      const r = await forgeManager.selectSession(pid);
      return json(res, 200, r || { connected: false });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  if (url.pathname === "/config" && req.method === "GET") {
    return json(res, 200, configStore.get());
  }
  if (url.pathname === "/config" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const patch = JSON.parse(raw || "{}");
      // P1-5: selecting a provider preset fills baseUrl/model in one step.
      // Explicit baseUrl/model in the same payload still win (custom endpoint).
      let effective = patch;
      if (patch.provider) {
        try {
          const preset = providerPatch(patch.provider, patch.apiKey || "");
          // Drop empty baseUrl/model so a preset is not clobbered by blank
          // form fields; an explicit non-empty value still wins (custom endpoint).
          const overrides = { ...patch };
          for (const k of ["baseUrl", "model"]) {
            if (overrides[k] === "") delete overrides[k];
          }
          effective = { ...preset, ...overrides };
        } catch (e) {
          return json(res, 400, { error: String(e.message || e) });
        }
      }
      const saved = configStore.save(effective);
      return json(res, 200, saved);
    } catch (e) {
      return json(res, 400, { error: String(e) });
    }
  }
  if (url.pathname === "/experts") {
    return json(res, 200, Object.values(EXPERTS));
  }
  if (url.pathname === "/workbench/tree") {
    return json(res, 200, workbench.chapterTree());
  }
  if (url.pathname === "/workbench/bible" && req.method === "GET") {
    return json(res, 200, workbench.readBible());
  }
  if (url.pathname === "/workbench/bible" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const patch = JSON.parse(raw || "{}");
      const next = { ...workbench.readBible(), ...patch };
      workbench.writeBible(next);
      return json(res, 200, next);
    } catch (e) {
      return json(res, 400, { error: String(e) });
    }
  }
  if (url.pathname === "/workbench/hints") {
    const rel = url.searchParams.get("path") || "src/map/chapter_01.lua";
    return json(res, 200, workbench.scanHints(rel));
  }
  if (url.pathname === "/workbench/overview") {
    return json(res, 200, workbench.campaignOverview());
  }
  if (url.pathname === "/workbench/dialogues") {
    return json(res, 200, workbench.campaignOverview().dialogues);
  }
  if (url.pathname === "/workbench/quests") {
    return json(res, 200, workbench.campaignOverview().quests);
  }
  if (url.pathname === "/workbench/spawners") {
    return json(res, 200, workbench.campaignOverview().spawners);
  }

  if (url.pathname === "/maps/sources") {
    const kind = url.searchParams.get("kind") || undefined;
    return json(res, 200, mapSources.listSources(kind));
  }
  if (url.pathname === "/maps/recommendations") {
    return json(res, 200, mapSources.listThemeRecommendations());
  }
  if (url.pathname === "/maps/recommendations/custom" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const item = mapSources.addCustomRecommendation(JSON.parse(raw || "{}"));
      return json(res, 200, item);
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
  }
  if (url.pathname === "/maps/recommendations/custom" && req.method === "DELETE") {
    const raw = await readBody(req);
    try {
      const { id } = JSON.parse(raw || "{}");
      const ok = mapSources.removeCustomRecommendation(id);
      return json(res, ok ? 200 : 404, { ok, id });
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
  }
  if (url.pathname === "/maps/scan") {
    const rootsParam = url.searchParams.get("roots");
    const roots = rootsParam ? rootsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    return json(res, 200, mapSources.scanLocal(roots));
  }
  if (url.pathname === "/maps/open" && req.method === "POST") {
    const raw = await readBody(req);
    let id;
    try {
      id = JSON.parse(raw || "{}").id;
    } catch {}
    try {
      // Sidecar itself cannot open browser; return URL for Electron to open.
      const list = mapSources.listSources();
      const s = list.find((x) => x.id === id);
      if (!s) return json(res, 404, { error: "unknown source" });
      return json(res, 200, { ok: true, id: s.id, url: s.url, name: s.name });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  // ---- P1-4: harness read surface. The renderer reads the single harness
  // instance created above (one product-process state, no duplicated source).
  if (url.pathname === "/harness/state") {
    return json(res, 200, agent.harnessState());
  }
  if (url.pathname === "/harness/providers") {
    return json(res, 200, listProviders());
  }
  if (url.pathname === "/harness/steering") {
    const intent = url.searchParams.get("intent") || "";
    const files = (url.searchParams.get("files") || "").split(",").filter(Boolean);
    const sel = harness.steering.select({ intent, files, maxChars: 8000 });
    return json(res, 200, {
      selectedIds: sel.selectedIds,
      skippedIds: sel.skippedIds,
      truncated: sel.truncated,
      usedChars: sel.usedChars,
      savedChars: sel.savedChars,
      preview: harness.steering.render(sel).slice(0, 1200),
    });
  }
  if (url.pathname === "/harness/tools") {
    const intent = url.searchParams.get("intent") || "";
    const plan = harness.injector.select({ intent, maxTools: 14 });
    return json(res, 200, plan.plan);
  }
  if (url.pathname === "/harness/spec") {
    return json(res, 200, harness.spec.summary());
  }
  if (url.pathname === "/harness/hooks") {
    return json(res, 200, { handlers: harness.hooks.list(), log: harness.hooks.log().slice(-30) });
  }
  if (url.pathname === "/harness/scratch") {
    return json(res, 200, harness.scratch.list());
  }
  if (url.pathname === "/harness/dispatch" && req.method === "POST") {
    const raw = await readBody(req);
    try {
      const { name, args = {} } = JSON.parse(raw || "{}");
      return json(res, 200, await agent.dispatchTool(name, args));
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
  }

  // WP7: the "检查" view displays a real checker result, not a chat forward.
  // Reuse the SAME lua_check tool implementation the agent calls (no second
  // checker, no model / API key required).
  if (url.pathname === "/check") {
    const subpath = url.searchParams.get("subpath") || "src";
    try {
      const result = await tools.dispatch("lua_check", { subpath }, { autoApprove: true });
      return json(res, result.ok ? 200 : 500, { ...result, subpath });
    } catch (e) {
      return json(res, 500, { ok: false, output: String(e.message || e), subpath });
    }
  }

  if (url.pathname === "/build" && req.method === "POST") {
    const raw = await readBody(req);
    let entry = "src.main";
    try {
      entry = JSON.parse(raw || "{}").entry || entry;
    } catch {}
    try {
      const stats = bundleCampaign({ projectRoot: PROJECT, entry });
      return json(res, 200, stats);
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  if (url.pathname === "/onboarding/checklist") {
    return json(res, 200, await onboarding.checklist());
  }
  if (url.pathname === "/onboarding/done" && req.method === "POST") {
    onboarding.markDone();
    return json(res, 200, { done: true });
  }
  if (url.pathname === "/onboarding/reset" && req.method === "POST") {
    try {
      fs.unlinkSync(path.join(PROJECT, ".wcc", "onboarding-done.json"));
    } catch {}
    return json(res, 200, { done: false });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[wcc-sidecar] listening http://127.0.0.1:${PORT}`);
  console.log(`[wcc-sidecar] project=${PROJECT}`);
  console.log(`[wcc-sidecar] model=${agent.modelConfig().configured ? "configured" : "offline"}`);
});
