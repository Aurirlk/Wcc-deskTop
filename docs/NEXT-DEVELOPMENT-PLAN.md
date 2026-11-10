# WCC 下一步开发计划（2026-11-10）

> **状态：计划稿，未开工。** 本文只做规划，不含任何"已完成"声明。
>
> **基线**：`git HEAD = d8ccdfb`，本地 `main` / GitHub `main` / Gitee `main` 三处一致。
> **主线来源**：Gitee 侧 7 个提交（`7fe0922` … `ef5a9be`，11-09 晚 ~ 11-10 凌晨），即 `harness/`、`docs/` 9 篇新文档、`wcc-skill/` front matter、`vendor/`、`scripts/create-shortcuts.py`。
> **裁决顺序（冲突时以此为准）**：`代码事实 > 最新主线文档 > 历史文档（快照）`。

---

## 0. 一句话结论

**项目不缺 AI，也不缺代码——缺的是「把已经写好的 Harness 能力接进主产品」和「一个能进图的地图数据层」。**

- 最新主线已交付可独立运行的 `harness/` 层（12 模块 + CLI + 15 自测，离线全链路通过），但**全仓没有任何非 harness 文件 import 它**，`agent.js` 仍在全量注入 skill、全量挂工具、`guard < 8` 硬循环。→ 第一优先级是接线，不是再写新模块。
- 所有地图相关文档都指向同一个未拍板的前置决策：**目标补丁选 1.26 / 1.31+ / 双轨**。这个不定，阶段 2 全部会返工。
- 本机 Electron 二进制缺失、无模型 key 时 Agent 只回文本、`build_map` 只产 `war3map.lua` 而不产 `.w3x`、本机 War3 1.26 只支持 JASS——**端到端目前跑不通，必须如实标注**。

---

## 1. 基线：实测证据（不是文档声称，是本机跑出来的）

| 命令 / 检查 | 实测结果 | 判定 |
|---|---|---|
| `node --test harness/test/harness.test.js` | 15/15 pass，0 fail，277ms | ✅ |
| `node harness/bin/wcc-harness.mjs demo` | EXIT=0，6 段离线全链路（steering 省 39,373 字符 → spec → scratch → hooks → 工具 10/29 → 预算 → TUI） | ✅ |
| `node harness/bin/wcc-harness.mjs tui --static` | EXIT=0，非 TTY 静态渲染 | ✅ |
| `npm test`（根） | 27/27 pass（sidecar 25 + lua-check 2）；**不含 harness 的 15 个** | ⚠️ |
| `npm run check` | `13 files, 3 issues, ok=true`（3 个均 WARNING；`check.js:165` 只把 error 计入 ok） | ⚠️ |
| `npm run dev:desktop` | **EXIT=1**：`Electron failed to install correctly` | 🔴 |
| `npm run build:desktop` | EXIT=0，但仅 `echo 'package with electron-builder later'` | 🔴 占位 |
| sidecar `/health` | `{"ok":true,"tools":20,"modelConfigured":false,"forgeConnected":false}` | ⚠️ |
| `POST /chat`（无 key） | 返回离线计划文本，**不生成 Lua / 不调工具 / 不检查** | 🔴 断点 |
| `POST /build`（空项目） | `missing:["src.main"]` 仍写出 584 字节 `war3map.lua` 并**返回成功** | 🔴 假成功 |
| 全仓 `.w3x` / `.w3m` | **零个** | 🔴 |

**代码事实**：桌面 UI → IPC → Sidecar HTTP/SSE → Agent Loop → 20 个工具 → 审批 → `lua_check` → `build_map` 这条链**代码上全部接线且真实实现**（`apps/wcc-desktop` 不是静态壳，`renderer/app.js` 654 行全是动态调用）。断点是环境、模型与产物层，不是接线层。

---

## 2. 文档分层（按"最新文件为主，其他为补充和快照"）

### 2.1 主线依据（现状 + 下一步的权威）

