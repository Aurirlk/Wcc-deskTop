#!/usr/bin/env node
/**
 * WCC Harness CLI — offline by default, no npm deps, no network, no model key.
 *
 *   node harness/bin/wcc-harness.mjs demo
 *   node harness/bin/wcc-harness.mjs steer --intent "写一个 boss 战" --files src/map/chapter_01.lua
 *   node harness/bin/wcc-harness.mjs spec init --goal "第一章：清剿营地"
 *   node harness/bin/wcc-harness.mjs spec done T1
 *   node harness/bin/wcc-harness.mjs check wcc-lib
 *   node harness/bin/wcc-harness.mjs hooks wcc-lib
 *   node harness/bin/wcc-harness.mjs tools --intent "改地图地形"
 *   node harness/bin/wcc-harness.mjs scratch grep "Wait"
 *   node harness/bin/wcc-harness.mjs providers | budget | probe | scripts
 *   node harness/bin/wcc-harness.mjs steering annotate --write   (改仓库文件)
 *   node harness/bin/wcc-harness.mjs tui --static | tui
 *   node harness/bin/wcc-harness.mjs selftest
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
const SKILL = path.join(ROOT, "wcc-skill");
// Repo-level contract shared by every harness. It is a pointer, not a copy of
// the iron rules (see AGENTS.md §1). Pass it explicitly so even a temp
// projectRoot (e.g. `demo`) reads the same file.
const AGENTS = fs.existsSync(path.join(ROOT, "AGENTS.md")) ? path.join(ROOT, "AGENTS.md") : null;

const {
  createHarness, createSteering, selectSteering, renderSteering,
  collectSteering, globToRegExp, matchesGlob,
  createSpecStore, createScratch,
  resolveProvider, listProviders, providerPatch,
  createBudget, estimateTokens, summarizeHistory, patchToolCalls,
  createHookBus, installDefaultHooks, EVENTS,
  createToolInjector, TOOL_CATALOG, GROUP_RULES, mergeCatalog,
  createPipeline,
  SCRIPT_MANIFEST, findScript, runScript, probeForge,
  createTui, renderStatic, diffPreview,
} = await import("../src/index.js");

const argv = process.argv.slice(2);
const cmd = (argv[0] || "demo").toLowerCase();
const rest = argv.slice(1);
const has = (flag) => rest.includes(flag);
const val = (flag, fallback = "") => {
  const i = rest.indexOf(flag);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : fallback;
};
const out = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));
const hr = (title) => `\n=== ${title} ===`;

const root = () => (has("--root") ? path.resolve(val("--root")) : ROOT);
const mk = (opts = {}) => createHarness({ projectRoot: root(), skillRoot: SKILL, agentsFile: AGENTS, ...opts });

switch (cmd) {
  case "help":
  case "-h":
    out(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 22).join("\n"));
    break;

  case "steer": {
    const steering = createSteering({ skillRoot: SKILL, agentsFile: AGENTS, maxChars: Number(val("--max", "12000")) });
    const files = val("--files", "").split(",").filter(Boolean);
    const sel = steering.select({
      intent: val("--intent", ""),
      files,
      explicit: val("--explicit", "").split(",").filter(Boolean),
      toolNames: val("--tools", "").split(",").filter(Boolean),
    });
    out({
      selectedIds: sel.selectedIds,
      matchedIds: sel.matchedIds,
      skippedIds: sel.skippedIds,
      truncated: sel.truncated,
      dropped: sel.dropped,
      usedChars: sel.usedChars,
      totalChars: sel.totalChars,
      savedChars: sel.savedChars,
      budget: sel.budget,
      preview: renderSteering(sel).slice(0, 600),
    });
    break;
  }

  case "steering": {
    const sub = (rest[0] || "list").toLowerCase();
    if (sub === "list") {
      out(collectSteering({ skillRoot: SKILL, agentsFile: AGENTS }).map((d) => ({ id: d.id, rel: d.rel, mode: d.mode, fileMatch: d.fileMatch, keywords: d.keywords, hasFrontMatter: d.hasFrontMatter, chars: d.chars })));
    } else if (sub === "annotate") {
      const h = mk();
      out({ ...h.annotateSteering({ write: has("--write") }), note: has("--write") ? "已写入 front matter" : "dry-run：未写文件（加 --write 才写）" });
    } else {
      out(`unknown steering subcommand: ${sub}`);
    }
    break;
  }

  case "spec": {
    const store = createSpecStore({ projectRoot: root() });
    const sub = (rest[0] || "status").toLowerCase();
    if (sub === "init") out(store.init(val("--goal", "未命名战役任务"), { force: has("--force") }));
    else if (sub === "status") out(store.summary());
    else if (sub === "done") out(store.setTask(rest[1] || "T1", true));
    else if (sub === "undo") out(store.setTask(rest[1] || "T1", false));
    else out(`unknown spec subcommand: ${sub}`);
    break;
  }

  case "check": {
    const target = rest.find((a) => !a.startsWith("--")) || "examples/demo-campaign/src";
    const r = runScript("wcc.check", { root: ROOT, args: ["packages/wcc-lua-check/src/cli.js", target] });
    out({ ...r, note: "退出码 1 表示发现 issues（不是脚本崩溃）" });
    break;
  }

  case "hooks": {
    const target = rest.find((a) => !a.startsWith("--")) || "wcc-lib";
    const h = mk();
    const r = await h.emit("file.write", { path: path.join(target, "wcc-core.lua") });
    out({ event: "file.write", target, results: r.results, blocking: r.blocking, registeredHooks: h.hooks.list() });
    break;
  }

  case "tools": {
    const injector = createToolInjector();
    const plan = injector.select({
      intent: val("--intent", ""),
      files: val("--files", "").split(",").filter(Boolean),
      expert: val("--expert", ""),
      needForge: has("--forge"),
      maxTools: Number(val("--max", "12")),
    });
    out(has("--full") ? { tools: plan.tools, plan: plan.plan } : plan.plan);
    break;
  }

  case "scratch": {
    const sc = createScratch({ projectRoot: root(), threshold: Number(val("--threshold", "4000")) });
    const sub = (rest[0] || "list").toLowerCase();
    if (sub === "offload") out(sc.offload(val("--name", "cli-demo"), "x".repeat(5000) + "\nWait(1)\n", { meta: { origin: "cli" }, force: true }));
    else if (sub === "grep") out(sc.grep(rest.slice(1).join(" ") || "Wait"));
    else if (sub === "recall") out(sc.recall(rest[1] || ""));
    else out(sc.list());
    break;
  }

  case "providers": out(listProviders()); break;
  case "budget": {
    const b = createBudget({ maxTurns: 2, maxTokens: 50 });
    b.beginTurn(); b.consume("x".repeat(400), { label: "demo" });
    out({ afterConsume: b.snapshot(), check: b.check(), providers: { deepseek: resolveProvider({ provider: "deepseek" }), ollama: resolveProvider({ provider: "ollama" }) } });
    break;
  }
  case "probe": out({ forge: probeForge({ root: ROOT }), scripts: SCRIPT_MANIFEST.filter((s) => s.cmd).map((s) => s.id) }); break;
  case "scripts": out(SCRIPT_MANIFEST); break;

  case "tui": {
    const h = mk();
    const tui = h.createTerminal({
      interactive: !has("--static") && Boolean(process.stdin.isTTY),
      onCommand: async (c, arg) => {
        if (c === "/spec") return JSON.stringify(h.spec.summary());
        if (c === "/tools") return JSON.stringify(createToolInjector().select({ intent: arg }).plan);
        if (c === "/steer") return h.steering.select({ intent: arg }).selectedIds.join(", ");
        if (c === "/check") return JSON.stringify(runScript("wcc.check", { root: ROOT })).slice(0, 500);
        if (c === "/scratch") return JSON.stringify(h.scratch.grep(arg || "Wait").hits.slice(0, 5));
        if (c === "/provider") return `${h.provider.label} / ${h.provider.model}`;
        return "ok";
      },
    });
    tui.push("info", "WCC harness TUI 就绪（离线，不调用模型）");
    if (has("--static")) {
      out(renderStatic({ ...h.tuiState(), events: tui.getState().events }, { color: false }));
    } else {
      tui.attach();
    }
    break;
  }

  case "selftest": {
    const r = runScript("wcc.harness.test", { root: ROOT });
    out(r.ok ? { ok: true, summary: r.stdout.split("\n").filter((l) => /^# (tests|pass|fail)/.test(l)).join(" | ") } : r);
    break;
  }

  case "demo": {
    // Fully offline: temp project root, real skill docs, real lua checker.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-harness-demo-"));
    try {
      const h = createHarness({ projectRoot: tmp, skillRoot: SKILL, agentsFile: AGENTS, steeringBudget: 8000, maxTools: 10 });
      const s1 = h.steering.select({ intent: "写一个 boss 战，需要对话和阶段机", files: ["src/map/chapter_01.lua"] });
      const s2 = h.steering.select({ intent: "随便看看", files: [] });
      const spec = h.spec.init("demo：第一章清剿营地");
      h.spec.setTask("T1", true);
      const off = h.scratch.offload("forge_list_objects", JSON.stringify({ units: Array.from({ length: 300 }, (_, i) => ({ id: `u${i}`, x: i, y: i })) }));
      const hooks = await h.emit("file.write", { path: path.join(ROOT, "wcc-lib", "wcc-core.lua") });
      const ctx = await h.prepareTurn({ userText: "改地图地形，放一批单位并生成 Lua", files: ["src/map/chapter_01.lua"], needForge: true });
      out([
        hr("1 steering 条件注入"),
        `A 上下文(写 Lua + boss 意图): matched=${s1.matchedIds.join(",")} | injected=${s1.selectedIds.join(",")} | dropped=${s1.dropped.length} | used=${s1.usedChars}/${s1.totalChars} saved=${s1.savedChars}`,
        `B 空上下文:                  matched=${s2.matchedIds.join(",")} | injected=${s2.selectedIds.join(",")} | dropped=${s2.dropped.length} | used=${s2.usedChars}/${s2.totalChars} saved=${s2.savedChars}`,
        hr("2 spec 状态机"),
        `init=${spec.written.join(",")} stage=${h.spec.stage()} progress=${JSON.stringify(h.spec.progress())}`,
        hr("3 scratch 上下文卸载"),
        `offloaded=${off.offloaded} id=${off.id} bytes=${off.bytes} grepHits=${h.scratch.grep("u42").count}`,
        hr("4 hooks 质量门禁"),
        `event=file.write results=${hooks.results.map((r) => `${r.name}:${r.result?.gate || "skip"}:${r.result?.ok ?? "-"}`).join(" | ")}`,
        hr("5 工具注入 / 预算 / provider"),
        `tools=${ctx.toolPlan.plan.selected.length}/${ctx.toolPlan.plan.counts.total} savedChars=${ctx.toolPlan.plan.savedChars}`,
        `budget=${JSON.stringify({ turns: ctx.budget.snapshot.turns, tokens: ctx.budget.snapshot.tokens, stopReason: ctx.budget.stopReason })}`,
        `provider=${h.provider.label}/${h.provider.model} configured=${h.provider.configured}`,
        hr("6 TUI 静态渲染（非 TTY 降级）"),
        renderStatic({ ...h.tuiState(), steering: { selectedIds: s1.selectedIds, savedChars: s1.savedChars }, tools: ctx.toolPlan.plan, lastHook: "lua_check @ file.write -> ok", events: [{ kind: "ok", text: "demo completed" }] }, { color: false, width: 92 }),
        hr("状态声明"),
        "本 demo 未联网、未调用模型、未启动 wc3-forge.exe、未写入仓库（临时目录已清理）。",
      ].join("\n"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    break;
  }

  default:
    out(`unknown command: ${cmd}\nrun: node harness/bin/wcc-harness.mjs help`);
    process.exitCode = 2;
}
