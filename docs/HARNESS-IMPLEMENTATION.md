# WCC AI 开发 Harness · 实现与讨论

> **2026-11-10 仓库状态补记（当日二次校正）**：本文撰写时「未 git commit / 未推送 / origin=gitclone.com」均为当时状态；当天成果已全部提交（`7fe0922`..`ef5a9be`，7 个）并推送到 Gitee **私有**仓库 `wei-kaijie/Wcc-deskTop`（项目为半成品，刻意不公开）。**当日稍后已完成三处同步**：以 Gitee 最新提交为基准合并了 GitHub 原分叉与本地改动，本地 `main`、GitHub `Aurirlk/Wcc-deskTop`、Gitee `wei-kaijie/Wcc-deskTop` 的 `main` 均已对齐（合并提交 `d8ccdfb`）；GitHub **不再**停在 `12b9169`。
> 此后仓库持续开发，**最新 HEAD 一律以 `git log -1` / `git ls-remote` 为准，本文不再跟踪具体 commit**；开发主线与排期见 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md)，换机说明见 [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) §1。

> 2026-11-09 晚 · 把此前四份调研稿（`HARNESS-REFERENCE.md` / `FEASIBILITY-REVIEW.md` / `FORGE-INTEGRATION.md` / `ASSETS-GUIDE.md`）的结论**落成可运行代码**，并回答「真做 Harness 需要什么脚本 / 工具注入怎么配合 / TUI 怎么做 / 隔壁 WC3 能抄什么」。
> 本文是**实现记录**，不是规划稿。所有「✅」都有对应文件与实测命令；所有「🔴 / 🟠」都明确列出未做。

---

## 0. 状态声明（先说清楚做到哪一步）

| 状态 | 内容 |
|---|---|
| ✅ 已落地 | `harness/` 独立零依赖层：12 个 JS 模块 + 1 个 CLI + 15 个自测用例，可离线运行 |
| ✅ 已落地 | `wcc-skill/` 8 份文档新增 steering front matter（**只加头部元数据，正文 0 改动**，`git diff --stat` = 8 files / +50 lines / 0 deletions） |
| ✅ 已验证 | `node --test harness/test/harness.test.js` → **15/15 pass**；`npm test` → 25+2 = **27 pass**；`npm run check` → **13 files, 0 issues** |
| ✅ 已验证 | `node harness/bin/wcc-harness.mjs demo` 全链路离线跑通（steering → spec → scratch → hook → 工具注入 → 预算 → TUI 静态渲染） |
| 🟠 未接入 | **未改动** `packages/wcc-sidecar/src/agent.js`、`server.js`、`tools.js`；现有 Agent Loop 仍全量注入 skill、仍手动 check、仍 `guard < 8` 硬循环 |
| 🟠 未接入 | `harness/` 故意**不进 npm workspaces**（根 `package.json` 未改、`package-lock.json` 未因本次新增而重生成），保持零依赖、零回归 |
| 🔴 未做 | `electron-builder` 打包、去掉启动器硬编码 node 路径、provider 设置页、真 forge 联调、独立 stdio MCP server、交互式 TUI 真机验收 |
| ✅ 已提交 | 当天成果共 6 个本地提交，已推送到 Gitee 私有仓库；🔴 **仍未发任何外部 Issue/PR** |
| ⚠️ 实测异常 | 当前 shell 读不到用户级 `WC3FORGE_EXE`（`probe` 返回 `(unset)`）；用户级环境变量需重新登录/重启资源管理器后才对新进程可见。**本次没有启动过 `wc3-forge.exe`，也没有 forge 联调实证** |

> 一句话：调研里的「最划算三件」（steering 条件加载、hooks 质量门禁、spec 落盘）已经**有代码、有测试、有 CLI**；但它们是**可独立运行的旁路层**，还没接进主 Agent Loop。接进去才是产品化，本文 §7 列为第一步。

---

## 1. 调研 → 实现映射（`HARNESS-REFERENCE.md` 第 3 节逐条对账）

