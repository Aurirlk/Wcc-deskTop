/**
 * Hooks: quality gates that fire on events instead of relying on "remember to
 * run npm run check" (Kiro Agent Hooks idea). Own implementation.
 *
 * Events: turn.start | turn.end | file.write | file.delete | tool.call |
 *         task.complete | spec.stage | approval.request
 */
import fs from "node:fs";
import path from "node:path";
import { checkPaths, formatReport } from "../../packages/wcc-lua-check/src/check.js";

export const EVENTS = [
  "turn.start", "turn.end", "file.write", "file.delete",
  "tool.call", "task.complete", "spec.stage", "approval.request",
];

/** Default runner: real WCC Lua static checker, no subprocess needed. */
export function defaultCheckRunner(projectRoot) {
  return function runCheck(target) {
    const abs = path.isAbsolute(target) ? target : path.resolve(projectRoot, target);
    if (!fs.existsSync(abs)) return { ok: false, issues: 1, errors: 1, warnings: 0, report: `target not found: ${abs}` };
    const report = checkPaths([abs]);
    return {
      ok: report.ok,
      issues: report.issues?.length ?? 0,
      errors: report.errors,
      warnings: report.warnings,
      report: formatReport(report, projectRoot),
    };
  };
}

/**
 * Default `task.complete` gate: actually run the checker over the project's Lua
 * sources instead of merely listing a plan. Missing targets are reported as
 * skipped (never silently "passed"), and warnings do not block.
 */
export function defaultGateRunner(projectRoot, {
  targets = ["examples/demo-campaign/src", "wcc-lib"],
  repoRoot = null,
} = {}) {
  return async function runGate() {
    const root = path.resolve(projectRoot || process.cwd());
    const fallback = repoRoot ? path.resolve(repoRoot) : null;
    // Targets are expressed relative to the REPO root. When the product points
    // at a campaign dir (e.g. examples/demo-campaign) they do not resolve under
    // projectRoot, which used to make the gate silently skip. Resolve against
    // the repo root as a fallback so the checker really runs (WP8).
    const candidates = [path.resolve(root, "src")]; // the active project's own Lua
    for (const t of targets) {
      candidates.push(path.resolve(root, t));
      if (fallback) candidates.push(path.resolve(fallback, t));
    }
    const paths = [];
    for (const p of candidates) {
      if (fs.existsSync(p) && !paths.includes(p)) paths.push(p);
    }
    if (!paths.length) {
      return { ok: true, skipped: true, errors: 0, warnings: 0, issues: [], report: "no lua targets found; gate skipped" };
    }
    const report = checkPaths(paths);
    return {
      ok: report.ok,
      skipped: false,
      errors: report.errors,
      warnings: report.warnings,
      issues: report.issues,
      report: formatReport(report, root),
    };
  };
}

export function createHookBus({ logger = () => {}, strict = false } = {}) {
  const handlers = new Map();
  const log = [];

  function on(event, fn, { name = fn.name || "anon", priority = 0, once = false } = {}) {
    if (!EVENTS.includes(event)) throw new Error(`unknown hook event: ${event}`);
    const list = handlers.get(event) || [];
    list.push({ name, fn, priority, once });
    list.sort((a, b) => b.priority - a.priority);
    handlers.set(event, list);
    return () => off(event, name);
  }

  function off(event, name) {
    handlers.set(event, (handlers.get(event) || []).filter((h) => h.name !== name));
  }

  async function emit(event, payload = {}) {
    const results = [];
    for (const h of [...(handlers.get(event) || [])]) {
      try {
        const r = await h.fn({ ...payload, event });
        results.push({ name: h.name, ok: true, result: r });
        if (h.once) off(event, h.name);
      } catch (e) {
        results.push({ name: h.name, ok: false, error: String(e.message || e) });
        if (strict) throw e;
      }
      log.push({ event, name: h.name, at: new Date().toISOString() });
    }
    logger({ event, results });
    return { event, results, blocking: results.some((r) => r.result?.verdict === "block") };
  }

  return {
    on, off, emit,
    list: () => Object.fromEntries([...handlers].map(([e, hs]) => [e, hs.map((h) => h.name)])),
    log: () => log.slice(),
  };
}

/** Install the built-in gates. `runCheck` / `runGate` are injectable for tests. */
export function installDefaultHooks(bus, {
  projectRoot, repoRoot = null, runCheck, runGate,
  blockOnIssues = true,
  gateOnTaskComplete = true,
} = {}) {
  const root = projectRoot || process.cwd();
  const check = runCheck || defaultCheckRunner(root);
  const gate = runGate || defaultGateRunner(root, { repoRoot });
  const registered = [];

  registered.push(bus.on("file.write", async ({ path: rel }) => {
    if (!rel || !String(rel).endsWith(".lua")) {
      return { skipped: true, reason: "not-lua" };
    }
    const r = check(rel);
    return {
      gate: "lua_check",
      target: rel,
      ok: r.ok,
      issues: r.issues,
      errors: r.errors ?? (r.ok ? 0 : r.issues),
      warnings: r.warnings ?? 0,
      report: r.report,
      // Only errors block; warnings are review prompts.
      verdict: !r.ok && blockOnIssues ? "block" : "allow",
    };
  }, { name: "lua-check-on-write", priority: 100 }));

  registered.push(bus.on("task.complete", async ({ taskId, run = false }) => {
    const plan = ["node packages/wcc-lua-check/src/cli.js examples/demo-campaign/src wcc-lib", "npm test"];
    const out = { gate: "quality-gate", taskId, plan, executed: false };
    if (run !== false && gateOnTaskComplete) {
      out.executed = true;
      out.result = await gate(taskId);
      // Errors block; warnings are review prompts and never block.
      out.verdict = out.result?.ok === false ? "block" : "allow";
      out.blocking = out.verdict === "block";
    } else {
      out.skipped = true;
      out.reason = "gateOnTaskComplete=false";
    }
    return out;
  }, { name: "quality-gate-on-task", priority: 50 }));

  registered.push(bus.on("turn.start", async ({ turn }) => ({ turn, startedAt: new Date().toISOString() }),
    { name: "turn-logger", priority: 10 }));

  return registered;
}
