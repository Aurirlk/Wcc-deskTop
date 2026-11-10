/**
 * Steering: conditional knowledge injection (Kiro-style, own implementation).
 *
 * Design contract:
 *  - A steering doc is a markdown file with an optional YAML-ish front matter block:
 *      ---
 *      id: conventions
 *      mode: conditional          # always | conditional | manual
 *      fileMatch: "<glob>,<glob>"  # comma separated globs, e.g. any Lua file
 *      toolMatch: forge_*,codegen_*
 *      keywords: 单位,物编,刷怪
 *      priority: 10
 *      maxChars: 6000
 *      ---
 *  - Docs without front matter fall back to DEFAULT_RULES (so the layer still
 *    works on a pristine wcc-skill tree).
 *  - Nothing is copied from Kiro / deepagents / Strands: design only.
 */
import fs from "node:fs";
import path from "node:path";

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Heuristics used when a doc has no front matter. */
export const DEFAULT_RULES = {
  "skill.md": { mode: "always", priority: 100, maxChars: 4000 },
  "knowledge/conventions.md": { mode: "conditional", fileMatch: ["**/*.lua"], priority: 60 },
  "knowledge/api-best-practices.md": {
    mode: "conditional",
    fileMatch: ["**/*.lua"],
    keywords: ["api", "原生", "函数"],
    priority: 55,
  },
  "knowledge/project-structure.md": {
    mode: "conditional",
    fileMatch: ["**/src/**", "**/wcc.project.json"],
    keywords: ["目录", "结构", "require"],
    priority: 40,
  },
  "patterns/task-boss-fight.md": { mode: "manual", keywords: ["boss", "阶段", "技能循环"], priority: 30 },
  "patterns/task-dialogue-sequence.md": { mode: "manual", keywords: ["对话", "过场", "cinematic"], priority: 30 },
  "patterns/task-object-batch.md": { mode: "manual", keywords: ["物编", "批量", "单位"], priority: 30 },
  "patterns/task-data-codegen.md": { mode: "manual", keywords: ["表格", "excel", "数据驱动"], priority: 30 },
};

export function parseFrontMatter(text) {
  const m = FRONT.exec(text);
  if (!m) return { meta: {}, body: text, hasFrontMatter: false };
  const meta = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (["fileMatch", "toolMatch", "keywords"].includes(key)) {
      meta[key] = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (["priority", "maxChars"].includes(key)) {
      meta[key] = Number(value) || 0;
    } else {
      meta[key] = value;
    }
  }
  return { meta, body: text.slice(m[0].length), hasFrontMatter: true };
}

/** Minimal glob -> RegExp. Supports *, **, ?. No dependency, no full glob spec. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$", "i");
}

export function matchesGlob(rel, glob) {
  const normalized = String(rel).replace(/\\/g, "/").replace(/^\.\//, "");
  if (globToRegExp(glob).test(normalized)) return true;
  // Also allow a bare "*.lua" to match nested paths, matching author intuition.
  return !glob.includes("/") && globToRegExp("**/" + glob).test(normalized);
}

function listMarkdown(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
        walk(abs);
      } else if (ent.isFile() && ent.name.endsWith(".md")) {
        out.push(abs);
      }
    }
  };
  walk(root);
  return out.sort();
}

/**
 * `agentsFile` is an optional repo-root AGENTS.md. It is intentionally opt-in:
 * the skill tree stays the single source of programming rules, while the repo
 * contract (pointer + engineering conventions) can be injected as `always`.
 */
