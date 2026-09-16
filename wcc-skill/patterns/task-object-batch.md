# 批量物编 / 单位生成模式（task-object-batch）

> 参考：提百万联盟「LUA 快捷生成装备/单位」（BV1ab411B7JR、BV1Hb411t7sZ）  
> 目标：少点 WE 物编 UI，用 Lua 注册 + 安全创建 + 批量刷。

## 原则

1. 四字码在圣经 `units` 中登记，避免幻觉 ID。  
2. 运行时字段用 `BlzSetUnitMaxHP` / `BlzSetUnitName` 等，经 `wcc-objects`。  
3. 批量生成优先 `codegen_run unit_registry` → `write_file`，再 `lua_check`。  
4. 不要循环裸 `CreateUnit` 不统计、不封装。

## 推荐流程

```text
1. bible_get — 看已有单位
2. codegen_run template=unit_registry
3. write_file src/map/unit_defs.lua（需审批）
4. chapter 里 Objects.CreateUnit / LineSpawn / Spawner
5. lua_check src
```

## 生成物示例

```lua
local Objects = require("src.lib.wcc-objects")
Objects.RegisterUnit("n001", { hp = 1200, name = "腐化卫士" })
local n = Objects.LineSpawn(Player(PLAYER_NEUTRAL_AGGRESSIVE), "n001", 0, 0, 5, 64, 270)
```

## 违禁

- 虚构不存在的物编 ID（未在 WE/圣经登记）  
- 忘记 owner（中立敌对 vs 玩家）  
- 大批量刷怪不设上限导致卡顿  

## 集成

在 `src/lib/` 保留 `wcc-objects.lua`（从仓库 `wcc-lib` 复制）。入口 `main.lua` 可 `require("src.map.unit_defs")`。
