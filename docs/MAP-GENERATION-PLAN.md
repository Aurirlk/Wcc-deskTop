# 地图生成与优化计划（WCC 最难的一块）

> 2026-11-09 夜 · 新增文档，回应「直接让 AI 铺地图不可取」的四条替代路线
> 覆盖：① 拼图流 ② 借鉴流 ③ 随机生成流 ④ 素材库流 ⑤ **代码凭据核查：AI 到底有没有实现人物摆放 / 触发器 / 战役剧情** ⑥ 本机 Python + Lua + 原版 WE 的外部支持 ⑦ Warcraft 3 MCP Server 是什么 ⑧ 统一架构与优先级。
>
> **证据等级约定**（全文严格遵守，避免虚假完成声明）：
> - ✅ **本机实测 / 仓库代码**：可复现，给出路径与行号
> - 🟠 **官方文档 / 二手资料**：注明来源，不当作已验证事实
> - 🔴 **未实现 / 未验证 / 缺口**：明确写「没有」，不写「计划中=已完成」
>
> **本轮状态**：只新增/更新 Markdown，**未改任何业务代码、未安装新依赖、未启动 WE 或 forge、未做 git commit、未发外部 Issue/PR**。
>
> **2026-11-10 补正**：后续的 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) 做了编译链专项调研，新增两项会改变本文结论的事实：① 本机游戏实测为 **1.26.0.6401（经典版，只支持 JASS）**，与本文「Lua 地图」前提冲突；② Warcraft 3 MCP Server 的 `wct`/`wtg` 写入**仅支持 1.31+ modern 格式**，在本机图上不可用。本文 §4.1 / §5 / §6.1 / §8 / §9 已就地标注，完整论证见新文档 §4–§5。**本文原有结论未被静默改写。**

---

## 0. 结论速览

| # | 问题 | 判定 |
|---|---|---|
| 1 | WCC 的 AI 内部实现了「人物摆放 / 触发功能」吗？ | **一半**：✅ **运行期 Lua**（游戏跑起来后 `CreateUnit` / `CreateTrigger`）完整实现；🔴 **编辑器期摆件**（写进 `.w3x` 的预置单位、装饰物、GUI 触发器树）**一行都没有**，设计上明确外包给 wc3-forge。见 §2 |
| 2 | 直接让 AI 铺地图不可取，对吗？ | ✅ 对，但理由要改：不是「AI 不会画地形」，而是 **WCC 根本没有可写的地图数据层**（零 `.w3x`、零 MPQ 依赖、`build_map` 只产 `war3map.lua`）。见 §2.5 |
| 3 | 四条路线的共同底座 | ✅ **文本 IR**（`.wcc/ir/`）+ **统一执行层适配器**。四条路线不是四选一，是四个「IR 的来源」。见 §6 |
| 4 | 借鉴流的「排除人物物品、保留地表树林建筑」 | 🔴 **用 AI 识图是错路**；🟠 `.w3x` 内部本来就分层，直接按文件过滤即可，准确率 100%。但有一个坑：**建筑在 WC3 里是单位，和「人物」同文件**。见 §3.2 |
| 5 | 有没有开源随机地图生成器？ | 🟠 **本次检索范围内没找到成熟、活跃的 WC3 专用生成器**；找到的是「零件」（噪声库 / w3e 解析器 / 文本 IR 转换器 / 编辑器的 `map_new`）。所以路线 3 应改成「自己组装」，不是「等现成工具」。见 §3.3 |
| 6 | 本机 Python + 原版 WE 能帮上忙吗？ | ✅ 能，但要认清：**WE 没有插件/自动化 API**。Python 做离线解析与校验，WE 只做「打开 / 保存编译 / 试玩」。见 §4 |
| 7 | Warcraft 3 MCP Server 是什么？ | ✅ `YElwiddi/warcraft-3-mcp-server`，**MIT**、TypeScript、直接读写 `.w3x` 文件、默认写 `.edited.w3x` 副本、支持真正的 GUI 触发器。**许可证上比 GPL-3.0 的 forge 更适合 WCC**，但 🔴 **2026-11-10 补正**：它是「文件编辑器 + 打包器」不是编译器，且 `wct`/`wtg` 写入只支持 Reforged/1.31+ modern 格式，**本机 1.26 上两个招牌能力不可用**。见 §5.6 与 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) §4 |
| 8 | 「中间可编译文件 → 编译成地图」怎么做？ | ✅ 现成链路不止一条（`w2l obj` / `jasshelper` / `grill build` / WE Save / MIT 打包库），但**真正难的是目标补丁选择**：本机 1.26 只跑 JASS，Lua 与文件夹地图是 1.31+ 能力。见 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) |

---

## 1. 为什么这是「最难的一块」

WCC 目前的能力边界是**「写战役逻辑的 Lua」，不是「改地图文件」**。三个事实：

1. ✅ `package.json` 只有 4 个 workspace 脚本（`test` / `check` / `sidecar` / `dev:desktop`），`package-lock.json` 里**没有任何 MPQ / w3x / storm 解析依赖**。
2. ✅ `find . -name "*.w3x"` → **仓库内 0 个 `.w3x`**（`examples/demo-campaign/README.md:21` 却写着 `demo-campaign.w3x`，属虚标）。
3. ✅ `packages/wcc-sidecar/src/build-map.js:130-131` 只写 `dist/build/war3map.lua`；该文件 `:164` 自述：**"完整 MPQ 写入需要 mpyq/stormlib/WE；本构建产出可导入脚本包"**。`docs/DEVELOPMENT-NOTES.md:88` 同样写「build 不写二进制 w3x」。

所以「地图生成」不是补一个 AI 提示词，而是**补一整层从二进制地图 → 可 diff 文本 → 再写回二进制的 I/O 能力**。这正是 `HARNESS-IMPLEMENTATION.md §5.1` 从 w3x2lni 借鉴的那条：AI 永远不直接改二进制。

---

## 2. 代码凭据：AI 到底实现了「人物摆放 / 触发功能」吗

### 2.1 先定义判据（不定义清楚就会互相误会）

| 层 | 含义 | 载体 | 谁执行 |
|---|---|---|---|
| **编辑器期（静态摆件）** | 地图打开前就已经放好的单位、树、建筑、区域、GUI 触发器 | `war3mapUnits.doo` / `war3map.doo` / `war3map.w3r` / `war3map.wtg` / `war3map.wct`（都在 `.w3x` MPQ 内） | World Editor / wc3-forge / Warcraft 3 MCP Server |
| **运行期（游戏内生成）** | 游戏跑起来后由脚本创建单位、注册事件 | `war3map.lua` → `CreateUnit` / `CreateTrigger` | WC3 引擎 + `wcc-lib` |

**WCC 做的是后者，而且是刻意的设计。**

### 2.2 ✅ 运行期「人物摆放」——有，且有多条路径

