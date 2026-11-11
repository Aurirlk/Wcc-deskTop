---
id: knowledge-wc3-object-ids
mode: conditional
fileMatch: "**/*.lua,**/*.json"
keywords: 物编,四字码,rawcode,CreateUnit,RegisterUnit,单位ID,单位,物品,技能
priority: 70
---
# WC3 物编 ID（rawcode）字典 · 骨架与未核实清单

> **状态：2026-11-11 · 覆盖率 0 · 🔴 字典不完整，不可用于生成代码。**
> **资源约束（同日用户确认）**：本机魔兽资产至少 3 天后才可能具备，当前网络/资源不支持下载；
> 期间保持覆盖率 0，禁止联网取数、禁止凭记忆或示例填 ID。以用户确认资源就绪为准。
> 本文刻意**不提供任何"可直接抄用的官方 ID 表"**：本机 MPQ / SLK 未提取成功，仓库内也没有可核实的来源。宁可留空表，绝不编造 ID 凑数。

## 1. 为什么必须先有这份文档

`docs/ASSETS-GUIDE.md` 判「物编 ID 字典 = 零」是 AI 幻觉四字码的根因：

- `wcc-lib/wcc-objects.lua:23-26` 的 `RegisterUnit(rawcode, fields)` 只是 `registry.units[rawcode] = fields`，**不创建物编条目、不校验 rawcode 是否存在**；
- `wcc-lib/wcc-core.lua` 的 `SafeCreateUnit` 同样不校验；
- 于是模型写 `CreateUnit(p, 'xxxx', x, y, 0)` 时，任何"看起来像四字码"的字符串都会被当作成功，直到进游戏才失败。

## 2. 两类四字码必须分开

| 类别 | 含义 | 存在条件 | 核实方式 |
|---|---|---|---|
| **官方原版 rawcode** | 暴雪 `war3.mpq` / `War3x.mpq` 物编表里的单位 / 英雄 / 物品 / 技能 | 取决于游戏补丁版本 | 从 `Units\UnitData.slk` / `UnitUI.slk` / `AbilityData.slk` / `ItemData.slk` 提取 |
| **自定义 rawcode** | 某张具体地图在 `war3map.w3u` / `w3a` / `w3t` / `w3d` 里新增的条目 | **只在那张地图里存在** | 读该地图自己的物编文件 |

`'n001'` 这类编号是典型的**自定义 ID 写法**：没有配套物编条目时它根本不存在，不能当作官方 ID 使用。同理，'h001' 也不因为"看起来合理"就存在。

## 3. 本仓库出现的四字码（全部 🔴 未核实）

| 值 | 出现位置 | 判定 |
|---|---|---|
| `'hfoo'` | `wcc-lib/wcc-core.lua:66`（参数注释示例）、`wcc-lib/wcc-spawner.lua` 的产物、`docs/ASSETS-GUIDE.md:52` 的引用 | 只作"参数形如四字码"的示意，**未核实** |
| `'ugho'` | `wcc-lib/wcc-spawner.lua:117` | 未核实 |
| `'h001'` | `wcc-lib/wcc-objects.lua:20`（注释示例） | 自定义 ID 写法示例，未核实 |
| `'n001'` / `'n002'` | `examples/demo-campaign/tables-sample.json`（`units`）、codegen / table-import 单测夹具 | 自定义 ID 示例，未核实 |
| `'Nbal'` | `examples/demo-campaign/README.md` 中以「绝不臆造」的否定式提及（旧版扩展建议里曾是硬编码示例） | 未核实，已改为 `bossId: null` 留空 |

> **不要从这些示例里抄 ID 写进战役代码。** 测试夹具里的值只用来断言字符串透传，不代表 ID 有效。

## 4. 一个必须点破的陷阱：vendor 里的 857 个四字码不是物编 ID

`vendor/wc3-lua-annotations/{common,blizzard,Platformapi_common}.lua` 里有 **857 个**形如 `'abpx'`、`'amsp'`、`'DTep'` 的四字码（2026-11-11 实测 `grep -oE "'[A-Za-z0-9]{4}'"` 去重计数）。但它们是

```lua
ABILITY_IF_MISSILE_SPEED = ConvertAbilityIntegerField('amsp')
```

这类 **JASS 字段 / 类型常量**（`common.j` / `blizzard.j` 的 Lua 注解），用于 `BlzSetAbilityIntegerField` 等 API 选择字段，**不是** `CreateUnit` / `RegisterUnit` 的 rawcode。把它们当单位 ID 会生成完全错误的代码。**提取字典时不要从这里取数。**

## 5. 来源与覆盖率

| 数据来源 | 状态 | 说明 |
|---|---|---|
| 本机 MPQ / SLK | 🔴 未取到 | `docs/ASSETS-GUIDE.md:32` 记录的游戏目录在本机不存在（2026-11-11 实测） |
| `w2l mpq <War3路径>` | 🔴 未运行 | `docs/MAP-COMPILE-PIPELINE.md:149` 是上游源码级证据，本机未实测 |
| Hive 公开 ID 列表 / `Drake53/War3Net` | 🔴 当前不可得 | 需联网取回后逐条登记来源；2026-11-11 用户明确本机网络/资源不支持下载，至少 3 天后才可能具备，**期间禁止尝试取数** |
| 仓库内 `vendor/` 注解 | ❌ 不适用 | 见上节 |

**覆盖率：官方单位 0 / 官方英雄 0 / 官方技能 0 / 官方物品 0。🔴 表未建成。**

## 6. 核实流程（不依赖 1.31+ 客户端，可先做）

1. 拿到 `war3.mpq` / `War3x.mpq` 或 1.31+ 客户端 → 用 `w2l mpq` 等**外部进程调用**提取 SLK（GPL/AGPL 工具源码绝不进本仓库；暴雪资产不分发，SLK 只本机使用）。
2. 从 `UnitData.slk` 的 ID 列生成 `rawcode → 名称 / 分类 / 来源文件 / 补丁版本` 表，写入本文 §7。
3. 每条 ID 必须带**来源文件与行列**；没有来源的条目一律不写。
4. 自定义 ID 必须附带所在地图与 `war3map.w3u` 条目，否则标「未定义」。
5. 在 🔴 清零之前，AI 生成 `CreateUnit` / `RegisterUnit` 时应先向用户确认 rawcode，**不得自行猜测**。

## 7. 已核实条目（当前为空）

| rawcode | 类型 | 名称 | 来源文件 | 目标补丁 |
|---|---|---|---|---|
| （无） | — | — | — | — |

## 8. 与文本 IR 的关系

`.wcc/ir/<map-id>/units.json` 里每个单位必须带 `rawcode` 与 `source`；`objects/*.ini` 里的自定义条目要能与物编文件对账。IR 目录契约的唯一权威是 `docs/MAP-COMPILE-PIPELINE.md`，本文件只负责 ID 事实表。
