/**
 * Zero-dependency TUI prototype (Node readline + ANSI escapes).
 * No blessed / ink / React — those would break the "green, click-and-run" goal.
 *
 * Two modes:
 *  - interactive TTY: full redraw, status bar, event stream, command line
 *  - non-TTY / CI: renderStatic() returns plain text (used by CLI + tests)
 *
 * IMPORTANT: this is a *surface*. It reads the same harness state / tool plan
 * as the Electron renderer would; it does not own a second tool registry.
 */
import readline from "node:readline";

export const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m",
  bgBlue: "\x1b[44m", bgRed: "\x1b[41m",
};

export function displayWidth(s) {
  let n = 0;
  for (const ch of String(s)) n += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
  return n;
}

export function clip(s, width) {
  let out = "";
  let n = 0;
  for (const ch of String(s)) {
    const w = displayWidth(ch);
    if (n + w > width) break;
    out += ch;
    n += w;
  }
  return out + " ".repeat(Math.max(0, width - n));
}

export function pad(s, width) {
  return clip(s, width);
}

const KIND_COLOR = {
  info: C.cyan, ok: C.green, warn: C.yellow, error: C.red,
  tool: C.magenta, model: C.blue, hook: C.gray, diff: C.gray,
};

export function defaultState() {
  return {
    provider: { label: "(未配置)", model: "-", configured: false },
    budget: { turns: 0, tokens: 0, maxTurns: 8, maxTokens: 60000, stopReason: null },
    spec: { stage: "none", done: 0, total: 0 },
    tools: { selected: [], savedChars: 0 },
    steering: { selectedIds: [], savedChars: 0 },
    forge: { exists: false },
    events: [],
    approval: null,
    mode: "idle",
  };
}

export function statusLine(state, width = 100, color = true) {
  const s = { ...defaultState(), ...state };
  const ok = s.provider.configured;
  const badge = (txt, ok2) => (color ? `${ok2 ? C.green : C.red}${txt}${C.reset}` : txt);
  const parts = [
    `WCC ${s.mode}`,
    badge(`model:${ok ? "✓" : "✗"}`, ok),
    badge(`forge:${s.forge.exists ? "✓" : "✗"}`, s.forge.exists),
    `spec:${s.spec.stage} ${s.spec.done}/${s.spec.total}`,
    `tools:${s.tools.selected.length}`,
    `turn:${s.budget.turns}/${s.budget.maxTurns}`,
    `tok:${s.budget.tokens}/${s.budget.maxTokens}`,
  ];
  const raw = parts.join(" │ ");
  if (!color) return clip(raw, width);
  return `${C.bgBlue}${C.bold} ${clip(raw, width - 2)} ${C.reset}`;
}

/** Plain-text rendering for CI / no-TTY / logs. */
export function renderStatic(state, { width = 100, maxEvents = 20, color = false } = {}) {
  const s = { ...defaultState(), ...state };
  const lines = [];
  lines.push(statusLine(s, width, color));
  lines.push("─".repeat(width));
  lines.push(`steering: ${s.steering.selectedIds.join(", ") || "(none)"}  saved≈${s.steering.savedChars} chars`);
  lines.push(`provider: ${s.provider.label} / ${s.provider.model}`);
  lines.push(`hooks:    ${s.lastHook || "(none)"}`);
  lines.push("─".repeat(width));
  for (const e of (s.events || []).slice(-maxEvents)) {
    const tag = `[${e.kind || "info"}]`.padEnd(9);
    lines.push(`${tag} ${String(e.text || "").replace(/\r?\n/g, " / ")}`);
  }
  lines.push("─".repeat(width));
  lines.push("commands: /spec /tools /steer /check /scratch <regex> /approve y|n /cancel /provider /diff /quit");
  if (s.approval) lines.push(`APPROVAL PENDING: ${s.approval}  -> y / n / a(always)`);
  return lines.join("\n");
}

export function diffPreview(before = "", after = "", maxLines = 40) {
  const a = String(before).split(/\r?\n/);
  const b = String(after).split(/\r?\n/);
  const out = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < Math.min(n, maxLines); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) out.push(`- ${a[i].slice(0, 160)}`);
    if (b[i] !== undefined) out.push(`+ ${b[i].slice(0, 160)}`);
  }
  if (n > maxLines) out.push(`… (${n - maxLines} more lines)`);
  return out.join("\n") || "(no textual diff)";
}