| 凭据 | 代码 |
|---|---|
| 底层安全封装 | `wcc-lib/wcc-core.lua:71-85` `WCC_Core.SafeCreateUnit(...)` → `:77 pcall(CreateUnit, idPlayer, unitid, x, y, face or 0)` |
| 物编注册 + 创建 | `wcc-lib/wcc-objects.lua:23-26` `RegisterUnit`（**注意：只是往 Lua table 里记一笔，不写 `war3map.w3u`**）、`:34-36` `CreateUnit` → `Core.SafeCreateUnit` |
| 批量摆放 | `wcc-lib/wcc-objects.lua:59-67` `LineSpawn`（按 64 间距刷一排）、`wcc-lib/wcc-spawner.lua:70-88` `SpawnWave` → `:79 Core.SafeCreateUnit`，`:82 IssuePointOrder` 自动下令进攻 |
| Boss 生成 | `wcc-lib/wcc-boss-fight.lua:38-41` `Spawn()` → `Core.SafeCreateUnit` |
| AI 生成这些代码的模板 | `packages/wcc-sidecar/src/codegen.js:100-117` `unit_wave`（含 x/y/unitId/count）、`:130-136` `unit_registry` |
| AI 可调用的工具 | `packages/wcc-sidecar/src/tools.js:179-197` `codegen_run`；`:198-226` `table_import` |
| 表格 → 摆放作业 | `packages/wcc-sidecar/src/table-import.js:79-96`：JSON/CSV 的 `units` / `waves` 行 → `unit_registry` / `unit_wave` jobs |
| Agent 的意图路由 | `packages/wcc-sidecar/src/agent.js:64-67`：`/单位|放人|地形|物编|地图|forge|改图|装备|批量/` → `codegen_run unit_registry` → `write_file` → `lua_check` |

> ⚠️ **一个必须点破的坑**：`RegisterUnit(rawcode, fields)` 在 `wcc-objects.lua:23-26` 只是 `registry.units[rawcode] = fields`，**不创建物编条目**，字段靠 `BlzSetUnitMaxHP` 等运行期 API 打补丁（`:39-53`）。四字码 `'hfoo'` / `'n001'` 是否真实存在，WCC 完全不校验 —— 这正是 `docs/ASSETS-GUIDE.md §2` 说的「AI 幻觉四字码根因」。

### 2.3 ✅ 运行期「触发功能」——有；🔴 GUI 触发器树——没有

| 凭据 | 代码 |
|---|---|
| 对话推进 / 跳过触发器 | `wcc-lib/wcc-dialogue.lua:205-210` `CreateTrigger()` + `TriggerRegisterPlayerEvent(... EVENT_PLAYER_END_CINEMATIC)` + `TriggerAddAction`；`:259-263` `skipTrig` 同样三件套 |
| Boss 事件模式 | `wcc-skill/patterns/task-boss-fight.md:182-190` `TriggerRegisterUnitEvent(trig, boss, EVENT_UNIT_DEATH)` / `EVENT_UNIT_DAMAGED` + `TriggerAddAction` |
| 通用触发器写法与泄漏规范 | `wcc-skill/knowledge/api-best-practices.md:198-215`（含 `DestroyTrigger`）、`:223-232`（反例） |
| 静态检查防崩 | `packages/wcc-lua-check/src/check.js:10` 禁 `TriggerSleepAction`；`:139-146` 死亡/触发上下文直接 `RemoveUnit` 报错 |

**但**：这些都是**游戏运行时注册的 Lua 事件**。`war3map.wtg`（WE 的 GUI 触发器树）、`war3map.wct`（自定义文本触发器）在 WCC 里**没有任何读写代码**。
`packages/wcc-sidecar/src/tools.js:31-364` 的 **20 个**本地工具中（✅ `grep -c` 实测），只有 `forge_status` / `forge_connect` / `forge_list_tools` 沾地图；`units_create` / `doodads_create` / `terrain_set_tile` / `triggers_add_gui` **一个都没有**。

唯一通道是转发：`tools.js:366-380` —— 凡 `forge_*` 且本地未定义的名字，交给 `forgeManager.callForgeTool(forgeName, args)`；`packages/wcc-sidecar/src/forge-mcp.js:433-441` 把 forge 的工具统一加 `forge_` 前缀注入。也就是说：**改图能力 100% 依赖外部 wc3-forge，WCC 自己没实现。**

`PROJECT-PLAN.md:115` 自己写得很清楚：

> 「改图、放人、物编、地形、GUI 触发器 | **wc3-forge MCP**（不重复造 152 工具）」

而 `wcc-skill/skill.md:142-150` §4.2「WE 前置配置」甚至要求 AI **输出一份让人去 WE 手工操作的清单**：

```
请在 World Editor 中完成以下配置：
1. 创建区域 `gg_rct_boss_spawn` (坐标: 1000, 1000)
2. 创建单位 `gg_unit_boss_001` (恐惧魔王)
3. 注册声音 `gg_snd_boss_intro`
```

> 🔴 这是全项目最能说明问题的三行：**摆人和建区域是"请人去 WE 手动做"的前置条件，不是 AI 的能力。**

### 2.4 ✅ 「战役人物剧情」——这块反而是 WCC 最厚实的资产

| 能力 | 凭据 |
|---|---|
| 对话/电影模式/打字机/镜头 | `wcc-lib/wcc-dialogue.lua`（330 行，`:81 Play`、`:127 ShowLine`、`:150 TypewriterEffect`、`:234 MoveCamera`） |
| 主线/支线任务（**真调原生 API**） | `wcc-lib/wcc-quest.lua`（388 行，`:258-282 CreateNativeQuest` 内 `CreateQuest()` / `QuestSetTitle` / `QuestItemCreate`） |
| 波次刷怪 / Boss 阶段机 | `wcc-lib/wcc-spawner.lua`（345 行）、`wcc-lib/wcc-boss-fight.lua`（99 行） |
| 数据驱动生成 | `codegen.js:118-129 dialogue_table`、`:138-146 quest_table`；`table-import.js:41-47` 解析 `dialogue` / `quests` |
| 可跑示例 | `examples/demo-campaign/src/chapter_01.lua`（169 行，对话链 → 创建任务 → 完成对话）、`main.lua` |

**所以准确说法是**：WCC 已经能写「人物说什么、任务怎么推进、怪什么时候刷」，但**不能决定「人物在地图编辑器里站在哪、触发器在 F4 里长什么样」**。用户说的「AI 更好编写战役人物剧情」是**已有能力 + 缺一层落地通道**，不是从零开始。

### 2.5 🔴 编辑器期能力：逐项判空

| 能力 | 状态 | 凭据 |
|---|---|---|
| 写 `.w3x` / MPQ | 🔴 无 | `build-map.js:130-131,164`；`package-lock.json` 无 MPQ 依赖 |
| 读 `.w3x` | 🔴 仅列文件名 | `map-sources.js:200-220 walkMaps` 只 `statSync` 取 path/bytes/mtime，`tools.js:346-363 local_maps_scan` 同样只列目录 |
| 预置单位 / 装饰物 / 地形 | 🔴 无本地工具 | `tools.js:31-364` 无对应 `run()` |
| GUI 触发器树 | 🔴 无 | 全仓无 `.wtg` / `.wct` 解析代码 |
| 物编 ID 字典 | 🔴 零 | `docs/ASSETS-GUIDE.md:15` 已判定；`WCC_Objects.RegisterUnit` 只是内存表 |
| 区域 / 相机 / 出生点 | 🔴 靠人手工 | `skill.md:142-150` WE 前置清单 |
| 端到端验证 | 🔴 无 | 仓库零 `.w3x`，无法跑「生成 → 进图 → 试玩」 |

### 2.6 文档虚标清单（本轮核查发现，顺手记下）