| # | 借鉴机制 | 来源 | 实现文件 | 状态 |
|---|---|---|---|---|
| 1 | spec 三阶段 + 任务状态机 | Kiro / spec-kit | `harness/src/spec.js` | ✅ `.wcc/spec/{requirements,design,tasks}.md`，`- [ ] T1` 解析、勾选回写、stage 推导、progress |
| 2 | steering 条件加载 | Kiro | `harness/src/steering.js` + `wcc-skill/*.md` front matter | ✅ always / conditional(fileMatch,toolMatch) / manual(#id) / keyword，含预算截断与 `dropped` 记录 |
| 3 | Agent Hooks 质量门禁 | Kiro | `harness/src/hooks.js` | ✅ `file.write(*.lua)` 自动跑**真实** `checkPaths()`；`task.complete` 生成 check+test 门禁计划；事件白名单、优先级、once、strict |
| 4 | 文件系统即工作记忆 | Deep Agents | `harness/src/scratch.js` | ✅ 超阈值工具结果落 `.wcc/scratch/`，主上下文只留「摘要+路径」，`grep/recall` 找回 |
| 5 | 模型可移植 | Strands | `harness/src/providers.js` | ✅ DeepSeek / 通义 / 智谱 / Kimi / 豆包 / Ollama / 自定义，全部 OpenAI 兼容 `/chat/completions` |
| 6 | 中间件分层 | Deep Agents | `harness/src/middleware.js` | ✅ 洋葱管线 7 层可独立开关：`planning / steering / tools / compaction / approval / budget / scratch` |
| 7 | 生命周期预算 | Strands | `harness/src/budget.js` | ✅ turn / token / wall-clock / cancel / stop reason；**token 是 chars÷4 估算，不是精确计费** |
| 8 | 历史压缩 + 破损 tool call 修补 | Deep Agents | `harness/src/budget.js` | ✅ `summarizeHistory()` 保留首条用户指令；`patchToolCalls()` 补 `[cancelled]` 并丢弃孤儿 tool 消息 |
| 9 | 人工审批 | Deep Agents | `harness/src/middleware.js` `withApproval` | 🟠 语义对齐已有 `/approval/*`，但 harness 层只是可注入回调，未接 Sidecar |
| 10 | 分层不锁死 / 独立 stdio MCP | Strands + `FORGE-INTEGRATION.md` L2 | `harness/src/index.js` `createHarness()` / `dispatch()` | 🟠 库形态已具备（纯函数、无单例、可 import），**MCP server 尚未写** |
| 附 | 按需工具注入（不吃上下文） | Kiro Powers / MCP 治理 | `harness/src/tool-inject.js` | ✅ 29 个工具声明只注入命中的组，带 `filtered/dropped/omitted` 审计与 schema 字符节省统计 |

**没有整包引入任何框架**：无 `deepagents` / `strands-harness` / `spec-kit` 依赖，无 Python，无 LangGraph。全部 Node 22 内置模块（`fs/path/child_process/readline`），这是「点击即用 + 绿色轻量」的硬约束。

### 1.1 组合根（真实代码，`harness/src/index.js`）

```js
const pipeline = createPipeline({ trace: true });
pipeline.use("planning",   withPlanning(spec));       // spec 摘要进 system
pipeline.use("steering",   withSteering(steering));   // 条件规范进 system
pipeline.use("tools",      withToolInjection(injector)); // 按需工具 schema
pipeline.use("compaction", withContextCompaction(...));
pipeline.use("approval",   withApproval({ autoApprove, request }));
pipeline.use("budget",     withBudget(budget));       // 超限即短路，不发模型请求
pipeline.use("scratch",    withScratch(scratch));     // 后置：大结果落盘
await pipeline.run(ctx);
```

### 1.2 质量门禁（真实代码，`harness/src/hooks.js`）

```js
bus.on("file.write", async ({ path: rel }) => {
  if (!rel || !String(rel).endsWith(".lua")) return { skipped: true, reason: "not-lua" };
  const r = check(rel);                       // 真· checkPaths / formatReport
  return { gate: "lua_check", ok: r.ok, issues: r.issues,
           verdict: !r.ok && blockOnIssues ? "block" : "allow" };
}, { name: "lua-check-on-write", priority: 100 });
```

实测：`node harness/bin/wcc-harness.mjs hooks wcc-lib` → `lua_check: 1 files, 0 issues, ok=true`；自测中写入含 `Wait(1)` 的临时 `.lua` → `ok=false`，`.md` 写入 → `skipped`。

---

## 2. 真做 AI 开发 Harness，需要哪些脚本

**结论先行**：脚本不是「一堆 bat」，而是**一张可被 hook / 工具 / TUI 共用的声明表**。已落地为 `harness/src/scripts.js` 的 `SCRIPT_MANIFEST`：每条脚本声明 `when / cmd / args / risk / needsApproval / timeoutMs`，执行器统一走 `runScript()`，默认对 `repo-write` 类要求显式 `approved: true`。

| 脚本 id | 触发时机 | 命令 | 风险 / 审批 | 失败处理 |
|---|---|---|---|---|
| `wcc.check` | `.lua` 落盘、任务完成、`/check` | `node packages/wcc-lua-check/src/cli.js <target>` | read / 免审批 | 退出码 1 = 发现 issues（**不是脚本崩溃**），结果回写事件流 |
| `wcc.test` | 任务完成、发版前、`/test` | `npm test` | read / 免审批 | 超时 120s，`stdout/stderr` 截断后落 scratch |
| `wcc.harness.test` | 改 harness 代码后、`/selftest` | `node --test harness/test/harness.test.js` | read / 免审批 | 同上 |
| `wcc.spec.init` | 新战役任务、`/spec init` | CLI `spec init` | local-write / 免审批 | 幂等：已存在则不覆盖，除非 `--force` |
| `wcc.steering.annotate` | 首次接入 / skill 文档更新 | CLI `steering annotate --write` | **repo-write / 需审批** | dry-run 默认；本次已执行并核验仅 +50 行头部 |
| `wcc.forge.probe` | `turn.start`、`/forge` | CLI `probe` | read / 免审批 | **只查环境变量与文件，不启动 exe** |
| `wcc.map.build` | spec 全部任务完成 | —（声明占位） | local-write / 需审批 | 🔴 目前 `cmd: null`，实际走 Sidecar `build_map` 工具；不伪装成独立脚本 |

**为什么这样分**：
1. **hook 是「必然发生」，脚本是「可执行单元」**。`task.complete` hook 不自己拼命令，而是从 manifest 取 `plan`，避免三处各写一份命令字符串（Kiro 与 forge 都踩过「GUI/MCP 双表面」的坑）。
2. **审批按风险而不是按命令名**。`repo-write` 会改仓库文件 → 需审批；`local-write` 只写 `.wcc/`（已 gitignore）→ 免审批；`external`（forge 写图）→ 双重审批。
3. **结果一律可卸载**。`stdout` 超过 4000 字符走 `scratch.wrapToolResult()`，主上下文只留路径与 preview，长战役才不会爆上下文。
4. **Windows 细节已处理**：`npm`/`npx` 在 Windows 走 `.cmd` + `shell:true`；超时用 `spawnSync timeout`; 不写 `.ps1/.bat` 到中文路径（避免编码乱码）。

**还缺的脚本（🔴 下一步补）**：`wcc.map.snapshot`（改图前备份 `.w3x`）、`wcc.map.diff`（IR 级对比，见 §5）、`wcc.release.pack`（electron-builder）、`wcc.forge.mcp`（独立 stdio MCP 入口）。这四个都涉及外部二进制或打包，不能先写假实现冒充完成。

---

## 3. 工具注入怎么配合：三层注入 + 一条执行链

这是本轮最关键的工程结论：**Harness 不是「给模型一堆工具」，而是「每轮决定给它看什么」**。

| 层 | 注入什么 | 由谁决定 | 实现 |
|---|---|---|---|
| ① 规范注入 | skill / knowledge / patterns 片段 | 当前编辑文件、意图关键词、显式 `#id` | `steering.select()` |
| ② 工具注入 | 本轮可见的 function schemas | 意图命中的 GROUP_RULES、专家、预算、是否允许 external | `tool-inject.select()` |
| ③ 脚本注入 | hook 触发时执行哪个脚本 | 事件类型 + manifest 的 `when` | `scripts.SCRIPT_MANIFEST` |
| ④ 结果注入 | 工具返回进上下文前是否被卸载 | 结果长度阈值 | `scratch.wrapToolResult()` |

**执行链**（`createHarness().prepareTurn()`，全部离线可观测）：

```
turn.start hook
  → planning(spec 摘要) → steering(条件规范) → tools(按需 schema)
  → compaction(历史) → approval(高风险挂起) → budget(超限短路)
  → [此处才调用模型] → tool dispatch → scratch(大结果落盘)
  → file.write hook(lua_check) → task.complete hook(check+test 门禁)
  → turn.end
```

**按需注入的实测效果**（`node harness/bin/wcc-harness.mjs tools --intent "改地图地形，放一批单位"`）：

| 指标 | 值 |
|---|---|
| 工具总数 | 29（含 harness 新增 11 个） |
| 本轮注入 | 11（5 个 always + codegen/forge 条件组） |
| 被过滤 | `forge_connect` → `external-not-allowed`（未显式允许外部写图） |
| schema 字符 | 2093 / 全量 3635，**省 1542** |
| `audit` 专家 | 自动排除 `write_file` 等所有非 read 工具 |

**规范注入的实测效果**（`steer --intent "写一个 boss 战" --files src/map/chapter_01.lua --max 6000`）：
- 全量 skill 文档 50,725 字符；本轮命中 5 份，预算 6000 内实际注入 2 份，**省 44,725 字符**；
- 返回体区分 `matchedIds`（规则命中）/ `selectedIds`（真注入）/ `truncated`（部分截断）/ `dropped`（预算耗尽被丢），**不把「命中」虚报成「已注入」**。

**与 wc3-forge 的配合边界**（沿用 `FEASIBILITY-REVIEW.md` C2）：
- forge 的 152 个 `forge_*` 工具**默认一个都不注入**；只有 `needForge=true` 且显式允许 external 时，才按 `dynamicForgeTools` 注入前 N 个；
- WCC 与 forge 只走 MCP/JSON-RPC 进程间通信，**不复制 forge 源码、不捆绑 `wc3-forge.exe`**（GPL-3.0 边界）；
- 所以「增强 MCP」在 WCC 侧的含义是：**给 forge 工具加一层按需注入 + 审批 + 结果卸载**，而不是往 forge 仓库里塞功能。

---

## 4. TUI 怎么做

**结论**：不要引 `blessed` / `ink` / React —— 那会把「双击即用」重新变回「装一堆依赖」。已落地零依赖原型 `harness/src/tui.js`（Node `readline` + ANSI）。

### 4.1 布局与状态

```
┌ 状态栏 ──────────────────────────────────────────────────────────────┐
│ WCC ready │ model:✓ │ forge:✓ │ spec:tasks 2/5 │ tools:9 │ turn:3/8 │ tok:12k/60k │
├ 事件流（最近 14 条，按 kind 着色）──────────────────────────────────┤
│ [model] 正在生成 chapter_02.lua …                                       │
│ [tool ] write_file src/map/chapter_02.lua                               │
│ [hook ] lua_check -> 0 issues                                           │
│ [diff ] + local boss = require("src.lib.wcc-boss-fight")                │
│ [warn ] forge_connect 待审批                                            │
├ 审批条（红色，y / n / a）────────────────────────────────────────────┤
│ APPROVAL: write_file (y/n/a)                                            │
└ > /spec  /tools  /steer  /check  /scratch <regex>  /diff  /cancel  /quit ┘
```

### 4.2 命令与交互

| 输入 | 行为 |
|---|---|
| 普通文本 | 作为用户输入 → 走 `prepareTurn()`（当前离线时明确回 `no model wired`，**不假装调了模型**） |
| `/spec` `/tools` `/steer` `/provider` | 读同一份 harness 状态，不另建数据源 |
| `/check` | 调 `runScript("wcc.check")`，输出截断后进事件流 |
| `/scratch <regex>` | 在被卸载结果里检索，命中最多 5 条 |
| `/approve y\|n\|a` / 审批态下直接 `y\|n\|a` | 解挂 `withApproval`；`a` = autoApprove（仅本会话） |
| `/diff` | 显示 `write_file` 前后文本 diff（± 行，最多 40 行） |
| `/cancel` `/quit` | 触发 `budget.cancel()` / 关闭 readline |

### 4.3 三个设计约定

1. **TUI 不是第二套 harness**。它只读 `h.tuiState()` 与 `injector.select()`；将来 Electron renderer 与独立 MCP server 读同一份状态。这条直接对上 forge README 的「GUI + MCP 双表面」教训——**双表面可以，双数据源不行**。
2. **必须有非 TTY 降级**。`renderStatic()` 输出纯文本，CI/日志/管道可用；实测 `node harness/bin/wcc-harness.mjs tui --static` 正常输出状态栏与命令提示。避免「只有真终端才能验证」的黑盒。
3. **中文宽度要自己算**。`displayWidth()` 把 CJK 计 2 列，`clip()` 按显示宽度截断，否则状态栏必然错位。已知限制：组合 emoji / 零宽字符未处理，够用即可，不引 `string-width`。

**🔴 未做**：交互式 TUI 真机验收（本次环境非 TTY，只验证了静态渲染与命令分派单测）；流式 token 增量刷新；鼠标/分屏；把 `write_file` 的 diff 自动挂到审批流。

---

## 5. 隔壁 WC3 有什么可借鉴的

> 来源可信度标注：✅ 官方文档 / README 级；🟠 二手资料（技术博客、百科、DeepWiki 概览），未逐行读源码核验。**下面每张表都不把二手资料当定论。**

### 5.1 w3x2lni —— 最值得抄的一条：**二进制地图 → 文本 IR → 可重建**

✅ **2026-11-10 已升级为官方文档 + 源码核实**（原为 🟠 二手博客，且其中 `metadata.ini` / `backend_merge` 两个说法未在官方源码中找到，已移除）：`docs/zh-cn/insider.md` 原文确认存在第四种隐藏格式 **`Full`**，流程为 `Map → Full → Obj/Lni/Slk`（`Core Frontend` / `Core Backend`）；`docs/zh-cn/README.md` 确认 **Lni 是对 git 友好的文本文件夹格式**、**Obj↔Lni 无损**、Slk 才做去冗余/脚本压缩；元数据来源官方写的是 **`xxxmetadata.slk`**（WE 与 War3 各一套，Obj 用 WE 的、Slk/Lni 用 War3 的），不是 `metadata.ini`。
> ✅ 官方 CLI 帮助（`script/locale/zhCN/raw.lng`）与源码（`script/backend/*.lua`、`script/map-builder/archive_mpq.lua`）也已核实：`w2l lni|obj|slk|mpq|config`，`lni` 出文件夹、`obj/slk` 出 `.w3x`，写盘走 StormLib FFI。完整命令与约束见 [MAP-COMPILE-PIPELINE.md §3.2](MAP-COMPILE-PIPELINE.md)。
> 🔴 **边界**：官方 README 的 TODO 仍列着「地形文件」「转换 doo, w3s, w3r 等文件」——**Lni 的文本化并不覆盖全部二进制层**，别把它当成完整 IR。

> ✅ 补证（2026-11-09，GitHub REST API 实测）：上游仓库是 **`sumneko/w3x2lni`**（173★ / **GPL-3.0** / 最后 push 2025-12-18），
> 不是 `actboy168/w3x2lni`（该地址 404）。因 GPL-3.0，**只可外部调用其 `w2l.exe`，源码不可并入 MIT 的 WCC**。
> 另：GitHub API 显示 `stijnherfst/HiveWE` 现为 **AGPL-3.0**（490★ / 2026-10-11），与 `FORGE-INTEGRATION.md §2` 记录的「HiveWE GPL-3.0」不一致，
> 待复核 CREDITS 所指版本/移植时点，暂不改写原结论。
> 地图生成的完整落地方案见 [MAP-GENERATION-PLAN.md](MAP-GENERATION-PLAN.md)；「中间文件 → 编译成地图」的专项链路见 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md)。

