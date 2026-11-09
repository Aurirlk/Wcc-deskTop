/**
 * WCC Harness — composition root.
 *
 * This is a NEW, standalone layer. It does NOT modify packages/wcc-sidecar and
 * does NOT replace agent.js. It can be used:
 *   a) directly via `node harness/bin/wcc-harness.mjs ...`
 *   b) as a library imported by the Sidecar / Electron main process later
 *   c) as the surface behind an MCP server later
 *
 * Zero npm dependencies. All state lives under <projectRoot>/.wcc/
 * (already gitignored by the repository).
 */
import fs from "node:fs";
import path from "node:path";
import { createSteering, annotationFor, selectSteering, renderSteering } from "./steering.js";
import { createSpecStore } from "./spec.js";
import { createScratch } from "./scratch.js";
import { resolveProvider, listProviders } from "./providers.js";
import { createBudget, STOP_REASONS } from "./budget.js";
import { createHookBus, installDefaultHooks } from "./hooks.js";
import { createToolInjector } from "./tool-inject.js";
import { createPipeline, withPlanning, withSteering, withToolInjection, withBudget, withContextCompaction, withApproval, withScratch } from "./middleware.js";
import { runScript, findScript, describeScripts, probeForge } from "./scripts.js";
import { createTui, defaultState } from "./tui.js";

export * from "./steering.js";
export * from "./spec.js";
export * from "./scratch.js";
export * from "./providers.js";
export * from "./budget.js";
export * from "./hooks.js";
export * from "./middleware.js";
export * from "./tool-inject.js";
export * from "./scripts.js";
export * from "./tui.js";

