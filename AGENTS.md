---
id: agents
mode: always
priority: 100
maxChars: 2600
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

## 3. 现状速记（2026-11-10，以代码为准）

- ✅ **P1 已接入**：`createHarness()` 已接进 `packages/wcc-sidecar/src/agent.js`
  （steering 条件注入 / injector 按需工具 / budget 停止条件 / scratch 卸载 /
  hooks 门禁与报错回喂），`server.js` 暴露 `/harness/*` 并共用同一实例。
  它仍零 npm 依赖、不进 workspaces，CLI 可独立运行。
  未完成的是 P2 进图、P3 打包分发（见 `docs/NEXT-DEVELOPMENT-PLAN.md` §11）。
- `build_map` 只产 `dist/build/war3map.lua` 脚本包，**不产 `.w3x`**；仓库零 `.w3x`。
- 本机 Electron 二进制缺失，`dev:desktop` 起不来；sidecar / check / harness 不依赖它。
- 本机 War3 1.26 只支持 JASS，`war3map.lua` 不能在本机试玩。目标补丁决策见
  `docs/MAP-COMPILE-PIPELINE.md` §5.3（**未拍板前 P2 全部返工风险**）。
