# WCC 素材指南（免翻墙 · 实测 2026-11-09）

> 本文只盘点「素材」：AI 生成战役逻辑时需要的**示例、数据表、ID 字典、底图、美术资产与参考实现**。
> 所有可达性均为本机实测（curl / Python urllib），不是推测。许可与合规红线见第 6 节。

---

## 0. 先看清缺口：项目现在到底缺什么

| 素材类别 | 当前真实状态 | 判定 |
|---|---|---|
| 示例战役地图 | `examples/demo-campaign/README.md` 声称有 `demo-campaign.w3x`，**仓库内零 `.w3x`/`.w3m` 文件** | 🔴 README 虚标，端到端无法验证 |
| 章节示例 | 只有 `chapter_01.lua` + `main.lua`（1 章）；`PROJECT-PLAN.md` Phase 5 计划 3 章 | 🟠 few-shot 严重不足 |
| 战役数据表 | `tables-sample.json`：2 个自定义单位 / 1 波刷怪 / 2 句对话 / 1 个任务 | 🔴 太薄，AI 学不到格式 |
| 物编 ID 字典 | 单位/物品/技能四字码、模型路径、图标路径、区域名 → **零** | 🔴 AI 幻觉 `'hfoo'`/`'n001'` 的根因 |
| 测试底图 | 零 | 🔴 无法跑 `require("src.main")` 闭环 |
| 游戏美术资产 | 零（模型/贴图/图标/音效） | ✅ 刻意合规：ADR §八「不分发暴雪资产」 |
| 知识素材 | `wcc-skill/` 3 knowledge + 4 patterns；`vendor/wc3-lua-annotations` 4635 行 | ✅ 全项目最厚的一块，是真正的资产 |
| 参考实现 | 仅 `wcc-lib/` 13 个自研 Lua 模块 | 🟠 无外部生态参照 |

**结论**：缺的不是「好看的模型」，而是**让 AI 写对代码所需的领域数据 + 可跑的示例**。
美术资产按你自己的 ADR 本来就不该进仓库，不应算缺口。

---

## 1. 首推：本机自有素材（零下载 · 零版权风险 · 完全离线）

你机器上现成就有整套素材库，**不需要翻墙、不需要下载任何东西**。

| 路径 | 内容 | 规模 | 建议用途 |
|---|---|---|---|
| `D:\净土\kkkk\魔兽争霸3冰封王座\Maps\` | 地图库 | **559 张 .w3x + 60 张 .w3m + 1 张 .w3n** | demo 底图、测试图、玩法参考 |
| └ `Maps\Download\` | 自定义图：DotA IMBA 3.83、忍者村大战、EchoIsles/LostTemple MU10 等 | 数十张 | 任务 / 刷怪 / 技能逻辑参考 |
| └ `Maps\dz\rpg\` | 平台缓存的 RPG 图（哈希命名） | 数百张 | 大量真实关卡逻辑样本 |
| └ `Maps\Scenario\` | 暴雪官方小游戏 4 张（WarChasers、BlizzardTD、AzureTowerDefense…） | 4 张 | **最干净的 demo 底图来源** |
| └ `Maps\FrozenThrone\Scenario\` | 官方 TFT 小游戏（TD / 赛车 / 糖果战争…） | 9 张 | 同上 |
| `war3.mpq` / `War3x.mpq` | 原版全部模型 MDX、贴图 BLP、图标、音效、音乐、UI、物编 SLK 表 | 431MB / 327MB | 提 ID 表、模型路径、图标路径 |
| `War3xlocal.mpq` / `zhCN.mpq` | 本地化文本与中文单位名 | 43MB / 648KB | 中文名称映射 |
| `Movies\*.mpq` | 8 段官方过场影片 | 15–28MB / 段 | 战役过场参考（勿分发） |
| `D:\360MoveData\Users\Administrator\Documents\Warcraft III` | 个人数据（魔兽存档等） | — | ⚠️ **只读**，勿移动勿删除 |

**提取工具的现实情况**（实测）：
- `World Editor.exe` / `worldedit.exe` 本机就有 → 最稳的方式是 WE 里「导入 / 导出物编数据」，无需第三方工具。
- `Drake53/War3Net`（GitHub 可达）提供 MPQ / SLK / `.w3x` 读写，适合程序化提取。
- `zezula.net`（Ladik's MPQEditor）本次实测 **HTTP 000 不可达**，如确需请走 GitHub 镜像或国内下载站，不要硬连。

---

## 2. 最该补的：领域数据素材（直接解决 AI 幻觉）

WCC 的 AI 最容易出错的地方不是「不会写 Lua」，而是**瞎编魔兽的四字码和路径**：
`CreateUnit(p, 'hfoo', x, y, 0)` 里的 `'hfoo'`、模型 `units\human\Footman\Footman.mdl`、
图标 `ReplaceableTextures\CommandButtons\BTNFootman.blp`、`gg_rct_spawn_point` 这类区域名。

建议落地成两份文件（都不含暴雪资产，只是 ID 与路径文本）：

| 目标文件 | 内容 | 来源 |
|---|---|---|
| `wcc-skill/knowledge/wc3-object-ids.md` | 常用单位/英雄/物品/技能四字码 + 中文名 + 分类 | 本机 MPQ 的 `Units\UnitData.slk` / `UnitUI.slk` / `AbilityData.slk` / `ItemData.slk`；或 War3Net 数据集 |
| `assets/paths.json` | 模型 / 图标 / 音效路径表 | 本机 MPQ 的 `(listfile)` + `UnitUI.slk`；或 Hive 公开 ID 列表 |
| 扩充 `examples/demo-campaign/tables-sample.json` | 至少 3 章：对话链、主线+支线任务、3 波刷怪、1 场 Boss | 参照 `wcc-skill/patterns/task-*.md` 自造 |

已就位的知识素材（别重复造）：
- `vendor/wc3-lua-annotations/`：`blizzard.lua` + `common.lua` + `Platformapi_common.lua`，4635 行，
  已配进 `.vscode/settings.json` 的 `Lua.workspace.library`。
  ⚠️ 它是**全局函数定义版**（`function CreateUnit(...) end`），能补函数名/参数名，**没有 `---@class` 类型标注**。
- `wcc-skill/knowledge/api-best-practices.md`、`conventions.md`、`project-structure.md`。

---

## 3. 开源代码 / 框架素材（GitHub 直连 200，慢时走 gh-proxy.com）

| 仓库 | ★ | 最近更新 | 可拿来补什么 |
|---|---:|---|---|
| `wurstscript/WurstScript` | 251 | 2026-11-07 | 活跃；标准库 + 物编数据 + 编译/构建思路，**最值得参考的数据源** |
| `Drake53/War3Net` | 168 | 2026-10-17 | MPQ / SLK / `.w3x` 读写 → 正好补 WCC「build 不写二进制 w3x」这个最大功能缺口 |
| `actboy168/YDWE` | 551 | 2024-06-16 | 国服增强 WE，大量 JASS/Lua 库与中文资料 |
| `Ceres-WC3/ceres` | 35 | 2020-09-09 | Lua 构建工具（已停更，仅作 build 逻辑参考） |
| `Luashine/wc3-packhelper-library` | 1 | 2025-08-25 | `string.pack` 封装，小工具 |
| `StephenSHorton/wc3-forge` | 14 | 2026-10-28 | 已装 v1.0.7 于 `D:\Programs\wc3-forge` |

获取方式（免翻墙）：
- GitHub 直连实测 HTTP 200；大文件慢时用 `https://gh-proxy.com/https://github.com/...`（实测 200）。
- GitHub API / raw 文件用 `D:\Python\python.exe` + `urllib` 最稳（curl 走代理时 `raw.githubusercontent.com` 返回 000）。
- npm 类依赖走 `https://registry.npmmirror.com`（已配）。