| 文件 | 作用 |
|---|---|
| `README.md` | 项目定位、模块结构、当前文档索引；`L135-136` 明确 harness 是旁路层 |
| `docs/HARNESS-IMPLEMENTATION.md` | **实现记录（不是规划稿）**；`§7 L259-271` 是全项目唯一未被推翻的下一步清单 |
| `docs/MAP-COMPILE-PIPELINE.md` | **`§5.3 / §11` 第 0 号决策（目标补丁）**；`§7` 两阶段 P0 验收 |
| `docs/MAP-GENERATION-PLAN.md` | `§7 L436-443` P0/P1/P2 与验收标准；`§8-10` 红线 |
| `docs/ASSETS-GUIDE.md` | 素材/领域数据缺口盘点（`§0` 缺口表、`§5` 最小行动清单） |
| `docs/FEASIBILITY-REVIEW.md`、`docs/FORGE-INTEGRATION.md` | 打包与许可证红线（两份文首"状态更新"已划出继续有效部分） |
| `docs/NEW-MACHINE-SETUP.md`、`docs/DEPLOYMENT-SHORTCUTS.md` | 换机清单、部署红线、回归基线 |
| `docs/HARNESS-REFERENCE.md` | 分析快照；**`§7` 已主动作废**（`L146-151`「已被实现稿接管」） |
| `harness/**`、`wcc-skill/**`（front matter）、`vendor/`、`scripts/create-shortcuts.py` | 代码事实，是文档的最终裁决者 |

### 2.2 补充 / 快照（有价值，但**不得当作进度依据**）

| 文件 | 只取这些 | 不取这些 |
|---|---|---|
| `PROJECT-PLAN-2.0.md` | `§1` 2.0 五个可验收目标、`§2` 7 页 IA、`§5` 4 个专家、`§6` 战役圣经 JSON | `§8` 立即执行顺序（22 项**全部未勾选**，报告明写「未开工」） |
| `PROJECT-PLAN.md` | `§2.3` 8 步用户旅程、`§5.3-5.5` 权限/记忆/模型路由策略、`§七` 六条 ADR、`§八` 版权红线原始出处 | `§十 Do Now`（全部过期）、React/Rust/`wcc-map/` 选型（已降级，目录不存在） |
| `项目状态与改进报告.md` | `§4` 14 项问题清单、`§6` forge 冒烟 9 步、`§9` 风险登记簿 | `§10 Do Now`；且本文件**未被 git 跟踪**，从未进入版本历史，是纯快照 |
| `wcc-skill/skill.md` 正文 | 四条编程铁律、输出协议、违禁行为、7 项质量检查——**仍生效** | 无（`2026-07-09` 内容，被主线当既有资产引用，未被复述） |
| `wcc-ai-blueprint.md` / `wcc-architecture.md` / `wcc-skill.md` | v1.0 愿景参考 | 不作为排期依据（已被 `wcc-skill/skill.md` 吸收超越） |
| `docs/DEVELOPMENT-NOTES.md` 等 5 篇 9-15 旧调研 | 事实性结论（如「Sidecar 必须用系统 node 启动」、合规策略） | 落地状态口径已过期 |
| `attic/novel-workflow/`、`.novel-workflow/` | — | **与主线无关，忽略**（`PROJECT-PLAN.md:60` 已判定） |
| `D:/Program/_wcc_dupes_snapshot_2026-11-10/` | 9 份 `(2)` 版本旧照，仓库外 | 不入库、不作为开发依据 |

---

## 3. 现状诊断：断点清单

### 3.1 文档已明确标注的断点

