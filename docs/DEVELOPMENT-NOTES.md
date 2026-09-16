# WCC 开发注意事项与落地状态

> 更新：2026-09-13 · 配套 `PROJECT-PLAN.md` v1.1

## Skill 使用结论

| Skill | 本次是否采用 | 用途 |
|-------|-------------|------|
| frontend-design | ✅ 约束叠加 | 桌面 UI 按 **convention mode**（内嵌工具）：深色、可找到按钮、无过度装饰 |
| skill-creator + mimo-skill-authoring | ✅ 流水线 | 产出 `packages/wcc-skill-mimocode/wcc-warcraft-campaign/` |
| mimo-desktop-guide | 仅元数据 | 了解宿主能力，不作为 WCC 产品设计来源 |
| figma / grok-build / arxiv / threejs-game-skills / xlsx-official | ❌ | 与 WC3 桌面 Harness 无直接关系；无 Figma MCP 本回合 |
| visualizer | 可选 | 架构图已有 SVG，无需再画 |

## 架构落地（MVP）

```text
apps/wcc-desktop     Electron Main + Renderer（会话/项目/检查/设置）
packages/wcc-sidecar localhost:47840 Agent Loop + 工具 + 审批
packages/wcc-lua-check  Node 静态检查（无 Rust 工具链，计划里 Rust 降为后续）
wcc-lib/             已补全 timer/logger/gc/math/boss-fight
attic/novel-workflow 已迁出
```

## 注意事项（必读）

1. **本机无 cargo** → 检查器与 CLI 先用 **Node**；`crates/wcc-*` 暂缓，避免假进度。  
2. **Electron 安装体积大** → `npm i` 时会拉 electron；仅开发机需要，打包可用 electron-builder（未接线）。  
3. **Sidecar 必须用系统 `node` 启动**，不能用 Electron 自带的 `process.execPath`。  
4. **路径安全**：`write_file`/`read_file` 禁止逃出项目根（`path.relative` 检查）。  
5. **审批**：默认 `WCC_AUTO_APPROVE=0`；桌面轮询 `/approval/pending`。生产勿默认自动放行写文件。  
6. **wc3-forge 未接入**：`forge_status` 为占位；改图能力依赖本机安装 Forge 并保持编辑器打开（后续 MCP 客户端）。  
7. **模型**：未配置 `WCC_MODEL_BASE_URL`/`WCC_MODEL_API_KEY` 时为**离线规划**，只给步骤不自动写盘。  
8. **Lua 铁律**：生成代码必须过 `lua_check`；游戏内仍需 WE 中 `require("src.main")`。  
9. **法律**：不分发暴雪资源；`wcc-lib` 仅脚本工具链。  
10. **demo 工程**：默认项目根指向 `examples/demo-campaign`，其中 `require` 路径按 WE 实际 `src/lib` 调整。

## 已验证命令

```bat
npm install
npm test
npm run check
npm run sidecar
npm run dev:desktop
```

2026-09-15 实测结果：

- `npm test`：sidecar 3 + lua-check 2 **全绿**
- `npm run check`：11 个 Lua 文件，**0 issues**
- `npm run sidecar`：`/health` ok，tools=6；离线 `/chat` 返回规划步骤
- Electron 官方二进制下载超时 → 已改为 `optionalDependencies`；有网时可：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install electron -w @wcc/desktop
npm run dev:desktop
```

MiMo 技能已安装至 `~/.config/mimocode/skills/wcc-warcraft-campaign/`（新对话生效）。

## Skill → MiMo 安装（可选）

复制到全局：

```bat
xcopy /E /I packages\wcc-skill-mimocode\wcc-warcraft-campaign "%USERPROFILE%\.config\mimocode\skills\wcc-warcraft-campaign"
```

或项目级：`<project>\.mimocode\skills\wcc-warcraft-campaign\`。新对话生效。

## 审计修复（2026-09-15 · 审查清单）

| 问题 | 修复 |
|------|------|
| preload 路径错误 `src/main/preload.cjs` | 改为 `../preload/preload.cjs` |
| `.wcc/config.json` 可能进 git | `.gitignore` 增加 `**/.wcc/` |
| dialogue.MoveCamera Location 泄漏 | 共享 `camLoc` + MoveLocation 复用 |
| 本地鼠标推进共享状态 desync | 去掉模块级 `GetLocalPlayer` 缓存；推进走同步事件 |
| 中文打字机乱码 | UTF-8 码点步进，不再 `string.sub` 按字节 |
| docs `Timer.ClearTimer` vs `Timer.Clear` | patterns 统一为 `Timer.Clear` |
| codegen 多行字符串 | `luaStr` 转义 `\\n \\r \\t` |
| README「require 进图」 | 明确 **原生 WC3 无 require**，用打包 `war3map.lua` |
| lua-check 0 issues 假安全 | 新增 location-leak / group-leak / desync / utf8 规则 |
| forge 协议未对真实客户端验证 | 保持风险标注；锁文件启发式 |

**仍存限制**：build 不写二进制 w3x；Electron 二进制可选；forge 线协议未联真机；lua-check 仍是启发式非完整解析。

## 流式与 Forge（2026-09-15）

- Sidecar：`POST /chat/stream` 返回 SSE（`delta` / `tool_start` / `tool_end` / `done`）
- 模型：`WCC_MODEL_BASE_URL` + `WCC_MODEL_API_KEY` + `WCC_MODEL_NAME`（OpenAI 兼容 `/chat/completions`，`stream:true`）
- Forge：读 `~/.wc3-forge/mcp/*.lock`（`pid/port/token`），TCP NDJSON JSON-RPC，请求带 `params._token`
- 工具：连接后动态注册 `forge_<toolName>`，默认需审批；`forge_status` / `forge_connect` / `forge_list_tools`
- 桌面：Main 解析 SSE 并 `webContents.send("wcc:chat-event")`，渲染层流式追加
- 离线无密钥时仍走 SSE，便于联调 UI