| 位置 | 原文 | 实际 |
|---|---|---|
| `PROJECT-PLAN-2.0.md:21` | 「`wcc build`：库+业务打进 w3x」 | 🔴 `build_map` 只产 `war3map.lua` + `src-tree/`，不写 `.w3x` |
| `PROJECT-PLAN.md:49` | 「Harness 负责…可交付的 `.w3x`」 | 🔴 同表 `:13` 自己已写「仅 war3map.lua 脚本包；MPQ 未接」，属未兑现目标 |
| `PROJECT-PLAN.md:207` | `wcc-map/ # 最小 w3x 读写/打包` | 🔴 目录不存在 |
| `examples/demo-campaign/README.md:21` | `demo-campaign.w3x` | 🔴 文件不存在（`ASSETS-GUIDE.md:12` 已指出） |
| `docs/FORGE-INTEGRATION.md:48` | 「forge GPL 源自 HiveWE (GPL-3.0)」 | 🟠 需复核：GitHub API 实测 `stijnherfst/HiveWE` **现为 AGPL-3.0**（490★，2026-10-11）。可能是许可变更或所指为旧版本/移植时点，**不改写原结论，标记为待核** |

---

## 3. 四条路线逐条评估

### 3.0 共同前提：四条路线其实是同一条管线的四种「素材来源」

```
来源(碎片库 / 已有 w3x / seed 生成 / 本机地图库)
   → 文本 IR（.wcc/ir/，可 git diff）  ← AI 只在这一层动笔
   → 执行层（MCP / 打包器）写回 .w3x
   → World Editor 打开 + Save 一次（编译触发器） + Test Map
   → 日志/截图回流 → lua_check / IR diff → 下一轮
```

AI 在 IR 层做「选哪个碎片、改哪个参数、裁剪哪块区域」，**不直接生成二进制、也不直接生成坐标矩阵**。这是四条路线能共存的原因。

### 3.1 ① 拼图流（Prefab / Tile 碎片库）—— 🟢 最推荐，先做这个

**你的原意**：生成大量可用拼接碎片，映射不同场景；关键时候调用不同碎片，修改裁剪后融入地图。

**判定：技术最稳、与现有生态最契合。** 因为碎片本质就是「一小块文本 IR」，可以 git 管理、可以 diff、可以回滚 —— 正好补 §2.5 那个洞。

| 环节 | 做法 | 现状 |
|---|---|---|
| 碎片格式 | 一个 `fragment.json` = `{ w3e 的 tilepoint 子网格, doo 装饰物列表, Units.doo 结构列表, w3r 区域模板, 边界元信息, seed, 来源图 hash }` | 🔴 未定义，本文 §6.2 给草案 |
| 来源 | 本机 `Maps\` 559 张 `.w3x`（✅ 实测）；优先 `Maps\Scenario\` 官方小图 4 张 / `FrozenThrone\Scenario\` 9 张（`ASSETS-GUIDE.md:35-36`） | 🟠 二手目录描述，需逐张确认 |
| 切分 | 按矩形窗从 `war3map.w3e` + `.doo` + `Units.doo` 抽子块，坐标归一化到碎片原点 | 🔴 未实现 |
| 缝合（**最难**） | 必须同步 `w3e`（地形/高度/水面/悬崖）+ `wpm`（路径）+ `shd`（阴影）+ `w3i` 相机边界 + 小地图，跨文件不一致会出不可走/黑图 | 🟠 HiveWE 论坛 2017 讨论明确指出「地图尺寸存在多个内建文件里」「改了 w3e/doo 是否要同步 pathing map」是真实坑 |
| 物编 ID | 碎片里的自定义单位 ID 进新图会撞车，需全局分配器（Wurst 的 `ObjectIdGenerator` 思路） | 🔴 `WCC_Objects.RegisterUnit` 只是内存表，无分配器 |
| 检索 | 碎片打标签（雪地/城镇/林地/BOSS 房/河岸），用户说话 → 向量/关键词召回 top-k → AI 选片 + 裁剪 | 🔴 未实现，但 `harness/src/tool-inject.js` 的按需注入与 `scratch.js` 大结果落盘可直接复用 |

**最小验证（P0）**：不做 AI，先手写 1 个 `16×16` 碎片 → 贴进一张空白图 → WE 打开能走 → 才算路线成立。**在此之前不要写「已支持拼图流」。**

### 3.2 ② 借鉴流（用户上传 `.w3x`，提取地表/树林/建筑，排除人物物品）—— 🔴 原思路要改两处

**改动 1：不要用「图片 + AI 视觉提取」，直接解析 `.w3x`。**
用户说的是「上传一张 w3x 的图片」，但 `.w3x` 本身是 **MPQ 归档**，内部按职责分文件存好了（🟠 依据 `ChiefOfGxBxL/WC3MapSpecification`、HiveWE Wiki、`war3map` README、`warcraft-3-mcp-server` 工具说明）：

| 内部文件 | 内容 | 借鉴流要保留吗 |
|---|---|---|
| `war3map.w3e` | 地形 tilepoint、贴图、高度、水、悬崖 | ✅ 地表 |
| `war3map.doo` | 装饰物 / 可破坏物（树、岩石、栅栏…） | ✅ 树林 |
| `war3map.wpm` / `war3map.shd` | 路径 / 阴影 | ✅ 必须同步保留，否则地形不可走 |
| `war3mapUnits.doo` | **预置单位 + 物品 + 建筑** | 🟠 见改动 2 |
| `war3map.w3r` / `.w3c` / `.w3i` | 区域 / 镜头 / 地图信息 | 🟠 可选 |
| `war3map.wtg` / `.wct` / `.j` / `.lua` | GUI 触发器树 / 自定义文本 / 编译后脚本 | ❌ 排除（要重写剧情） |
| `war3map.wts` / `.imp` / `war3mapMisc.txt` | 字符串 / 导入资源 / 平衡常数 | 🟠 按需 |

按文件过滤是**确定性、100% 准确**的，视觉模型反而会猜错贴图与高度。
**如果只有截图没有 `.w3x`**：截图只能当「意图参考」，让 AI 描述风格后回到路线 ① 从碎片库合成，**不要做像素→地形重建**。

**改动 2：「排除人物和物品，保留建筑」不能靠丢文件。**
在 WC3 里 **建筑就是单位**（带 `UNIT_TYPE_STRUCTURE` 的四字码单位，和步兵、英雄一起放在 `war3mapUnits.doo`）。`ChiefOfGxBxL/WC3MapTranslator` 的 `UnitsTranslator` 也是把单位与物品放在同一个翻译器里（🟠 README）。
所以正确做法是**按类型过滤而不是按文件过滤**：

```
读 war3mapUnits.doo → 逐条取 4 字 rawcode
  → 查 UnitData.slk / 单位分类字典，判定 是否建筑 / 是否英雄 / 是否普通单位 / 是否物品
  → 保留「建筑」类，丢弃「人物」「物品」「野怪」