| 对 Harness 的启示 | WCC 现状 / 下一步 |
|---|---|
| **AI 永远不要直接改二进制 `.w3x`**；应先改文本 IR，再 build 回地图 | 现在 Sidecar 有 `build_map` / `table_import`，但**没有独立的 `.wcc/ir/` 文本中间表示** 🔴 |
| **IR 可 diff / 可回滚 / 可 code review**，是「AI 改图可信」的前提 | 建议：`.wcc/ir/{units,quests,dialogues,triggers}.json` + `wcc.ir.diff` / `wcc.map.snapshot` 两个脚本 |
| **编辑期无损、发布期优化分离** | `lua_check` 应在每次写入后跑（编辑期），压缩/合并只在 `build` 时做；目前两者都混在 `build_map` 里 🟠 |
| **元数据驱动校验**（字段类型） | 物编字段类型表可反哺 `codegen_run` 的参数校验，减少 AI 编造字段 |

### 5.2 WurstScript / WurstStdlib2 —— **编译期即质量门禁**

✅ 官方 `wurstlang.org/stdlib` 与仓库 README：`wurst.build` 是项目配置文件；`@compiletime` 函数在编译期执行，`UnitDefinition` / `AbilityDefinition` 等对象编辑 API 在编译期生成 `war3map.w3u` 等二进制；`ObjectIdGenerator` 生成不与原生对象冲突的 ID；标准库带 `*Tests` 包与 `AGENTS.md`、`CONTRIBUTING.md`；VS Code 扩展自动安装编译器与 JRE，用户不必手工配环境。