| # | 断点 | 依据 |
|---|---|---|
| D1 | **`harness/` 整层未接入主产品**——`createHarness()` 未被 `agent.js` / `server.js` 引用 | `HARNESS-IMPLEMENTATION.md:18`、`README.md:135-136`、`§7` 第 1 项 🔴 |
| D2 | 无模型 key 时 `agent.js` 走 `offlinePlan()`，只回文本，`tool_calls` 为空 | `agent.js:166-177`；`PROJECT-PLAN-2.0.md:118` mock model E2E 未勾选 |
| D3 | `build_map` 只写 `war3map.lua` 脚本包，**不出二进制 `.w3x`** | `build-map.js:130-131,164`；`PROJECT-PLAN-2.0.md:7-10` 状态校正 |
| D4 | 没有 `.wcc/ir/` 文本中间表示，AI 无法「改文本 → build 回地图」 | `MAP-GENERATION-PLAN.md:202`、`L390-392` L1/L2 全缺 |
| D5 | 无 `snapshot` / `diff` / `verify`，无「生成→编译→报错回喂模型」闭环 | `MAP-GENERATION-PLAN.md:287-294`、`HARNESS-IMPLEMENTATION.md:224` 🟠 |
| D6 | Electron 二进制缺失、`build` 是 echo 占位、启动器硬编码 node 路径 | `FEASIBILITY-REVIEW.md:60-62`；本机实测 |
| D7 | 本机 War3 **1.26.0.6401 只支持 JASS**，`war3map.lua` 不能试玩 | `README.md:146`、`MAP-COMPILE-PIPELINE.md:304-307` |
| D8 | forge 未联调（`WC3FORGE_EXE` unset）、无 stdio MCP server（`packages/wcc-mcp` 仓库里不存在） | `HARNESS-IMPLEMENTATION.md:22,265`、`§7` 第 6/7 项 |
| D9 | 无仓库级 `AGENTS.md`，「任何 harness 读同一份铁律」未建立 | `HARNESS-IMPLEMENTATION.md:216,243,265` |
| D10 | 领域数据薄：物编 ID 字典为零（AI 幻觉 `'hfoo'` 根因）、数据表仅 1 章、测试底图零 | `ASSETS-GUIDE.md:12-18` |

### 3.2 本次实测**新发现**、文档未写的问题（计划增量）

| # | 问题 | 证据 | 违反的既有纪律 |
|---|---|---|---|
| N1 | **`build_map` 对 `missing` 模块静默返回成功**（空项目也写出 584 字节并报成功） | `POST /build` 实测 | `MAP-COMPILE-PIPELINE.md:371`「绝不静默假装成功」 |
| N2 | **Electron 安装软失败被掩盖**：`scripts/optional-electron.js` 只判断 `package.json` 存在就打印 `electron present`，不校验二进制 | postinstall 实测 + 本机 `node_modules/electron/` 无 `path.txt`/`dist/` | `FEASIBILITY-REVIEW.md:61` |
| N3 | **质量门禁默认不阻断**：`hooks.js:84` `blockOnIssues=false`；`check.js:165` warning 不计入 `ok`，故 3 个 WARNING 仍 `ok=true` | 源码 + `npm run check` | `HARNESS-IMPLEMENTATION.md:93` 质量门禁设计意图 |
| N4 | 根 `npm test` 只跑 27 个，**漏掉 harness 的 15 个**；`tests/` 目录为空 | 根 `package.json` + 实测 | `NEW-MACHINE-SETUP.md:66-74` 回归基线 |
| N5 | `@wcc/shared` 是名义包：`dist/` 不存在、`IPC` 常量名与 `main.js`/`preload.cjs` 实际用的不一致、无人 import | 源码 Grep | 架构一致性 |
| N6 | `wcc-lib/wcc-hotreload.lua` 依赖原生 `require`，而 WC3 Lua 无 `require`（打包用自造 `__wcc_require`）→ 真机上 `Init()` 降级返回 false | `wcc-hotreload.lua:17,35,49` + `build-map.js` | 可用性 |

### 3.3 一句话链路判断

> **「桌面 UI → Sidecar → Agent → 工具 → 静态检查」代码是通的；「用户说一句话 → AI 生成 Lua → 检查 → 产出可进图地图」端到端跑不通。**

---

## 4. 第 0 号决策：目标补丁（**必须先拍板**）

`MAP-COMPILE-PIPELINE.md:29 / L311-319 / L449-451` 明确：「真正没解决的是**选哪个目标版本**，这个必须先拍板，否则后面全部返工」。

