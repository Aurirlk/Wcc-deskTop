# Harness 框架横向借鉴评估：Kiro / Strands Harness / Deep Agents

> **2026-11-10 仓库状态补记**：本文「未 git commit / 未推送 / origin=gitclone.com」均为**撰写当时**状态。当天成果已全部提交（`7fe0922`..`83ced5f`，6 个）并推送到 Gitee **私有**仓库 `wei-kaijie/Wcc-deskTop`（项目为半成品，刻意不公开；`main` 与本地一致）；GitHub `Aurirlk/Wcc-deskTop` 仍停在 `12b9169`（push 受阻未同步）。权威说明见 [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) §1。

> 2026-11-09 · 为「WCC 继续作为独立、点击即用的 harness」寻找可借鉴的架构设计。
> 本文是**当时的调研快照**：写作时未引入任何依赖、未改动项目代码、未 git commit。
> ⚠️ **状态更新（2026-11-09 晚）**：第 3 节的落地动作已逐条实现为可运行代码，见
> [`docs/HARNESS-IMPLEMENTATION.md`](HARNESS-IMPLEMENTATION.md) —— 新增零依赖 `harness/` 层、
> 15 项自测通过、8 份 skill 文档新增 steering front matter；仍未接入 `agent.js` / 打包 / 提 PR。
> 本文第 1–2、4–6 节的分析与判断继续有效。
> 配套阅读：`docs/FEASIBILITY-REVIEW.md`（方案可行性）、`docs/FORGE-INTEGRATION.md`（forge 生态）。

---

## 0. 先正名：三个名字分别指什么

| 你写的 | 实际对象 | 置信度 | 说明 |
|---|---|---|---|
| **kiro** | **Kiro**（AWS 的 agentic IDE / CLI，`kiro.dev`） | ✅ 确定 | **闭源商业产品**，不是可嵌入的开源框架；基于 Code OSS，需登录账号 |
| **stand-harness** | **Strands Harness**（AWS 开源，`strands-agents/harness-sdk`） | ✅ **用户已确认（笔误）** | GitHub 上并无叫 `stand-harness` 的知名项目；佐证：① Kiro 与 Strands 同为 AWS；② `harness-sdk` 仓库内带 `.kiro/` 目录，两者生态直接关联；③ 三者并列都是 2025–2026 的 agent harness，逻辑自洽 |
| **deepagent** | **Deep Agents**（`langchain-ai/deepagents`） | ✅ 确定 | 官方自称 *"the batteries-included agent harness"*，MIT。另有同名干扰项：`deepagentsdk.dev`（第三方 Vercel AI SDK 版）、`RUC-NLPIR/DeepAgent`（WWW'26 学术论文，非框架）——都不是本文对象 |

### 仓库实测元数据（GitHub API，2026-11-09）

| 仓库 | ★ | 许可证 | 主语言 | 状态 |
|---|---|---|---|---|
| `strands-agents/harness-sdk` | 9,084 | **Apache-2.0** | TypeScript | 当日仍活跃，2025-05 创建 |
| `langchain-ai/deepagents` | **31,137** | **MIT** | Python | 当日仍活跃，2025-07 创建 |
| `langchain-ai/deepagentsjs` | 1,638 | **MIT** | TypeScript | 11-06 活跃 ← **与 WCC（Node 22 / JS）最贴合** |
| `github/spec-kit` | 148,899 | MIT | Python | Kiro「spec-driven」的**开源对照物**，值得单独看 |

---

## 1. 三者定位：谁是可借鉴的「框架」

| | 是不是 harness 框架 | 能否直接引入 WCC | 能借鉴什么 |
|---|---|---|---|
| **Kiro** | ❌ 是**产品**（IDE/CLI/Web），闭源、需账号 | ❌ 不能，且正是你要避开的门槛形态 | ✅ **设计范式**：spec 三阶段、steering 条件加载、hooks、MCP 治理 |
| **Strands Harness** | ✅ 是（Python + TypeScript SDK，`createHarness()`） | 🟠 技术上可以（TS 版、Node 22+），但会引入一整套运行时，违背「绿色轻量」 | ✅ **架构哲学 + 模型可移植 + 生命周期预算** |
| **Deep Agents** | ✅ 是（官方定义即 agent harness，Python + JS） | 🟠 可以，但强绑 LangGraph 运行时与大量 peer deps，与 Electron 便携目标冲突 | ✅ **中间件分层 + 上下文工程**（最有价值的一块） |

