/**
 * Script manifest: the shell-side half of a harness. Every script declares
 * WHEN it fires, its risk level and whether it needs approval. Scripts are
 * data first (so TUI / hooks / MCP all read the same table), then executable.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const SCRIPT_MANIFEST = [
  {
    id: "wcc.check",
    when: "file.write(*.lua) / task.complete / 用户 /check",
    cmd: "node",
    args: ["packages/wcc-lua-check/src/cli.js", "examples/demo-campaign/src", "wcc-lib"],
    risk: "read", needsApproval: false, timeoutMs: 30000,
    desc: "Lua 静态检查（禁 Wait / 泄漏 / 虚构 API）",
  },
  {
    id: "wcc.test",
    when: "task.complete / 发版前 / 用户 /test",
    cmd: "npm", args: ["test"],
    risk: "read", needsApproval: false, timeoutMs: 120000,
    desc: "Sidecar + lua-check 既有测试",
  },
  {
    id: "wcc.harness.test",
    when: "改 harness 代码后 / 用户 /selftest",
    cmd: "node", args: ["--test", "harness/test/harness.test.js"],
    risk: "read", needsApproval: false, timeoutMs: 60000,
    desc: "Harness 层自测（node:test，零依赖）",
  },
  {
    id: "wcc.spec.init",
    when: "新战役任务开始 / 用户 /spec init",
    cmd: "node", args: ["harness/bin/wcc-harness.mjs", "spec", "init"],
    risk: "local-write", needsApproval: false, timeoutMs: 15000,
    desc: "生成 .wcc/spec/{requirements,design,tasks}.md",
  },
  {
    id: "wcc.steering.annotate",
    when: "首次接入 / skill 文档更新后",
    cmd: "node", args: ["harness/bin/wcc-harness.mjs", "steering", "annotate", "--write"],
    risk: "repo-write", needsApproval: true, timeoutMs: 15000,
    desc: "给 wcc-skill/*.md 写入 steering front matter（改仓库文件，需审批）",
  },
  {
    id: "wcc.forge.probe",
    when: "turn.start / 用户 /forge",
    cmd: "node", args: ["harness/bin/wcc-harness.mjs", "probe"],
    risk: "read", needsApproval: false, timeoutMs: 10000,
    desc: "检查 WC3FORGE_EXE 与 .wcc/spec 状态，不启动外部 exe",
  },
  {
    id: "wcc.map.snapshot",
    when: "改图前（必须先做） / 用户 /map snapshot",
    cmd: null, handler: "mapSnapshot", args: [], risk: "local-write", needsApproval: false, timeoutMs: 30000,
    desc: "改图前只读快照：sha256 + 副本 + .wcc/ir/<map-id>/manifest.json（含 targetPatch / language）",
  },
  {
    id: "wcc.map.diff",
    when: "IR 变更前 / 用户 /map diff",
    cmd: null, handler: "mapDiff", args: [], risk: "local-write", needsApproval: false, timeoutMs: 30000,
    desc: "生成标准 unified diff 到 patches/，可 git apply -R 回滚；只读两个 IR 文本",
  },
  {
    id: "wcc.map.verify",
    when: "写 .edited.w3x 之前（闸门） / 用户 /map verify",
    cmd: null, handler: "mapVerify", args: [], risk: "read", needsApproval: false, timeoutMs: 60000,
    desc: "parse→serialize 逐字节 round-trip 闸门；不能无损重建就拒绝写图",
  },
  {
    id: "wcc.map.set_script",
    when: "P2 阶段 B（🔴 条件触发，当前未解封）：注入战役脚本前",
    cmd: null, handler: "mapSetScript", args: [], risk: "external-write", needsApproval: true, timeoutMs: 60000,
    desc: "参数契约 + 可注入 adapter：强制 targetPatch(\"1.31+\") 与 strategy(script-only|durable|gui)；script-only 明确警告「WE 重存会丢失」且不写图；无逐字节 round-trip 证据或无真 adapter 一律 fail-closed，绝不写 .w3x",
  },
  {
    id: "wcc.map.build",
    when: "spec 全任务完成（当前仅声明，走 Sidecar build_map 工具）",
    cmd: null, args: [], risk: "local-write", needsApproval: true, timeoutMs: 60000,
    desc: "打包战役；当前由 Sidecar build_map 工具执行，不作为独立脚本启动",
  },
];

// ---------------------------------------------------------------------------
// P2 / G1 — text-IR helpers. Pure node (fs + crypto), zero npm dependencies.
// These are GATES, not serializers: they never write a binary .w3x and never
// claim "WE can open it". Contract: docs/MAP-COMPILE-PIPELINE.md §6.1 / §7.
// ---------------------------------------------------------------------------
const IR_TARGET_PATCH = "1.31+"; // B+A dual-track decision, 2026-11-11
const IR_LANGUAGE = "lua";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function mapIdFor(p) {
  const b = path.basename(p).replace(/\.[^.]+$/, "").toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return b || "map";
}

function irRoot(root, mapId) {
  return path.join(path.resolve(root), ".wcc", "ir", mapId);
}

function resolveFile(root, p, label) {
  if (!p || typeof p !== "string") return { error: `${label}-required` };
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { error: `${label}-not-found`, abs };
  return { abs };
}

function toLines(text) {
  const a = String(text).replace(/\r\n/g, "\n").split("\n");
  if (a.length && a[a.length - 1] === "") a.pop();
  return a;
}

/** LCS edit script; null when the input is too large to diff in memory. */
function editScript(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4_000_000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: "=", v: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: "-", v: a[i++] });
    else ops.push({ t: "+", v: b[j++] });
  }
  while (i < n) ops.push({ t: "-", v: a[i++] });
  while (j < m) ops.push({ t: "+", v: b[j++] });
  return ops;
}

