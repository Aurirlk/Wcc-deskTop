# WCC 下一步开发计划

> **状态：P2 进行中（条件触发）；P0 / P1 / P1.5 已归档见附录 A。**
>
> **基线**：HEAD 以 `git log -1` 为准。本地 `main`、GitHub `origin/main`、Gitee `gitee/main` 是**同一份数据的三处副本**（单一逻辑数据源 + 两个镜像），不再区分主仓库 / 镜像 / 谁更新；每次推送用 `npm run sync`，只校验用 `npm run sync:check`。
> **裁决顺序**：代码事实 > 最新主线文档 > 历史文档（快照）。
> **证据等级**：✅ 本机实测 / 🟠 官方文档或二手 / 🔴 未实现未验证。写 ✅ 必须附可复现命令与输出。

## 防过期机制（本文件硬约束）

1. **物理分区**：全文只分「第一部分 计划正文（只写未做的）」与「附录 A 执行记录（只写已做的）」。正文禁止出现「已完成 / ✅」；附录禁止出现「待办 / 下一步」。
2. **状态行只描述当前阶段**，禁止全局性的「未开工」断言。
3. **阶段推进只允许两个动作**：把该阶段任务表整块移入附录 A（附实测命令与输出）→ 改状态行一词。不得就地改口吻、不得在正文里追加完工声明。
4. **不跟踪具体 commit**：基线不写 hash；历史 commit 只出现在附录 A 的记录里。
5. **指针只用文档级链接**，不带 `§号`；涉及本文件其他部分时用稳定标题（如「见附录 C」）。

---

# 第一部分 · 计划正文

## 0. 现状

`harness/` 已接入主产品 Agent Loop，`server.js` 暴露 `/harness/*` 并共用同一实例；产品侧**仍未接线**的是 7 层 pipeline / `prepareTurn` / spec 每轮注入 / TUI / `annotateSteering`（仅 CLI 与自测使用；产品化见 P3 / P4 纲要）。状态虚标与门禁空转的修复记录见附录 A.4。桌面 UI → Sidecar → Agent → 工具 → Lua 静态检查 → `war3map.lua` 脚本包这条链代码上可跑；**「一句话 → 真实模型生成 Lua → 检查 → 产出可试玩 `.w3x`」端到端未通**。硬断点在 `build-map.js` 只产文本脚本包、仓库零 `.w3x`、无地图数据层。

## 1. 现行基线（实测，非文档声称）

| 命令 / 检查 | 实测结果 |
|---|---|
| `npm test` | 60 pass / 0 fail（sidecar 37 + lua-check 2 + shared 1 + harness 20） |
| `npm run check` | 13 files / 0 errors / 3 warnings / ok=true（warning 为复核提示，不阻断） |
| `node harness/bin/wcc-harness.mjs demo` | EXIT=0，离线全链路 |
| `node harness/bin/wcc-harness.mjs selftest` | 20/20 |
| `node scripts/optional-electron.js` | `electron NOT usable: dist folder missing`，`dev:desktop` 起不来 |
| `npm run build:desktop` | EXIT=1 + `electron-builder packaging is P3 and is NOT implemented`（不再假成功） |
| 全仓 `.w3x` / `.w3m` | 零个 |
| 真实模型 key | 未配置；无 key 时 `/chat` 走 `offlinePlan()` 只回文本、零 tool_calls |
| `/health` 的 `harnessWired` / `harnessAgentsFile` | 运行时探测（agent 能力 + 共用实例）；`AGENTS.md` 命中 |

桌面默认 `PROJECT = examples/demo-campaign`（该目录无自己的 `AGENTS.md`）；`server.js` 与 `agent.js` 显式传入仓库根唯一那份 `AGENTS.md`，实测 `/harness/steering` 命中 `agents`、`/health` 的 `harnessAgentsFile=AGENTS.md`。

## 2. 已定决策与文档分层

### 2.1 第 0 号决策：B+A 双轨（已拍板）