> **结论**：三者都**不建议整包引入**，但都值得**抄设计**。WCC 的 Node/Electron 骨架已经存在，照搬框架等于把「点击即用」重新变回「装一堆依赖」。

---

## 2. 各自值得抄的机制

### 2.1 Kiro —— 把「规范」变成可执行的工程流程

| 机制 | 内容 | 官方来源 |
|---|---|---|
| **Spec 三阶段** | `requirements`（EARS 记法、验收条件）→ `design`（架构）→ `tasks.md`（离散可勾选任务）。每阶段都是**人工评审检查点**，spec 作为活文档留在仓库 | `kiro.dev/docs/getting-started/first-project` |
| **Steering 条件加载** | `.kiro/steering/*.md`；三种模式：always-on / `fileMatchPattern` 按文件类型加载 / 手动 `#` 引用；可外链 OpenAPI 等契约 | AWS Builder Center SDD 文 |
| **Agent Hooks** | 文件创建/保存/删除、prompt 生命周期、spec 任务完成等事件触发；可跑 agent 动作或 shell 命令（保存后 lint、任务完成后跑测试） | Kiro 官方 first-project / Hooks 文档 |
| **Powers + MCP 治理** | 按需加载工具指令与 MCP，避免所有工具常驻吃上下文；企业级还做 MCP 白名单与模型治理 | Kiro 官方 + AWS 企业 SDD 文 |

### 2.2 Deep Agents —— 中间件即 harness

官方定义：*「同样的 tool-calling loop，但内置让长任务可靠的能力」*。全部由**可插拔 middleware** 组装，每块都能覆盖或移除：

| 中间件 | 提供的能力 |
|---|---|
| TodoList | `write_todos`：可写计划，拆解/跟踪/动态调整 |
| Filesystem | `ls / read_file / write_file / edit_file / glob / grep`；**虚拟文件系统当工作记忆**，大工具结果落盘而不是塞进对话 |
| SubAgent | `task` 委派子智能体，**隔离上下文窗口**，父 agent 只收结论 |
| Summarization | 历史超限时压缩，而不是粗暴截头丢掉原始指令 |
| PatchToolCalls | 修复被中断/取消的 tool call 造成的消息历史破损 |
| 人工审批 | LangGraph interrupt，敏感工具执行前暂停 |
| 可选 backend | 内存 / 本地磁盘 / LangGraph Store / 沙箱（Modal、Daytona、Deno） |

### 2.3 Strands Harness —— 模型无关 + 分层不锁死

| 机制 | 内容 |
|---|---|
| **分层但不锁死** | Harness 给「一次调用即可投产」的默认配置，返回的对象仍是普通 Agent；随时下钻 SDK 自己接管 loop / hooks / 会话后端，**无需逃离框架** |
| **模型可移植** | 统一 provider 语法 + reasoning effort 分级；Bedrock / Anthropic / OpenAI / Gemini / **Ollama 本地**都可换，切换不改业务逻辑 |
| **生命周期预算** | turn limits、token budgets、cancellation、stop reasons |
| **上下文卸载** | 大工具结果转存文件 + 缓存复用请求片段，压 token |
| **Agent Skills / 委派** | 内置带 checklist 的子 agent，可加载 Agent Skills |
| 其余 | MCP 集成、session ID 长期记忆、streaming、guardrails、tracing、evals |

