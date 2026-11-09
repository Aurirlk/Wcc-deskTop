/**
 * Spec: requirements -> design -> tasks, persisted as Markdown (Kiro/spec-kit style).
 * Own implementation, zero dependencies. Tasks are checkboxes with stable ids.
 */
import fs from "node:fs";
import path from "node:path";

export const STAGES = ["requirements", "design", "tasks", "executing", "done"];

const TEMPLATES = {
  requirements: (goal) => `# Requirements\n\n目标：${goal}\n\n> EARS 记法：While / When / If-Then / Shall。每条需求必须有可验证的验收条件。\n\n- [ ] R1 When 玩家进入第一章，系统 Shall 播放开场对话，且对话结束后任务面板出现「主线：清剿营地」。\n- [ ] R2 If 单位死亡 Then 系统 Shall 销毁其 Location/Group 句柄。\n\n## 验收条件\n\n- [ ] AC1 npm run check 输出 0 issues\n- [ ] AC2 npm test 全绿\n`,
  design: (goal) => `# Design\n\n目标：${goal}\n\n## 架构\n\n- 逻辑层：src/map/*.lua + wcc-lib/*\n- 数据层：WE / wc3-forge（不在本 spec 内改二进制）\n- 入口：src/main.lua -> require(\"src.map.chapter_01\")\n\n## 约束\n\n- 禁 Wait / TriggerSleepAction / PolledWait\n- Handle 用完销毁；GetLocalPlayer 内不做影响同步的操作\n- 文件写入前说明意图，写入后自动 lua_check\n\n## 待确认\n\n- [ ] D1 章节文件划分\n`,
  tasks: (goal) => `# Tasks\n\n目标：${goal}\n\n> 格式： - [ ] T1 ... ；id 稳定，供 hooks / TUI 引用。\n\n- [ ] T1 列出项目结构并读取 steering\n- [ ] T2 生成章节 Lua 模块（经审批写文件）\n- [ ] T3 运行 lua_check 并修复 issues\n- [ ] T4 运行 npm test\n- [ ] T5 生成战役交付清单\n`,
};

export function createSpecStore({ projectRoot }) {
  const dir = path.join(path.resolve(projectRoot), ".wcc", "spec");
  const file = (stage) => path.join(dir, `${stage}.md`);
  const ensure = () => fs.mkdirSync(dir, { recursive: true });

  function init(goal = "未命名战役任务", { force = false } = {}) {
    ensure();
    const written = [];
    for (const stage of ["requirements", "design", "tasks"]) {
      const f = file(stage);
      if (force || !fs.existsSync(f)) {
        fs.writeFileSync(f, TEMPLATES[stage](goal), "utf8");
        written.push(stage);
      }
    }
    return { dir, written, existed: written.length === 0 };
  }

  function read(stage) {
    try {
      return fs.readFileSync(file(stage), "utf8");
    } catch {
      return "";
    }
  }

  function write(stage, text) {
    ensure();
    fs.writeFileSync(file(stage), text, "utf8");
    return file(stage);
  }

  function parseTasks(md = read("tasks")) {
    const tasks = [];
    for (const line of md.split(/\r?\n/)) {
      const m = /^\s*[-*]\s*\[([ xX])\]\s*(T\d+)\s+(.+)$/.exec(line);
      if (!m) continue;
      tasks.push({ id: m[2], done: m[1].toLowerCase() === "x", text: m[3].trim(), line });
    }
    return tasks;
  }

  function setTask(id, done = true, stage = "tasks") {
    const md = read(stage);
    const re = new RegExp(`^(\\s*[-*]\\s*\\[)([ xX])(\\]\\s*${id}\\s+)`, "m");
    if (!re.test(md)) return { ok: false, reason: `task ${id} not found`, file: file(stage) };
    const next = md.replace(re, (_all, a, _b, c) => `${a}${done ? "x" : " "}${c}`);
    write(stage, next);
    return { ok: true, id, done, file: file(stage) };
  }

  function progress() {
    const tasks = parseTasks();
    const done = tasks.filter((t) => t.done).length;
    return { total: tasks.length, done, pending: tasks.length - done, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
  }

  /** Stage is derived from file state, not stored (no second source of truth). */
  function stage() {
    if (!fs.existsSync(file("requirements"))) return "none";
    const tasks = parseTasks();
    if (tasks.length && tasks.every((t) => t.done)) return "done";
    if (tasks.length && tasks.some((t) => t.done)) return "executing";
    if (fs.existsSync(file("tasks"))) return "tasks";
    if (fs.existsSync(file("design"))) return "design";
    return "requirements";
  }

  function summary() {
    return { dir, stage: stage(), progress: progress(), tasks: parseTasks(), files: STAGES.slice(0, 3).map((s) => ({ stage: s, exists: fs.existsSync(file(s)) })) };
  }

  return { dir, init, read, write, parseTasks, setTask, progress, stage, summary, file };
}