| 选项 | 含义 | 代价 / 后果 |
|---|---|---|
| A 守 1.26 走 JASS | 贴合本机 | **现有 1841 行 Lua 运行时 + 全部 wcc-skill 铁律推倒重来**，且 1.26 无文件夹地图、MCP 招牌能力不可用 |
| B 另备 1.31+ 验证机 | 保住 Lua 资产，真机可验收 | 需用户自行准备 1.31+（**不动本机 1.26 是红线**） |
| C 只做离线生成 | 最省事 | 永远无法端到端试玩，验收口径必须降级 |

**本计划推荐：B + A 并行（双轨），以 1.31+ / Lua 为开发主线，本机 1.26 只读保留作参照。**

理由：
1. 现有 `wcc-lib/` 11 模块、`wcc-skill/` 全为 Lua，改 JASS 等于废弃最大资产；
2. `README.md:30` 已声明目标 `v1.31+`，双轨与既有定位一致；
3. 1.31+ 才能用 `wct`/`wtg` 写入与「WE Save 一次进图」流程；
4. `MAP-COMPILE-PIPELINE.md:442` 红线「未升级、未替换、未修改本机 1.26 游戏」必须守住，因此 1.31+ 只能是**另备环境**，由用户决定，我不代装。

**若用户不准备 1.31+ 环境**：阶段 2 自动降级为「只做文本 IR + snapshot/diff/verify + 离线脚本包」，并在 README 明确写「不产出可试玩地图」——按项目真实性纪律，**不得写「已支持地图生成 / 已打通编译链」**。

**`manifest.json` 必须记录 `targetPatch` 与脚本语言**（`MAP-COMPILE-PIPELINE.md:347-350`），这是双轨落地的第一块砖。

---

## 5. 路线图

优先级依据：`HARNESS-IMPLEMENTATION.md §7`（唯一权威下一步）+ `MAP-GENERATION-PLAN.md §7` P0 + `MAP-COMPILE-PIPELINE.md §7` 两阶段验收。

### P0 — 基线固化与「不依赖拍板」的止血（先做，不改业务代码）

| 任务 | 改动 | 验收 |
|---|---|---|
| P0-1 **修过期状态声明**（见 §8） | `README.md`、9 篇新文档文首补记 | 仓库内不再出现「GitHub 停在 12b9169」「用 GitHub 地址 clone 拿最新」 |
| P0-2 **测试基线统一** | 根 `package.json` 的 `test` 纳入 `harness/test/harness.test.js`；`tests/` 空目录补 E2E 占位说明或直接移除 | `npm test` = **42 pass**（27 + 15） |
| P0-3 **修 N1 假成功** | `build-map.js`：`missing.length > 0` 时返回明确失败，不写产物 | 空项目 `POST /build` 返回非成功，`missing` 可见 |
| P0-4 **修 N2 安装检测** | `scripts/optional-electron.js`：校验 `path.txt` / 二进制，缺失时给明确指引（含 `ELECTRON_MIRROR`，**不加 `ELECTRON_CUSTOM_DIR`**） | 缺失时 postinstall 不再谎报 `electron present` |
| P0-5 **修 N3 门禁**（设计确认后） | `hooks.js` `blockOnIssues` 在 `task.complete` 显式开启；`check.js` 区分 error/warning 输出 | WARNING 不误报 ok，但也不误伤现有 13 文件 |
| P0-6 **补 `AGENTS.md`**（D9） | 仓库根，收拢 `wcc-skill/skill.md` 四条铁律 + 输出协议 + 违禁行为，供所有 harness 读取 | `steering.js` 能命中 `mode: always`；与 `wcc-skill/skill.md` 不产生双数据源 |
| P0-7 **补 N5/N6 处置结论** | 决定 `@wcc/shared` 是补齐还是删除；`wcc-hotreload.lua` 标注「WC3 环境不可达」或从分发清单剔除 | 有明确书面结论，不留悬空 |

