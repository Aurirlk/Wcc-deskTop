#!/usr/bin/env node
/**
 * check-doc-consistency.mjs — WP9 收尾门禁（npm run docs:check）。
 *
 * 检查仓库 .md 文档的口径一致性，退出码非 0 即失败。
 * 模式字符串只存在于本文件（.mjs），不写进 .md，避免检查时自命中。
 * 主计划在断言 2-4 中被排除：它需要描述「待清理口径」，不是活跃声明。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_PLAN = "docs/NEXT-DEVELOPMENT-PLAN.md";
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".workbuddy", ".novel-workflow", ".omo",
  "attic", "dist", "tests", ".wcc",
]);
const KEPT_UNTRACKED = [".novel-workflow/", ".omo/", "wcc-core.lua", "项目状态与改进报告.md", ".workbuddy/"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(abs, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const allMd = walk(ROOT);
const scanning = allMd.filter((p) => rel(p) !== MAIN_PLAN);

function hits(files, re) {
  const found = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (re.test(line)) found.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 120)}`);
    });
  }
  return found;
}

function fileIfExists(name) {
  const abs = path.join(ROOT, name);
  return fs.existsSync(abs) ? [abs] : [];
}

const ENTRY_DOCS = [
  "README.md",
  "examples/demo-campaign/README.md",
  "docs/ASSETS-GUIDE.md",
  "docs/DEVELOPMENT-NOTES.md",
  "wcc-ai-blueprint.md",
  "wcc-architecture.md",
  "wcc-skill.md",
  "wcc-skill/skill.md",
  "wcc-skill/knowledge/conventions.md",
  "wcc-skill/knowledge/project-structure.md",
  "wcc-skill/patterns/task-boss-fight.md",
  "packages/wcc-skill-mimocode/wcc-warcraft-campaign/SKILL.md",
].flatMap(fileIfExists);

const docsDir = allMd.filter((p) => rel(p).startsWith("docs/") && rel(p) !== MAIN_PLAN);

const checks = [];
function add(name, found, note = "") {
  checks.push({ name, found, note });
}

// 1. 主计划自洽：不能有「未开工」断言、旧 commit、悬空锚点
add("1 主计划自洽（无未开工断言 / 旧 commit / 悬空锚点）",
  hits(fileIfExists(MAIN_PLAN), /计划稿，未开工|12b9169|d8ccdfb|§11|§3\.2/));

// 2. 决策口径：全仓不得再有「决策未定」的活跃声明
add("2 决策口径已定（无活跃的决策未定声明）",
  hits(scanning, /未拍板|待拍板/));

// 3. 单数据源与回归基线：不得留有旧数值 / 主仓库叙事 / 手工双推
add("3 单数据源与回归基线（无旧数值 / 主仓库 / 手工双推）",
  hits(scanning, /27 pass|27 tests|15\/15|15 harness|Gitee 主仓库|git push origin main/));

// 4. 进图指引 + IR 唯一契约
add("4a 进图指引（无错误入口 / 虚构地图文件）",
  hits(ENTRY_DOCS, /在 World Editor 中打开|demo-campaign\.w3x|触发器，内容为.*require/));
add("4b IR 唯一契约（docs 内无第二套目录树）",
  hits(docsDir, /\.wcc\/ir\/\{/));

// 5. AGENTS.md 仍以 mode: always 被 steering 命中
let steeringOut = "";
let steeringErr = "";
try {
  steeringOut = execFileSync(process.execPath,
    ["harness/bin/wcc-harness.mjs", "steering", "list"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  steeringErr = String(e.stderr || e.message || "").slice(0, 200);
}
add("5 AGENTS.md 仍被 steering 命中",
  steeringOut.includes('"id": "agents"') ? [] : [`CLI 输出未命中 agents${steeringErr ? " / " + steeringErr : ""}`]);

// 6. 保留项未被 git 跟踪
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
} catch (e) {
  tracked = [];
}
add("6 保留项未入库",
  KEPT_UNTRACKED.flatMap((k) => tracked.some((f) => f === k || f.startsWith(k))
    ? [`被 git 跟踪：${k}`] : []));

console.log("=== WCC 文档一致性门禁（npm run docs:check）===");
let failed = 0;
for (const c of checks) {
  const ok = c.found.length === 0;
  if (!ok) failed++;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${c.name}${c.note ? " — " + c.note : ""}`);
  for (const line of c.found.slice(0, 12)) console.log(`        ${line}`);
  if (c.found.length > 12) console.log(`        … 另有 ${c.found.length - 12} 处`);
}
console.log(`\n结果：${checks.length - failed} PASS / ${failed} FAIL`);
process.exit(failed ? 1 : 0);
