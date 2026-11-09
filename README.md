# Warcraft Campaign Craft (WCC)

> 魔兽争霸3战役 · **桌面 AI Harness**（WorkBuddy 式）· Lua 1.31+

## 这是什么

WCC 用 **Electron 桌面壳 + Sidecar Agent + 安全 Lua 库 + Skill**，让 AI 帮你写可玩战役逻辑（对话/任务/刷怪/Boss）。地图数据层计划对接 **wc3-forge MCP**，不重做 World Editor。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `wcc-lib/` | 发给地图项目的 Lua 运行时（core/timer/logger/gc/math/dialogue/quest/spawner/boss-fight） |
| `wcc-skill/` | AI 编码规范与模式库 |
| `apps/wcc-desktop/` | 桌面壳（会话 UI） |
| `packages/wcc-sidecar/` | Agent Loop、工具、审批 |
| `packages/wcc-lua-check/` | Lua 静态检查 |
| `harness/` | **独立零依赖 Harness 层**（steering / hooks / spec / scratch / provider / budget / 中间件 / 工具注入 / TUI） |
| `examples/demo-campaign/` | 示例战役 |
| `docs/` | 计划、调研、实现记录 |
| `attic/novel-workflow/` | 已隔离的小说工作流模板 |

## 快速开始

```bat
npm install
npm test
npm run check
npm run sidecar
npm run dev:desktop
```

Harness 层（独立目录、零依赖、**不进 npm workspaces**，不影响上面的命令）：

```bat
node --test harness/test/harness.test.js
node harness/bin/wcc-harness.mjs demo
node harness/bin/wcc-harness.mjs tui --static
```

> `harness/` 目前是**可独立运行的旁路层**，尚未接入 `agent.js` / `server.js`；
> 已实现什么、未实现什么、如何接入，见 [docs/HARNESS-IMPLEMENTATION.md](docs/HARNESS-IMPLEMENTATION.md)。

模型（可选，Sidecar 环境变量）：

```bat
set WCC_MODEL_BASE_URL=https://api.deepseek.com/v1
set WCC_MODEL_API_KEY=sk-...
set WCC_MODEL_NAME=deepseek-chat
```

## 在 World Editor 中使用 wcc-lib

1. 地图启用 **Lua**，触发器仅：`require("src.main")`  
2. 将 `wcc-lib/*.lua` 复制到地图项目 `src/lib/`  
3. 业务写在 `src/map/chapter_01.lua`，在 `src/main.lua` require  

> ⚠️ 本仓库面向 **Lua 1.31+**。本机实测为 **War3 1.26.0.6401**（只支持 JASS），因此这台机器上**不能直接试玩 `war3map.lua`**。版本约束与三种可选路径见 [docs/MAP-COMPILE-PIPELINE.md §5](docs/MAP-COMPILE-PIPELINE.md)。  

## 文档

- [docs/NEW-MACHINE-SETUP.md](docs/NEW-MACHINE-SETUP.md) — **换机迁移清单**：clone → 依赖 → 回归验证，不入库的本地配置、必须单独带走的数据、目标补丁决策  
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

## License

MIT
