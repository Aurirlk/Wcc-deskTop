# 数据驱动代码生成（task-data-codegen）

> 参考：War3ExcelTool（Excel→Lua/INI/JSON，BV1ce75zMErf）  
> WCC 路径：结构化 JSON → `codegen_run` → `write_file` Lua 模块。

## 何时用

- 多波刷怪表、多句对话表、任务目标列表，**手写易错且重复**。  
- 表格/策划数据已存在于 JSON（后续可从 Excel 导出）。

## 内置模板

| template | 产出 |
|----------|------|
| `unit_wave` | `Spawner.Create({...})` |
| `dialogue_table` | `Dialogue.Play({...})` |
| `unit_registry` | `Objects.RegisterUnit(...)` |
| `quest_table` | `Quest.Create({...})` |

## SOP

```text
1. codegen_list — 确认 schema
2. codegen_run template=... args={...}
3. 检查生成 Lua 是否合规（无 Wait）
4. write_file 到 src/map/xxx.lua（需审批）
5. main.lua require
6. lua_check
```

## Excel / 表格导入（War3ExcelTool 风格）

1. 导出 JSON/CSV（可含 `units` / `waves` / `dialogue` / `quests`）。  
2. 放入项目，例如 `tables-sample.json`。  
3. `table_import path=tables-sample.json generate=true`  
4. `write_file` → `lua_check` → main require。  

样例：`examples/demo-campaign/tables-sample.json`。

## 注意

- codegen 只负责**语法骨架**；镜头、回调、事件仍要人工/专家补全。  
- 生成后必须过 `lua_check`。  
- 与 forge 分工：codegen 写逻辑表；forge 改地图实体。