> P0 全部**不触碰模型与地图**，可独立交付。此阶段结束前不得宣称任何功能「已打通」。

### P1 — 让 harness 从旁路变成产品行为（**最高 ROI，第一优先级开发**）

对应 `HARNESS-IMPLEMENTATION.md §7` 第 1/2/4 项 🔴。

| 任务 | 改动 | 验收 |
|---|---|---|
| P1-1 **接入 `createHarness()`** | `agent.js`：`assembleSystem()` → `steering.select + render`（替代 skill.md 前 2000 字全量）；`toolDefs()` → `injector`（29 工具按需）；`guard < 8` → `budget`（含取消时 `patchToolCalls()`）；工具结果 → `scratch.offload`（替代 `slice(0,50_000)`） | steering 注入量可观测、工具按需、预算生效；**27+15+新增测试全绿** |
| P1-2 **保留离线降级路径** | 无 key 时仍走 `offlinePlan()`，不因接线导致回归 | `/chat` 无 key 行为不变 |
| P1-3 **mock model E2E** | 补测试覆盖 `PROJECT-PLAN-2.0.md:118` 未勾选项：mock 流式 + 工具调用 + 生成 Lua + `lua_check` + 报错回喂修正 | 「一句话 → Lua → 检查 → 修正」在**无真实 key** 下可复现 |
| P1-4 **`/harness/*` 端点** | `server.js` 暴露 `/harness/state`、`/harness/steering`、`/harness/spec`、`/harness/hooks`，renderer 与 TUI 共用 | 遵守 `HARNESS-IMPLEMENTATION.md:176`「**双表面可以，双数据源不行**」 |
| P1-5 **provider 下拉** | `config-store.save(providerPatch(id,key))`，国产模型零翻墙 | 设置页可切换 7 个预设，`/health modelConfigured` 变化可观测 |
| P1-6 **质量门禁回喂**（D5 最小版） | `lua_check` 结果作为 tool result 回灌模型，形成「生成→检查→修」闭环 | 有可复现的 E2E 用例；`HARNESS-IMPLEMENTATION.md:224` 🟠 转 ✅ |

### P2 — 让产物能「进图」（最难点，**依赖第 0 号决策**）

严格按 `MAP-COMPILE-PIPELINE.md §7` 分两阶段，**A 阶段刻意不写任何脚本**（`L386`）。

| 任务 | 依据 | 验收 |
|---|---|---|
| P2-1 **物编 ID 字典** `wcc-skill/knowledge/wc3-object-ids.md` | `ASSETS-GUIDE.md:15,118` ROI 最高，AI 幻觉根因 | 单位/建筑/物品分类 + 四字码，`steering` 可命中 |
| P2-2 **`.wcc/ir/` 文本 IR + 3 个脚本** `wcc.map.snapshot` / `diff` / `verify` | `MAP-GENERATION-PLAN.md:421-430,440` P0 | diff 可读、可回滚、round-trip 自检通过；**禁止 `echo` 占位**（`L432`） |
| P2-3 **阶段 A**：1 张真实 `.w3x` → 读 → IR → 写回 `.edited.w3x` → WE 打开 → Save → Test Map | `MAP-COMPILE-PIPELINE.md:379-386` | 不报错、单位在新位置、地形/树林/触发器未丢 |
| P2-4 **阶段 B**：脚本编译进图，接 `w2l`/`grill` **外部进程** | `MAP-COMPILE-PIPELINE.md:390-395` | B3「durable 与否的分水岭」通过；`wcc.map.set_script` 必须带 `targetPatch`/`strategy`，`script-only` 时明确警告「WE 重存会丢失」 |
| P2-5 **补示例资产** | `ASSETS-GUIDE.md:115-122`：修 `demo-campaign.w3x` 虚标、`tables-sample.json` 扩到 3 章 | README 不再虚标；3 章 demo 可打包 |
| P2-6 **`manifest.json` 双轨字段** | `MAP-COMPILE-PIPELINE.md:347-350` | 记录 `targetPatch` + 脚本语言；`build/` 全量可重建 |