| 启示 | WCC 对应 |
|---|---|
| **「开箱即用」的标杆是工具链自动装好**，不是让用户配环境 | 直接印证 `FEASIBILITY-REVIEW.md` 的 🔴 打包/硬编码 node 路径问题 |
| `@compiletime` = 生成期校验，等价于 hooks 的必然性 | 已落地 `file.write → lua_check` ✅；可再加 `build → 全量 check + test` |
| **不冲突 ID 生成器**：AI 最容易编错的就是物编 ID | `codegen.js` 应加 `allocObjectId()`，从已用 ID 集合分配 🟠 |
| **仓库里放 `AGENTS.md` 作为 agent 契约** | 与 Kiro `.kiro/steering` 同构：WCC 应有一份 `AGENTS.md`（或 `.wcc/steering/`）让**任何 harness**（Claude Code / WCC / 未来的 MCP）读到同一份铁律 🔴 |

### 5.3 YDWE / JassHelper —— **预处理层与双表面**

🟠 DeepWiki 概览 + 百科：YDWE 基于官方 WE 扩展，集成 w3x2lni 做格式转换、JassHelper 把 vJass 编译成标准 JASS、提供 Lua 脚本支持、虚拟 MPQ、插件体系；vJass 本身必须经 jasshelper 二次编译才能被引擎识别（百度百科）。