/** Standard unified diff (context 3) that `git apply -R` can reverse. */
export function unifiedDiff(oldText, newText, rel = "ir.txt") {
  const ops = editScript(toLines(oldText), toLines(newText));
  if (!ops) return { ok: false, reason: "diff-too-large" };
  if (!ops.some((o) => o.t !== "=")) {
    return { ok: true, identical: true, patch: "", added: 0, removed: 0 };
  }

  // Mark every op within 3 lines of a change, then split into contiguous hunks.
  const near = new Array(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].t !== "=") {
      for (let q = Math.max(0, k - 3); q <= Math.min(ops.length - 1, k + 3); q++) near[q] = true;
    }
  }
  let oldLine = 1, newLine = 1;
  const meta = ops.map((o) => {
    const rec = { ...o, oldLine, newLine };
    if (o.t === "=") { oldLine++; newLine++; }
    else if (o.t === "-") oldLine++;
    else newLine++;
    return rec;
  });

  const out = [`diff --git a/${rel} b/${rel}`, `--- a/${rel}`, `+++ b/${rel}`];
  let k = 0;
  while (k < meta.length) {
    if (!near[k]) { k++; continue; }
    const s = k;
    while (k < meta.length && near[k]) k++;
    const hunk = meta.slice(s, k);
    const oldCount = hunk.filter((o) => o.t === "=" || o.t === "-").length;
    const newCount = hunk.filter((o) => o.t === "=" || o.t === "+").length;
    out.push(`@@ -${hunk[0].oldLine},${oldCount} +${hunk[0].newLine},${newCount} @@`);
    for (const o of hunk) out.push(`${o.t === "=" ? " " : o.t}${o.v}`);
  }
  return {
    ok: true,
    identical: false,
    patch: out.join("\n") + "\n",
    added: ops.filter((o) => o.t === "+").length,
    removed: ops.filter((o) => o.t === "-").length,
  };
}

