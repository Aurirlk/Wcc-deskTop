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
| `examples/demo-campaign/` | 示例战役 |
| `docs/` | 计划、调研、注意事项 |
| `attic/novel-workflow/` | 已隔离的小说工作流模板 |

## 快速开始

```bat
npm install
npm test
npm run check
npm run sidecar
npm run dev:desktop
```

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

## 文档

- [PROJECT-PLAN.md](PROJECT-PLAN.md) — v1.1 桌面 Harness 计划  
- [docs/DEVELOPMENT-NOTES.md](docs/DEVELOPMENT-NOTES.md) — 注意事项与落地状态  
- [docs/workbuddy-research.md](docs/workbuddy-research.md) — WorkBuddy 调研  
- [index.html](index.html) — 调研摘要页  

## License

MIT