| 启示 | WCC 对应 |
|---|---|
| **「写的是 A，跑的是 B」必须有显式编译层**，且编译失败要有可读诊断 | WCC 的 `wcc-lib` 是运行时库，`lua_check` 是静态检查，但**没有「生成 → 编译 → 报错回喂模型」闭环** 🟠 |
| 插件体系让能力可插拔 | 对应 `middleware.use()` 可开关层 ✅ |
| YDWE 的「GUI 增强 + 脚本编译器」双表面 | 又一次印证：UI 与工具层必须共用同一 registry，别写两套 |

### 5.4 wc3-forge —— **MCP 是协议，不是代码合并**

✅ 前几轮实测（`FORGE-INTEGRATION.md` / `FEASIBILITY-REVIEW.md`）：Go + Wails 单二进制；`mcp/` 是 TypeScript stdio server，是 152 个工具的 source of truth；README 明写「加功能通常要 GUI + MCP 双表面同时改」；GPL-3.0-or-later（源自 HiveWE 移植义务）；`docs/forge-protocol.md` 已记下 JSON-RPC/NDJSON/lockfile 协议事实。

| 启示 | WCC 对应 |
|---|---|
| **工具目录是单一事实来源** | 已落地 `tool-inject.js` 的 `mergeCatalog()`：传真实 Sidecar `tools.list()` 进来时以真实 schema 为准，避免双份维护 ✅ |
| 双表面要求 → 成本陡增 | WCC 的 TUI / Electron / MCP 都要读 `createHarness()` 同一状态 ✅（设计上），🔴 代码上还没接 |
| 别把 GPL 代码搬进 MIT 仓库 | 本次 `harness/` 全自有实现，只抄设计，未复制任何 forge / Kiro / Deep Agents 源码 ✅ |

