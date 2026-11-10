/**
 * Middleware pipeline (Deep Agents "middleware == harness" idea).
 * Each layer is independently switchable; no framework, no peer deps.
 * Layer signature: async (ctx, next) => void | result
 */
import { summarizeHistory, patchToolCalls, STOP_REASONS } from "./budget.js";
import { renderSteering } from "./steering.js";

export function createPipeline({ trace = false } = {}) {
  const layers = [];
  const journal = [];

  function use(name, fn, { enabled = true } = {}) {
    if (layers.some((l) => l.name === name)) throw new Error(`duplicate middleware: ${name}`);
    layers.push({ name, fn, enabled });
    return { disable: () => setEnabled(name, false), enable: () => setEnabled(name, true) };
  }

  function setEnabled(name, enabled) {
    const layer = layers.find((l) => l.name === name);
    if (!layer) throw new Error(`unknown middleware: ${name}`);
    layer.enabled = enabled;
  }

  async function run(ctx) {
    const active = layers.filter((l) => l.enabled);
    const dispatch = async (i) => {
      if (i >= active.length) return undefined;
      const layer = active[i];
      const t0 = Date.now();
      let out;
      try {
        out = await layer.fn(ctx, () => dispatch(i + 1));
      } finally {
        if (trace) journal.push({ name: layer.name, ms: Date.now() - t0 });
      }
      return out;
    };
    await dispatch(0);
    return ctx;
  }

  return {
    use, run, setEnabled,
    list: () => layers.map(({ name, enabled }) => ({ name, enabled })),
    journal: () => journal.slice(),
  };
}

/** Preset layers used by createHarness(). */
export function withSteering(steering) {
  return async (ctx, next) => {
    if (!steering || ctx.systemInjected) return next();
    const selection = steering.select({
      files: ctx.files || [],
      toolNames: ctx.toolNames || [],
      intent: ctx.userText || "",
      explicit: ctx.explicit || [],
      maxChars: ctx.steeringBudget,
    });
    ctx.steering = selection;
    ctx.system = [ctx.system || "", renderSteering(selection)].filter(Boolean).join("\n\n");
    ctx.systemInjected = true;
    return next();
  };
}

export function withPlanning(specStore) {
  return async (ctx, next) => {
    if (!specStore) return next();
    const s = specStore.summary();
    ctx.spec = s;
    ctx.system = [
      ctx.system || "",
      `# Spec\nstage=${s.stage} progress=${s.progress.done}/${s.progress.total}\n` +
        s.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.id} ${t.text}`).join("\n"),
    ].filter(Boolean).join("\n\n");
    return next();
  };
}

export function withToolInjection(injector) {
  return async (ctx, next) => {
    if (!injector) return next();
    const plan = injector.select({
      files: ctx.files || [],
      intent: ctx.userText || "",
      expert: ctx.expert,
      maxTools: ctx.maxTools,
      needForge: ctx.needForge,
      dynamicForgeTools: ctx.dynamicForgeTools,
    });
    ctx.toolPlan = plan;
    ctx.tools = plan.tools;
    return next();
  };
}

export function withBudget(budget) {
  return async (ctx, next) => {
    if (!budget) return next();
    budget.beginTurn();
    budget.consume(ctx.system || "", { label: "system" });
    budget.consume(ctx.tools || [], { label: "tool-schemas" });
    budget.consume(ctx.userText || "", { label: "user" });
    const verdict = budget.check();
    ctx.budget = { ...verdict, snapshot: budget.snapshot() };
    if (verdict.exceeded) return; // short-circuit: no model call this turn
    return next();
  };
}

export function withContextCompaction({ maxTokens = 12000 } = {}) {
  return async (ctx, next) => {
    if (Array.isArray(ctx.messages) && ctx.messages.length) {
      const r = summarizeHistory(ctx.messages, { maxTokens });
      ctx.messages = r.messages;
      ctx.compaction = { compacted: r.compacted, removed: r.removed };
      const patched = patchToolCalls(ctx.messages);
      ctx.messages = patched.messages;
      ctx.patchedToolCalls = patched.patched;
    }
    return next();
  };
}

export function withApproval({ autoApprove = false, request = null } = {}) {
  return async (ctx, next) => {
    const risky = (ctx.pendingToolCalls || []).filter((t) => t.needsApproval);
    if (!risky.length || autoApprove) return next();
    if (!request) {
      ctx.approval = { pending: risky, status: "blocked", reason: "no approval handler wired" };
      return; // do not proceed to model call until UI resolves
    }
    const decisions = [];
    for (const t of risky) {
      const ok = await request({ name: t.name, args: t.args });
      decisions.push({ name: t.name, approved: Boolean(ok) });
    }
    ctx.approval = { pending: risky, decisions, status: decisions.every((d) => d.approved) ? "approved" : "denied" };
    if (ctx.approval.status === "denied") {
      ctx.stopReason = STOP_REASONS.TOOL_DENIED;
      return;
    }
    return next();
  };
}

export function withScratch(scratch) {
  return async (ctx, next) => {
    await next();
    if (scratch && Array.isArray(ctx.toolResults)) {
      ctx.toolResults = ctx.toolResults.map((r) => ({
        ...r,
        wrapped: scratch.wrapToolResult(r.name || "tool", r.output, { turn: ctx.turn }),
      }));
    }
  };
}