> P2 全程红线：只写 `.edited.w3x` 副本 / 改前快照 / WE 中打开的图先关闭 / 改 GUI 触发器后 Save 一次 / **AI 永不直接改二进制** / 外部工具只调用不复制源码 / 不动本机 1.26。

### P3 — 产品化与分发（`FEASIBILITY-REVIEW.md` 称「产品化最后一步」）

| 任务 | 依据 | 验收 |
|---|---|---|
| P3-1 最小 `electron-builder` 便携包 + 去掉启动器硬编码 node 路径 | `HARNESS-IMPLEMENTATION.md §7` #5 🔴 | 新机器双击即用；`build` 不再是 echo |
| P3-2 **打包前先定死 GPL 红线** | `FEASIBILITY-REVIEW.md:94` | 安装包**不捆绑** `wc3-forge.exe` |
| P3-3 真 forge 联调 | `§7` #6 🟠 | `WC3FORGE_EXE` 生效后 `/health` 出现 `forgeConnected:true`；**probe 仍 unset 时不得虚报已连** |
| P3-4 独立 stdio MCP server `packages/wcc-mcp` | `§7` #7 🟠 | 仅进程间协议通信，forge 源码零复制；`FORGE-INTEGRATION.md:89`「先把 L2 跑通再开口」 |
| P3-5 交互式 TUI 真机验收 + 流式刷新 + diff 挂审批 | `§7` #8 🟠 | 真 TTY 下验收，非静态渲染 |

### P4 — 外部生态（**最后，且非必须**）

- `FEASIBILITY-REVIEW.md:163`「议题必须来自真实踩到的 bug / 真实需要，**不编造**」；
- `FORGE-INTEGRATION.md:171-178` 五条 ❌：不首条 Issue 申请 collaborator、不整体搬进 forge 的大 PR、不复制 GPL 源码、不批量改格式、不编造 bug；
- `FEASIBILITY-REVIEW.md:175`「不要把『增强 MCP 功能』当首个 PR 目标」；C1/C2/并行仍需用户拍板（作者建议「C2 先做实，C1 再作为关系建立」）。

---

## 6. 验收口径（定义「做完」）

沿用 `MAP-GENERATION-PLAN.md:8-11` 证据等级：✅ 本机实测 / 🟠 官方文档或二手 / 🔴 未实现未验证。

1. **P1 完成标志**：mock model 下跑通「一句话 → 生成 Lua → `lua_check` → 报错回喂 → 修正」，且 `npm test` 全绿、steering 注入量可观测。此时才可以把 `harness/` 从「旁路层」改称「产品行为」。
2. **P2 完成标志**：阶段 A + 阶段 B 两阶段 P0 全过（`MAP-COMPILE-PIPELINE.md:397` 目前「两阶段都没做」）。**在此之前，仓库内任何「已支持地图生成」「已打通编译链」的说法都不成立**（`L443`）。
3. **全局回归基线**：`npm test` 42+ pass、`npm run check` 无 error、`harness demo` EXIT=0、`dev:desktop` 可启动。
4. 每一项的 ✅ 必须附**可复现命令与输出**，禁止「计划中 = 已完成」。

---

## 7. 红线（开工前必须复述一遍）