export function createHarness({
  projectRoot = process.cwd(),
  skillRoot = null,
  config = {},
  catalog = [],
  steeringBudget = 12000,
  maxTools = 12,
  maxTurns = 8,
  maxTokens = 60000,
  autoApprove = false,
  onApprovalRequest = null,
  strictHooks = false,
} = {}) {
  const root = path.resolve(projectRoot);
  const resolvedSkillRoot = path.resolve(skillRoot || path.join(root, "wcc-skill"));
  const spec = createSpecStore({ projectRoot: root });
  const scratch = createScratch({ projectRoot: root });
  const steering = createSteering({ skillRoot: resolvedSkillRoot, maxChars: steeringBudget });
  const hooks = createHookBus({ strict: strictHooks });
  const budget = createBudget({ maxTurns, maxTokens });
  const provider = resolveProvider(config);
  const injector = createToolInjector({ catalog, maxTools });
  installDefaultHooks(hooks, { projectRoot: root });

  const pipeline = createPipeline({ trace: true });
  pipeline.use("planning", withPlanning(spec));
  pipeline.use("steering", withSteering(steering));
  pipeline.use("tools", withToolInjection(injector));
  pipeline.use("compaction", withContextCompaction({ maxTokens: Math.floor(maxTokens / 4) }));
  pipeline.use("approval", withApproval({ autoApprove, request: onApprovalRequest }));
  pipeline.use("budget", withBudget(budget));
  pipeline.use("scratch", withScratch(scratch));

  let turn = 0;
  const history = [];

  /** Build everything a model call needs — no network, fully inspectable. */
  async function prepareTurn({
    userText = "", files = [], explicit = [], expert = "",
    needForge = false, dynamicForgeTools = [], pendingToolCalls = [],
    system = "", toolResults = null,
  } = {}) {
    turn += 1;
    const ctx = {
      turn,
      userText,
      files,
      explicit,
      expert,
      system,
      steeringBudget,
      maxTools,
      needForge,
      dynamicForgeTools,
      pendingToolCalls,
      toolNames: (injector.catalog || []).map((t) => t.name),
      messages: history.slice(),
      toolResults,
    };
    await hooks.emit("turn.start", { turn, userText });
    await pipeline.run(ctx);
    if (!ctx.budget?.exceeded && ctx.approval?.status !== "denied" && ctx.approval?.status !== "blocked") {
      history.push({ role: "user", content: userText });
    }
    return ctx;
  }

  /** Dispatch harness-owned tools. Shape matches Sidecar tools.dispatch(). */
  async function dispatch(name, args = {}) {
    try {
      switch (name) {
        case "spec_status": return { ok: true, output: JSON.stringify(spec.summary(), null, 2) };
        case "spec_init": return { ok: true, output: JSON.stringify(spec.init(args.goal || "未命名战役任务", { force: Boolean(args.force) }), null, 2) };
        case "spec_done": {
          const r = spec.setTask(args.id, true);
          if (r.ok) await hooks.emit("task.complete", { taskId: args.id, run: false });
          return { ok: r.ok, output: JSON.stringify(r, null, 2) };
        }
        case "scratch_grep": return { ok: true, output: JSON.stringify(scratch.grep(args.pattern || ".", { maxHits: Number(args.maxHits) || 40 }), null, 2) };
        case "scratch_recall": return { ok: true, output: JSON.stringify(scratch.recall(args.id || ""), null, 2) };
        case "steering_select": {
          const sel = steering.select({ intent: args.intent || "", files: String(args.files || "").split(",").filter(Boolean) });
          return { ok: true, output: JSON.stringify({ selectedIds: sel.selectedIds, skippedIds: sel.skippedIds, usedChars: sel.usedChars, savedChars: sel.savedChars }, null, 2) };
        }
        case "provider_list": return { ok: true, output: JSON.stringify(listProviders(), null, 2) };
        case "budget_status": return { ok: true, output: JSON.stringify(budget.snapshot(), null, 2) };
        case "forge_probe": return { ok: true, output: JSON.stringify(probeForge({ root }), null, 2) };
        case "hook_emit": return { ok: true, output: JSON.stringify(await hooks.emit(args.event, { path: args.path, turn }), null, 2) };
        case "wcc_check": {
          const r = runScript("wcc.check", {
            root,
            args: args.target ? ["packages/wcc-lua-check/src/cli.js", args.target] : null,
          });
          return { ok: r.ok, output: JSON.stringify(r, null, 2) };
        }
        default: return { ok: false, output: `harness: unknown tool ${name}` };
      }
    } catch (e) {
      return { ok: false, output: String(e.message || e) };
    }
  }

  async function emit(event, payload) {
    return hooks.emit(event, payload);
  }

  function tuiState() {
    const s = spec.summary();
    const idlePlan = injector.select({ intent: "" }).plan;
    return {
      ...defaultState(),
      provider: { label: provider.label, model: provider.model, configured: provider.configured },
      budget: budget.snapshot(),
      spec: { stage: s.stage, done: s.progress.done, total: s.progress.total },
      tools: { selected: idlePlan.selected, savedChars: idlePlan.savedChars },
      forge: probeForge({ root }),
      mode: provider.configured ? "ready" : "offline",
    };
  }

  function createTerminal(opts = {}) {
    return createTui({ state: tuiState(), ...opts });
  }

  /** Write steering front matter into skill docs (explicit, reviewable). */
  function annotateSteering({ write = false } = {}) {
    const changed = [];
    for (const doc of steering.docs) {
      const block = annotationFor(doc.rel);
      if (!block || doc.hasFrontMatter) continue;
      changed.push(doc.rel);
      if (write) fs.writeFileSync(doc.abs, block + fs.readFileSync(doc.abs, "utf8"), "utf8");
    }
    if (write) steering.reload();
    return { write, changed, count: changed.length };
  }

  return {
    root, skillRoot: resolvedSkillRoot,
    spec, scratch, steering, hooks, budget, provider, injector, pipeline,
    prepareTurn, dispatch, emit, tuiState, createTerminal, annotateSteering,
    history, STOP_REASONS,
    layers: () => pipeline.list(),
  };
}