/** Pre-edit, read-only snapshot + IR manifest. Never modifies the source map. */
export function mapSnapshot({ root = process.cwd(), map, outDir = null } = {}) {
  const f = resolveFile(root, map, "map");
  if (f.error) return { ok: false, reason: f.error, map: f.abs || null };
  const bytes = fs.readFileSync(f.abs);
  const hash = sha256(bytes);
  const mapId = mapIdFor(f.abs);
  const ir = irRoot(root, mapId);
  const dir = outDir ? path.resolve(outDir) : path.join(ir, "snapshot");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(f.abs));
  fs.copyFileSync(f.abs, dest);

  const snapJson = {
    schema: "wcc-map-snapshot/1",
    mapId,
    source: path.basename(f.abs),
    sourceSha256: hash,
    size: bytes.length,
    snapshot: path.basename(dest),
    targetPatch: IR_TARGET_PATCH,
    language: IR_LANGUAGE,
    createdAt: new Date().toISOString(),
    note: "改图前只读快照；原图永不修改，写图一律落 .edited.w3x 副本",
  };
  fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapJson, null, 2), "utf8");

  // Three hard rules: AI writes text only; manifest records targetPatch +
  // language; build/ is fully rebuildable from IR and never enters git.
  const snapJsonPath = path.join(dir, "snapshot.json");
  const manifest = {
    schema: "wcc-ir/1",
    mapId,
    targetPatch: IR_TARGET_PATCH,
    language: IR_LANGUAGE,
    source: { file: path.basename(f.abs), sha256: hash, size: bytes.length },
    files: [{ path: "snapshot/snapshot.json", producer: "wcc.map.snapshot", sha256: sha256(fs.readFileSync(snapJsonPath)) }],
    build: { reproducible: true, note: "build/ 是生成物，全量可从 IR 重建，不进 git" },
    serializersVerified: false,
  };
  fs.writeFileSync(path.join(ir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (sha256(fs.readFileSync(f.abs)) !== hash) {
    return { ok: false, reason: "source-changed-during-snapshot" };
  }
  return {
    ok: true,
    mapId,
    sha256: hash,
    size: bytes.length,
    source: f.abs,
    snapshot: dest,
    manifest: path.join(ir, "manifest.json"),
    note: "原图 sha256 前后一致；未写任何 .w3x",
  };
}

/** IR-level diff: a reviewable, reversible patch in patches/. */
export function mapDiff({ root = process.cwd(), mapId = "map", from, to, name = null, rel = null } = {}) {
  const a = resolveFile(root, from, "from");
  if (a.error) return { ok: false, reason: a.error, from: a.abs || null };
  const b = resolveFile(root, to, "to");
  if (b.error) return { ok: false, reason: b.error, to: b.abs || null };
  const r = rel || path.basename(b.abs);
  const d = unifiedDiff(fs.readFileSync(a.abs, "utf8"), fs.readFileSync(b.abs, "utf8"), r);
  if (!d.ok) return { ok: false, reason: d.reason };
  if (d.identical) {
    return { ok: true, identical: true, added: 0, removed: 0, patch: "", patchPath: null, rel: r };
  }
  const dir = path.join(irRoot(root, mapId), "patches");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(name || "ir").replace(/[^\w.-]/g, "_")}.patch`);
  fs.writeFileSync(file, d.patch, "utf8");
  return {
    ok: true, identical: false, rel: r,
    added: d.added, removed: d.removed,
    patch: d.patch, patchPath: file,
    note: "可 git apply -R 回滚；AI 只写文本 IR",
  };
}

/**
 * Gate before writing .edited.w3x: parse -> serialize must be byte-for-byte
 * identical. Without an external serializer the gate FAILS CLOSED (🔴 not
 * measured) — it never fakes a pass. A synthetic buffer only proves the
 * comparison logic, never that WE can open the map.
 */
export function mapVerify({ root = process.cwd(), source, rebuilt = null, serializer = null, env = process.env } = {}) {
  const s = resolveFile(root, source, "source");
  if (s.error) return { ok: false, reason: s.error, blocking: true };
  let rebuiltAbs = null;
  if (rebuilt) {
    const r = resolveFile(root, rebuilt, "rebuilt");
    if (r.error) return { ok: false, reason: r.error, blocking: true };
    rebuiltAbs = r.abs;
  } else {
    const cmd = serializer?.cmd || env.WCC_MAP_ROUNDTRIP_CMD || "";
    const out = serializer?.out || env.WCC_MAP_ROUNDTRIP_OUT || "";
    if (!cmd || !out) {
      return {
        ok: false,
        reason: "external-tool-missing",
        blocking: true,
        note: "🔴 round-trip 未实测（mdx-m3-viewer / w2l lni 本机未跑）；未过闸门，禁止写 .edited.w3x。合成单测只能证明字节比较逻辑，不证明 WE 能打开。",
      };
    }
    const res = spawnSync(cmd, [...(serializer?.args || []), s.abs], {
      cwd: path.resolve(root), encoding: "utf8", timeout: 60000, windowsHide: true,
    });
    if (res.status !== 0 || res.error) {
      return {
        ok: false, reason: "serializer-failed", blocking: true,
        error: res.error ? String(res.error.message || res.error) : String(res.stderr || "").slice(0, 500),
      };
    }
    rebuiltAbs = path.isAbsolute(out) ? out : path.resolve(root, out);
    if (!fs.existsSync(rebuiltAbs)) {
      return { ok: false, reason: "serializer-output-missing", blocking: true };
    }
  }
  const a = fs.readFileSync(s.abs);
  const b = fs.readFileSync(rebuiltAbs);
  const hashA = sha256(a), hashB = sha256(b);
  if (!a.equals(b)) {
    return {
      ok: false, reason: "round-trip-mismatch", blocking: true,
      sourceSha256: hashA, rebuiltSha256: hashB,
      note: "不能无损重建，拒绝写图",
    };
  }
  return {
    ok: true, verified: true, evidence: "byte-for-byte", sha256: hashA,
    note: "仅证明 parse→serialize 字节一致；不证明 WE 能打开，也不等于已进图",
  };
}

// ---------------------------------------------------------------------------
// P2-6 — wcc.map.set_script parameter contract (the DEGRADED delivery).
// docs/MAP-COMPILE-PIPELINE.md §5.3 / :386: the interface MUST take
// `targetPatch` + `strategy` explicitly; `script-only` must warn that a WE
// re-save destroys the script and must never silently report success.
//
// 🔴 THIS LAYER NEVER WRITES A .w3x. No real MCP `wc3_set_durable_script` /
// `w2l obj` / `wc3_add_gui_trigger` adapter is wired on this machine. Without
// an explicitly injected adapter (and a verified byte-for-byte round-trip) it
// FAILS CLOSED. A fake adapter in a unit test proves only the parameter
// contract — never that WE can open the map (stage B3/B4 is still 🔴).
// ---------------------------------------------------------------------------
export const SET_SCRIPT_STRATEGIES = Object.freeze(["script-only", "durable", "gui"]);
/** B+A dual-track decision (2026-11-11): 1.31+/Lua is the only built mainline. */
export const SUPPORTED_TARGET_PATCHES = Object.freeze(["1.31+"]);

const SCRIPT_ONLY_WARNING =
  "WE 重存会丢失脚本：script-only 只写 war3map.lua/j，World Editor 重存（Save）会覆盖它。" +
  "此策略不写图；如需进图请用 strategy=\"durable\"，并先过 wcc.map.verify 逐字节闸门。";

function readScriptArg(root, script) {
  if (typeof script !== "string" || !script.trim()) return { error: "script-required" };
  // A one-line string that names an existing file is a path; anything else is
  // treated as the script text itself. Never guess a path from script content.
  if (!script.includes("\n")) {
    const abs = path.isAbsolute(script) ? script : path.resolve(root, script);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return { text: fs.readFileSync(abs, "utf8"), from: abs };
    }
  }
  return { text: script, from: null };
}

/**
 * Validate + dispatch a script-injection request. Returns `written:false` in
 * every failure path. Even on success, `written` comes from the adapter's
 * honest report — this function itself performs no binary writes.
 */
export function mapSetScript({
  root = process.cwd(),
  map = null,
  script = null,
  targetPatch = null,
  strategy = null,
  adapter = null,
  roundTrip = null,
  mapId = null,
} = {}) {
  const base = { written: false, targetPatch, strategy };

  // 1) targetPatch is mandatory and must match the approved mainline.
  if (!targetPatch || typeof targetPatch !== "string" || !targetPatch.trim()) {
    return {
      ok: false, ...base, reason: "targetPatch-required", blocking: true,
      note: "必须显式声明目标补丁，绝不猜测；本机 1.26 只读保留、不施工。",
    };
  }
  if (!SUPPORTED_TARGET_PATCHES.includes(targetPatch)) {
    return {
      ok: false, ...base, reason: "unsupported-target-patch", blocking: true,
      supported: [...SUPPORTED_TARGET_PATCHES],
      note: "🔴 仅 1.31+ / Lua 主线已拍板；1.26 只支持 JASS，不进图、不改写本机游戏。",
    };
  }

  // 2) strategy is mandatory and from a closed set.
  if (!strategy) {
    return {
      ok: false, ...base, reason: "strategy-required", blocking: true,
      supported: [...SET_SCRIPT_STRATEGIES],
    };
  }
  if (!SET_SCRIPT_STRATEGIES.includes(strategy)) {
    return {
      ok: false, ...base, reason: "unsupported-strategy", blocking: true,
      supported: [...SET_SCRIPT_STRATEGIES],
    };
  }

  // 3) The map and the script must both be real.
  const m = resolveFile(root, map, "map");
  if (m.error) return { ok: false, ...base, reason: m.error, blocking: true, map: m.abs || null };
  const s = readScriptArg(root, script);
  if (s.error) return { ok: false, ...base, reason: s.error, blocking: true };

  const scriptSha256 = sha256(Buffer.from(s.text, "utf8"));

  // 4) script-only: EXPLICIT warning, NO write, NEVER a silent success.
  if (strategy === "script-only") {
    return {
      ok: false, ...base,
      reason: "script-only-not-durable", blocking: true,
      warning: SCRIPT_ONLY_WARNING,
      scriptSha256, scriptChars: s.text.length,
      note: "未写任何 .w3x；WE 重存会丢失单独写入的脚本。见 MAP-COMPILE-PIPELINE.md §7。",
    };
  }

  // 5) durable / gui: round-trip gate FIRST, then an explicitly injected adapter.
  if (!roundTrip || roundTrip.ok !== true || roundTrip.verified !== true) {
    return {
      ok: false, ...base, reason: "round-trip-not-verified", blocking: true,
      note: "写图前必须先由 wcc.map.verify 取得 parse→serialize 逐字节证据；合成字节块单测不算真机验收。",
    };
  }
  if (typeof adapter !== "function") {
    return {
      ok: false, ...base, reason: "external-tool-missing", blocking: true,
      note: "🔴 MCP wc3_set_durable_script / w2l obj / wc3_add_gui_trigger 均未在本机接入；未过闸门，禁止写 .edited.w3x。",
    };
  }

  const id = mapId || mapIdFor(m.abs);
  const ext = path.extname(m.abs);
  const outFile = path.join(path.dirname(m.abs), `${path.basename(m.abs, ext)}.edited${ext || ".w3x"}`);
  const req = {
    map: m.abs,
    mapId: id,
    targetPatch,
    strategy,
    language: IR_LANGUAGE,
    script: s.text,
    scriptSha256,
    scriptFrom: s.from,
    outFile, // red line: always an .edited copy, never overwrite the source
    roundTrip: {
      verified: roundTrip.verified,
      evidence: roundTrip.evidence || null,
      sha256: roundTrip.sha256 || null,
    },
  };

  let result;
  try {
    result = adapter(req);
  } catch (e) {
    return { ok: false, ...base, reason: "adapter-error", blocking: true, error: String(e.message || e) };
  }
  if (!result || result.ok !== true) {
    return {
      ok: false, ...base, reason: "adapter-failed", blocking: true,
      adapterResult: result || null,
      note: "adapter 未报告成功，未写任何 .w3x；绝不静默成功。",
    };
  }
  return {
    ok: true, ...base,
    written: Boolean(result.written),
    outFile: result.outFile || null,
    evidence: result.evidence || null,
    note: "adapter 已返回结果；真机 WE Save / Test Map 验收仍属 🔴 未验证（阶段 B3/B4）。",
  };
}

const SCRIPT_HANDLERS = { mapSnapshot, mapDiff, mapVerify, mapSetScript };

export function findScript(id) {
  return SCRIPT_MANIFEST.find((s) => s.id === id) || null;
}

export function describeScripts() {
  // `handler` scripts ARE executable (in-process), `cmd:null` ones are not.
  return SCRIPT_MANIFEST.map((s) => ({ ...s, executable: Boolean(s.cmd || s.handler) }));
}

/**
 * Run a declared script. Approval-gated scripts require approved:true.
 * Handler scripts take an options OBJECT as `args`; shell scripts keep the
 * original argv ARRAY. Both read the same SCRIPT_MANIFEST (single source).
 */
export function runScript(id, { root = process.cwd(), args = null, approved = false, dryRun = false } = {}) {
  const s = findScript(id);
  if (!s) return { ok: false, id, reason: "unknown-script" };
  if (s.handler) {
    if (s.needsApproval && !approved) {
      return { ok: false, id, reason: "approval-required", skipped: true, desc: s.desc };
    }
    const opts = args && typeof args === "object" && !Array.isArray(args) ? args : {};
    if (dryRun) return { ok: true, id, dryRun: true, handler: s.handler, args: { root, ...opts }, cwd: root };
    const fn = SCRIPT_HANDLERS[s.handler];
    if (!fn) return { ok: false, id, reason: "handler-missing", handler: s.handler };
    try {
      return { ...fn({ root, ...opts }), id, runBy: "handler" };
    } catch (e) {
      return { ok: false, id, reason: "handler-error", error: String(e.message || e) };
    }
  }
  if (!s.cmd) return { ok: false, id, reason: "declared-only", desc: s.desc };
  if (s.needsApproval && !approved) {
    return { ok: false, id, reason: "approval-required", skipped: true, desc: s.desc };
  }
  const cmd = process.platform === "win32" && ["npm", "npx"].includes(s.cmd) ? `${s.cmd}.cmd` : s.cmd;
  const argv = args || s.args;
  if (dryRun) return { ok: true, id, dryRun: true, cmd, args: argv, cwd: root };
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, {
    cwd: root,
    encoding: "utf8",
    timeout: s.timeoutMs,
    windowsHide: true,
    // Windows needs cmd.exe to launch npm.cmd / npx.cmd.
    shell: process.platform === "win32" && cmd.endsWith(".cmd"),
  });
  return {
    ok: r.status === 0 && !r.error,
    id,
    code: r.status,
    durationMs: Date.now() - t0,
    stdout: String(r.stdout || "").slice(0, 20000),
    stderr: String(r.stderr || "").slice(0, 8000),
    error: r.error ? String(r.error.message || r.error) : null,
  };
}

/** Safe, dependency-free probe: no external exe is executed. */
export function probeForge({ env = process.env, root = process.cwd() } = {}) {
  const exe = env.WC3FORGE_EXE || "";
  const specDir = path.join(path.resolve(root), ".wcc", "spec");
  return {
    envVar: "WC3FORGE_EXE",
    value: exe || "(unset)",
    exists: exe ? fs.existsSync(exe) : false,
    specDir,
    specExists: fs.existsSync(specDir),
    note: "只做文件/环境变量检查，不启动 wc3-forge.exe",
  };
}