### 5.5 一句话总结「隔壁 WC3」

> **WCC 缺的不是 AI，是「可 diff 的文本中间表示 + 编译期门禁 + ID/元数据校验」这三十年老工具链已经解决过的问题。**
> Kiro 给的是「怎么组织 Agent」，WC3 工具链给的是「怎么让领域产物可被机器安全地改」。这两块合起来，才是「AI 编辑战役/地图」的完整答案。

**优先级建议**：① `AGENTS.md`/steering 契约（几小时，立刻让外部 harness 也能守铁律）→ ② `.wcc/ir/` 文本 IR + diff（决定长战役可用性）→ ③ `allocObjectId()` 与元数据校验（决定生成物编是否可信）→ ④ 生成→编译→报错回喂闭环。

---

## 6. 与既有战略文档的关系（不推翻，只补实）

| 文档 | 本文带来的变化 |
|---|---|
| `FEASIBILITY-REVIEW.md` 论断 A | 「🟠 工程待补」中**上下文工程与质量门禁**这一块已补上并验证；**打包分发红线仍在**（`build` 仍是 echo 占位、启动器仍硬编码 node） |
| 论断 B | 代码二分照旧；`harness/` 是**第三个物理隔离目录**（不在 workspaces、不进 lock、不进 forge），与「两条提交线」原则一致 |
| 论断 C（C2 优先） | `forge_*` 默认不注入 + 按需 external 审批，是 C2 的具体实现；**C1（给 forge 提 PR）仍未做，也未发任何 Issue** |
| `FORGE-INTEGRATION.md` L2 | `createHarness()` / `dispatch()` 已是可 import 的库形态，为独立 stdio MCP server 铺好路；**server 本身仍未写** |
| `HARNESS-REFERENCE.md` | 其第 3 节 10 条落地动作，本文 §1 逐条对账；第 7 节「未动代码」的状态已过期，已在文首加状态更新 |