export function collectSteering({ skillRoot, agentsFile = null }) {
  const root = path.resolve(skillRoot);
  const files = listMarkdown(root);
  if (agentsFile && fs.existsSync(agentsFile)) files.push(path.resolve(agentsFile));
  return files.map((abs) => {
    let rel = path.relative(root, abs).replace(/\\/g, "/");
    if (rel.startsWith("..")) rel = path.basename(abs);
    const text = fs.readFileSync(abs, "utf8");
    const { meta, body, hasFrontMatter } = parseFrontMatter(text);
    const rule = DEFAULT_RULES[rel] || {};
    return {
      id: meta.id || rel.replace(/\.md$/, "").replace(/\//g, "-"),
      rel,
      abs,
      mode: meta.mode || rule.mode || "manual",
      fileMatch: meta.fileMatch || rule.fileMatch || [],
      toolMatch: meta.toolMatch || [],
      keywords: meta.keywords || rule.keywords || [],
      priority: meta.priority ?? rule.priority ?? 0,
      maxChars: meta.maxChars || rule.maxChars || 0,
      body,
      hasFrontMatter,
      chars: body.length,
    };
  });
}

function hit(list, patterns) {
  if (!patterns?.length) return false;
  return list.some((item) => patterns.some((p) => matchesGlob(item, p) || String(item).includes(p.replace(/\*/g, ""))));
}

/**
 * @param {object}  ctx
 * @param {string[]} ctx.files      files being edited / read this turn
 * @param {string[]} ctx.toolNames  tools likely used this turn
 * @param {string}   ctx.intent     user text
 * @param {string[]} ctx.explicit   manual "#id" references
 * @param {number}   ctx.maxChars   total injection budget
 */
export function selectSteering({ docs, context = {} }) {
  const files = context.files || [];
  const toolNames = context.toolNames || [];
  const intent = String(context.intent || "").toLowerCase();
  const explicit = (context.explicit || []).map((s) => String(s).replace(/^#/, "").toLowerCase());
  const budget = context.maxChars || 12000;

  const decisions = docs.map((doc) => {
    let reason = "";
    let selected = false;
    if (doc.mode === "always") {
      selected = true;
      reason = "always";
    } else if (doc.mode === "conditional") {
      if (hit(files, doc.fileMatch)) {
        selected = true;
        reason = "fileMatch";
      } else if (hit(toolNames, doc.toolMatch)) {
        selected = true;
        reason = "toolMatch";
      }
    }
    if (!selected && (doc.mode === "manual" || explicit.length)) {
      if (explicit.some((e) => doc.id.toLowerCase().includes(e) || doc.rel.toLowerCase().includes(e))) {
        selected = true;
        reason = "explicit";
      }
    }
    if (!selected && doc.keywords.length && intent) {
      const k = doc.keywords.find((word) => intent.includes(String(word).toLowerCase()));
      if (k) {
        selected = true;
        reason = `keyword:${k}`;
      }
    }
    return { ...doc, selected, reason };
  });

  const chosen = decisions.filter((d) => d.selected).sort((a, b) => b.priority - a.priority);
  const matchedIds = chosen.map((d) => d.id);
  let used = 0;
  const blocks = [];
  const truncated = [];
  const dropped = [];
  for (const doc of chosen) {
    const limit = doc.maxChars || Infinity;
    const room = Math.max(0, budget - used);
    if (room < 200) {
      dropped.push({ id: doc.id, reason: "budget-exhausted" });
      continue;
    }
    const take = Math.min(doc.chars, limit, room);
    const body = doc.body.slice(0, take);
    used += body.length;
    if (take < doc.chars) truncated.push(doc.id);
    blocks.push({ id: doc.id, rel: doc.rel, reason: doc.reason, chars: body.length, body });
  }

  const totalChars = docs.reduce((n, d) => n + d.chars, 0);
  return {
    blocks,
    selectedIds: blocks.map((b) => b.id), // actually injected (budget permitting)
    matchedIds,                           // matched by rules before budget
    skippedIds: decisions.filter((d) => !d.selected).map((d) => d.id),
    truncated,                            // partially injected
    dropped,                              // matched but fully dropped: no budget left
    usedChars: used,
    totalChars,
    savedChars: Math.max(0, totalChars - used),
    budget,
  };
}

export function renderSteering(selection) {
  if (!selection.blocks.length) return "";
  return [
    "# Steering (conditional, do not assume unlisted docs are in effect)",
    ...selection.blocks.map((b) => `\n## ${b.id} [${b.reason}]\n${b.body}`),
  ].join("\n");
}

/** One-shot helper used by the CLI + TUI. */
export function createSteering({ skillRoot, maxChars = 12000, agentsFile = null }) {
  let docs = collectSteering({ skillRoot, agentsFile });
  const select = (context = {}) => selectSteering({ docs, context: { maxChars, ...context } });
  const reload = () => {
    docs = collectSteering({ skillRoot, agentsFile });
    return docs;
  };
  return { get docs() { return docs; }, select, render: renderSteering, reload };
}

/** Front matter that `annotate` writes into an existing skill doc. */
export function annotationFor(rel) {
  const rule = DEFAULT_RULES[rel];
  if (!rule) return null;
  const lines = ["---", `id: ${rel.replace(/\.md$/, "").replace(/\//g, "-")}`, `mode: ${rule.mode}`];
  if (rule.fileMatch?.length) lines.push(`fileMatch: "${rule.fileMatch.join(",")}"`);
  if (rule.keywords?.length) lines.push(`keywords: ${rule.keywords.join(",")}`);
  lines.push(`priority: ${rule.priority}`);
  if (rule.maxChars) lines.push(`maxChars: ${rule.maxChars}`);
  lines.push("---", "");
  return lines.join("\n");
}