---

## 4. 社区素材站（免翻墙实测结果）

| 站点 / 路径 | 实测 | 内容 | 限制 |
|---|---|---|---|
| `https://www.hiveworkshop.com/` | **200** | 国际最大 WC3 社区 | 分类页受反爬限制（见下） |
| `/repositories/maps.564/` | 403 | 地图库 | Cloudflare，需浏览器带 Cookie 人工访问 |
| `/repositories/models/` | 403 | 模型 MDX | 同上 |
| `/repositories/skins/` | 403 | 皮肤 | 同上 |
| `/repositories/icons.541/` | 403 | 图标 BTN | 同上 |
| `/repositories/spells-and-systems.569/` | 403 | 技能与系统 | 同上（对 WCC 逻辑层最有价值的一类） |
| `/pages/model-checker/` | **200** | 在线模型检查工具 | 可直接用 |
| `https://www.epicwar.com/` | **200** | 老图档案站 | 仅外链，无 API |
| `https://stephenshorton.github.io/wc3-forge/docs/claude-code/` | **200** | forge 接入 Claude Code 官方文档 | 见 `docs/forge-protocol.md` |
| `https://gh-proxy.com/` | **200** | GitHub 加速 | 下载镜像源 |
| `https://mirrors.tuna.tsinghua.edu.cn/` / `registry.npmmirror.com` | **200** | 国内镜像 | 依赖下载 |
| `https://www.zezula.net/`（MPQEditor）/ `www.wc3c.net` | **000** | — | 本次不可达，别硬连 |

> 注：旧路径 `/resources/`、`/models/`、`/forums/`、`/threads/` 均为 404/403，
> 上表的 `/repositories/...` 才是 Hive 当前正确入口。

**合规**：遵循你自己 `docs/map-sources-research.md` §3 的既定策略——
只索引**用户已有文件**与**官方链接**，不爬虫批量下载、不镜像站点内容。
逐个资源务必看作者许可（模型/图标多数要求署名，部分禁止商用）。

---

## 5. 最小行动清单（按性价比排序）

1. **补 `demo-campaign.w3x`** — 从 `Maps\Scenario\` 复制一张干净小图，WE 里启用 Lua、触发器只留 `require("src.main")`，
   或直接借 War3Net 生成空图。同时修掉 README 里「已有 .w3x」的虚标。
2. **扩充 `tables-sample.json` 到 3 章** — 对话 / 任务 / 刷怪 / Boss 各给完整样本，AI 才有格式可依。
3. **提一份物编 ID 表** — `wcc-skill/knowledge/wc3-object-ids.md`，这是 ROI 最高的一项。
4. **补 `build_map` 写二进制 `.w3x`** — 借 War3Net 的 MPQ/地图序列化思路，当前 `docs/DEVELOPMENT-NOTES.md` §88 明确写着「build 不写二进制 w3x」。
5. **3 章 demo + 端到端测试** — 有了底图才能真正跑「生成 → check → 注入 → 进游戏 → 日志回流」。

---

## 6. 合规红线（沿用项目既有约定）

- 不分发暴雪原版资产（`PROJECT-PLAN.md` §八 风险表「版权」行：不分发暴雪资产；MIT 工具链）。
- 不批量镜像 / 爬取素材站内容（`docs/map-sources-research.md` §3）。
- `D:\360MoveData\` 与 `D:\净土\kkkk\` 属个人数据，只读，勿移动勿删除。
- AI 生成的战役若引用第三方模型/图标，须在 README 标注作者与许可。