> 一则**与你判断直接相关**的旁证（二手新闻转载，非官方定论，别当精确数据）：AWS 发布 Strands Harness 时称其 model-neutral、可跑本地 Ollama，并在 Terminal Bench 2.1 上有「同任务成本显著低于某商业 CLI」的对比。这说明 **harness 本身的上下文/预算管理就是独立竞争力，而且可以脱离特定厂商模型**。这恰好支持你「不把产品押在某个外部 CLI 上」的方案。
> 反过来也修正我上一轮的说法：通用 CLI 并非「只有模型」，其工具编排与上下文工程是真壁垒——只是**对目标用户不可达**。

---

## 3. 映射到 WCC：能落地的动作

WCC 现状（已实测）：`apps/wcc-desktop` 自动拉起 Sidecar + 健康看护；`server.js` 约 20 路由含 `/approval/*`、`/session/*`、`/workbench/*`、`/config`；`agent.js` 离线模式只返回 `steps`；`check`/`test` 是手动命令；`wcc-skill` 作为整体文档注入。

| # | 借鉴机制 | WCC 现状 | 落地动作 | 优先级 |
|---|---|---|---|---|
| 1 | **Kiro spec 三阶段** | `workbench` 已有 `bible / quests / dialogues / spawners` 结构化设定数据（≈ spec artifacts），但缺任务状态机 | 在 `.wcc/spec/{requirements,design,tasks}.md` 落盘可勾选任务，逐任务执行并回写状态；`offlinePlan` 从「打印 steps」升级为「生成 spec」 | 🔴 最高 |
| 2 | **Kiro steering 条件加载** | `wcc-skill` 铁律/4 patterns/3 knowledge 是**全量常驻**，吃上下文 | 给 knowledge 文档加 `fileMatch` 元数据：编辑 `.lua` 才注入魔兽铁律，编辑 tables 才注入物编规范，调 forge 才注入协议 → 省 token、减噪声（与 deepagents「skills 按需加载」同构） | 🔴 最高 |
| 3 | **Kiro Agent Hooks** | `lua_check` 目前要手动 `npm run check` | 加 hook 层：`.lua` 落盘 → 自动 `lua_check` → 结果回写 UI；spec 任务完成 → 自动 `check + test`。把质量门禁从「记得跑」变成「必然跑」 | 🔴 最高 |
| 4 | **deepagents 文件系统即工作记忆** | 只有 `session-store`（会话持久化），**无上下文卸载** | 把 forge 返回的地图对象列表、lua_check 输出、地图解析结果写到 `.wcc/scratch/`，主上下文只留摘要+路径，按需 `grep` 回来。长战役（多章/几十触发器）可用性的分水岭 | 🟠 高 |
| 5 | **Strands 模型可移植** | `config-store` 只有 `baseUrl/apiKey/model`，默认 `deepseek-chat` | 扩成 **provider preset**：DeepSeek / 通义 / 智谱 / 月之暗面 / Ollama 本地 / 自定义，设置页下拉即切。直接服务「免翻墙、不绑定单一厂商、可全离线」的产品定位 | 🟠 高 |
| 6 | **deepagents 中间件分层** | `agent.js` / `tools.js` / `server.js` 硬编码耦合 | 不迁框架，只把现有能力拆成可注册中间件（planning / filesystem / subagent / summarization / approval），各块可开关 → 不同用户（只写 Lua / 要改图）用不同默认组合 | 🟠 高 |
| 7 | **Strands 生命周期预算** | 无 | 加 turn limit / token budget / 取消 / stop reason。国产模型按量计费 + 长战役任务，这是产品级必需 | 🟠 中 |
| 8 | **deepagents Summarization + PatchToolCalls** | 无历史压缩；`/approval/resolve` 取消后可能留下不完整 tool 消息 | 长会话压缩历史（保留原始指令）；审批取消时修补消息历史，避免下一轮 provider 校验报错 | 🟠 中 |
| 9 | **deepagents 人工审批** | ✅ 已有 `/approval/pending` + `/approval/resolve` | 无需照搬，只需对齐语义 | ✅ 已有 |
| 10 | **Strands「分层不锁死」** | Sidecar 全内置 | 把 `wcc-lib` / `lua_check` / `wcc-skill` 暴露成可独立调用的层 —— 正好与 `FORGE-INTEGRATION.md` 的 **L2 独立 stdio MCP** 路线合流 | 🟠 中 |

