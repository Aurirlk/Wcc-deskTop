# WCC 独立 Harness + 二分 PR 方案 · 可行性分析

> 2026-11-09 · 针对「WCC 继续做点击即用的独立 harness；代码二分，只把优化部分提 PR；wc3-forge 增强 MCP」这一方案的核查与评估。
> 本文是**当时的分析快照**：写作时未改动任何项目代码、未提交 git、未发送任何外部 Issue/PR。
> ⚠️ **状态更新（2026-11-09 晚）**：论断 A 中「上下文工程 + 质量门禁」已补上并验证，
> 见 [`docs/HARNESS-IMPLEMENTATION.md`](HARNESS-IMPLEMENTATION.md)；新增 `harness/` 独立目录（不在 workspaces、
> 未改根 `package.json`、未重生成 lock）。**打包分发红线、Electron 版本不一致、启动器硬编码路径、
> 尚无 forge 联调实证、C1 PR 仍未发** —— 这些结论全部继续有效。仍未替你做任何 git commit。

---

## 0. 结论速览

| # | 论断 | 判定 | 一句话 |
|---|---|---|---|
| A | WCC 继续作为独立 harness，做「点击即用」产品 | ✅ 战略成立 / 🟠 工程待补 | harness **不是缺失，是已有但未打包**；真成本在打包分发与合规，不在造 harness |
| B | 代码二分：只提优化 PR，harness 留本地 | ✅ 可行，但须物理隔离 | 三条硬约束：GPL 边界、remote 只读镜像、工作区脏 |
| C | wc3-forge 增强 MCP 功能 | 🟠 技术可行 / 组织不确定 | 纯 TS 层便宜、Go 层贵；forge alpha 单人、零外部 PR 先例，首 PR 宜小 |

**总体**：方案成立，且比「做 Claude Code 的领域插件」更贴合你给的约束。需要修正的是**成本估计**（A）与**三处边界**（B 的许可证、C 的歧义、分发合规）。

---

## 1. 前提校正：上一轮建议为何失效

上一轮我建议「别做 Claude Code 竞品，做它的领域插件」，隐含前提是**目标用户能稳定、无障碍地使用 Claude Code**。你给出的约束把这个前提否掉了：

- 访问门槛与账号不确定性 → 产品可触达性不成立；
- 用户群不可能把工作流押在一个不可控的外部 harness 上；
- 「点击即用」的分发价值，恰恰是通用 CLI 不覆盖的部分。

前提一变，结论就该翻转：**独立 harness 是产品本体，不是可省略的薄层**。这点我上轮判断偏了。

一处技术校正（不改变结论）：「普通 CLI 离开基础模型没什么竞争力」作为绝对判断不完全成立——权限模型、工具编排、上下文管理、终端/IDE 集成都是独立壁垒。但对**你锁定的这群用户**这些壁垒不可达，所以「不构成有效竞争」成立。**产品定位应建立在可触达性上，不必建立在对手强弱上。**

---

## 2. 论断 A：WCC 作为独立「点击即用」harness

### 2.1 已有实物（不是从零造）

| 层 | 实测状态 |
|---|---|
| Electron 壳 | `apps/wcc-desktop/` 6 文件；`main.js` **自动 spawn Sidecar** + `/health` 轮询 + 崩溃自动重启（上限 5 次）+ 默认项目根指向 `examples/demo-campaign` |
| Renderer | 已有 health pill（`model✓`/`forge✓`）、onboarding 引导清单、settings 页（`configGet/configPost`）、forge 会话发现与连接 UI、对话、workbench |
| Sidecar | `server.js` 约 20 个路由：`/health` `/tools` `/approval/*` `/chat/stream` `/chat` `/history` `/session/*` `/forge/*` `/config` `/experts` `/workbench/*` |
| 模型 | 默认 `deepseek-chat`（国产、OpenAI 兼容）；`config-store.js` + `onboarding.js` 已提供配置落盘与引导 |
| 领域层 | `wcc-lib` 13 个 Lua 模块 + `wcc-skill` + `lua_check`；`npm run check` 13 文件 0 issues，`npm test` 27 pass |
| forge 客户端 | `forge-mcp.js` 双 transport（stdio `<exe> --mcp` + TCP lockfile NDJSON JSON-RPC） |
| 依赖 | `npm install` 完成，61 顶层包；Electron 45.2.3 包与二进制均就位 |

