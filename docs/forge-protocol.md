# wc3-forge MCP 协议对齐（依据官方文档 2026-09-15）

来源：https://stephenshorton.github.io/wc3-forge/docs/claude-code/ · README「MCP wire contract」

## 已验证事实（公开文档）

| 项 | 官方说明 |
|----|----------|
| 推荐接入 | 编辑器二进制 **`--mcp`** = **stdio MCP server**（薄代理到运行中的编辑器） |
| 启动示例 | `claude mcp add wc3-forge -- "C:\Program Files\wc3-forge\wc3-forge.exe" --mcp` |
| 线协议（bridge） | **JSON-RPC 2.0 over TCP, NDJSON-framed on 127.0.0.1** |
| 发现 | 每 pid 一个锁文件 **`~/.wc3-forge/mcp/<pid>.lock`**（`WC3FORGE_MCP_LOCK_DIR` 可覆盖） |
| 鉴权 | 每条请求 **`params._token`** = 锁文件中的 token |
| 多实例 | `sessions_list` / `session_select`；`window_set_title` 标注实例 |
| 工具命名 | **下划线**：`map_status`、`units_create`、`terrain_set_tile`（不是 `units.move`） |
| 旧 Node server | `mcp/` 目录；与 `--mcp` **同协议同工具集** |

## WCC 实现策略

1. **Transport 双通道**
   - `stdio`：spawn `wc3-forge.exe --mcp`，JSON-RPC over stdin/stdout（MCP initialize → tools/list / tools/call）
   - `tcp`：读锁文件连 127.0.0.1:port，NDJSON + `_token`（GUI 已打开时）
2. **优先顺序**：用户配置了 `WC3FORGE_EXE` → stdio；否则尝试锁文件 TCP；都失败则 UI 降级「仅 Lua 工作流」。
3. **工具暴露**：连接成功后动态注册 `forge_<name>`（如 `forge_map_status`），默认需审批。
4. **不猜测**：未连接时 `forge_status` 明确说明安装步骤，不假装可用。

## 最小冒烟（需本机安装）

```text
1. 打开 wc3-forge 并加载任意地图
2. WCC 扩展页 → 刷新 Forge
3. forge_list_tools 应出现 150+ 工具
4. 审批后调用 forge_map_status
```