---

## 7. 下一步（按 ROI 排序，均未执行）

| # | 动作 | 级别 | 说明 |
|---|---|---|---|
| 1 | 把 `createHarness()` 接进 `agent.js`：`assembleSystem()` 改用 steering、`toolDefs()` 改用 injector、`guard < 8` 换成 budget、工具结果过 scratch、取消时 `patchToolCalls()` | 🔴 | 这一步才让「调研」变成「产品行为」；改完须重跑 27+15 tests |
| 2 | `server.js` 暴露 `/harness/state` `/harness/steering` `/harness/spec` `/harness/hooks`，Electron renderer 与 TUI 共用 | 🔴 | 双表面共用单一数据源 |
| 3 | 补 `AGENTS.md`（仓库级铁律）+ `.wcc/ir/` 文本 IR + `wcc.map.snapshot/diff` | 🟠 | 见 §5 |
| 4 | provider 下拉接 `config-store.save(providerPatch(id,key))` | 🟠 | 预设已有，UI 未接 |
| 5 | 最小 `electron-builder` 便携包 + 去掉启动器硬编码路径 | 🔴 | 产品化最后一步，`FEASIBILITY-REVIEW.md` 已标红线 |
| 6 | 真 forge 联调：`WC3FORGE_EXE` 在新 shell 生效后跑 `/health` 出现 `forgeConnected: true` | 🟠 | 当前 `probe` 仍是 `(unset)`，**不要虚报已连** |
| 7 | 独立 stdio MCP server（`packages/wcc-mcp`），与 forge 并列注册 | 🟠 | L2 路线；注意 `packages/wcc-mcp` 目前只在文档里出现过，**仓库里并不存在** |
| 8 | 交互式 TUI 真机验收 + 流式刷新 + diff 挂审批 | 🟠 | 非 TTY 环境无法验 |