> **成本重估**：你担心「普通 harness 缺失成本比较高」——实际 harness 骨架齐备，**补齐成本主要在联调验证，不在重建**。真正的大头在下面 2.2。

### 2.2 「点击即用」的六个真实卡点

| 级别 | 卡点 | 证据 |
|---|---|---|
| 🔴 | **无打包配置** | `apps/wcc-desktop/package.json` 的 `build` = `echo 'package with electron-builder later'`；全仓 `find` 无 `electron-builder` / `forge.config` / `.nsi` → **没有可分发 exe** |
| 🔴 | **启动器依赖本机特定路径** | `wcc-启动器.bat` 硬编码 `C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-6`，且需手选菜单 `[4]` → 换机即断、也不是「点击即用」 |
| 🟠 | **Electron 版本声明不一致** | 桌面包声明 `electron ^33.0.0`，实际装的是 **45.2.3**；`main.js` 用的 API 都是 33 就有的，理论兼容，但**未实测** `npm run dev:desktop` |
| 🟠 | **模型 Key 仍需用户填** | 零配置做不到；只能做到「一次填国产 Key」 |
| 🟠 | **forge 首次需指魔兽目录** | 第二次配置；`WC3FORGE_EXE` 已持久化，但编辑器内路径未配 |
| 🟠 | **运行时体积/路径** | 依赖 `node_modules`（61 包 + Electron 二进制 100MB 级）→ 打包体积与资源路径需处理 |

### 2.3 成本重估表

| 你以为的成本 | 实际成本分布 |
|---|---|
| 造通用 harness（高） | **低**：已有，只需联调 |
| 点击即用（中） | **高**：electron-builder 配置、便携 exe、去掉硬编码 node 路径、首次启动引导、模型/forge 两步配置收拢 |
| 分发合规（未计入） | **新增隐性成本**，见 2.5 |

> **产业佐证与补强清单**：Strands Harness（AWS，Apache-2.0）与 Deep Agents（LangChain，MIT）都把「通用 agent harness」当作独立开源品类，且 model-neutral —— 支持论断 A。harness 层具体该补哪些机制，见 `docs/HARNESS-REFERENCE.md`：结论是优先补「上下文工程 + 质量门禁」（steering 条件加载、hooks、spec 落盘），这些改造**不引入新依赖、不增加分发体积**，与上面的打包成本是两件事。

### 2.4 产品定义校准

「开箱即用」可达的定义是：

> **零命令行 + 零翻墙 + 一次填国产模型 Key + 双击即用 + 自动拉起 Sidecar + 自动探测 forge**

不可达的是「零配置」——API Key 与 forge 的魔兽目录必须用户给一次。建议把这句写进产品定义，避免验收落差。

### 2.5 🔴 产品化新增的合规红线（最易被忽略）

WCC = **MIT**（`LICENSE` 已核）；wc3-forge = **GPL-3.0-or-later**（源自 HiveWE 移植义务）。

| 分发方式 | 判定 |
|---|---|
| 独立进程 + MCP 协议通信 + **分别安装** | 通常不构成衍生作品，WCC 保持 MIT ✅ |
| 把 `wc3-forge.exe` **打进 WCC 安装包**一起分发 | 有 GPL 传染争议 🔴 |

**结论**：WCC 安装包**不捆绑 forge**，只做「检测 `WC3FORGE_EXE` → 提示自行下载 → 引导首次配置」。既降体积，也把许可证风险隔离在产品之外。这条要在写打包脚本前定死。

---

## 3. 论断 B：代码二分，只提优化 PR，harness 留本地

### 3.1 建议的拆分边界

