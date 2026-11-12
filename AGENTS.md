---
id: agents
mode: always
priority: 100
maxChars: 4200
---
# WCC 仓库级 Agent 契约（AGENTS.md）

> 本文件是所有在此仓库工作的 Agent / Harness 的**共同入口**。
> **它不复述编程铁律全文**——规范只有一份权威：`wcc-skill/skill.md`。
> 若两者冲突，以 `wcc-skill/skill.md` 为准；本文件只负责指路 + 仓库级工程约定。

## 1. 唯一权威与分工（避免双数据源）

| 要找什么 | 去哪读 | 说明 |
|---|---|---|
| 编程铁律（语言/沙箱/内存/零全局污染） | `wcc-skill/skill.md` §2 | **唯一权威**，本文件不复制 |
| 代码输出协议（Brief / WE 前置 / Lua 源码 / 集成） | `wcc-skill/skill.md` §4 | **唯一权威** |
| 违禁行为、质量检查清单 | `wcc-skill/skill.md` §5 / §6 | **唯一权威** |
| 条件注入的规范文档 | `wcc-skill/knowledge/*`、`patterns/*` | 由 `harness/src/steering.js` 按 front matter 条件选择 |
| 当前开发主线与排期 | `docs/NEXT-DEVELOPMENT-PLAN.md` | **唯一排期依据** |
| 项目开发目标（最终目标 / 当前状态） | `docs/NEXT-DEVELOPMENT-PLAN.md` 第一部分「开发目标」 | **唯一权威陈述**；README 只留一句话定位 + 指针，本文件不复制 |
| 安装 / 启动 / 各入口使用说明 | `README.md`「使用指南」章节 | **唯一使用入口**，不另建手册 / 文档地图 |
| 实现记录 / 编译链 / 地图计划 | `docs/HARNESS-IMPLEMENTATION.md` 等 9 篇 | 最新主线文档 |
| 历史计划 | `PROJECT-PLAN*.md`、`项目状态与改进报告.md` | **快照，不作排期依据** |

裁决顺序（冲突时）：**代码事实 > 最新主线文档 > 历史文档**。

## 2. 仓库级工程约定（这些不在 skill.md 里）

1. **不许静默假装成功**。构建有缺失模块必须抛错不写产物；检查有 error 必须阻断；
   postinstall 不得因 `package.json` 存在就谎报 Electron 可用。
   `build` 脚本不得用 `echo` 占位冒充完成。
2. **验证命令**（每次改动后至少跑前两条）：
   - `npm test` — sidecar + lua-check + harness 全量
   - `npm run check` — Lua 静态检查；`ok=true` 仅表示 0 error，warning 是复核提示
   - `node harness/bin/wcc-harness.mjs demo` — harness 离线全链路
3. **证据等级**：✅ 本机实测 / 🟠 文档或二手 / 🔴 未实现未验证。
   写 ✅ 必须附可复现命令与输出；禁止把"计划中"写成"已完成"。
4. **分支与远端 —— 单一逻辑数据源**：本地 `main`、GitHub `origin/main`、Gitee `gitee/main`
   是**同一份数据的三处副本**，不再区分「主仓库 / 镜像 / 谁更新」。每次推送必须**两端同时同步**：
   `npm run sync`（推两端并校验一致）、`npm run sync:check`（只校验不推）。
   **禁止只推一端、禁止 `--force`**；脚本检测到远端分叉会直接拒绝，此时先 `fetch` + `merge/rebase` 再同步。
   > ⚠️ 术语消歧：本节说的「单数据源」只针对 **git remote**。§1 标题与 §2.5 里的
   > 「避免双数据源 / 双数据源不行」指的是**文档权威（只认 `wcc-skill/skill.md`）**与
   > **harness 运行时状态（TUI / renderer 共用同一实例）**，与 GitHub/Gitee 无关，**始终有效，不得删除**。
5. **harness 硬约束**：零 npm 依赖、零 Python、无 LangGraph；
   **双表面可以，双数据源不行**（TUI / renderer 共用同一份状态）。
6. **不入库**：`.lnk`、`.wcc/config.json`（含 apiKey）、令牌、`.w3x` 二进制、本机绝对路径。
7. **范围红线**：不重做地图编辑器、不引入向量库、不复制 GPL/AGPL 源码、
   不升级/不替换本机 War3 1.26 游戏；AI 永不直接改地图二进制，只写文本 IR。

## 3. 现状速记（2026-11-11，以代码为准）

- ✅ **P1 / P1.5 已接入**：`createHarness()` 在 `agent.js`（steering / injector / budget /
  scratch / hooks / 工具路由），`server.js` 暴露 `/harness/*` 并共用同一实例；显式注入仓库根
  唯一 `AGENTS.md`，`/health` 为真实探测，renderer 有状态面板，`/check` 复用同一 `lua_check`。
- ✅ **产品侧管线已接线（11-12）**：每次模型调用都跑 7 层 pipeline（planning/spec → steering →
  tools → compaction → approval → budget → scratch）。产品传自己的 messages 与每轮新 budget
  （`recordHistory:false` / `budgetOverride`），**只有一份会话历史**；`/harness/pipeline`、
  `/harness/tui-state`、`/harness/annotate` 暴露同一实例，CLI TUI 用 `--remote` 读产品状态。
- ✅ **P2 地基已落地**：`wcc.map.snapshot` / `diff` / `verify` 三个文本 IR 闸门（纯 node、
  零依赖）；`verify` 缺外部序列化器时 fail-closed。`wcc-skill/knowledge/wc3-object-ids.md`
  是**覆盖率 0 的骨架**，绝不编造四字码。
- ✅ **P2-6 / G4 已交付**：`wcc.map.set_script` 参数契约（强制 `targetPatch` / `strategy`，
  `script-only` 拒绝并警告「WE 重存会丢失」，无逐字节证据或真 adapter 一律 fail-closed、永不写图）；
  示例战役 3 章 + `manifest.json` 双轨字段（`mapGenerated: false`）。真机进图仍 🔴。
- 🔴 **P2 阶段 A/B 未闭环**：仓库零 `.w3x`，真实 round-trip / WE 打开均未验证，按用户自备
  1.31+ 环境**条件触发**，状态行不推进。`build_map` 只产 `dist/build/war3map.lua`。
  2026-11-11 用户确认：本机魔兽资产**至少 3 天后**才有、当前网络/资源不支持下载；
  期间禁止联网取数与编造 rawcode，**以用户确认就绪为准，不按日期自动解封**。
- 本机 Electron 二进制缺失（`npm run build:desktop` 如实 EXIT=1，打包属 P3）；真实模型 key 未配置。
- 本机 War3 1.26 只支持 JASS。**B+A 双轨已拍板**：1.31+ / Lua 主线，本机 1.26 只读保留、
  不升级不替换；`manifest.json` 记 `targetPatch` 与 `language`；1.31+ 环境由用户自备。
- 现行基线：`npm test` 76/76（sidecar 40 + lua-check 2 + shared 1 + harness 33）、
  `npm run check` 15 files / 0 errors / 3 warnings、CLI selftest 33/33、`npm run docs:check` 10 PASS。
  排期与执行记录见 `docs/NEXT-DEVELOPMENT-PLAN.md`（正文 + 附录 A）。
