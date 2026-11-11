# WCC 示例战役 (Demo Campaign)

> **⚠️ require 消歧（2026-11-11）**：本文示例里的 `require("src.*")` 是 **WCC 源码组织方式**，
> 由 `build-map.js` 内联成单文件 `war3map.lua`（自造 `__wcc_require`）。WC3 原生 Lua **没有 require**，
> **不要在 WE 触发器里写 `require("src.main")`**；进图请用 `dist/build/war3map.lua` 全文。

> **状态（2026-11-11）**：这是**示例资产与 few-shot 样本**，不是一张可玩的地图。
> 3 章数据 / 3 个章节脚本骨架 + 双轨 `manifest.json`；🔴 **未进图、不产出 `.w3x`**。
> 目标补丁 `1.31+` / `lua`；本机 War3 1.26 只支持 JASS，不能试玩 `war3map.lua`。

---

## 概述

本示例用于让 AI 与开发者看清 WCC 的**数据格式与代码形状**，包含：

- **3 章数据表**：开场对话链、主线 + 支线任务、3 波刷怪、1 场 Boss 配置骨架
- **3 个章节脚本**：对话 / 任务 / 刷怪池 / 计时器 / Boss 阶段机的调用形状
- **Lua 静态检查与打包链路**的可复现入口

它**不包含**地形、物编条目、触发器二进制或任何地图文件；仓库零 `.w3x`。

---

## 文件结构

```
demo-campaign/
├── manifest.json            # 双轨配置：targetPatch / language / chapters / mapGenerated=false
├── tables-sample.json       # 3 章示例数据表（units / waves / dialogue / quests + chapters / boss）
├── src/
│   ├── main.lua             # 主入口：只自动启动第一章
│   ├── chapter_01.lua       # 第一章：对话 + 主线任务
│   ├── chapter_02.lua       # 第二章：支线任务 + 刷怪池 + 计时器（示例骨架）
│   └── chapter_03.lua       # 第三章：Boss 阶段机 + 结局对话（示例骨架）
└── README.md                # 本文件
```

> ⚠️ **本目录不含任何 `.w3x` 地图文件**。当前 `build_map` 只产出可导入的
> `dist/build/war3map.lua` 脚本包（+ `src-tree/`），写入二进制 `.w3x` 尚未实现；
> 详见 [docs/MAP-COMPILE-PIPELINE.md](../../docs/MAP-COMPILE-PIPELINE.md) §7 与
> [docs/MAP-GENERATION-PLAN.md](../../docs/MAP-GENERATION-PLAN.md) §2.6 虚标清单。
> `dist/` 是生成物，被 `.gitignore` 忽略，不入库。

### manifest.json 双轨字段

| 字段 | 值 | 含义 |
|---|---|---|
| `targetPatch` | `"1.31+"` | B+A 双轨决策：以 1.31+ / Lua 为开发主线 |
| `language` | `"lua"` | 与 `wcc-lib`（11 个 .lua / 1848 行）及 wcc-skill 铁律一致 |
| `mapGenerated` | `false` | **事实声明**：尚未产出地图，绝不虚报 |
| `chapters` | `["ch1","ch2","ch3"]` | 章节索引，与 `tables-sample.json` 对齐 |

字段命名与 IR 唯一契约 `.wcc/ir/<map-id>/manifest.json` 对齐，但本文件是**示例级配置**，
不是某张真实地图的 IR 产物；IR 契约的唯一权威是 `docs/MAP-COMPILE-PIPELINE.md` §6.1。

---

## 如何使用

### 1. 生成脚本包

运行 `build_map`，产出 `dist/build/war3map.lua`（+ `src-tree/`）。若 `require` 图有未解析模块，
构建会**直接失败且不写产物**——不会给出半截脚本包。

### 2. 导入脚本

在 WE 的**地图脚本**中粘贴 `war3map.lua` 全文（或走 P2 阶段 B 的 E3 durable 双写）。
WC3 原生 Lua 没有 `require`，**不要**在触发器里写 `require("src.main")`；
源码内的 `require("src.*")` 由构建器内联为 `__wcc_require`。

> 🔴 **阶段 B 尚未解封**：需要用户自备 1.31+ 客户端、一张真实 `.w3x`、WE 可 Save / Test Map，
> 以及一条实测过 round-trip 的注入路径。在此之前不要声称「已进图」。

### 3. 本地可做的验证（不需要游戏）

```bash
npm run check          # Lua 静态检查：0 errors
npm test               # 全量测试
node harness/bin/wcc-harness.mjs demo
```

**本机不能试玩**：War3 1.26.0.6401 只支持 JASS；`war3map.lua` 需要 1.31+ 环境。
上表三步只验证代码形状与静态规则，**不产出可运行地图**。

---

## 代码说明

### main.lua

主入口：导入核心库与三个章节模块，`Core.SafeExecute(Init)` 里只自动启动第一章；
`chapter_02` / `chapter_03` 一并打包供 `build_map` 校验 require 图，但**不自动 Start()**。

### chapter_01.lua

对话系统、任务创建与目标更新的完整示例。

### chapter_02.lua

支线任务 + 两路刷怪池 + `Timer.SetTimeout` 延迟回调 + 收尾清理。
刻意不使用 `Wait` / `TriggerSleepAction` / `PolledWait`。

### chapter_03.lua

Boss 阶段机的调用形状 + 结局对话。**`bossId` 刻意留空**：物编 ID 字典覆盖率 0
（`wcc-skill/knowledge/wc3-object-ids.md` 🔴 不完整），`Start()` 会走
「未核实 → 跳过创建 → 只播结局」的诚实分支，绝不臆造 `'Nbal'` 之类四字码。

---

## 数据说明（tables-sample.json）

- 保留 `units` / `waves` / `dialogue` / `quests` **顶层结构**，因为
  `packages/wcc-sidecar/src/table-import.js` 与 `test/table-import.test.js` 以此为夹具；
  `meta` / `chapters` / `boss` 仅作示例索引，codegen 不消费。
- 3 章：`ch1` 主线「拯救村民」+ 1 波；`ch2` 支线「守住路口」+ 2 波；`ch3` 主线「讨伐恐惧魔王」+ Boss 骨架。
- 🔴 **表内所有 rawcode 都是未核实示例值**（`'n001'` / `'n002'` / `'ugho'`），
  只用来演示格式与断言字符串透传，**不可直接用于生成战役代码**。
  `boss.bossId` 为 `null`，等待已核实来源。

---

## 常见问题

### Q: 如何修改对话内容？

A: 编辑对应章节的 `Dialogue.Play()` 调用，或改 `tables-sample.json` 的 `dialogue` 数组。

### Q: 如何添加新任务？

A: 用 `Quest.Create()`，并同步在 `tables-sample.json` 的 `quests` 里登记（参考 `chapter_02.lua`）。

### Q: 如何添加新章节？

A: 新增 `src/chapter_04.lua`，在 `main.lua` 中 `require` 并按需显式调用 `Start()`；
同时在 `tables-sample.json` 的 `chapters` 与 `manifest.json` 的 `chapters` 里登记。
**注意**：这只是文本示例，不等于能进图。

### Q: 为什么 README 里写「不能试玩」？

A: 因为本目录没有地图文件，`build_map` 只产脚本包；且本机 1.26 不支持 Lua。
任何「保存并运行游戏就能看到剧情」的说法都是虚标，已删除。

---

*WCC 示例资产 · 最近整理：2026-11-11（3 章 + 双轨 manifest）*