| 归属 | 内容 |
|---|---|
| **留本地（WCC harness 本体）** | `apps/wcc-desktop/*`；`packages/wcc-sidecar/src/` 下 `server / agent / tools / config-store / onboarding / session-store / workbench / codegen / build-map / table-import / lua-extract`；`wcc-lib`、`wcc-skill`、`wcc-lua-check`；`docs/*`；启动器 bat |
| **可提交 PR 的「优化部分」** | **不是从 WCC 切文件**，而是 fork forge 后改 **forge 自己的** `mcp/src/*`、`site/content/docs/*`、`mcp/README.md` |
| **灰区（建议留本地）** | `packages/wcc-sidecar/src/forge-mcp.js`（WCC 的 forge 客户端）、`docs/forge-protocol.md`。若要贡献，只贡献**协议事实的文档修正**，不搬代码 |

### 3.2 🔴 许可证两种情形必须分清

| 情形 | 做法 | 后果 |
|---|---|---|
| **(a)** fork forge → 改 forge 自身代码 | 改的是 GPL 仓库 | 与 WCC 的 MIT 完全无关，干净 ✅ |
| **(b)** 把 WCC 的 MIT 代码搬进 forge 仓库 | 复制出去 | 那部分随 forge 以 GPL 分发；WCC 本体仍是 MIT，但**这部分不再由你独占 MIT 授权**，且**反向不能把 forge 代码带回 WCC** 🟠 |

→ **建议只走 (a)**。另外：若同一逻辑两边各留一份，未来必然出现「双份维护 + 许可证分叉」。从一开始就用**两个独立 clone / 两条独立提交线**物理隔离，不要来回复制。

### 3.3 工程前提（当前不就绪）

- 🔴 `origin` = `https://gitclone.com/github.com/Aurirlk/Wcc-deskTop.git` —— **只读镜像，不能 push、不能提 PR**。提 PR 必须走 `github.com` 网页版，或另加一个 github remote。
- 🟠 工作区脏，拆分前需先归类：
  - `M package-lock.json` —— `npm install` 同步了 `hasInstallScript` 与 `apps/wcc-desktop` 的 `devDependencies → optionalDependencies`，属**正常同步、非手工改动**；
  - `M packages/wcc-lua-check/src/cli.js` —— `git diff` **无实质内容**，仅状态标记；
  - `?? docs/ASSETS-GUIDE.md`、`?? docs/FORGE-INTEGRATION.md`、`?? vendor/`、`?? wcc-启动器.bat` —— 本轮我方新增，需先决定归档还是提交。
  - 🟠 **状态更新（11-09 晚）**：又新增 `?? harness/`、`?? docs/HARNESS-IMPLEMENTATION.md`、`?? docs/FEASIBILITY-REVIEW.md`、`?? docs/HARNESS-REFERENCE.md`，以及 `M wcc-skill/` 8 份文档（仅加 steering 头部元数据，正文未动，`git diff --stat` = +50 行 / 0 删除）。**拆分基线比写作时更脏，仍建议先归类再谈二分**。
- 按你一贯习惯，**未替你做任何 git commit**。

### 3.4 结论

二分**可行且是正确做法**，但「只提交优化部分」应理解为：**在 forge 的 fork 里提交「对 forge 的优化」**，而不是「把 WCC 的一部分切出来送进去」。后者引入许可证与维护分叉，收益并不更高。

---

## 4. 论断 C：wc3-forge 增强 MCP 功能

### 4.1 先澄清歧义

| 解读 | 可行性 |
|---|---|
| **C1**：提 PR 给 forge 补 MCP 工具 / 修 bug | 🟠 技术可行，组织不确定（见 4.3 / 4.4） |
| **C2**：WCC 侧把 forge 当「增强的 MCP 执行层」调用，**forge 本体不改** | ✅ 100% 自己可控、无需 PR、零许可证风险 |

**建议：C2 先做实，C1 再作为关系建立**。两者不冲突，C2 的实测结果正好给 C1 提供真实议题。

### 4.2 forge MCP 结构实测

| 文件 | 规模 | 含义 |
|---|---|---|
| `mcp/src/tools.ts` | **1392 行** | 单文件用 `zod` + `McpServer` 注册全部工具 |
| `mcp/src/index.ts` | **23 行** | 注册 `registerTools` + `StdioServerTransport` |
| `bridge_client.ts` / `discovery.ts` | — | SessionPool / BridgeError / lockfile 会话发现 |
| `mcp/README.md` | 59 行 | 明写注册给 Claude Code（`--scope` 顺序坑都写了） |

