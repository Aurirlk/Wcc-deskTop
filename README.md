# Warcraft Campaign Craft (WCC)

> 魔兽争霸3战役 · **桌面 AI Harness**（WorkBuddy 式）· Lua 1.31+ · **最终目标：一句话 → 可试玩地图（当前 🔴 未通）**
>
> **单一逻辑数据源**：本地 `main`、GitHub <https://github.com/Aurirlk/Wcc-deskTop>、Gitee **私有**仓库 <https://gitee.com/wei-kaijie/Wcc-deskTop>（项目仍是半成品，刻意不公开）是**同一份数据的三处副本**，不再区分主仓库 / 镜像 / 谁更新；每次推送两端同时同步（`npm run sync` / `npm run sync:check`）。最新 HEAD 一律以 `git log -1` 为准。
>
> <sub>历史快照（2026-11-10）：当日曾「以 Gitee 最新提交为基准合并 GitHub 原分叉与本地改动」，该叙事仅作沿革记录，不是现行口径。</sub>
> 开发主线与下一步排期见 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md)；换机、凭据与归档见 [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) §1。

> 🎮 让 AI 成为你的魔兽争霸3战役开发搭档

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Warcraft III](https://img.shields.io/badge/Warcraft%20III-v1.31%2B-blue.svg)]()
[![Lua](https://img.shields.io/badge/Lua-5.3-green.svg)]()

## 🌟 项目愿景

WCC 是面向中文地图作者的**桌面 AI Harness**：用自然语言描述战役需求，由 Agent 生成符合 WCC 规范的 Lua 战役逻辑，经过静态检查与质量门禁，打包成 `war3map.lua` 脚本包，最终注入真实地图并在 1.31+ 客户端里试玩。`wcc-lib`（安全封装库）、`wcc-skill`（AI 编码规范与模式库）与 `harness/`（上下文工程层）共同构成它的领域能力。

> **目标 vs 现状（务必分清）**：用户 2026-11-11 拍板「**端到端可玩地图是最终目标**」；但当前 **🔴 未达成**——`build_map` 只产文本脚本包、仓库零 `.w3x`、本机 1.26 只支持 JASS。目标、边界、完成标志与红线的**唯一权威陈述**在 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) 第一部分「开发目标」，本 README 不复述全文。

### 为什么选择 WCC？

| 传统WE触发器 | WCC + AI |
|-------------|----------|
| 图形化节点，难以版本控制 | 纯Lua代码，Git友好 |
| 复制粘贴，难以复用 | 模块化设计，一次编写多处使用 |
| 调试困难，只能在游戏中测试 | 日志系统 + AI辅助除错 |
| 学习曲线陡峭 | 自然语言描述需求，AI生成代码 |

## 🚀 快速开始

> 本 README 是**使用文档唯一入口**：安装、启动、命令、端点、故障排查都在下方「使用指南」。
> 换机迁移见 [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md)，桌面快捷方式见 [docs/DEPLOYMENT-SHORTCUTS.md](docs/DEPLOYMENT-SHORTCUTS.md)。

### 前置条件

| 项 | 要求 | 说明 |
|---|---|---|
| Node.js | **≥ 20**（见 `package.json` 的 `engines`） | Sidecar 与测试需要；`harness/` 本身零依赖 |
| 操作系统 | Windows（当前实测环境） | 桌面壳为 Electron |
| 魔兽争霸3 | **1.31+ / Lua** 客户端 | **仅最终试玩需要**；本机 1.26.0.6401 只支持 JASS，不能试玩 `war3map.lua` |
| 模型 | OpenAI 兼容 API Key，或本地 Ollama | 不配 key 也能跑，但 `/chat` 只回离线文本、零工具调用 |
| Electron | 可选 | 本机二进制缺失，桌面启动与打包会如实失败 |

### 安装

```bash
git clone https://github.com/Aurirlk/Wcc-deskTop.git
# 或：git clone https://gitee.com/wei-kaijie/Wcc-deskTop.git   # 私有仓库，需凭据
cd Wcc-deskTop
npm install          # postinstall 只探测 Electron，缺失时打印提示且不报错
npm test             # 全量回归（现行基线见主计划第一部分现状）
npm run check        # Lua 静态检查，0 error 才算通过
npm run docs:check   # 文档口径一致性门禁
```

`wcc-lib/` 已随仓库提供；`build-map.js` 会在项目根及其上两级自动查找它，**不需要手动复制到地图项目**。

### 第一个战役脚本

> ⚠️ **进图方式（2026-11-11 校正）**：WC3 原生 Lua **没有 `require`**。本文与
> `wcc-skill/` 示例里的 `require("src.*")` 只用于**源码组织**，`build-map.js` 会把依赖
> 内联成单文件 `dist/build/war3map.lua`（自造 `__wcc_require`）。
> **不要在 World Editor 触发器里写 `require("src.main")`**；直接把 `war3map.lua` 全文
> 粘贴进地图脚本，或走 P2 阶段 B 的 E3 durable 双写。需 **1.31+ 客户端**；本机 1.26 只支持 JASS，不能直接试玩。

1. 编写 `src/main.lua`：

   ```lua
   local core = require("src.lib.wcc-core")
   local dialogue = require("src.lib.wcc-dialogue")

   -- 初始化WCC
   core.Log("WCC 已加载！")

   -- 创建一段对话
   dialogue.Play({
       {speaker = "阿尔萨斯", text = "我们到了，斯坦恩布莱德。"},
       {speaker = "乌瑟尔", text = "保持警惕，王子殿下。"}
   })
   ```

2. 运行 `build_map`（真实命令见「使用指南」），得到 `dist/build/war3map.lua` 与 `src-tree/`。

3. 在 WE 的**地图脚本**中粘贴 `war3map.lua` 全文。**🔴 本机不能试玩**：1.26 只支持 JASS，且本构建**不产出 `.w3x`**。要真正进图需自备 1.31+ 客户端与一张真实地图，并按 [docs/MAP-COMPILE-PIPELINE.md](docs/MAP-COMPILE-PIPELINE.md) 的两阶段 P0 验收；该链路当前按条件触发封锁。

## 🧭 使用指南（唯一入口）

> 现行基线、证据等级与完成标志只看 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) 第一部分现状；本节只写「怎么跑」，不写会过期的数字。

### 全部 npm scripts

| 命令 | 实际行为 | 备注 |
|---|---|---|
| `npm install` | 安装 workspaces 依赖；`postinstall` 探测 Electron 二进制 | 缺失时打印 `electron NOT usable` 并正常退出，**不谎报可用** |
| `npm test` | 串联 sidecar + lua-check + shared + harness 四段测试 | 提交前必跑 |
| `npm run check` | 对 `examples/demo-campaign/src` 与 `wcc-lib` 跑 Lua 静态检查 | `ok` 只表示 0 error，warning 是复核提示 |
| `npm run docs:check` | 文档口径一致性门禁 | 退出码非 0 即失败 |
| `npm run sidecar` | 启动 Sidecar，监听 `127.0.0.1:47840` | **必须指定项目根，见下** |
| `npm run dev:desktop` | 启动 Electron 桌面壳 | 🔴 本机二进制缺失，EXIT=1 |
| `npm run build:desktop` | 打包分发（属 P3） | 🔴 **EXIT=1 + 「P3 未实现」是预期行为**，不是打包成功 |
| `npm run sync` | 一次推两端并校验三处一致 | 分叉拒绝、禁强推、脏工作区拒绝 |
| `npm run sync:check` | 只校验不推送 | 推前体检 |
| `npm run test:harness` | 单独跑 harness 自测 | 零依赖 |

`wcc-启动器.bat` 菜单：`[1]` Sidecar / `[2]` check / `[3]` test / `[4]` Desktop / `[5]` harness demo + selftest。

### 启动 Sidecar（必须指定项目根）

Sidecar 用 `WCC_PROJECT_ROOT` 或当前目录作为项目根。仓库根**没有 `src/`**，直接从仓库根启动后
`/build`、`/check` 都会因目标不存在而失败（`/build` 返回 HTTP 500 且**不写产物**）。

```bash
WCC_PROJECT_ROOT=examples/demo-campaign npm run sidecar
# Windows CMD: set WCC_PROJECT_ROOT=examples/demo-campaign && npm run sidecar
curl -s http://127.0.0.1:47840/health
```

默认端口 `47840`，可用 `WCC_SIDECAR_PORT` 覆盖。桌面壳会自动把项目根设为
`examples/demo-campaign`，所以从桌面启动时无需手设。启动会在 `<projectRoot>/.wcc/`
写 `config.json` 与会话 JSONL——该目录含凭据，**被 gitignore 忽略，绝不入库**。

### 配置模型（有 key 才真正调模型）

优先级从低到高：环境变量 → `<projectRoot>/.wcc/config.json` → 设置页 / `POST /config`。

| 环境变量 | 用途 |
|---|---|
| `WCC_MODEL_BASE_URL` / `WCC_MODEL_API_KEY` / `WCC_MODEL_NAME` | OpenAI 兼容 base URL / Key / 模型名 |
| `WCC_AUTO_APPROVE` | `1` 时跳过写文件审批（生产勿默认开启） |
| `WCC_PROJECT_ROOT` / `WCC_SIDECAR_PORT` / `WCC_SKILL_ROOT` / `WCC_NODE` | 项目根、端口、skill 目录、node 可执行文件 |

设置页 provider 下拉经 `providerPatch` 自动填预设：`deepseek` / `qwen` / `zhipu` / `moonshot` /
`doubao` / `ollama` / `custom`。**`ollama` 是唯一无需 key 的 provider**（本地 `127.0.0.1:11434`）。

```bash
curl -s -X POST http://127.0.0.1:47840/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"qwen","apiKey":"<你的 key>"}'
```

未配置 key 时 `/chat` 与 `/chat/stream` 走 `offlinePlan()`：只返回中文建议文本，
**不请求模型、不产生任何工具调用**。

### 常用 HTTP 端点

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/health` | 服务 / 模型 / harness 接线状态（运行时探测） |
| POST | `/chat/stream`、`/chat` | 对话（SSE 流式 / 一次性） |
| GET | `/check?subpath=src` | 复用同一 `lua_check` 工具；有 error 返回 500 |
| POST | `/build` | 打包战役脚本；缺模块返回 500 且**不写产物** |
| GET | `/config`、`/experts`、`/tools` | 配置（隐藏 key）/ 专家 / 工具清单 |
| GET | `/harness/state`、`/harness/steering`、`/harness/tools` | 产品进程内**同一个** harness 实例的只读视图 |
| GET | `/harness/providers`、`/harness/spec`、`/harness/hooks`、`/harness/scratch` | 预设、spec、hook 日志、scratch |
| POST | `/harness/dispatch` | 手动触发工具（需审批的工具走审批） |
| GET | `/harness/pipeline` | 7 层管线开关 + 每轮 journal（**真实执行**）+ spec |
| GET | `/harness/tui-state` | 产品 harness 状态，供 CLI TUI `--remote` 读同一份数据 |
| GET/POST | `/harness/annotate` | 补 skill 文档 front matter；GET 默认 dry-run，仅 POST `{"write":true}` 才写文件 |
| GET | `/session/*`、`/workbench/*`、`/maps/*`、`/forge/*`、`/onboarding/*` | 会话、工作台、地图源、forge、向导 |

```bash
curl -s "http://127.0.0.1:47840/harness/steering?intent=%E5%86%99lua%E5%B9%B6%E6%A3%80%E6%9F%A5"
curl -s "http://127.0.0.1:47840/harness/tools?intent=%E5%86%99lua"
curl -s "http://127.0.0.1:47840/harness/pipeline"
curl -s -X POST http://127.0.0.1:47840/build \
  -H "Content-Type: application/json" -d '{"entry":"src.main"}'
```

产物在 `examples/demo-campaign/dist/build/`：`war3map.lua`（单文件内联 `__wcc_require`）、
`src-tree/`、`README.md`、`build-stats.json`。`dist/` 是生成物，被 gitignore 忽略、不入库。
端点实现的唯一真相是 `packages/wcc-sidecar/src/server.js`；桌面 IPC 见
`apps/wcc-desktop/src/preload/preload.cjs`。`/harness/spec` `/harness/hooks` `/harness/scratch`
`/harness/dispatch` 以及新增的 `/harness/pipeline` `/harness/tui-state`
`/harness/annotate` 目前在桌面 UI 侧没有 IPC 通道，需直接 HTTP 调用。

### harness CLI（零依赖，可独立跑）

```bash
node harness/bin/wcc-harness.mjs demo        # 离线全链路（无参数即 demo）
node harness/bin/wcc-harness.mjs selftest   # harness 自测
node harness/bin/wcc-harness.mjs help        # 打印全部子命令
node harness/bin/wcc-harness.mjs steering list
node harness/bin/wcc-harness.mjs steer --intent="写一段对话"
node harness/bin/wcc-harness.mjs spec status
node harness/bin/wcc-harness.mjs scripts
node harness/bin/wcc-harness.mjs providers
node harness/bin/wcc-harness.mjs tui --static
node harness/bin/wcc-harness.mjs tui --static --remote http://127.0.0.1:47840
```

`steering annotate --write` 会改仓库文件（默认 dry-run）；`tui`（不带 `--static`）需要真 TTY。
7 层 pipeline 已在**产品主循环**每次模型调用时执行（见 `/harness/pipeline` 的 journal）；
CLI TUI 加 `--remote` 后读取产品 Sidecar 的同一份状态，不再另建实例。
`/harness/annotate` 默认 dry-run，只有显式 POST `{"write":true}` 才改仓库文件。

### 当前能做什么 / 不能做什么

| ✅ 现在能做 | 🔴 现在不能做 |
|---|---|
| 写 Lua 战役逻辑、静态检查、质量门禁回喂 | 产出二进制 `.w3x`、在 WE 里试玩 |
| 打包 `war3map.lua` 脚本包、3 章示例资产 | 无 key 时真实模型生成 |
| 文本 IR 的 snapshot / diff / verify 闸门 | 真实 `.w3x` round-trip、脚本注入 |
| harness 条件注入 / 按需工具 / 预算 / scratch | electron 打包分发、真 forge 联调 |
| 7 层 pipeline 每轮编排、TUI `--remote` 共用状态 | TUI 嵌进 Electron（不做，改用 `--remote`） |
| 离线 demo / selftest / 双端同步 | 物编 ID 查表（字典覆盖率 0） |

阶段 A/B 与物编字典数据核实按用户自备环境**条件触发**：用户 2026-11-11 明确本机魔兽资产
至少 3 天后才有、当前网络/资源不支持下载；期间不联网取数、不编造四字码、状态行不推进。

### 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| `/build`、`/check` 返回 500 | 从仓库根启动了 Sidecar；设 `WCC_PROJECT_ROOT=examples/demo-campaign` |
| `dev:desktop` / `build:desktop` EXIT=1 | Electron 二进制缺失 / 打包属 P3 未实现，**是预期行为** |
| `/chat` 只回文本、不调工具 | 未配 key，走 `offlinePlan()`；配 key 或选 `ollama` |
| `npm run sync` 拒绝推送 | 分叉或已跟踪文件未提交；先 fetch + merge，禁止强推 |
| `npm run docs:check` FAIL | 文档口径过期；按输出的命中行修正 |
| `npm test` 偶发 `JavaScript heap out of memory` 或成片用例失败 | 本机可用内存偏低，而 `node --test` 默认按 CPU 核数（本机 16 核）并发起多个进程 → **不是代码缺陷**。单跑一次基线为 76/76；内存紧张时分别单跑各 suite，或给 `node --test` 加 `--test-concurrency=2`，**不要据此判定测试挂了** |
| 想确认某端点是否存在 | 直接读 `packages/wcc-sidecar/src/server.js` |

---

## 📚 核心组件

### wcc-lib (核心库)

| 模块 | 功能 |
|------|------|
| `wcc-lib/` | 发给地图项目的 Lua 运行时（core/timer/logger/gc/math/dialogue/quest/spawner/boss-fight） |
| `wcc-skill/` | AI 编码规范与模式库 |
| `apps/wcc-desktop/` | 桌面壳（会话 UI） |
| `packages/wcc-sidecar/` | Agent Loop、工具、审批 |
| `packages/wcc-lua-check/` | Lua 静态检查 |
| `harness/` | **独立零依赖 Harness 层**（steering / hooks / spec / scratch / provider / budget / 中间件 / 工具注入 / TUI） |
| `examples/demo-campaign/` | 示例战役 |
| `docs/` | 计划、调研、实现记录 |
| `attic/novel-workflow/` | 已隔离的小说工作流模板

### wcc-skill (AI技能包)

让AI助手理解魔兽争霸3开发的最佳实践：

- `skill.md` - AI角色定义与全局约束
- `knowledge/` - 编码规范、API最佳实践
- `patterns/` - 常见任务模板（Boss战、对话序列等）

## 🎯 使用示例

### Boss战模板

```lua
local Core = require("src.lib.wcc-core")
local BossFight = require("src.lib.wcc-boss-fight")

-- bossId 必须来自已核实的物编 ID 字典；当前字典覆盖率 0，
-- 因此示例显式留空 —— 绝不臆造 'Nbal' 之类四字码。
local verifiedBossId = nil
if not verifiedBossId then
    Core.Log("bossId 未核实，跳过创建（不臆造四字码）")
    return
end

-- 正确 API：New(config) 建实例，:Start() 无参启动
local bf = BossFight.New({
    bossId = verifiedBossId,
    spawnX = 1000,
    spawnY = 1000,
    phases = {
        { healthPercent = 100, onEnter = function() Core.Log("战斗开始！") end },
        { healthPercent = 50,  onEnter = function() Core.Log("Boss 进入狂暴状态！") end }
    }
})
if bf then bf:Start() end
```

> 旧版这里写成 `bossFight.Start({ bossId = 'Nbal', ... })`，既用错了 API
> （`wcc-lib/wcc-boss-fight.lua` 的构造是 `WCC_BossFight.New(config)`，启动是无参 `:Start()`），
> 又硬编码了一个**未核实**的四字码。现已按 [wcc-skill/knowledge/wc3-object-ids.md](wcc-skill/knowledge/wc3-object-ids.md) 的口径修正。

Harness 层（独立目录、零依赖、**不进 npm workspaces**，不影响上面的命令）：

```bat
npm test                                   :: 全量回归（现行基线见主计划第一部分）
npm run check                              :: Lua 静态检查（0 error 才算通过）
npm run docs:check                         :: 文档口径一致性门禁
node harness/bin/wcc-harness.mjs demo      :: 离线全链路
node harness/bin/wcc-harness.mjs selftest :: harness 自测
```

> ✅ **2026-11-10 P1 已接入**：`harness/` 不再是旁路层——`createHarness()` 已接进
> `packages/wcc-sidecar/src/agent.js`（steering 条件注入、工具按需注入、budget 停止条件、
> scratch 卸载、hooks 质量门禁与报错回喂），并由 `server.js` 暴露 `/harness/*` 供**产品进程内**的桌面读取同一实例；
> 独立 CLI TUI 在另一进程自建实例，不与产品共用状态。
> 它仍保持**零 npm 依赖、不进 npm workspaces**，上面的 CLI 命令依旧可独立运行。
> 实现细节见 [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md)，
> P1 验收记录见 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) 附录 A。
>
> ✅ **2026-11-11 状态补充**：P1.5 已补齐 `agentsFile` 注入、renderer 状态面板、`/check` 真实检查输出与质量门禁；
> P2 已落地 `wcc.map.snapshot` / `diff` / `verify` 三个文本 IR 闸门（见主计划附录 A.4 / A.5）。
> `npm run build:desktop` 目前明确报错「P3 未实现」并 EXIT=1，**不是**打包成功。

### 用自然语言描述需求

在 VSCode 或桌面会话里说：

> "帮我写一个刷怪系统，每 30 秒在区域 gg_rct_spawn_point 生成 5 只食尸鬼，向玩家基地移动"

配好模型 key 后，Agent 会按 `wcc-skill/skill.md` 的规范生成代码、跑 `lua_check` 并把错误回喂修正；未配 key 时只回离线建议文本。环境变量、provider 预设与 `POST /config` 的写法见「使用指南 → 配置模型」。

> ⚠️ 本仓库面向 **Lua 1.31+**。本机实测为 **War3 1.26.0.6401**（只支持 JASS），因此这台机器上**不能直接试玩 `war3map.lua`**。版本约束与三种可选路径见 [docs/MAP-COMPILE-PIPELINE.md](docs/MAP-COMPILE-PIPELINE.md)。  

## 文档

> **索引只此一份**，不另建文档地图。裁决顺序：**代码事实 > 最新主线文档 > 历史文档（快照）**。

**主线 / 现行依据**

- [AGENTS.md](AGENTS.md) — **仓库级 Agent 契约**（`mode: always` 注入给每个 Agent）：唯一入口指针、工程约定、术语消歧、红线；规范权威仍是 `wcc-skill/skill.md`
- [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) — **下一步开发计划（唯一排期依据）+ 开发目标唯一权威陈述**：现行基线、P2 条件触发 → P4、B+A 双轨决策、附录 A 执行记录 / B 编号映射 / C IR 契约
- [docs/P0-DISPOSITIONS.md](docs/P0-DISPOSITIONS.md) — `@wcc/shared` 冻结 / `wcc-hotreload` 环境限制（与主计划文档分层表一致，归**主线**）
- [docs/MAP-COMPILE-PIPELINE.md](docs/MAP-COMPILE-PIPELINE.md) — 编译链专项、**`.wcc/ir/` 目录契约唯一权威**、三条硬约定落地状态、两阶段 P0 验收
- [docs/MAP-GENERATION-PLAN.md](docs/MAP-GENERATION-PLAN.md) — 地图生成四路线、M0/M1/M2 子项目阶段、虚标清单
- [docs/ASSETS-GUIDE.md](docs/ASSETS-GUIDE.md) — 素材来源、物编 ID 数据缺口与提取路径
- [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md) — Harness 实现记录（文首有 P1 状态更新注记）
- [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) — 换机迁移清单、回归验证、1.31+ 环境就绪检查
- [docs/DEPLOYMENT-SHORTCUTS.md](docs/DEPLOYMENT-SHORTCUTS.md) — 部署快捷方式建议与红线
- [wcc-skill/knowledge/wc3-object-ids.md](wcc-skill/knowledge/wc3-object-ids.md) — **物编 ID 字典骨架**（🔴 覆盖率 0，绝不编造四字码）
- [examples/demo-campaign/manifest.json](examples/demo-campaign/manifest.json) — 示例战役双轨配置（`targetPatch` / `language` / `mapGenerated: false`）；3 章样本见 `tables-sample.json`

**参考（沿革与调研，非排期；部分结论已过期，以各文文首注记为准）**

- [docs/HARNESS-REFERENCE.md](docs/HARNESS-REFERENCE.md)（「§7 已作废」）、[docs/FEASIBILITY-REVIEW.md](docs/FEASIBILITY-REVIEW.md)、[docs/FORGE-INTEGRATION.md](docs/FORGE-INTEGRATION.md) — 架构借鉴、独立 Harness 可行性、forge 生态与许可证边界
- [docs/DEVELOPMENT-NOTES.md](docs/DEVELOPMENT-NOTES.md)、[docs/workbuddy-research.md](docs/workbuddy-research.md)、[index.html](index.html) — 2026-09 调研与摘要页（**文首已加校正注记**；正文仍引用已快照的 `PROJECT-PLAN.md`，仅作沿革）
- [docs/bilibili-research.md](docs/bilibili-research.md)、[docs/map-sources-research.md](docs/map-sources-research.md)、[docs/forge-protocol.md](docs/forge-protocol.md) — B 站教程 / 地图站 / forge 线协议调研（文首已加校正注记）
- [examples/demo-campaign/README.md](examples/demo-campaign/README.md) — 示例战役三章数据与脚本包使用说明（**不是可玩地图**）
- [packages/wcc-skill-mimocode/wcc-warcraft-campaign/SKILL.md](packages/wcc-skill-mimocode/wcc-warcraft-campaign/SKILL.md)、[vendor/wc3-lua-annotations/README.md](vendor/wc3-lua-annotations/README.md) — 外部 Skill 定义与第三方 Lua 注解说明
- `wcc-skill/skill.md`（编程铁律唯一权威）、`wcc-skill/knowledge/*`、`wcc-skill/patterns/*` — 由 harness steering 按 front matter 条件注入

**快照（不作进度依据）**

- [PROJECT-PLAN.md](PROJECT-PLAN.md)、[PROJECT-PLAN-2.0.md](PROJECT-PLAN-2.0.md)、根 `wcc-ai-blueprint.md` / `wcc-architecture.md` / `wcc-skill.md`、[attic/](attic/) — 历史阶段产物，文首已加快照横幅；`项目状态与改进报告.md` 为本机未入库文件

### 如何贡献

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 贡献类型

- 🐛 **Bug修复** - 修复现有代码的问题
- ✨ **新功能** - 添加新的系统模块
- 📚 **文档** - 改进文档和示例
- 🎨 **模式模板** - 添加新的任务模式（如护送、防守等）
- 🗺️ **示例地图** - 创建演示用的战役脚本与文本 IR（**二进制 `.w3x` 不入库**）

### 代码规范

- 编程铁律、代码输出协议与违禁行为**唯一权威**是 `wcc-skill/skill.md`；`wcc-skill/knowledge/*.md` 由 harness steering 条件注入，作补充说明
- 所有公共 API 必须有 EmmyLua 注解
- 提交前至少跑 `npm test` 与 `npm run check`；改文档再跑 `npm run docs:check`；提交后 `npm run sync` 同步两端

## 📖 历史说明与路线图

> 本 README 早期曾并列「历史目录 / 新仓库」两套叙事并附一份旧路线图。三处 `main` 现已统一为**同一份数据的三个副本**（`npm run sync` 同时同步），不再区分新旧仓库，旧路线图已移除。
> **现行进度与排期只看 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md)**；已完成阶段见其附录 A。
> **使用文档只看本 README 的「使用指南」章节**（不另建手册）；开发目标只看主计划第一部分「开发目标」。

## 💬 社区

- GitHub <https://github.com/Aurirlk/Wcc-deskTop> 与 Gitee <https://gitee.com/wei-kaijie/Wcc-deskTop> 是**同一份数据的两个镜像**（`npm run sync` 同时同步，禁止只推一端 / 强推）。
- Issues / 讨论在任一仓库提交即可。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Warcraft III Lua API](https://www.hiveworkshop.com/) - Hive Workshop社区
- [EmmyLua War3](https://github.com/sumneko/war3-lua) - 类型注解库
- 所有贡献者和使用者

---

<p align="center">
  Made with ❤️ by Warcraft III modding community
</p>