| 类别 | 红线 |
|---|---|
| 许可证 | forge（GPL-3.0）/ w3x2lni / YDWE / HiveWE **只做外部进程调用，源码绝不进 MIT 仓库**；安装包不捆绑 `wc3-forge.exe`；C1/C2 用两个独立 clone 物理隔离 |
| 版权 | 不分发暴雪原版资产；`common.j`/`blizzard.j`/SLK 只本机提取使用；`D:\360MoveData\`、`D:\净土\kkkk\` 只读勿移动勿删除 |
| 真实性 | 所有 🔴 一律写成「没有」；**不允许先写 `echo` 占位冒充完成**（现有 `build` 脚本就是反面教材）；不虚报 forge 已连；不把 steering「命中」虚报成「已注入」 |
| 写图安全 | 默认落 `.edited.w3x` 副本、改前快照、WE 中打开的图先关闭、改 GUI 触发器后 Save 一次、AI 只写 `*.json`/`*.ini`/`script/*` 文本 |
| 用户环境 | **不升级、不替换、不修改本机 1.26 游戏与 `change\` 版本包**；1.31+ 验证环境由用户决定，不代装 |
| 凭据/部署 | `.lnk` / `.wcc/config.json`（含 apiKey）/ 令牌不入库；不写死盘符账号；不把改注册表当部署步骤 |
| 架构 | harness 保持**零 npm 依赖、零 Python、无 LangGraph**；**双表面可以，双数据源不行**；不重做地图编辑器、不引入向量库；`Lua 是游戏真相源；权限先于自主` |
| 范围 | `PROJECT-PLAN-2.0.md:41` 非 2.0：完整 3D 地图、Wurst/TS 编译、云同步、插件商店审核 |

---

## 8. 开工前先修的「过期声明与矛盾」

这些会**误导后续 AI 会话**，属于 P0-1，必须先校正：

1. **同步状态滞后（最要紧）**：`README.md:5` 与 9 篇新文档文首「2026-11-10 仓库状态补记」仍写「GitHub 停在 `12b9169`、push 受阻未同步」。合并后三处已全部 = `d8ccdfb`。应改为「GitHub / Gitee / 本地三处已同步至 `d8ccdfb`」，并去掉 `NEW-MACHINE-SETUP.md:39`「不要用 GitHub 地址 clone」的绝对化表述。
2. **README 自相矛盾**：`README.md:5` 说 GitHub 未同步，`L39` 却给 `git clone https://github.com/Aurirlk/Wcc-deskTop.git`。统一为三处同步后的地址说明。
3. **优先级前后翻转（以最新为准）**：`项目状态与改进报告.md:109/274` 把 Forge 真机联调列 P0 第一；最新 `HARNESS-IMPLEMENTATION.md:268` 降为第 6 位 🟠，且 `MAP-COMPILE-PIPELINE.md:453`「先不投入适配，等目标补丁定了再说」。→ **采用最新**。
4. **打包位次**：历史报告排「本周」；`FEASIBILITY-REVIEW.md:185` / `§7` #5 明确是「产品化最后一步」。→ **采用最新（P3）**。
5. **「可玩 .w3x」口径**：`PROJECT-PLAN-2.0.md:26` 曾写进能力阶梯（已被 `L7-10` 状态校正否定）、`ASSETS-GUIDE.md:121` 仍建议「补 `build_map` 写二进制」；最新 `MAP-COMPILE-PIPELINE.md:43,367,397,443` 要求两阶段 P0 + 目标补丁前置。→ **采用最新**。
6. **已作废清单**：`HARNESS-REFERENCE.md §7`（`L146-151`）、`PROJECT-PLAN.md §十 Do Now`、`PROJECT-PLAN-2.0.md §8`、`项目状态与改进报告.md §10` —— 明确标注「快照，不作排期依据」。
7. **待复核项**：`HARNESS-IMPLEMENTATION.md:196-197` 与 `MAP-GENERATION-PLAN.md:133` 记录 HiveWE 许可证 GPL-3.0 → AGPL-3.0 不一致，原文「暂不改写原结论」。保持标注，不擅自改写。
8. **文档虚标 5 项**：`MAP-GENERATION-PLAN.md:127-133` 列出 `PROJECT-PLAN-2.0.md:21`、`PROJECT-PLAN.md:49/207`（`wcc-map/` 不存在）、`examples/demo-campaign/README.md:21`（`demo-campaign.w3x` 不存在）等，逐条修或加否定注记。

---

## 9. 下一步立即可执行的三项（不依赖第 0 号决策）

1. **§8 的文档状态校正**（P0-1）——让仓库描述与 `d8ccdfb` 事实一致，避免后续开发被旧声明带偏。
2. **`npm test` 纳入 harness 15 测 + 修 `build_map` 假成功**（P0-2 / P0-3）——纯止血，零架构风险。
3. **启动 P1-1 接入 `createHarness()`**（`HARNESS-IMPLEMENTATION.md §7` #1 🔴）——最高 ROI，是让「调研」变成「产品行为」的唯一动作。

> 第 0 号决策（§4）只阻塞 **P2**，不阻塞 P0/P1。因此建议：**先并行推进 P0 + P1，同时把目标补丁拍板提上日程**。

---

## 10. 执行记录：P0 已完成（2026-11-10）

> 本节是**实测记录**，不是计划。所有 ✅ 均附可复现命令，符合 §6「禁止计划中 = 已完成」。

| 任务 | 落地 | 验证 |
|---|---|---|
| P0-1 过期声明校正 | `README.md`、`docs/` 6 篇文首补记、`NEW-MACHINE-SETUP.md` §1、`DEPLOYMENT-SHORTCUTS.md:209` 改为三处已同步且**不跟踪具体 commit**；3 份历史 plan 加「版本快照」横幅与「Do Now 已过期」注记；`examples/demo-campaign/README.md` 去掉不存在的 `.w3x` 虚标 | `grep` 全仓无「仍停在 12b9169 / push 受阻 / 不要用 GitHub clone」断言（0 条） |
| P0-2 测试基线统一 | 根 `package.json` 新增 `test:harness`，`npm test` 纳入 harness 与 `@wcc/shared` | `npm test` = **49/49 pass**（sidecar 27 + lua-check 2 + shared 1 + harness 19） |
| P0-3 修 build 假成功 | `build-map.js` 在 `missing.length > 0` 时抛错且**在任何文件写入之前**；新增 2 个回归测试 | 空项目 `POST /build` → **HTTP 500** + 列出 `src.main`；`war3map.lua` 不存在 |
| P0-4 修 Electron 检测 | `scripts/optional-electron.js` 校验 `path.txt` / `dist` / 真实二进制，给出 `ELECTRON_MIRROR` 指引（明确不加 `ELECTRON_CUSTOM_DIR`） | 本机输出 `electron NOT usable: dist folder missing (dist)`，不再谎报 present |
| P0-5 质量门禁 | `check.js` 返回 `errors`/`warnings` 计数且报告显式区分；`hooks.js` 新增 `defaultGateRunner`，`task.complete` **真的执行**检查并阻断 error；`blockOnIssues` 默认 true；`index.js` 的 `spec_done` 改为 `run: true` | `npm run check` → `13 files, 3 issues (0 errors, 3 warnings), ok=true [review prompts]`，3 个既有 warning 未误伤；新增 3 个门禁测试全绿 |
| P0-6 AGENTS.md | 仓库根 `AGENTS.md`（`mode: always`），**只做指针 + 仓库级约定，不复述铁律**；`steering.js`/`index.js`/CLI 全部接入 `agentsFile` | `steering list` 含 `{"id":"agents","mode":"always"}`；demo 输出 `injected=skill,agents,...`；自测断言命中且不复制铁律 |
| P0-7 悬空项处置 | 结论见 [P0-DISPOSITIONS.md](P0-DISPOSITIONS.md)：`@wcc/shared` 冻结（+ 防呆测试）、`wcc-lib/wcc-hotreload.lua` 标注 WC3 环境不可用并写进产物 README | `@wcc/shared` 防呆测试通过；Lua 注释与 `build-map.js` 产物说明已更新 |

**回归基线**：`npm test` 49/49 · `npm run check` 0 errors · `harness demo` EXIT=0 · `git diff` 无未解冲突。

> 注：用户要求保留的 4 个非 `(2)` 未跟踪项（`wcc-core.lua`、`.omo/`、`.novel-workflow/`、`项目状态与改进报告.md`）**未纳入提交**，保持未跟踪原样。

---

*本文为主计划；进度更新请直接改本文件并附实测命令，不要在历史 plan 上追加。历史文档按 §2.2 保持快照原样。*