```

🔴 **前置依赖**：这张分类字典 WCC 现在没有（`ASSETS-GUIDE.md:15` 判定物编 ID 字典为零，并建议补 `wcc-skill/knowledge/wc3-object-ids.md`）。这是借鉴流真正的第一块砖，而它同时也是修 AI 幻觉四字码的 ROI 最高项 —— 一举两得。

**可用执行层**（🟠 官方 README）：
- `YElwiddi/warcraft-3-mcp-server`：`wc3_list_units` / `wc3_list_doodads` / `wc3_read_terrain` / `wc3_delete_unit` / `wc3_replace_file`
- `wc3-forge`：`units_list` / `doodads_list` / `terrain_get_tile` / `map_extract_to_folder` / `map_save_as`

**两条硬约束**（🟠 `warcraft-3-mcp-server` README 明写）：① 外部写盘前**必须先在 WE 里关掉这张图**，写完再重新打开；② 改了 GUI 触发器后要**在 WE 里 Save 一次**，编辑器才会把触发器编译进可运行脚本。

### 3.3 ③ 随机生成流（先找开源生成器）—— 🟠 检索结论：没有现成整车，只有零件

**检索范围与诚实结论**：本轮用了多轮 WebSearch（中英文，含 "Warcraft III random map generator" / "w3x generator" / "procedural terrain seed" / 中文「魔兽随机地图生成器」），并尝试 GitHub Search API（**403 rate limit exceeded**，未完成全量检索）。**在已检索到的结果里，没有发现成熟、活跃、专用于生成 WC3 地图的开源项目。** 不能据此断言「不存在」，只能说「本轮没找到，别把计划押在它上面」。

找到的是**可直接组装的零件**（许可证均为 GitHub API 实测 2026-11-09）：

| 零件 | ★ / 许可 / 最后 push | 能干什么 | 对路线 3 的用法 |
|---|---:|---|---|
| `eGlint/Warcraft-III-Noise-Library` | 4 / **MIT** / 2025-05-20 | Perlin(1D/2D/3D) + OpenSimplex2D，提供 **JASS / vJASS / Lua / Wurst** 四版；Hive 上还有 `wurstNoiselib` | 用固定 seed 产高度/贴图分布；**注意这是游戏运行期噪声，不是编辑器期铺 w3e** |
| `sethmachine/pyw3x` | 3 / **无许可证标注** / 2022-12-07 | Python + StormLib 封装，移植 HiveWE `Terrain.cpp`，实测能把 `war3map.w3e` 读出并**字节级无差异写回** | 证明 Python 改 w3e 可行；🔴 无许可 + 6 年未更，**只作思路参考，不要引入代码** |
| `ChiefOfGxBxL/WC3MapTranslator` | 123 / **MIT** / 2026-07-12 | `war3map ⇄ JSON`，支持 w3e / Units.doo / doo / w3r / w3c / 物编 7 类 / w3i / imp / wts；npm `wc3maptranslator@5.0.0`（npmmirror 实测 MIT） | **路线 3 的真正底座**：seed → JSON → `.w3e`/`.doo` → 塞回 MPQ |
| `invoker-bot/war3map` | 21 / **MIT** / 2026-04-28 | TypeScript，覆盖 w3e / doo / Units.doo / wtg / wct / wpm / shd；`MapArchiveObject.readArchive/writeArchive` 读写 `.w3x`；npm `war3map@0.1.2` | 比 Translator 覆盖更多文件（含**路径图/阴影/触发器树**），更适合做完整 IR |
| `node-stormlib` | npm `0.1.0-alpha.0` / **MIT** | MPQ 容器读写（只是容器，地图内部文件由上面的库解析） | 打包回 `.w3x`；🔴 alpha，需实测预编译二进制 |
| `Drake53/War3Net` | 168 / **MIT** / 2026-10-17 | C# .NET，MPQ / SLK / `.w3x` 读写，可提物编 SLK ID 表 | 补 ID 字典、SLK 表；C# 栈，走独立 CLI 而非塞进 Node |
| `sumneko/w3x2lni` | 173 / **GPL-3.0** / 2025-12-18 | Map → **Full 文本中间态** → Lni/Obj/Slk；`w2l.exe obj` 可从 `maps/table/*.ini` 重建 `.w3x` | 🟠 **许可隔离**：可调用其 exe（进程隔离），**不可把源码并入 MIT 的 WCC** |
| `stijnherfst/HiveWE` | 490 / **AGPL-3.0** / 2026-10-11 | C++20 现代编辑器，w3e/doo 解析、笔刷、实时预览 | 只作格式参考，AGPL 不碰 |
| `StephenSHorton/wc3-forge` | 14 / **GPL-3.0** / 2026-10-28 | `map_new(name/size/tileset)` + `terrain_set_tile` / `terrain_paint_tile` / `terrain_brush_height|cliff|ramp|water` / `map_save_as` | **最省事的打底**：让 forge 建空图并刷地形，WCC 只管 seed 与参数 |
| `Sko0owi/HOMM3-mapgen` | 🟠 非 WC3 | 英雄无敌3 的模板化生成器：Zone / NoisePlacer / ObjectPlacer / GuardPlacer / RoadPlacer / TemplateInfo | **仅借架构**（模板 + 分区 + 各类放置器分离），别当 WC3 工具 |

**结论与建议改法**：路线 3 不要写成「用户用现成随机地图工具生成」，改成
> **WCC 自己提供 `wcc.map.seed`：seed → 噪声 → `w3e`/`doo` JSON（走 MIT 的 `war3map` 或 `wc3maptranslator`）→ 塞回空白 `.w3x`；或先调 forge `map_new` 打底，再由 seed 决定 tile 分布。**

⚠️ 别忘 `wpm` 路径图与 `shd` 阴影必须一起生成/重算；`WC3MapTranslator` 明确 **不支持 wpm / shd**（README 标 ❌），`war3map` 才支持。这是选库的关键分水岭。

### 3.4 ④ 素材库流（大模型调取素材地图再微调）—— 🟢 最容易先出成果

**本机现状（✅ 实测 2026-11-09）**：`D:\净土\kkkk\魔兽争霸3冰封王座\Maps\` 下 **559 个 `.w3x` + 60 个 `.w3m` + 1 个 `.w3n`**（另有 3 html / 2 txt / 1 7z）。这就是现成素材库，**零下载、零版权获取动作**。

**但「让大模型记住地图」是错的设计**。正确做法是**索引 + 检索**，把地图变成可查询的元数据：

```
扫描(已有 map-sources.js:200-220 walkMaps 只会列文件名)
  → 解析每张图头部: 尺寸/tileset/玩家数/单位数/装饰物数/区域数/是否 Lua/是否有 wtg
  → .wcc/map-index.json（纯文本，可 git）
  → 用户说话 → 召回 top-k（按主题/尺寸/tileset/复杂度）
  → AI 在候选图上做「微调」（改几处 tile / 挪几个单位 / 替换剧情脚本）
  → 输出 diff（IR 级）→ 审批 → 写回副本
```

WCC 已有半块砖：`tools.js:346-363 local_maps_scan` + `map-sources.js` 的 `walkMaps` 已能列出路径/大小/时间；缺的是**解析头部 + 建索引 + 检索**。
另外 `harness/src/scratch.js`（大结果落盘）与 `tool-inject.js`（按需注入）正好用来把 559 张图的清单挡在上下文之外 —— 别把索引塞进 prompt。

**合规红线**（沿用 `ASSETS-GUIDE.md §6`）：只索引**用户本机已有文件**，只存元数据与 hash，不批量爬取、不镜像、不分发地图本体或暴雪资产；加密/受保护图可能读不全（`warcraft-3-mcp-server` README 明确承认这点）。

---

## 4. 本机 Python + Lua + 原版 WE 的「外部支持」

### 4.1 本机实测（✅ 本轮逐项跑过）

| 项 | 实测值 |
|---|---|
| Python | `D:\Python\python.exe` **3.13.14**（pip 26.1.2） |
| **游戏版本**（2026-11-10 补测） | ✅ `war3.exe` / `game.dll` **FileVersion 1.26.0.6401（Version 1.26）** → **经典版，只支持 JASS 地图脚本**；Lua 脚本与「文件夹地图 + auto-import」是 **Patch 1.31+** 能力（🟠 官方 patch notes）。🔴 因此本文 §4.3 闭环里的 `war3map.lua` **在这台机器上不能直接试玩** |
| **编译工具**（2026-11-10 补测） | 🔴 无 `w2l.exe` / `jasshelper.exe` / `pjass` / `grill` / `common.j` / `blizzard.j`；✅ 仅有 `change\SFmpq.dll` 184,320 B 与 `版本1.20e.zip`…`版本1.27b.zip` 共 9 个版本包；`jass_plugin\alpha\` 为空目录 |
| 原版 WE | `D:\净土\kkkk\魔兽争霸3冰封王座\worldedit.exe` **5,103,592 B**（无版本资源）；同目录 `World Editor.exe` 57,344 B（启动器）；`worldedit.org` 5,529,043 B |
| 游戏数据 | `war3.mpq` **451,574,838 B**、`War3x.mpq` **342,689,568 B**、`War3xlocal.mpq` 45,017,713 B、`storm.dll` / `_storm.dll` 各 339,968 B |
| 地图库 | 559 `.w3x` / 60 `.w3m` / 1 `.w3n` |
| Python 现有库 | ✅ `json` / `struct` / `zlib`；🔴 **未装** `mpyq` / `PIL(Pillow)` / `numpy` / `pytest` |
| 国内镜像 | ✅ 清华 `pypi.tuna.tsinghua.edu.cn/simple/mpyq/` **200**、阿里 `mirrors.aliyun.com/pypi/simple/mpyq/` **200** |
| npm 镜像 | ✅ npmmirror 上 `wc3maptranslator@5.0.0`(MIT) / `war3map@0.1.2`(MIT) / `node-stormlib@0.1.0-alpha.0`(MIT) 均可查 |

### 4.2 🔴 必须先接受的事实：WE 没有自动化 API

🟠 `YElwiddi/warcraft-3-mcp-server` README 原话：

> "Warcraft's World Editor has **no plugin/automation system**, so this edits the map *file* directly."

所以「让 AI 更好编写地图」**不是让 AI 驱动 WE 点鼠标**，而是：

| 角色 | 职责 | 绝不做的事 |
|---|---|---|
| **Python（离线层）** | 解包 MPQ、解析/生成 IR、扫 559 张图建索引、做字节级 round-trip 校验、跑批处理与统计 | 不常驻、不碰 GUI |
| **Node / Sidecar（编排层）** | 会话、审批、工具注入、steering、`lua_check`、调用执行层 | 不自己解析二进制 |
| **Lua / `wcc-lib`（运行期层）** | 对话、任务、刷怪、Boss、事件触发器 —— **WCC 已有的最强部分** | 不假装能改 `.w3x` |
| **原版 WE（验证层）** | 打开地图、**Save 一次编译 GUI 触发器**、Test Map 试玩、人眼验收 | 不做自动化编辑 |

可选增强：🟠 `actboy168/YDWE`（**GPL-3.0**，551★，2024-06-16）在官方 WE 上加了 Lua / JassHelper / w3x2lni / 插件体系，是「WE 有外部能力」的唯一成熟路径；但 GPL 许可 + 老版本 WC3 兼容问题，按你既定战略**只作外部可调用工具，不并入 MIT 仓库**。

### 4.3 建议的闭环（每一步都有产物与责任方）

| 步 | 动作 | 产物 | 责任方 | 风险 |
|---|---|---|---|---|
| 0 | **备份原图** | `xxx.bak.w3x` | Python | 🔴 现在 `HARNESS-IMPLEMENTATION.md §3` 列的 `wcc.map.snapshot` 还没写，必须先补 |
| 1 | 关掉 WE 中打开的这张图 | — | 人 / UI 提示 | 🟠 不关会写冲突 |
| 2 | 解包 → 转文本 IR | `.wcc/ir/<map>/{terrain,doodads,units,triggers}.json` | Python（mpyq 读） / Node（war3map） | 🔴 wpm/shd 不能丢 |
| 3 | AI 在 IR 上「微调」 | IR diff（可 git diff） | Sidecar + steering + 审批 | 只改文本，不碰二进制 |
| 4 | 字节级 round-trip 自检 | `verify.json` | Python | 🟠 借鉴 MCP Server 的「写前先证明能 byte-for-byte 重建」策略 |
| 5 | IR → 二进制 → 打包回 `.w3x` | `xxx.edited.w3x`（**默认写副本**） | 执行层 | 🔴 目前无实现 |
| 6 | WE 打开 + **Save 一次** | 编译后的 `war3map.j/lua` | 人 / `wc3_open_in_editor` | 不 Save 则 GUI 触发器不生效 |
| 7 | Test Map 试玩 | 日志 / 截图 | 人 / `wc3_test_map` | 目前无日志自动回流 |
| 8 | 回流校验 | `lua_check` 报告 + IR diff | WCC | 形成下一轮输入 |

> 这正好把 §2.4 已有的「剧情能力」接到 §2.5 缺失的「落地通道」上，也是你这句「让 AI 更好编写相关地图、战役人物剧情」的可执行版本。

### 4.4 Python 侧需要补什么（🔴 全部未安装、未实测）

| 依赖 | 用途 | 状态 |
|---|---|---|
| `mpyq` | 纯 Python 读 MPQ（**只读**） | 🟠 国内镜像 200 已验证可达；功能细节未装未测 |
| StormLib 绑定 / `node-stormlib` | **写回** MPQ（mpyq 不能写） | 🔴 需实测预编译二进制；`node-stormlib` 仍是 alpha |
| `Pillow` / `numpy` | 仅在「确实要处理截图/小地图」时才需要 | 🔴 未装；借鉴流改走文件过滤后**大概率不需要** |
| `wc3-object-ids.md` / `assets/paths.json` | 单位分类、建筑判定、四字码字典 | 🔴 零，`ASSETS-GUIDE.md §2` 已列为 ROI 最高项 |

⚠️ 本机 `storm.dll` 是**暴雪游戏自带 DLL**，与开源 StormLib 不是同一套 API，**不要假设可以直接拿来写 MPQ** —— 本轮未验证，标为待查。

---

## 5. Warcraft 3 MCP Server 是什么（本轮新增调研）

### 5.1 一句话定位

✅ `YElwiddi/warcraft-3-mcp-server`：一个 **MIT 许可的 TypeScript MCP server**，让 Claude「直接改 `.w3x` / `.w3m` 文件」，而不是驱动 World Editor。
GitHub API 实测（2026-11-09）：**12★ / MIT / TypeScript / 最后 push 2026-08-14**。要求 **Node ≥ 18**，`npm install && npm run build` 后用 `claude mcp add wc3 -- node <path>/dist/index.js` 注册。

🟠 README 的关键论断：**WE 没有插件/自动化系统，所以直接改地图文件**；改完在 WE 打开或进游戏就能看到。
**默认安全**：改动写到同目录 `MyMap.edited.w3x` 副本，**不覆盖原图**，除非明确要求。

### 5.2 工具集（🟠 依据官方 README）

| 类别 | 工具 |
|---|---|
| 看 | `wc3_overview`、`wc3_map_info`、`wc3_list_files` / `wc3_read_file`、`wc3_read_objects`、`wc3_read_placements` / `wc3_list_units` / `wc3_list_doodads`、`wc3_read_script`、`wc3_read_strings`、`wc3_read_regions` / `wc3_read_cameras` / `wc3_read_sounds`、`wc3_read_terrain`、`wc3_read_triggers`、`wc3_read_imports` |
| 改 | `wc3_place_unit` / `wc3_modify_unit` / `wc3_delete_unit`、`wc3_place_doodad` / `wc3_modify_doodad` / `wc3_delete_doodad`、`wc3_add_region` / `wc3_modify_region` / `wc3_delete_region`、`wc3_add_camera` / `wc3_delete_camera`、`wc3_write_objects`、`wc3_set_string`、`wc3_write_script` / `wc3_replace_file`、**`wc3_add_gui_trigger` / `wc3_modify_gui_trigger`** |
| 建 | `wc3_create_object`（基于已有四字码派生自定义单位/物品/技能）、**`wc3_set_durable_script`** |
| 验 | `wc3_open_in_editor`、`wc3_test_map` |

两个值得抄的设计：

- **GUI 触发器（1.1 起）**：写的是 `war3map.wtg`（编辑器自己的触发器数据），所以在 Trigger Editor (F4) 里**看得见、Save 后仍在**。写前会**先证明能把该图触发器 byte-for-byte 重建，做不到就拒绝写入**。🟠 改完需在 WE 里 **Save 一次**编译成可运行脚本。
- **`wc3_set_durable_script`**：把 JASS/Lua 同时写进 `war3map.wct` 和地图脚本，因此**立即能跑 + 经 WE 重存后不丢**，还能在触发器编辑器里继续编辑。这正好解决 `wc3_add_trigger` 那种「向脚本拼接代码，WE 一保存就被覆盖」的老问题 —— **对 WCC 的 `war3map.lua` 注入路径是直接可用的经验**。

### 5.3 和 wc3-forge 的对比（决定 WCC 该接谁）

| 维度 | `YElwiddi/warcraft-3-mcp-server` | `StephenSHorton/wc3-forge` v1.0.7 |
|---|---|---|
| 许可证 | ✅ **MIT**（与 WCC 同族，可安全集成） | 🔴 **GPL-3.0**（只能进程间通信，不可复制源码） |
| 工作方式 | 直接读写 `.w3x` 文件，**不需要常驻 GUI** | 需要**运行中的编辑器**，MCP 通过 pid lockfile 桥接 |
| 工具量 | 🟠 ~30 个（README 列举） | ✅ **152 个**（官方 tool-reference 实测） |
| 地形写入 | 🟠 `wc3_read_terrain` 仅**读**摘要；写地形要靠 `wc3_replace_file` 塞内部文件 | ✅ `terrain_set_tile` / `paint_tile` / `set_height` / `brush_height|cliff|ramp|water` / `swap_tileset` |
| 新建地图 | 🔴 README 未见 `map_new` | ✅ `map_new(name/size/tileset)`、`map_extract_to_folder` |
| GUI 触发器 | ✅ 原生 `wtg` 读写 + round-trip 安全闸门 | ✅ `triggers_tree` / `triggers_add_gui` / `triggers_convert_to_lua` |
| 撤销 / 历史 | 🔴 未见 | ✅ 与 GUI 共用 history stack，`Ctrl+Z` 可撤销 AI 的改动 |
| 默认安全 | ✅ 写 `.edited.w3x` 副本 | 🟠 `map_save` 原地保存（可用 `map_save_as` 规避） |
| 坐标 | 🟠 各工具自带 x/y | ✅ 统一游戏坐标（原点在地图中心） |
| 活跃度 | 12★，2026-08-14 后无 push（API 实测） | 14★，2026-10-28（API 实测） |
| 已知限制 | 超大 / 加密图部分不可读；改前要关 WE；GUI 改动后要 Save 一次 | alpha、单人维护、加功能要 GUI+MCP 双表面同改 |

### 5.4 对 WCC 的战略意义（重要）

1. **它比 forge 更契合你已定的战略**。你已决定「WCC 做点击即用的独立 harness、forge 只做增强执行层、代码二分只提优化 PR」。MIT 的 MCP Server 意味着：想集成时可以**直接作为依赖/MCP 注册**，没有 GPL 传染争议；forge 仍只能走进程间协议。
2. **建议把 C2 从「只接 forge」扩成「双执行层适配」**：在 WCC 内部定义一层 `map_*` 抽象（`map_open` / `map_read_ir` / `map_apply_diff` / `map_save_as` / `map_verify`），底下挂 forge 适配器与 `wc3` 适配器。`harness/src/tool-inject.js` 的 `mergeCatalog()` 已经支持把外部工具目录合并成单一 registry，正好避免双份维护（这也是从 forge「GUI+MCP 双表面」吃到的教训）。
3. **它同时是路线 ②④ 的现成执行层**：`wc3_list_units` / `wc3_list_doodads` / `wc3_delete_unit` 直接服务借鉴流过滤；`wc3_overview` / `wc3_map_info` 直接服务素材库索引。
4. 🔴 **本轮只是调研**：**未 clone、未 npm install、未注册 MCP、未启动过它、未与 WCC 联调**。任何「已接入」的说法都不成立。

### 5.5 风险

- 🟠 12★、2026-08 后无更新，属小项目；依赖它做唯一执行层不稳。
- 🟠 它和 forge **不能同时写同一张图**（都是文件级写），必须串行 + 快照 + 副本。
- 🟠 它的定位是「给 Claude 用」，而你已明确 **WCC 不依赖 Claude Code**（国内门槛/封号）。所以接入方式应是 **WCC 自己作为 MCP client 调它**（或复用其文件层库），而不是要求用户装 Claude Code。
- 🔴 加密/受保护地图读不全；本机 `Maps\dz\rpg\` 下大量平台缓存图很可能属于此类，索引时要能优雅降级。

### 5.6 2026-11-10 补正：源码级复核与版本硬约束

以下为 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) 的新增结论，**推翻/收紧了 §5.1–§5.4 的乐观判断**：

| 项 | 新证据 | 对本文的修正 |
|---|---|---|
| 定位 | ✅ `src/map.ts` 头部注释：容器用 `mdx-m3-viewer`(MIT)、物编用 `wc3maptranslator`(MIT)；`package.json` 只有 4 个依赖，无 StormLib/无原生二进制 | 它是 **「文件编辑器 + MPQ 重打包器」，不是编译器**。真正把触发器编成 `war3map.j/lua` 的是 **WE 的 Save**（`src/durable.ts` 注释原文） |
| 写盘 | ✅ `saveMap()`：`map.save()` 失败时降级 `archive.save()` + 原样贴回 512B `HM3W` 头；`wc3_write_script` / `wc3_replace_file` 默认落 `.edited.w3x` | 🟠 源码级证明**纯 JS 能打包 `.w3x`**，修正 §4.4「MPQ 写回必须先啃原生 StormLib」的保守判断；🔴 但本机未实测 |
| 安全闸门 | ✅ `src/wtg.ts` 的 `mutateWtg()` 写前要求 parse→serialize **byte-for-byte**；`map.ts` 用 load→save 逐字节探测 doo 的 buildVersion | 直接就是 `wcc.map.verify` 的实现范本 |
| 脚本持久化 | ✅ `src/durable.ts` / `wct.ts`：脚本双写 `war3map.wct` + 镜像 `war3map.j/lua`（sentinel 幂等），因为 **WE 每次 Save 会从 `wtg`+`wct` 重编译脚本，单独改 `war3map.j` 会被覆盖** | 🔴 **WCC 现有 `build_map` 只产脚本包，不等于「进图」**；`wcc.map.set_script` 必须带 `targetPatch`/`strategy` |
| **版本限制** | ✅ `wct.ts` 只接受 `0x80000004`；`wtg.ts` 的 modern（`WTG!` + `0x8000000x`，Reforged/1.31+）可读写，**classic v4/v7 只能读不能写** | 🔴 本机 **1.26** 图上 `wc3_set_durable_script` / `wc3_add_gui_trigger` **大概率直接报错或拒写**。§5.4 的「建议做双执行层」应**等目标补丁定了再投入** |
| 编辑器桥 | ✅ `src/editor.ts` 硬编码 Reforged 默认安装路径，`openInEditor` 用 `-loadfile`、`testMap` 用 `-launch -window -loadfile` | 🔴 本机路径不匹配，必须显式传 `exePath`；老客户端还可能要求地图放在 `Documents\Warcraft III\Maps` |

> 🟠 结论调整：**许可证上仍是三者中最贴合 WCC 的**（MIT），但**功能上受游戏补丁版本制约**。选型顺序应从「许可优先」改为「目标补丁优先 → 许可次之」。完整命令、目录契约与 P0 验收见新文档。

---

## 6. 统一架构：把四路线 + Python + 两个 MCP 收敛成一条管线

### 6.1 分层

| 层 | 组件 | 现状 |
|---|---|---|
| L0 素材 | 本机 559 `.w3x` / 官方 `Scenario` 小图 / `war3.mpq` 的 SLK ID 表 | ✅ 有，零下载 |
| L1 解析 | Python(mpyq 读) + `war3map`/`wc3maptranslator`(MIT, Node) + MPQ 写回 | 🔴 全缺，本轮未装。🟠 补正：`mdx-m3-viewer`(MIT) 已由 MCP Server 生产代码证明能纯 JS 读写/重打包 MPQ，**本轮仍属源码级证据、本机未实测**；外部编译器可选 `w2l obj`(GPL) / `grill build`(Apache) / `jasshelper`(老版本) |
| L2 **文本 IR** | `.wcc/ir/`：`terrain.json` / `doodads.json` / `units.json` / `regions.json` / `fragments/` / `diffs/` | 🔴 全缺（`HARNESS-IMPLEMENTATION.md §3` 已列为待补脚本） |
| L3 编排 | `harness/`（steering / hooks / spec / scratch / budget / 审批 / 工具注入）+ Sidecar | ✅ 已有 14 文件 2088 行，🟠 **旁路未接主循环** |
| L4 执行 | forge MCP（GPL，进程隔离）/ `wc3` MCP（MIT，可集成）/ WE（编译与试玩） | 🟠 只有 forge 的转发代码，未联真机 |
| L5 验证 | `lua_check` → IR diff → WE Save → Test Map → 日志回流 | 🟠 只有 `lua_check` 一段 |

### 6.2 碎片格式草案（🔴 设计稿，未实现）

```json
{
  "schema": "wcc.fragment/0.1",
  "id": "scenario_snow_ruins_16x16",
  "size": { "tilesX": 16, "tilesY": 16, "unitPerTile": 128 },
  "origin": "center-relative",
  "tags": ["雪地", "废墟", "可通行", "无剧情"],
  "layers": {
    "w3e":  "fragments/snow_ruins_16x16/w3e.tilepoints.json",
    "doo":  "fragments/snow_ruins_16x16/doodads.json",
    "units":"fragments/snow_ruins_16x16/structures.json",
    "wpm":  "fragments/snow_ruins_16x16/pathing.bin",
    "shd":  "fragments/snow_ruins_16x16/shadow.bin"
  },
  "edge": { "N":"snow", "E":"snow|cliff", "S":"road", "W":"snow" },
  "objectIds": [], "sourceHash": "sha256:...", "license": "user-owned"
}
```

`edge` 元数据是拼图流能否自动缝合的关键（边界贴图/高度只允许相同类型相接）；`objectIds` 交给全局分配器去重；`sourceHash` 保合规溯源。

### 6.3 需要补的脚本（对齐 `SCRIPT_MANIFEST` 的四条缺口）

| 脚本 | 作用 | 状态 |
|---|---|---|
| `wcc.map.snapshot` | 改图前备份原 `.w3x` | 🔴 未写，P0 |
| `wcc.map.diff` | IR 级 diff（AI 改了什么、可审批可回滚） | 🔴 未写，P0 |
| `wcc.map.index` | 扫本机地图 → `.wcc/map-index.json` | 🔴 未写，P1（路线 ④） |
| `wcc.map.fragment` | 切分 / 检索 / 缝合碎片 | 🔴 未写，P1（路线 ①） |
| `wcc.map.seed` | seed → 噪声 → w3e/doo JSON | 🔴 未写，P2（路线 ③） |
| `wcc.map.apply` | IR → `.edited.w3x`（挂执行层适配器） | 🔴 未写，P1 |
| `wcc.map.verify` | byte-for-byte round-trip + wpm/shd 一致性 | 🔴 未写，P0 |
| `wcc.release.pack` | electron-builder 打包 | 🔴 未写（与本文无关，见 `HARNESS-IMPLEMENTATION.md`） |

> **纪律**：上述脚本均涉及外部二进制或新依赖，**不允许先写 `echo` 占位冒充完成**（现有 `build` 脚本就是反面教材）；`release.pack` 与本文无关，仅作并列记录。

---

## 7. 优先级与验收标准

| 级别 | 做什么 | 为什么先做 | 验收标准（不许含糊） |
|---|---|---|---|
| **P0** | ① 补 `wcc-object-ids.md`（单位/建筑/物品分类 + 四字码）；② `wcc.map.snapshot` + `wcc.map.diff` + `wcc.map.verify`；③ 打通 **1 张**官方 `Scenario` 小图的「读 → IR → 写回副本 → WE 打开 → Save → Test Map」 | 没有分类字典，借鉴流过滤不成立；没有快照/diff，任何写图都不安全；没有端到端，其余全是纸面 | 拿一张真实 `.w3x` 跑通，产出 `.edited.w3x`，WE 能打开且单位/地形不丢；diff 可读、可回滚、round-trip 自检通过 |
| **P1** | ④ 路线 ④ 索引与检索；⑤ 路线 ① 碎片库（先手工 1 片，再谈自动生成）；⑥ 双执行层 `map_*` 适配（forge / `wc3`） | ④ 零解析也能出成果；① 是路线 ②③ 的基础；⑥ 解掉 GPL 单点依赖 | 559 张图索引可查；1 个手写碎片贴进空图后 WE 可走；同一 IR diff 能通过两种适配器落到副本 |
| **P2** | ⑦ 路线 ② 自动过滤（含建筑判定）；⑧ 路线 ③ `wcc.map.seed`；⑨ 剧情 IR ↔ `war3map.lua` / `wtg` 联动 | 依赖 P0 字典与 P1 管线 | 「排除人物物品、保留地表树林建筑」在 3 张不同图上结果正确；seed 可复现；AI 写的一章剧情能在游戏里跑起来并被 `lua_check` 通过 |
| **持续** | 修 §2.6 的文档虚标；`AGENTS.md` / steering 契约；不分发暴雪资产 | 你一贯要求文档真实 | 仓库内不再出现「已有 `.w3x`」「build 打进 w3x」这类过期声明 |

---

## 8. 本轮验证记录（可复现）

| 项 | 命令 / 来源 | 结果 |
|---|---|---|
| Python 版本 | `D:/Python/python.exe -V` | `Python 3.13.14` |
| WE 实测 | `ls` + `find` 游戏目录 | `worldedit.exe` 5,103,592 B；`World Editor.exe` 57,344 B；`storm.dll` 339,968 B |
| 地图库 | Python `glob` 统计扩展名 | `.w3x 559 / .w3m 60 / .w3n 1` |
| Python 依赖 | `importlib.util.find_spec` | 有 `json/struct/zlib`；无 `mpyq/PIL/numpy/pytest` |
| 国内镜像 | `urllib` 请求清华/阿里 `/simple/mpyq/` | 均 **200** |
| npm 镜像 | npmmirror registry API | `wc3maptranslator@5.0.0`(MIT) / `war3map@0.1.2`(MIT) / `node-stormlib@0.1.0-alpha.0`(MIT) |
| 许可证 | GitHub REST `/repos/{owner}/{repo}` | 见 §3.3 / §5.1 表；`actboy168/w3x2lni` **404**（正确仓库是 `sumneko/w3x2lni`，173★ GPL-3.0）；GitHub Search API **403 rate limit** |
| forge 工具表 | `WebFetch https://stephenshorton.github.io/wc3-forge/docs/tool-reference` | 152 工具；`map_new` / `terrain_*` / `units_*` / `doodads_*` / `triggers_*` / `history_*` 全部在列 |
| MCP Server | `WebFetch` 官方 README + GitHub API | MIT / 12★ / TypeScript / push 2026-08-14；工具集与 GUI 触发器机制见 §5.2 |
| 代码凭据 | `Read` / `Grep` 仓库源码 | 行号见 §2 各表；仓库零 `.w3x`；`package-lock.json` 无 MPQ 依赖 |
| 补测：游戏版本（2026-11-10） | PowerShell `Get-Item ... .VersionInfo` | `war3.exe` / `game.dll` = **1.26.0.6401**；`worldedit.exe` 无版本资源 |
| 补测：编译工具（2026-11-10） | `find` + `ls` 游戏目录 | 无 `w2l`/`jasshelper`/`pjass`/`grill`/`common.j`/`blizzard.j`；有 `change\SFmpq.dll` 与 9 个版本包 |
| 补测：上游命令（2026-11-10） | GitHub raw 抓 `w3x2lni` 中文帮助/源码、`wurstlang.org/start.html`、MCP `src/*.ts` | `w2l lni/obj/slk/mpq`、`grill build/run/patch`、`jasshelper.exe`、WE Save 编译机制见 [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) |
| **未做** | — | 未装任何新依赖、未启动 WE/forge/MCP Server、未跑端到端改图、未改业务代码、未 commit、未发外部 Issue/PR；补测轮同样**未下载 w2l、未安装 grill/JassHelper、未 clone MCP、未升级本机游戏** |

---

## 9. 红线与边界

- 🔴 **许可**：`w3x2lni`(GPL-3.0) / `HiveWE`(AGPL-3.0) / `YDWE`(GPL-3.0) / `wc3-forge`(GPL-3.0) **只做外部进程调用，源码不进 MIT 仓库**；`war3map` / `wc3maptranslator` / `War3Net` / `node-stormlib` / `warcraft-3-mcp-server` / Noise Library 均为 MIT，可安全评估引入（引入前仍须逐个核对依赖树许可）。`sethmachine/pyw3x` **无许可证标注**，只看思路不取代码。
- 🔴 **版权**：不分发暴雪原版资产（`PROJECT-PLAN.md §八`）；本机 `Maps\` 只做本机索引，不批量镜像/爬取社区站（`map-sources-research.md §3`）；`D:\360MoveData\` 与个人数据只读。
- 🔴 **真实性**：本文所有 🔴 项一律不写成「已实现」；`build` 脚本 `echo` 占位、`demo-campaign.w3x` 虚标等历史问题不因本文出现而自动修复。
- 🔴 **安全**：任何写图默认落 `.edited.w3x` 副本；改前快照；WE 中打开的图必须先关闭；GUI 触发器改动后必须 Save 一次。
- 🔴 **版本（2026-11-10 新增）**：`manifest.json` 必须记录 `targetPatch` 与脚本语言。**本机 1.26 只跑 JASS**；Lua 脚本、文件夹地图、MCP 的 modern `wct/wtg` 都要求 1.31+。**未升级、未替换、未修改本机游戏与 `change\` 版本包**，是否需要 1.31+ 验证机由用户决定。详见 [MAP-COMPILE-PIPELINE.md §5](MAP-COMPILE-PIPELINE.md)。
- 🟠 **未验证**：`WC3FORGE_EXE` 在当前 shell 仍读不到（`HARNESS-IMPLEMENTATION.md` 已记录需新登录）；forge 与 `wc3` MCP 均**未联真机**。

---

## 10. 要你拍板的三件事

1. **P0 先做哪条**：我建议 **「物编 ID/建筑分类字典 + 快照/diff/verify + 1 张真实图的端到端」**，因为四条路线全卡在「没有可写地图层」；字典还顺手治 AI 幻觉四字码。你若更想先看到效果，可改成 **路线 ④ 地图索引**（最容易出可见成果）。
2. **执行层接谁**：是维持「只接 forge」，还是按 §5.4 做 **双执行层 `map_*` 适配**（MIT 的 `wc3` MCP 更贴 WCC 许可证，forge 地形能力更强）？这决定 P1 的接口形状。
3. **WE 的参与程度**：是坚持 **「WE 只做打开/Save/试玩」**（最稳、零自动化幻觉），还是连 YDWE 的插件能力也纳入评估（能力更强但 GPL + 老版本兼容）？

---

## 附：相关文档

- [MAP-COMPILE-PIPELINE.md](MAP-COMPILE-PIPELINE.md) — **编译链专项**：中间可编译文件 → 地图的五条链路、命令证据、MCP 源码档案、1.26 版本约束、IR 目录契约与 P0 验收
- [HARNESS-IMPLEMENTATION.md](HARNESS-IMPLEMENTATION.md) — 已落地的 harness 层、脚本清单、WC3 工具链借鉴
- [ASSETS-GUIDE.md](ASSETS-GUIDE.md) — 本机素材、ID 字典缺口、合规红线
- [FORGE-INTEGRATION.md](FORGE-INTEGRATION.md) — forge 生态与 GPL 边界
- [FEASIBILITY-REVIEW.md](FEASIBILITY-REVIEW.md) — 独立 harness + 二分 PR 方案
- [map-sources-research.md](map-sources-research.md) — 地图来源与「只索引不爬取」策略
- `PROJECT-PLAN.md` §2.2 / 第 115 行 — 原始设计决策「改图外包 wc3-forge」