export const COMMANDS = ["/spec", "/tools", "/steer", "/check", "/scratch", "/approve", "/cancel", "/provider", "/diff", "/help", "/quit"];

export function createTui({ state = defaultState(), onCommand = null, onUserText = null, input = process.stdin, output = process.stdout, interactive = Boolean(process.stdin.isTTY), color = true, width = 100 } = {}) {
  let s = { ...defaultState(), ...state };
  let rl = null;
  let lastDiff = { before: "", after: "" };

  const push = (kind, text) => {
    s.events = [...(s.events || []), { kind, text: String(text), at: new Date().toISOString() }].slice(-200);
  };

  const paint = () => {
    if (!interactive) return;
    output.write("\x1b[2J\x1b[H");
    output.write(statusLine(s, width, color) + "\n");
    output.write(`${color ? C.gray : ""}${"─".repeat(width)}${color ? C.reset : ""}\n`);
    for (const e of (s.events || []).slice(-14)) {
      const c = color ? KIND_COLOR[e.kind] || "" : "";
      const r = color ? C.reset : "";
      output.write(`${c}${clip(String(e.text || "").replace(/\r?\n/g, " / "), width)}${r}\n`);
    }
    output.write(`${color ? C.gray : ""}${"─".repeat(width)}${color ? C.reset : ""}\n`);
    if (s.approval) output.write(`${color ? C.bgRed : ""} APPROVAL: ${s.approval} (y/n/a) ${color ? C.reset : ""}\n`);
    output.write(`${color ? C.bold : ""}> ${color ? C.reset : ""}`);
  };

  /** Handle one input line. Exported as a method so it can be unit-tested. */
  async function handleLine(line) {
    const raw = String(line || "").trim();
    if (!raw) return { type: "empty" };
    if (s.approval && /^[yna]$/i.test(raw)) {
      const decision = raw.toLowerCase();
      const name = s.approval;
      s.approval = null;
      push("ok", `approval ${name}: ${decision}`);
      const r = onCommand ? await onCommand("/approve", decision) : null;
      if (r) push("info", r);
      if (interactive) paint();
      return { type: "approval", decision, name };
    }
    if (!raw.startsWith("/")) {
      push("model", `user> ${raw}`);
      const r = onUserText ? await onUserText(raw) : "(no model wired; offline TUI)";
      if (r) push("model", r);
      if (interactive) paint();
      return { type: "user", text: raw };
    }
    const [cmd, ...rest] = raw.split(/\s+/);
    const arg = rest.join(" ");
    if (cmd === "/quit") {
      close();
      return { type: "quit" };
    }
    if (cmd === "/diff") {
      push("diff", diffPreview(lastDiff.before, lastDiff.after));
      if (interactive) paint();
      return { type: "diff" };
    }
    if (!COMMANDS.includes(cmd)) {
      push("warn", `unknown command ${cmd}`);
      if (interactive) paint();
      return { type: "unknown", cmd };
    }
    push("tool", `${cmd} ${arg}`.trim());
    const r = onCommand ? await onCommand(cmd, arg) : null;
    if (r) push("info", typeof r === "string" ? r : JSON.stringify(r));
    if (interactive) paint();
    return { type: "command", cmd, arg, result: r };
  }

  function setState(patch) {
    s = { ...s, ...patch };
    if (interactive) paint();
    return s;
  }

  function setDiff(before, after) {
    lastDiff = { before, after };
  }

  function attach() {
    if (!interactive || rl) return;
    rl = readline.createInterface({ input, output, terminal: true });
    rl.on("line", (line) => { void handleLine(line); });
    rl.on("close", () => { rl = null; });
    paint();
  }

  function close() {
    if (rl) rl.close();
    rl = null;
  }

  return {
    push, paint, handleLine, setState, setDiff, attach, close,
    renderStatic: (opts) => renderStatic(s, opts),
    getState: () => ({ ...s }),
    isInteractive: () => interactive,
  };
}
