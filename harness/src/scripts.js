/**
 * Script manifest: the shell-side half of a harness. Every script declares
 * WHEN it fires, its risk level and whether it needs approval. Scripts are
 * data first (so TUI / hooks / MCP all read the same table), then executable.
 */
import fs from "node:fs";
import path from "node:path";
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
    id: "wcc.map.build",
    when: "spec 全任务完成（当前仅声明，走 Sidecar build_map 工具）",
    cmd: null, args: [], risk: "local-write", needsApproval: true, timeoutMs: 60000,
    desc: "打包战役；当前由 Sidecar build_map 工具执行，不作为独立脚本启动",
  },
];

export function findScript(id) {
  return SCRIPT_MANIFEST.find((s) => s.id === id) || null;
}

export function describeScripts() {
  return SCRIPT_MANIFEST.map((s) => ({ ...s, executable: Boolean(s.cmd) }));
}

/** Run a declared script. Approval-gated scripts require explicit approved:true. */
export function runScript(id, { root = process.cwd(), args = null, approved = false, dryRun = false } = {}) {
  const s = findScript(id);
  if (!s) return { ok: false, id, reason: "unknown-script" };
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
