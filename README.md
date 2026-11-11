# Warcraft Campaign Craft (WCC)

> 魔兽争霸3战役 · **桌面 AI Harness**（WorkBuddy 式）· Lua 1.31+
>
> **单一逻辑数据源**：本地 `main`、GitHub <https://github.com/Aurirlk/Wcc-deskTop>、Gitee **私有**仓库 <https://gitee.com/wei-kaijie/Wcc-deskTop>（项目仍是半成品，刻意不公开）是**同一份数据的三处副本**，不再区分主仓库 / 镜像 / 谁更新；每次推送两端同时同步（`npm run sync` / `npm run sync:check`）。最新 HEAD 一律以 `git log -1` 为准。
>
> <sub>历史快照（2026-11-10）：当日曾「以 Gitee 最新提交为基准合并 GitHub 原分叉与本地改动」，该叙事仅作沿革记录，不是现行口径。</sub>
> 开发主线与下一步排期见 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md)；换机、凭据与归档见 [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) §1。最新 HEAD 一律以 `git log -1` 为准。

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
node --test harness/test/harness.test.js
node harness/bin/wcc-harness.mjs demo
node harness/bin/wcc-harness.mjs tui --static
```

> ✅ **2026-11-10 P1 已接入**：`harness/` 不再是旁路层——`createHarness()` 已接进
> `packages/wcc-sidecar/src/agent.js`（steering 条件注入、工具按需注入、budget 停止条件、
> scratch 卸载、hooks 质量门禁与报错回喂），并由 `server.js` 暴露 `/harness/*` 供**产品进程内**的桌面读取同一实例；
> 独立 CLI TUI 在另一进程自建实例，不与产品共用状态。
> 它仍保持**零 npm 依赖、不进 npm workspaces**，上面的 CLI 命令依旧可独立运行。
> 实现细节见 [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md)，
> P1 验收记录见 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) 附录 A。

模型（可选，Sidecar 环境变量）：

在VSCode中对AI助手说：

> "帮我写一个刷怪系统，每30秒在区域gg_rct_spawn_point生成5只食尸鬼，向玩家基地移动"

AI会自动生成符合WCC规范的代码！

> ⚠️ 本仓库面向 **Lua 1.31+**。本机实测为 **War3 1.26.0.6401**（只支持 JASS），因此这台机器上**不能直接试玩 `war3map.lua`**。版本约束与三种可选路径见 [docs/MAP-COMPILE-PIPELINE.md §5](docs/MAP-COMPILE-PIPELINE.md)。  

## 文档

- [AGENTS.md](AGENTS.md) — **仓库级 Agent 契约**：唯一入口指针、工程约定、红线（规范权威仍是 `wcc-skill/skill.md`）
- [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md) — **下一步开发计划（唯一排期依据）**：现行基线、P1.5→P4、双轨决策、附录 A 执行记录
- [docs/P0-DISPOSITIONS.md](docs/P0-DISPOSITIONS.md) — P0 悬空项处置结论（`@wcc/shared` 冻结 / `wcc-hotreload` 环境限制）
- [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) — **换机迁移清单**：clone → 依赖 → 回归验证，不入库的本地配置、必须单独带走的数据、1.31+ 环境就绪检查  
- [docs/DEPLOYMENT-SHORTCUTS.md](docs/DEPLOYMENT-SHORTCUTS.md) — **部署快捷方式建议**：本机桌面实测、换机失效原因、三层入口模型、最小快捷方式集、`scripts/create-shortcuts.py` 用法与红线  
- [docs/MAP-GENERATION-PLAN.md](docs/MAP-GENERATION-PLAN.md) — **地图生成与优化计划**：拼图/借鉴/随机/素材库四路线、人物摆放与触发器的代码凭据、Python+Lua+WE 外部支持、Warcraft 3 MCP Server、统一 IR 架构  
- [docs/MAP-COMPILE-PIPELINE.md](docs/MAP-COMPILE-PIPELINE.md) — **编译链专项**：文本化/打包/编译三层澄清、`w2l`/`grill`/`jasshelper`/WE Save 命令证据、MCP Server 源码级档案、本机 1.26 版本硬约束、中间文件目录契约与 P0 验收  
- [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md) — **Harness 实现记录**：调研→代码对账、脚本/工具注入、TUI、WC3 借鉴、验证命令  
- [docs/HARNESS-REFERENCE.md](docs/HARNESS-REFERENCE.md) — Kiro / Strands Harness / Deep Agents 调研  
- [docs/FEASIBILITY-REVIEW.md](docs/FEASIBILITY-REVIEW.md) — 独立 Harness + 二分 PR 方案可行性  
- [docs/FORGE-INTEGRATION.md](docs/FORGE-INTEGRATION.md) — forge 生态与许可证边界  
- [docs/ASSETS-GUIDE.md](docs/ASSETS-GUIDE.md) — 素材来源指引  
- [PROJECT-PLAN.md](PROJECT-PLAN.md) — v1.1 桌面 Harness 计划  
- [docs/DEVELOPMENT-NOTES.md](docs/DEVELOPMENT-NOTES.md) — 注意事项与落地状态  
- [docs/workbuddy-research.md](docs/workbuddy-research.md) — WorkBuddy 调研  
- [index.html](index.html) — 调研摘要页  

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
- 🗺️ **示例地图** - 创建演示用的战役地图

### 代码规范

- 遵循 `wcc-skill/knowledge/conventions.md` 中的编码规范
- 所有公共API必须有 EmmyLua 注解
- 提交前运行测试（如果有）

## 📖 文档

- [架构设计](wcc-architecture.md) - 系统架构详解
- [AI执行蓝图](wcc-ai-blueprint.md) - AI编程规范
- [编码规范](wcc-skill/knowledge/conventions.md) - 代码风格指南
- [API参考](wcc-skill/knowledge/api-best-practices.md) - 魔兽API最佳实践

## 🗺️ 路线图

> 以下为本历史目录的旧路线图。**现行进度以新仓库为准**（Desktop MVP / Sidecar / lua-check / 完整 wcc-lib 已落地）。

- [x] 核心安全沙箱 (wcc-core)
- [x] 对话系统 (wcc-dialogue)
- [x] 任务系统 (wcc-quest)
- [ ] Boss战模板（新仓库已有 wcc-boss-fight）
- [x] 刷怪池系统 (wcc-spawner)
- [ ] 完整的示例战役
- [ ] 社区模式模板库
- [ ] **桌面 Harness**（见新仓库 apps/wcc-desktop）

## 💬 社区

- 新仓库：[Aurirlk/Wcc-deskTop](https://github.com/Aurirlk/Wcc-deskTop)
- Issues / 讨论请到新仓库提交

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