→ **纯 TS 层加工具、改错误提示、修健壮性都很便宜**；一旦新工具需要 Go 侧 bridge 新 RPC，按 README 要求要 **GUI + MCP 双表面同时改**，成本陡增。

### 4.3 PR 候选分级

| 级别 | 内容 |
|---|---|
| ✅ 低成本（推荐首 PR） | 文档（`site/content/docs/*.mdx`、`mcp/README.md`：Windows 路径、`--scope` 顺序、免翻墙说明）；`discovery.ts` / `bridge_client.ts` 健壮性（超时、错误文案、Windows 路径、会话失效重连）；测试补充；**纯查询类工具**（仅封装已有 bridge RPC，不动 Go） |
| 🟠 中 | 需要 Go 侧配合的新工具 |
| 🔴 高 / 不建议首 PR | 改 Go 核心、改 GUI、以「功能增强」为名的大改 |

⚠️ 议题必须来自**真实踩到的 bug / 真实需要**，不编造。维护者是工程师，虚标议题会直接毁掉信任。

### 4.4 组织风险（本方案最大的不确定项）

| 事实 | 影响 |
|---|---|
| alpha、14★ / 2 forks、单人 493 commits | 维护带宽有限 |
| **25 个 PR 全是维护者自己开的，零外部 PR 先例** | 无流程可循，首 PR 响应不确定 |
| 无 `CONTRIBUTING.md`、无 PR/Issue 模板、Discussions 未开 | 提案只能开 Issue |
| v1.0.7 (2026-09-05) 后低频维护，最后 push 10-28 | 周期长 |
| ✅ 维护者自用 Claude Code（有 `CLAUDE.md`、`claude` 贡献账号） | 对「AI 驱动 + 领域知识」理念天然契合 |

→ **不要把「增强 MCP 功能」当首个 PR 目标**。先用小修复 / 文档 PR 建立可合并记录，再谈功能增强与协作权限。

---

## 5. 风险汇总

| 级别 | 风险 | 缓解 |
|---|---|---|
| 🔴 | 分发包捆绑 GPL 的 forge | WCC 只检测/引导，不捆绑 |
| 🔴 | `gitclone.com` remote 不能提 PR | 改走 github.com 网页版 Fork |
| 🔴 | 无打包配置 = 产品化最后一步没走 | 先做最小 electron-builder 便携包验证 |
| 🟠 | MIT 代码外搬导致 GPL 化 / 双份维护 | 只走 (a)，两条提交线物理隔离 |
| 🟠 | 工作区脏，拆分基线不清 | 先归类并提交，再开始二分 |
| 🟠 | Electron ^33 vs 实际 45.2.3 未实测 | 隔离环境试跑桌面壳 |
| 🟠 | forge 零外部 PR 先例，增强类 PR 可能被搁置 | 首 PR 降级为文档 / 健壮性 |
| ✅ | harness 已有实物、领域层独立、国产模型默认可用 | 直接复用，不重建 |

---

## 6. 最小验证动作（本次不执行，仅列）

1. 隔离环境试 `npm run dev:desktop`，确认 Electron 45 能跑现有 `main.js`（注意会弹 GUI，此前 GUI 安装器曾卡死）。
2. 加一份最小 `electron-builder` 配置产出便携 exe，验证「换路径、无本机 node 也能运行」。
3. 网页版 Fork forge → 在线改一处文档 → 走一遍 PR 流程，验证免翻墙链路。
4. WCC 侧跑通 forge 探测/连接，`/health` 出现 `forgeConnected: true`，作为 C2 的实证。
5. 归类并提交当前工作区改动，建立干净拆分基线。

---

## 7. 需要你拍板

1. 论断 C 指 **C1**（给 forge 提 PR）还是 **C2**（WCC 侧调用增强），还是两者并行、C2 优先？
2. 「优化部分」具体指哪类：bug 修复 / 文档 / 纯 TS 查询工具 / 协议健壮性？给一个真实议题，我就能把 PR 成本量化。
3. 是否接受 3.2 的情形 (b)（搬 WCC 代码进 forge、那部分 GPL 化）？**我建议否**。