---

## 8. 验证记录（可直接复跑）

```bat
cd /d D:\净土\Wcc-deskTop

node --test harness/test/harness.test.js
:: 15 tests / 15 pass / 0 fail

npm test
:: @wcc/sidecar 25 pass + @wcc/lua-check 2 pass = 27 pass

npm run check
:: wcc-lua-check: 13 files, 0 issues, ok=true

node harness/bin/wcc-harness.mjs demo
:: steering / spec / scratch / hooks / 工具注入 / 预算 / TUI 全链路离线跑通
node harness/bin/wcc-harness.mjs steer --intent "写一个 boss 战" --files src/map/chapter_01.lua --max 6000
node harness/bin/wcc-harness.mjs tools --intent "改地图地形，放一批单位"
node harness/bin/wcc-harness.mjs hooks wcc-lib
node harness/bin/wcc-harness.mjs tui --static
node harness/bin/wcc-harness.mjs selftest
```

`demo` 的真实输出要点（2026-11-09）：

```
A 上下文: matched=6 份 | injected=2 份 | dropped=4 | used=8000/50725 saved=42725
B 空上下文: matched=1 份 | injected=1 份 | dropped=0 | used=4000/50725 saved=46725
spec: init=requirements,design,tasks  stage=executing  1/5
scratch: offloaded=true  bytes=8681  grep("u42")=1
hooks: file.write -> lua_check:true
工具注入: 10/29  savedChars=1603   budget: turn=1 tok=3734/60000
provider: DeepSeek/deepseek-chat configured=false（未填 Key，离线）
```

> `demo` 不联网、不调模型、不启动 forge、不写仓库（用系统临时目录并清理）。`steering annotate --write` 是**唯一改动仓库已有文件**的动作，已单独核验：8 files / +50 lines / 0 deletions。

---

## 9. 许可证与归属

| 项 | 说明 |
|---|---|
| WCC / `harness/` | MIT，全部自有实现；**未复制** Kiro（闭源）、Strands Harness（Apache-2.0）、Deep Agents（MIT）、spec-kit（MIT）、wc3-forge（GPL-3.0）任何源码 |
| 借鉴方式 | 只读公开文档描述的设计；provider 端点为公开文档/控制台常见配置（2026-11-09 核对，模型名以厂商控制台为准） |
| forge 边界 | 不捆绑 `wc3-forge.exe`、不复制 Go/TS 代码；只按公开协议事实通信 |
| 外部动作 | 无 commit、无 push、无 Issue、无 PR |
