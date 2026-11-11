# WCC 示例战役 (Demo Campaign)
> **⚠️ require 消歧（2026-11-11）**：本文示例里的 `require("src.*")` 是 **WCC 源码组织方式**，
> 由 `build-map.js` 内联成单文件 `war3map.lua`（自造 `__wcc_require`）。WC3 原生 Lua **没有 require**，
> **不要在 World Editor 触发器里写 `require("src.main")`**；进图请用 `dist/build/war3map.lua` 全文。


> 这是一个完整的示例战役，演示 WCC 系统的基本用法。

---

## 概述

本示例战役包含：

- **开场对话** - 使用对话系统展示剧情
- **任务系统** - 创建和追踪任务
- **基本战斗** - 简单的单位交互

---

## 文件结构

```
demo-campaign/
├── src/
│   ├── main.lua             # 主入口文件
│   └── chapter_01.lua       # 第一章逻辑
├── tables-sample.json       # 示例数据表
└── README.md                # 本文件
```

> ⚠️ **本目录不含 `.w3x` 地图文件**。当前 `build_map` 只产出可导入的
> `dist/build/war3map.lua` 脚本包（+ `src-tree/`），写入二进制 `.w3x` 尚未实现；
> 详见 [docs/MAP-COMPILE-PIPELINE.md](../../docs/MAP-COMPILE-PIPELINE.md) §7 与
> [docs/MAP-GENERATION-PLAN.md](../../docs/MAP-GENERATION-PLAN.md) §2.6 虚标清单。

---

## 如何使用

### 1. 生成脚本包

运行 `build_map`，产出 `dist/build/war3map.lua`（+ `src-tree/`）。本目录**不含任何 `.w3x` 地图文件**。

### 2. 导入脚本

在 WE 的**地图脚本**中粘贴 `war3map.lua` 全文（或走 P2 阶段 B 的 E3 durable 双写）。WC3 原生 Lua 没有 `require`，**不要**在触发器里写 `require("src.main")`；源码内的 `require("src.*")` 由构建器内联为 `__wcc_require`。

### 3. 运行测试

保存并运行游戏，你将看到：

1. 开场对话（阿尔萨斯和乌瑟尔的对话）
2. 任务自动创建并显示在任务面板
3. 完成任务后的对话

---

## 代码说明

### main.lua

主入口文件，负责：

- 导入核心库
- 初始化系统
- 启动第一章

### chapter_01.lua

第一章逻辑，演示：

- 对话系统的使用
- 任务系统的创建和管理
- 任务目标的更新

---

## 扩展建议

### 添加战斗系统

```lua
-- 在 chapter_01.lua 中添加
local BossFight = require("src.lib.wcc-boss-fight")

-- 创建Boss战
local boss = BossFight.New({
    bossId = 'Nbal',  -- 恐惧魔王
    spawnX = 2000,
    spawnY = 3000,
    phases = {
        {healthPercent = 100, onEnter = function() Core.Log("战斗开始！") end},
        {healthPercent = 50, onEnter = function() Core.Log("Boss进入狂暴！") end}
    }
})
```

### 添加刷怪系统

```lua
-- 在 chapter_01.lua 中添加
local Spawner = require("src.lib.wcc-spawner")

-- 创建刷怪池
Spawner.Create({
    unitId = 'ugho',  -- 食尸鬼
    x = 1500,
    y = 2000,
    interval = 30.0,
    count = 5,
    targetX = 1000,
    targetY = 1000
})
```

---

## 学习要点

1. **模块化设计** - 每个文件负责一个功能
2. **安全封装** - 使用 Core 库的安全函数
3. **内存管理** - 及时销毁不需要的资源
4. **事件驱动** - 使用回调函数处理异步逻辑

---

## 常见问题

### Q: 如何修改对话内容？

A: 编辑 `chapter_01.lua` 中的 `Dialogue.Play()` 调用，修改 `sequence` 表中的内容。

### Q: 如何添加新任务？

A: 使用 `Quest.Create()` 创建新任务，参考 `chapter_01.lua` 中的示例。

### Q: 如何添加新章节？

A: 创建新的 `chapter_02.lua` 文件，在 `main.lua` 中导入并启动。

---

*本示例由 WCC 项目提供，最后更新: 2026-07-09*