### 最划算的三件（ROI 排序）

1. **#2 steering 条件加载 + #3 hooks**：几乎零新依赖，纯改造现有文件注入与命令触发，立刻让 `wcc-skill` 与 `lua_check` 从「文档」变成「强制机制」。
2. **#1 spec 落盘**：`workbench` 数据骨架已在，只是把规划结果持久化 + 加状态机；顺带解决「README 虚标 demo 地图」以外的另一个空壳感。
3. **#5 provider preset**：几行配置 + 一个下拉，产品价值最大（免翻墙、可换模型、可本地 Ollama），直接对应你这一轮的战略前提。

---

## 4. 不该抄的

| ❌ | 理由 |
|---|---|
| 整包迁到 `deepagents` / `strands-harness` | Python 主仓 / LangGraph 或一整套 SDK 运行时 + 大量 peer deps，与 Node/Electron 便携目标冲突，把「点击即用」倒退回「装依赖」 |
| Kiro 的 IDE / 账号 / 云端体系 | 闭源、需登录，正是你要替用户绕开的门槛 |
| 无脑堆 MCP | AWS 自己的 SDD 文章都警告：每个常驻 MCP 都吃上下文并引入噪声。WCC 只需 forge 一个执行层 |
| 把 `github/spec-kit`（148.9k★）整个搬进来 | 它是 CLI + 模板工具；借鉴它的 spec 目录结构与阶段划分即可 |
| 复制任何一方的源码 | 设计可借鉴，代码要自己写（见第 6 节） |

---

## 5. 对可行性结论的影响（`FEASIBILITY-REVIEW.md`）

- **强化论断 A**：Strands 与 Deep Agents 都由大厂开源、model-neutral、明确把自己定位为「agent harness」产品——**通用 harness 本身就是一个可独立存在的品类**，不是某个 CLI 的附属品。你「WCC 继续做 harness」的判断有产业先例支撑。
- **细化 A 的「🟠 工程待补」**：除打包分发（红线级）外，harness 层最该补的是**上下文工程与质量门禁**（本文 #1–#4），而不是重建骨架。这些改造都不引入新依赖、不增加分发体积。
- **呼应 B / C**：#10 的分层暴露与 `FORGE-INTEGRATION.md` 的 L2（WCC 独立 stdio MCP、forge 不改）是同一件事；hooks 与中间件分层也让 C2（WCC 侧调用 forge）更干净。三者互为补强，不是三套新工作。
- **不新增许可证风险**：三者均为 Apache-2.0 / MIT，与 WCC 的 MIT 兼容；且都是**只读借鉴设计**，与 forge 的 GPL-3.0 边界毫无交集。

---

## 6. 许可证与归属

| 来源 | 许可证 | 可否借鉴设计 | 可否复制代码 |
|---|---|---|---|
| Kiro | 闭源商业 | ✅ 公开文档描述的设计 | ❌ 不可，也不逆向 |
| Strands Harness | Apache-2.0 | ✅ | 🟠 可，但需保留 NOTICE / 归属，且 WCC 无需这么做 |
| Deep Agents (py/js) | MIT | ✅ | 🟠 可，但需保留版权声明 |
| spec-kit | MIT | ✅ | 🟠 同上 |

> 建议：**一律只抄思路、不复制代码**。WCC 保持纯 MIT 自有实现，避免将来向 forge 提 PR 时还要解释第三方代码来源。

---

## 7. 下一步（已被实现稿接管）

1. 三者指代已全部确认：**Kiro / Strands Harness / Deep Agents**。
2. 第 3 节建议的 **#2 + #3（steering 条件加载 + hooks）** 以及 #1/#4/#5/#6/#7/#8/#10 已落地，
   逐条对账与验证结果见 [`docs/HARNESS-IMPLEMENTATION.md`](HARNESS-IMPLEMENTATION.md) §1。
3. 本文保留为分析稿；实现稿**写作时**同样未替你做任何 git commit（后续已统一提交并推送，见文首补记）。
