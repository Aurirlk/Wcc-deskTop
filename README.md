# Warcraft Campaign Craft (WCC)

> 魔兽争霸3战役 · **桌面 AI Harness**（WorkBuddy 式）· Lua 1.31+
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

WCC 是一个基于 LLM（大型语言模型）和 Lua 的《魔兽争霸3》战役级开发脚手架。它通过提供**安全封装库**、**标准化模式**和**AI专家提示词**，让开发者能使用自然语言与AI结对编程，快速构建复杂的游戏逻辑、剧情演出和Boss战。

### 为什么选择 WCC？

| 传统WE触发器 | WCC + AI |
|-------------|----------|
| 图形化节点，难以版本控制 | 纯Lua代码，Git友好 |
| 复制粘贴，难以复用 | 模块化设计，一次编写多处使用 |
| 调试困难，只能在游戏中测试 | 日志系统 + AI辅助除错 |
| 学习曲线陡峭 | 自然语言描述需求，AI生成代码 |

## 🚀 快速开始

### 前置条件

1. **魔兽争霸3** v1.31+ (或重制版)
2. **VSCode** + [Lua插件(Sumneko)](https://marketplace.visualstudio.com/items?itemName=sumneko.lua)
3. **AI助手** (GitHub Copilot / Cline / Cursor)
4. **Node.js** (用于本地开发服务器，可选)

### 安装步骤

```bash
# 1. 克隆仓库（GitHub 与 Gitee 三处已同步，任选其一）
git clone https://github.com/Aurirlk/Wcc-deskTop.git
# 或：git clone https://gitee.com/wei-kaijie/Wcc-deskTop.git   # 私有仓库，需凭据
cd Wcc-deskTop

# 2. 将 wcc-lib 复制到你的地图项目
cp -r wcc-lib/ /path/to/your/map/src/lib/

# 3. 在 VSCode 中打开项目
code .
```

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

2. 运行 `build_map`，得到 `dist/build/war3map.lua` 与 `src-tree/`。

3. 在 World Editor 的**地图脚本**中粘贴 `war3map.lua` 全文，保存并运行游戏测试！

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
local core = require("src.lib.wcc-core")
local bossFight = require("src.lib.wcc-boss-fight")

-- 配置Boss战
bossFight.Start({
    bossId = 'Nbal',  -- 恐惧魔王
    spawnX = 1000,
    spawnY = 1000,
    phases = {
        {
            healthPercent = 100,
            onEnter = function()
                core.Log("战斗开始！")
            end
        },
        {
            healthPercent = 50,
            onEnter = function()
                core.Log("Boss进入狂暴状态！")
            end
        }
    }
})
```

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

模型（可选，Sidecar 环境变量）：

在VSCode中对AI助手说：

> "帮我写一个刷怪系统，每30秒在区域gg_rct_spawn_point生成5只食尸鬼，向玩家基地移动"

AI会自动生成符合WCC规范的代码！

> ⚠️ 本仓库面向 **Lua 1.31+**。本机实测为 **War3 1.26.0.6401**（只支持 JASS），因此这台机器上**不能直接试玩 `war3map.lua`**。版本约束与三种可选路径见 [docs/MAP-COMPILE-PIPELINE.md §5](docs/MAP-COMPILE-PIPELINE.md)。  

## 文档

> **索引只此一份**，不另建文档地图。裁决顺序：**代码事实 > 最新主线文档 > 历史文档（快照）**。

**主线 / 现行依据**

- [AGENTS.md](AGENTS.md) — **仓库级 Agent 契约**（`mode: always` 注入给每个 Agent）：唯一入口指针、工程约定、术语消歧、红线；规范权威仍是 `wcc-skill/skill.md`
- [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) — **下一步开发计划（唯一排期依据）**：现行基线、P2 条件触发 → P4、B+A 双轨决策、附录 A 执行记录 / B 编号映射 / C IR 契约
- [docs/MAP-COMPILE-PIPELINE.md](docs/MAP-COMPILE-PIPELINE.md) — 编译链专项、**`.wcc/ir/` 目录契约唯一权威**、三条硬约定落地状态、两阶段 P0 验收
- [docs/MAP-GENERATION-PLAN.md](docs/MAP-GENERATION-PLAN.md) — 地图生成四路线、M0/M1/M2 子项目阶段、虚标清单
- [docs/ASSETS-GUIDE.md](docs/ASSETS-GUIDE.md) — 素材来源、物编 ID 数据缺口与提取路径
- [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md) — Harness 实现记录（文首有 P1 状态更新注记）
- [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) — 换机迁移清单、回归验证、1.31+ 环境就绪检查
- [docs/DEPLOYMENT-SHORTCUTS.md](docs/DEPLOYMENT-SHORTCUTS.md) — 部署快捷方式建议与红线
- [wcc-skill/knowledge/wc3-object-ids.md](wcc-skill/knowledge/wc3-object-ids.md) — **物编 ID 字典骨架**（🔴 覆盖率 0，绝不编造四字码）

**参考（结论有效，非排期）**

- [docs/P0-DISPOSITIONS.md](docs/P0-DISPOSITIONS.md) — `@wcc/shared` 冻结 / `wcc-hotreload` 环境限制
- [docs/HARNESS-REFERENCE.md](docs/HARNESS-REFERENCE.md)、[docs/FEASIBILITY-REVIEW.md](docs/FEASIBILITY-REVIEW.md)、[docs/FORGE-INTEGRATION.md](docs/FORGE-INTEGRATION.md) — 调研、二分 PR 可行性、forge 生态与许可证边界
- [docs/DEVELOPMENT-NOTES.md](docs/DEVELOPMENT-NOTES.md)、[docs/workbuddy-research.md](docs/workbuddy-research.md)、[index.html](index.html) — 注意事项、调研摘要页
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