- 以 **1.31+ / Lua 为开发主线**；本机 War3 1.26.0.6401 **只读保留，不升级 / 不替换 / 不修改**（含 `change\` 版本包）。
- 1.31+ 验证环境由用户自备，AI 不代装。
- `manifest.json` 必须记录 `targetPatch` 与 `language`；P2 阶段 B 走 **E3 Lua 注入**（MCP `wc3_set_durable_script` 双写 / `w2l obj`）。JASS / E2 仅保留为**不施工**的可选支线。
- 1.31+ 环境未就绪时，阶段 A/B 按「条件触发」处理，只交付契约与单测并标 🔴，**状态行不推进，不虚报已打通**。

### 2.2 文档分层

| 归类 | 文件 |
|---|---|
| **主线依据** | 本文件（唯一排期）、`AGENTS.md`（仓库契约，`mode: always`）、`README.md`、`docs/P0-DISPOSITIONS.md`、`docs/HARNESS-IMPLEMENTATION.md`（实现记录）、`docs/MAP-COMPILE-PIPELINE.md`（编译链与 IR 唯一契约）、`docs/MAP-GENERATION-PLAN.md`（地图计划）、`docs/ASSETS-GUIDE.md`、`docs/NEW-MACHINE-SETUP.md`、`docs/DEPLOYMENT-SHORTCUTS.md`；代码事实：`harness/**`、`packages/**`、`apps/**`、`wcc-skill/**`、`scripts/**` |
| **参考（结论有效，非排期）** | `docs/FEASIBILITY-REVIEW.md`、`docs/FORGE-INTEGRATION.md`、`docs/HARNESS-REFERENCE.md`（§7 已作废）、`wcc-skill/skill.md`（规范唯一权威）、`docs/DEVELOPMENT-NOTES.md` 等旧调研的事实性结论 |
| **快照（不作进度依据）** | `PROJECT-PLAN.md`、`PROJECT-PLAN-2.0.md`、`项目状态与改进报告.md`（未被 git 跟踪）、根 `wcc-ai-blueprint.md` / `wcc-architecture.md` / `wcc-skill.md`、`attic/`、`.novel-workflow/`、`.workbuddy/memory/` |

## 3. 路线图总览

| 阶段 | 目标 | 依赖 | 完成标志 |
|---|---|---|---|
| **P2** | 文本 IR + 真实 `.w3x` 读改回写 + E3 Lua 脚本进图 | P1.5；阶段 A/B 依赖用户自备环境 | `MAP-COMPILE-PIPELINE.md` 两阶段 P0 全过 |
| **P3** | 打包分发、GPL 红线、真 forge 联调、独立 MCP server、TUI 真机验收 | P2 全过 + Electron 可用 | 新机器双击即用 |
| **P4** | forge PR 生态 | P3 中踩到真实 bug | 议题来自真实需求，不编造 |

P0 / P1 / P1.5 的任务表与实测记录见附录 A。

**P2 未通过前，仓库内任何「已支持地图生成 / 已打通编译链」的说法都不成立。**

## 4. P1.5 收尾 → 附录 A.4

该阶段的任务表与实测记录已整块移入附录 A.4，正文不再保留它的任务条目。

## 5. P2 进图（详细，条件触发）

**统一前置**：只写 `.edited.w3x` 副本、改前快照、WE 中打开的图先关闭、GUI 触发器改后 Save 一次、AI 永不直接改二进制、只写文本 IR；GPL/AGPL 工具（w3x2lni / YDWE / HiveWE / wc3-forge / WurstScript）**只做外部进程调用，源码绝不进 MIT 仓库**；不分发暴雪资产。

**证据等级**：`w2l` 命令 / `grill` / MCP Server 打包 / `mutateWtg()` byte-for-byte 闸门 / durable 双写为 ✅ 上游源码级；`jasshelper` / YDWE 兼容性为 🟠 二手；本机实跑 `w2l`、clone MCP Server、装 `grill`、`mdx-m3-viewer` 逐字节验证、1.26 classic `wtg` 序列化器、`wpm`/`shd` 规则、1.31+ 环境、`WC3FORGE_EXE` 均为 🔴 未做未验。所有 🔴 一律写「没有」。

| 组 | 任务 | 文件 | 验收 | 外部依赖 | 未就绪时降级 |
|---|---|---|---|---|---|
| **G0** | P2-1 物编 ID 字典 | 新建 `wcc-skill/knowledge/wc3-object-ids.md`（`mode: conditional`）；数据取本机 `Units\UnitData.slk` 等或 `w2l mpq` 或 Hive 公开列表；注明 `wcc-objects.lua` 的 `RegisterUnit` 不校验 rawcode | `steering list` 命中；含 `'hfoo'` / `'n001'` 反例 | 本机 SLK 🟠 | 只写已核实的少量四字码 + 来源与覆盖率，标 🔴 不完整，**绝不编造 ID** |
| **G1** | P2-2 `wcc.map.snapshot` / `diff` / `verify` | `harness/src/scripts.js` 注册并实现（纯 node + `spawnSync`，零 npm 依赖）；`verify` 范本为「不能无损重建就拒绝写」；`wcc.map.build` 的 declared-only 占位可保留 | snapshot 原图 sha256 不变；diff 可读可 `apply -R`；verify 不一致**必须拒写**；含负例测试；**禁止 echo / `cmd:null` 冒充完成** | snapshot/diff 本机可闭环；verify 需 `mdx-m3-viewer` / `w2l lni` 🔴 | 工具缺失返回 `{ok:false, reason:'external-tool-missing'}` 并阻断写图，标 🔴 未实测 |
| | P2-3 三条硬约定 | `docs/MAP-COMPILE-PIPELINE.md` §6.1 + 附录 C | AI 产物只含 `*.json` / `*.ini` / `script/*`；`manifest` 含 `targetPatch`+`language`；`build/` 在 `.gitignore` 且可从 IR 全量重建 | — | — |
| **G2 阶段 A**（刻意不写任何脚本） | P2-4 A1–A4：选 1 张官方 Scenario 小图 → 读 `war3mapUnits.doo` 且 round-trip 逐字节一致 → 只平移 1 个单位 128，写 `xxx.edited.w3x` → WE 打开 + Save + Test Map | 依据 `MAP-COMPILE-PIPELINE.md` 阶段 A；产物不入库 | A2 sha256 前后一致；A3 原图 hash 不变；A4 截图与日志回流 | 真实 `.w3x` + `mdx-m3-viewer` / `w2l lni` 🔴 + WE 可用 | 标 🔴 未闭环，只交付 round-trip 设计 + **合成字节块单测**；不得据合成夹具写「WE 能打开」 |
| **G3 阶段 B**（E3 Lua 主线） | P2-5 B1：`manifest.json` 填 `targetPatch="1.31+"`、`language="lua"`；`war3map.j` 仅保留可选支线目录、不施工 | `.wcc/ir/<map-id>/manifest.json` 模板入 docs，实例不入库 | JSON 两字段有值 | — | — |
| | P2-6 B2：最小脚本经 **MCP `wc3_set_durable_script` 双写 / `w2l obj`** 注入；`wcc.map.set_script` 必须带 `targetPatch`+`strategy`（`script-only\|durable\|gui`），`script-only` 明确警告「WE 重存会丢失」，绝不静默成功 | `harness/src/scripts.js` 新增 `wcc.map.set_script`；外部仅 `spawnSync` | 产物内脚本可核对；`script-only` 返回警告**且不写图**；`harness/` 内无 JASS 主线痕迹 | 用户自备 1.31+ + MCP Server 或 `w2l obj` 🔴 | 标 🔴 未验证，只交付**参数契约 + 假 adapter 单测**（缺 targetPatch 拒绝、script-only 带警告） |
| | P2-7 B3/B4：WE Save 后重读确认脚本未被覆盖（**durable 分水岭**）→ Test Map 看到输出 + 日志回流 + `lua_check` | 依据 `MAP-COMPILE-PIPELINE.md` 阶段 B | B3 重读哈希比对；B4 截图/日志 + `npm run check` 0 errors | 同 P2-6 + 真实 WE | 同上，标 🔴 不虚报 |
| **G4** | P2-8 补示例资产：`tables-sample.json` 扩到 3 章、manifest 双轨字段、demo README 不再虚标 `.w3x` | `examples/demo-campaign/README.md`、`tables-sample.json`、必要时 `src/chapter_02.lua` / `chapter_03.lua` | 3 章样本齐；`npm test` 不回退；README 无「已有 `.w3x`」 | 无（纯文本可闭环） | 先补数据 + 否定注记，章节脚本标「示例，未进图」 |

**环境就绪检查表**（每次开工前逐条确认，全过才允许把阶段 A/B 从「条件触发」改为「可执行」）：① 1.31+ 客户端可用；② 一张非加密真实 `.w3x` 已选定并备份；③ WE 可打开 + Save + Test Map；④ `w2l` / `mdx-m3-viewer` / MCP Server 至少一条注入路径可用且已实测 round-trip。

## 6. P3 / P4 纲要

**P3 产品化与分发**（触发：P2 两阶段 P0 全过 + Electron 可用 + GPL 红线书面定死）：最小 `electron-builder` 便携包与去启动器硬编码 node 路径；打包前定死「安装包不捆绑 `wc3-forge.exe`」；真 forge 联调（probe unset 不得虚报已连）；独立 stdio MCP server `packages/wcc-mcp`（当前不存在，仅进程间协议）；交互式 TUI 真机验收 + 流式刷新 + diff 挂审批。

**P4 外部生态**（触发：P3 真 forge 联调中踩到**真实** bug）：议题必须来自真实 bug / 真实需要，不编造；遵守 `FORGE-INTEGRATION.md` 五条 ❌ 与 `FEASIBILITY-REVIEW.md`「不要把增强 MCP 功能当首个 PR 目标」。

## 7. 验收、提交与红线

### 7.1 每阶段必跑

```bash
npm test                                   # 基线 60/60；代码改动须追加测试并说明新增数
npm run check                              # 13 files / 0 errors / 3 warnings / ok=true
node harness/bin/wcc-harness.mjs demo       # EXIT=0
node harness/bin/wcc-harness.mjs selftest   # 20/20
node scripts/optional-electron.js           # 必须报 NOT usable，不得谎报 present
npm run sync:check                         # 推前校验三处一致
```

P2 追加：三脚本负例单测、sha256 比对输出、WE / Test Map 截图与日志回流。

### 7.2 WP9 收尾门禁

**一条命令**：`npm run docs:check`（实现见 `scripts/check-doc-consistency.mjs`）。退出码非 0 即失败，逐条列出命中文件与行。

| # | 断言 | 范围 |
|---|---|---|
| 1 | 主计划不再自相矛盾、无硬编码 commit、无悬空锚点 | 主计划自身 |
| 2 | 无活跃的「决策未定」口径 | 全仓 `.md`（排除主计划与工具/快照目录） |
| 3 | 无过期回归基线、无「主仓库 / 手工双推」旧措辞 | 同上 |
| 4 | 无错误进图指引、无虚构地图文件、无第二套 IR 目录树 | 入口指引文档 + `docs/` |
| 5 | `AGENTS.md` 仍被 steering 以 `mode: always` 命中 | 实跑 CLI |
| 6 | 4 个保留未跟踪项与 `.workbuddy/` 未被 git 跟踪 | `git ls-files` |

> 主计划因需**描述**待清理口径，在断言 2–4 中被排除；检查用的模式字符串只存在于 `.mjs` 脚本，不写进 `.md`，避免自命中。

### 7.3 证据与提交

- 附录 A 每条记录带「可复现命令 + 输出摘录」；每个 🔴 明确写「没有 / 未验证 / 未闭环」，并附**降级后实际交付了什么**，不留空、不写「计划中 = 已完成」。
- 提交前 `git status --short` 核对：4 个保留未跟踪项与 `.workbuddy/` 仍未跟踪；`.w3x` / `*.lnk` / `.wcc/config.json` / 本机绝对路径不入库。
- 只 `git add` 本次已跟踪改动 → commit（新提交，非 amend，不跳 hook）→ **`npm run sync`**（分叉拒绝、禁 force、推后三方校验）→ `npm run sync:check` 复核。脚本在已跟踪文件有未提交改动时拒绝推送，故**必须先 commit 再 sync**；按单数据源口径**禁止**分别 `git push origin main` / `git push gitee main`。
- 状态行推进单独一次「仅状态行」commit 后再 sync。

### 7.4 红线（开工前复述）

不动本机 1.26 游戏与 `change\` 版本包、AI 不代装 1.31+；GPL/AGPL 源码只外部进程调用、绝不进 MIT 仓库、安装包不捆绑 forge；不分发暴雪资产；写图只落 `.edited.w3x` 副本 + 改前快照 + WE 先关图 + 改触发器后 Save 一次 + AI 永不直接改二进制；所有 🔴 如实写「没有」、**禁止 echo 占位冒充完成**、不虚报 forge 已连、不把 steering「命中」虚报成「已注入」；harness 零 npm 依赖 / 零 Python / 无 LangGraph，**双表面可以，双数据源不行**；不重做地图编辑器、不引入向量库；`packages/wcc-shared` 保持冻结（`P0-DISPOSITIONS.md`），不因统一 IPC 名而 import 或产 dist。

---

# 附录 A · 执行记录归档

> 本附录只写已做的。阶段推进时把任务表整块从正文移入此处并附实测命令与输出。

## A.1 P0 基线固化（提交 `03c0e17`）

| 任务 | 落地 | 验证 |
|---|---|---|
| 过期声明校正 | `README.md`、`docs/` 6 篇文首补记、`NEW-MACHINE-SETUP.md` §1、`DEPLOYMENT-SHORTCUTS.md` 改为三处已同步；3 份历史 plan 加快照横幅与「Do Now 已过期」注记 | 全仓 grep 无「仍停在 / push 受阻 / 不要用 GitHub clone」断言 |
| 测试基线统一 | 根 `package.json` 新增 `test:harness`，`npm test` 纳入 harness 与 `@wcc/shared` | `npm test` = 49/49 pass |
| 修 build 假成功 | `build-map.js` 在 `missing.length > 0` 时抛错且在任何写入之前；新增 2 个回归测试 | 空项目 `POST /build` → HTTP 500 + 列出 `src.main`；`war3map.lua` 不存在 |
| 修 Electron 检测 | `optional-electron.js` 校验 `path.txt` / `dist` / 真实二进制 | 输出 `electron NOT usable: dist folder missing (dist)` |
| 质量门禁 | `check.js` 区分 errors/warnings；`hooks.js` 新增 `defaultGateRunner`，`task.complete` 真执行并阻断 error；`blockOnIssues` 默认 true | `npm run check` → 13 files / 0 errors / 3 warnings / ok=true |
| `AGENTS.md` | 仓库根 `mode: always` 指针文档，**不复述铁律**；`steering.js` / `index.js` / CLI 接入 `agentsFile` | `steering list` 含 `{"id":"agents","mode":"always"}` |
| 悬空项处置 | `docs/P0-DISPOSITIONS.md`：`@wcc/shared` 冻结（+ 防呆测试）、`wcc-hotreload.lua` 标注 WC3 不可用 | 防呆测试通过 |

**N1–N6 断点全部已处置**：N1 build 假成功（修）、N2 Electron 软失败（修）、N3 门禁不阻断（修）、N4 漏 harness 测试（修）、N5 `@wcc/shared` 名义包（**冻结**，结论见 `P0-DISPOSITIONS.md`）、N6 `wcc-hotreload.lua` 环境不可达（**标注并排除出分发**，结论见 `P0-DISPOSITIONS.md`）。此项履行 `P0-DISPOSITIONS.md` 对 N6 加标注的承诺。

## A.2 P1 harness 接入（提交 `15a17e7`）

| 任务 | 落地 | 验证 |
|---|---|---|
| 接入 `createHarness()` | 重写 `agent.js`：steering 条件注入替代全量 skill；injector 按需工具替代 `tools.list()` 全量；**每轮新建** `createBudget` 替代 `guard<8`；`scratch.wrapToolResult` 替代 `slice(0,50_000)`；`summarizeHistory` + `patchToolCalls` 每轮修复历史；harness 自有工具路由到 `harness.dispatch()` | `npm test` 57/57；E2E 断言 `wired=true`、`savedChars>0`、`tools.selected<=14`、`budget.turns>=1` |
| 保留离线降级 | 无 key 时 `callModel` 走 `offlinePlan()`；`modelConfig()` 改用 `resolveProvider`（兼容 ollama 免 key） | E2E「offline path preserved」断言零 tool_start |
| mock model E2E | `test/harness-e2e.test.js` 本地 SSE 假模型驱动全链路 | 4 项 E2E 全绿；断言门禁反馈**出现在第二次模型请求**里 |
| `/harness/*` 端点 | `server.js` 单个 harness 实例传给 agent，暴露 state / providers / steering / tools / spec / hooks / scratch / dispatch；`/config` 用 `providerPatch` | 实机 HTTP：7 层、`AGENTS.md` 命中、`/harness/tools` 省 2590 字符、`spec_status` 正确返回 |
| provider 下拉 | 设置页 `#cfg-provider`；修掉空字符串覆盖预设与 env 镜像未清除两个坑 | 实机 `provider=qwen` → `dashscope.../compatible-mode/v1` + `qwen-plus` |
| 质量门禁回喂 | 写 `.lua` 后触发 `file.write` hook，block 时注入下一轮；`lua_check` 报 error 同样回灌 | E2E 两条独立用例均断言第二次请求含 `[WCC 质量门禁]` |

**回归基线**：`npm test` 57/57（sidecar 35 + lua-check 2 + shared 1 + harness 19）· `npm run check` 0 errors / 3 warnings · `harness demo` EXIT=0 · 三处同步。

**P1 当时的收窄口径**：P1 接入的是 steering / injector / budget / scratch / hooks / 工具路由与 `/harness/*` 端点；当时 renderer 未消费 harness 状态，7 层 pipeline / `prepareTurn` / spec 每轮注入 / TUI / `annotateSteering` 在产品侧未接线。其中 renderer 状态消费、门禁空转与状态虚标已在附录 A.4（WP6–WP8）处置；pipeline 等仍未接线。

## A.3 单一逻辑数据源与双端同步（提交 `7511de4`）

`AGENTS.md` §2.4 确立「本地 / GitHub / Gitee 三处副本 = 一个逻辑数据源 + 两个镜像，不再区分主仓库 / 镜像 / 谁更新」；新增 `scripts/sync-remotes.mjs` 与 `npm run sync` / `sync:check`（推两端、分叉拒绝、禁 force、推后三方校验）；术语消歧明确 §1 文档权威与 §2.5 harness 运行时状态的「双数据源不行」与 git remote 无关、始终有效。

实测：`npm run sync` 快进推两端并校验 `local=github=gitee`；隔离临时 git 仓库验证「只推一端自动补齐 → EXIT=0」「远端分叉拒绝且两端未被改动 → EXIT=1」「脏工作区拒绝 → EXIT=1」；`npm test` 57/57、`npm run check` 0 errors、harness demo EXIT=0。

> 4 个保留未跟踪项（`.novel-workflow/`、`.omo/`、`wcc-core.lua`、`项目状态与改进报告.md`）与 `.workbuddy/` 始终未入库。

## A.4 P1.5 口径统一与产品底座收尾（M0 + M1）

**阶段推进**：状态行由「P1.5 进行中」改为「P2 进行中（条件触发）」；P1.5 任务表整块迁入本附录。附录 A.1–A.3 中的测试数是各阶段当时的实测值，现行基线见第一部分现状。

### M0 文档口径（WP1–WP5 + WP9 门禁）

| 任务 | 落地 | 验证 |
|---|---|---|
| WP1 主计划重构 | 计划正文 / 执行记录物理分区、状态行只写当前阶段、5 条防过期机制；6 处带章节号的悬空指针改文档级链接 | `npm run docs:check` 断言 1 PASS |
| WP2 双轨回填 | 8 个文件「决策未定」改为「已拍板 B+A 双轨」；编译链缺口 #10 转 ✅；历史段落保留原文加注记 | 全仓无活跃决策未定声明；harness 自测通过 |
| WP3 单数据源与基线 | 6 篇文首加历史快照注记、去「主仓库」叙事、手工双 push 改 `npm run sync`、回归基线刷新 | 门禁断言 3 PASS；`npm run sync:check` EXIT=0 |
| WP4 进图指引 | 源码内 `require` 加消歧注记；WE 入口改粘贴 `dist/build/war3map.lua`；删 `demo-campaign.w3x` 虚标 | 门禁断言 4a PASS |
| WP5 IR 与编号 | `.wcc/ir/` 唯一权威定为编译链 §6.1；地图计划内部 P0/P1/P2 改名 M0/M1/M2 | 门禁断言 4b PASS |
| WP9 门禁 | 新增 `scripts/check-doc-consistency.mjs` + `npm run docs:check`，7 条断言，模式串只存 `.mjs` | 7 PASS / 0 FAIL |

### M1 代码侧（WP6–WP8 + WP9 复跑）

| 任务 | 落地 | 验证 |
|---|---|---|
| WP6 `agentsFile` | `server.js` / `agent.js` 用 `REPO_ROOT` 显式传入仓库根唯一那份 `AGENTS.md`（不复制第二份）；`SKILL` 改绝对路径；`/health` 的 `harnessWired` 由硬编码 `true` 改为运行时探测（agent 能力 + 共用实例），新增 `harnessAgentsFile`；注释收窄为「产品进程内单实例，独立 CLI TUI 另建实例」 | `packages/wcc-sidecar/test/agents-file.test.js`：裸项目根起 sidecar，`/harness/steering` 命中 `agents`、`/health` 返回 `harnessWired=true` / `harnessAgentsFile=AGENTS.md`；`createAgent` fallback 用 `examples/demo-campaign` 亦命中 |
| WP7 renderer 与 build | renderer 新增 `refreshHarnessState()` 消费已暴露但零调用的 `harnessState()` / `harnessSteering()` / `harnessTools()`，home 页显示 wired / layers / AGENTS.md / steering / savedChars / selected tools；新增 `/check` 端点复用**同一个** `lua_check` 工具，`#btn-check` 直接把报告写入 `#check-out`（不再转发到聊天）；`build` 去掉 echo 假成功 | `npm run build:desktop` → EXIT=1 + `electron-builder packaging is P3 and is NOT implemented`；实机 `/check?subpath=src` → HTTP 200 `wcc-lua-check: 2 files, 0 issues`，缺目录 → HTTP 500 `ok:false`；`app.js` 命中 `harnessState` |
| WP8 门禁空转 | `defaultGateRunner` 增加 `repoRoot` 回退，并把「项目自身 `src/`」列为候选；`createHarness` 用自身位置推出 `REPO_ROOT` 并传入；`harness/src/index.js` 文首如实标注 pipeline / `prepareTurn` / spec 每轮注入 / TUI / `annotateSteering` 在产品侧 0 调用 | `harness/test/harness.test.js` 新增用例：`createHarness({projectRoot:'examples/demo-campaign'})` 后 `task.complete` → `skipped:false`、`errors:0`、`verdict:allow` |
| WP9 复跑 | 全量回归 + 门禁 + 双端同步 | `npm test` **60/60**（sidecar 37 + lua-check 2 + shared 1 + harness 20）；`npm run check` 13 files / 0 errors / 3 warnings / ok=true；harness demo EXIT=0；CLI selftest 20/20；`npm run docs:check` 7 PASS；`npm run sync` 后三处一致 |

**如实标注**：7 层 pipeline / `prepareTurn` / spec 每轮注入 / TUI / `annotateSteering` 在产品侧仍为 0 调用，本阶段不强行接线（P3 纲要）；`dev:desktop` 与 Electron 二进制仍不可用；真实模型 key 未配置；全仓零 `.w3x`。这些都不写成已闭环。

**排查记录**：WP7 的 `/check` 回归最初写成在同一测试文件内并发启动两个 sidecar 子进程，Windows / Node 22 下触发 `0xC0000409` 使测试进程整体崩溃。手工起服务确认端点本身正常（HTTP 200 / 500 均正确），改为复用同一个子进程后 2/2 通过；不是端点缺陷，也不是掩盖失败。

---

# 附录 B · P 编号映射

`MAP-GENERATION-PLAN.md` 的内部 P0/P1/P2 是**地图子项目阶段**，已改名为 **M0/M1/M2**；本文件保留全项目 P 编号。

| 全项目阶段 | 地图子项目（改名前 → 改名后） | 内容 |
|---|---|---|
| P2-1 | P0① → M0-① | 物编 ID 字典 |
| P2-2 / G1 | P0② → M0-② | snapshot / diff / verify |
| P2-4 阶段 A + P2-6 阶段 B | P0③ → M0-③ | 1 张真实 `.w3x` 读→IR→写回→WE→Save→Test Map |
| P2 之后（不展开） | P1 → M1 | 559 张图索引、手写碎片、双执行层 |
| P4 或更后 | P2 → M2 | 路线②自动过滤 / ③seed / 剧情 IR↔wtg 联动 |

`MAP-COMPILE-PIPELINE.md` 的「阶段 A/B / 两阶段 P0」是**验收口径**，不是排期编号；两阶段 P0 = 本文件 P2 的阶段 A/B，非 M0。

---

# 附录 C · `.wcc/ir/` 唯一契约

**唯一权威**：`docs/MAP-COMPILE-PIPELINE.md` §6.1。`MAP-GENERATION-PLAN.md` 与 `HARNESS-IMPLEMENTATION.md` 只保留指向该节的指针，不再各自定义目录树。

```
.wcc/ir/<map-id>/
  manifest.json      # schema 版本、源图 sha256、targetPatch="1.31+"、language="lua"、
                     #   每个内部文件「由哪个序列化器产出 + 输出 hash」
                     #   （字段统一：原 wc3Patch→targetPatch，原「脚本语言(jass|lua)」→language）
  terrain.json / doodads.json / units.json / regions.json / cameras.json
  quests.json / dialogues.json / triggers.json   # 剧情层，与 HARNESS-IMPLEMENTATION 视角合并
  objects/*.ini      # 物编修改表，对齐 w3x2lni 的 table/ 9 张 ini
  script/
    war3map.lua      # 【主线】1.31+ / Lua，AI 写这里
    war3map.j        # 【可选支线】仅显式切 E2 时启用，本轮不施工
    fragments/*.lua
  patches/           # IR 级 diff，可审批可回滚（统一原 diffs/ 与 wcc.ir.diff）
  build/             # 【生成物，不进 git】全量可重建，含 <map>.edited.w3x
```

三条硬约定：AI 只写 `*.json` / `*.ini` / `script/*` 文本；`manifest` 记 `targetPatch` + `language`；`build/` 全量可重建，任何一步失败从 IR 重来，不手工修二进制。`fragments/` 与 `patches/` 均为同一 `<map-id>/` 下的子目录，不另立根。

---

*本文件是主计划；进度更新按「防过期机制」执行，不要在历史 plan 上追加。历史文档按 §2.2 保持快照原样。*
