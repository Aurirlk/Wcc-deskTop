# B 站魔兽 Lua 教程调研 → WCC 优化结论

> 调研日期：2026-09-15 · 对照仓库内已有引用（BV1zJ411X7YK、h-lua、War3ExcelTool、提百万等）

## 1. 视频与技术信号

| 来源 | 信号 | 对 WCC 启发 |
|------|------|-------------|
| **h-lua 库**（BV1Lh411v7pR / BV1iv411L7CP，文档 h-lua.hunzsig.org） | 完整 Lua 框架：模块加载、UI sync、伤害榜、**热更新代码** | 模块注册表 + 热载入开发流；skill 强调「库先行」 |
| **War3ExcelTool**（BV1ce75zMErf） | Excel ↔ TS/Lua/INI/JSON，**w3x 解析**，物编导出 | 数据驱动：表格→Lua 生成器；物编元数据进圣经 |
| **提百万 LUA 生成装备/单位**（BV1ab411B7JR 等） | **绕过物编 UI**，Lua 批量创建物品/单位并调用 | `wcc-objects` + codegen 工具；减少手工 WE |
| **T 调用 Lua**（BV13cgB6pEuf） | GUI 触发与 Lua 混用过渡路径 | 架构保留「WE 一个入口 require」 |
| **改图/脚本提取**（BV1rq4y1E7UN、BV1wwKA6cES7） | 改他人图、脚本移植 | forge MCP + 静态检查并重 |
| **y3 / KK**（BV1hGDZYmEyn 等） | 平台自有编辑器生态 | 非目标竞品；坚持 1.31+ 官方 Lua |
| **纯 AI 改图**（BV14YLP6cEFe） | AI 加单位做技能 | 与本产品方向一致，需强 schema 与审批 |

## 2. 落地到四块优化

### 架构
- **Layered lib**：core → objects/gc/timer → systems（dialogue/quest/spawner/boss）→ chapter  
- **Data plane**：`.wcc/bible.json` + 可选表格 JSON；codegen 只读数据写 Lua  
- **Dev loop**：build 单文件 war3map.lua +（可选）源码树热载提示（对齐 h-lua 热更思路）

### Tool 注册
- 每个工具：`name` / `description` / `category` / `needsApproval` / **完整 `inputSchema`**  
- 分类：`project` `src` `check` `build` `codegen` `obj` `forge` `skill`  
- **Expert 过滤**：编剧少暴露 forge；审查只读；刷怪/spawn 优先 spawner 工具  
- forge 工具连接后才注入，避免 152 个工具撑爆上下文（对齐懒加载）

### Function calling
- `toolDefs` 一律带真实 JSON Schema（不再糊 path/content）  
- 系统提示声明「先 bible_get / codegen_list_templates」  
- 大输出截断 + 外部化已有；补 **codegen 结果直接可 write_file**

### Skills
- 新增 `patterns/task-object-batch.md`（提百万路径）  
- 新增 `patterns/task-data-codegen.md`（ExcelTool 路径）  
- skill 总纲加入：物编用 Blz* + wcc-objects；表格生成后必须 lua_check

## 3. 实现优先级（本回合）

1. Tool 元数据 schema 化 + 分类 + 专家过滤  
2. `wcc-lib/wcc-objects.lua` + `codegen` 工具  
3. Skill patterns 两份  
4. 测试与冒烟  

## 4. 链接

- https://h-lua.hunzsig.org  
- https://github.com/alading-2/War3ExcelTool-Open  
- https://www.bilibili.com/video/BV1Lh411v7pR · BV1ce75zMErf · BV1ab411B7JR · BV1zJ411X7YK  
