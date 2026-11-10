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
    if (!fs.existsSync(abs)) return { ok: false, issues: 1, report: `target not found: ${abs}` };
    const report = checkPaths([abs]);
    return { ok: report.ok, issues: report.issues?.length ?? 0, report: formatReport(report, projectRoot) };
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
export function installDefaultHooks(bus, { projectRoot, runCheck, runGate, blockOnIssues = false } = {}) {
  const check = runCheck || defaultCheckRunner(projectRoot || process.cwd());
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
      report: r.report,
      verdict: !r.ok && blockOnIssues ? "block" : "allow",
    };
  }, { name: "lua-check-on-write", priority: 100 }));

  registered.push(bus.on("task.complete", async ({ taskId, run = false }) => {
    const plan = ["node packages/wcc-lua-check/src/cli.js examples/demo-campaign/src wcc-lib", "npm test"];
    const out = { gate: "quality-gate", taskId, plan, executed: false };
    if (run && runGate) {
      out.executed = true;
      out.result = await runGate(taskId);
    }
    return out;
  }, { name: "quality-gate-on-task", priority: 50 }));

  registered.push(bus.on("turn.start", async ({ turn }) => ({ turn, startedAt: new Date().toISOString() }),
    { name: "turn-logger", priority: 10 }));

  return registered;
}
