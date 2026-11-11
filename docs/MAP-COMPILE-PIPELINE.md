# 从「中间可编译文件」到「可玩地图」：编译链专项调研

> **⚠️ 历史快照（2026-11-11 标注）**：下面这段「以 Gitee 最新提交为基准合并 GitHub 原分叉」是 11-10 当日叙事，**不是现行口径**。现行：本地 / GitHub / Gitee 三处 `main` 是**一个逻辑数据源 + 两个镜像**，不再区分主仓库 / 镜像 / 谁更新；每次推送用 `npm run sync`，只校验用 `npm run sync:check`。见 [AGENTS.md](../AGENTS.md)。
>
> **2026-11-10 仓库状态补记（当日二次校正）**：本文撰写时「未 git commit / 未推送 / origin=gitclone.com」均为当时状态；当天成果已全部提交（`7fe0922`..`ef5a9be`，7 个）并推送到 Gitee **私有**仓库 `wei-kaijie/Wcc-deskTop`（项目为半成品，刻意不公开）。**当日稍后已完成三处同步**：以 Gitee 最新提交为基准合并了 GitHub 原分叉与本地改动，本地 `main`、GitHub `Aurirlk/Wcc-deskTop`、Gitee `wei-kaijie/Wcc-deskTop` 的 `main` 均已对齐（合并提交 `d8ccdfb`）；GitHub **不再**停在 `12b9169`。
> 此后仓库持续开发，**最新 HEAD 一律以 `git log -1` / `git ls-remote` 为准，本文不再跟踪具体 commit**；开发主线与排期见 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md)，换机说明见 [NEW-MACHINE-SETUP.md](NEW-MACHINE-SETUP.md) §1。

> 2026-11-10 · `MAP-GENERATION-PLAN.md` 的续篇，专攻你指出的最难一项：
> **「如何生成中间可以编译的文件，然后用工具编译成地图」**。
> 同时把 **Warcraft 3 MCP Server** 从「README 简介」升级为**源码级档案**。
>
> **证据等级**（沿用前篇，全文严格遵守）：
> - ✅ **本机实测 / 上游仓库源码原文 / 官方命令行帮助**：给出路径、行号或原文
> - 🟠 **官方文档 / 二手资料**：注明来源，不当作已验证事实
> - 🔴 **未实现 / 未验证 / 缺口**：明确写「没有」，不把「计划中」写成「已完成」
>
> **本轮状态（撰写当时）**：只新增 / 更新 Markdown。**未下载 w2l、未安装 grill / JassHelper、未 clone MCP Server、未启动 WE / 游戏 / forge、未跑任何端到端改图、未改业务代码、未装新依赖、未 git commit、未发外部 Issue/PR。**

---

## 0. 结论速览（先看这一节）

| # | 问题 | 判定 |
|---|---|---|
| 1 | 「编译成地图」到底指什么？ | 🔴 **一句话里混了三件不同的事**：① 文本化（二进制 → IR）② 序列化 + MPQ **打包**（IR → `.w3x`）③ **脚本编译**（源码 / GUI 触发器 → `war3map.j` / `.lua`）。**只有 ③ 是真编译，且只有 WE 或外部编译器能做**；② 常被误叫「编译」，其实是组装。混用会直接导致架构设计错。见 §1 |
| 2 | 有现成「中间文件 → 地图」的工具吗？ | ✅ **有，而且不止一条**：`w3x2lni` 的 `w2l obj`（官方 CLI 原文）、`JassHelper` 命令行、`Wurst + grill build`、WE 1.31+ 的**文件夹地图 + auto-import**、以及 MIT 的 `mdx-m3-viewer` 纯 JS 打包。见 §3 |
| 3 | 哪条最适合 WCC？ | 🟢 **Node 侧 MIT 全家桶**（`mdx-m3-viewer` + `wc3maptranslator`/`war3map`）做容器，`w3x2lni`/`grill` 做**外部进程编译器**（GPL/Apache 隔离）。WCC 自己只产文本 IR 与脚本源码，不碰二进制。见 §6 |
| 4 | 最大的拦路虎是什么？ | 🔴 **不是工具不够，是本机版本**：✅ 实测 `war3.exe` / `game.dll` 为 **1.26.0.6401 经典版**。Lua 地图脚本与「文件夹地图」都是 **1.31+** 才有的能力；MCP Server 的 `wct`/`wtg` 写入也只支持 Reforged/1.31+ 的 modern 格式。**WCC 现有 `war3map.lua` 在这台机器上不能直接跑。** 见 §5 |
| 5 | Warcraft 3 MCP Server 到底算什么？ | ✅ 它是**「文件编辑器 + 打包器」，不是编译器**。它用 `mdx-m3-viewer`(MIT) 读写 MPQ 容器、用 `wc3maptranslator`(MIT) 转物编；真正把触发器编成脚本的是 **WE 的 Save**。见 §4 |
| 6 | 现在能做端到端了吗？ | 🔴 **不能**。仓库零 `.w3x`、零 MPQ 依赖、`build_map` 只产 `war3map.lua`；本机也没有 `w2l.exe` / `jasshelper.exe` / `grill` / `common.j` / `blizzard.j`。§7 给了两阶段 P0 验收，在此之前不写「已支持地图生成」 |

**一句话**：资料其实已经够画出完整链路了，真正没解决的是**「选哪个目标版本」**——它决定脚本是 JASS 还是 Lua、决定要不要编译器、决定 MCP Server 能不能用。这个必须先拍板，否则后面全部返工。

---

## 1. 术语澄清：别再叫它「编译成地图」

### 1.1 三个动作、三种产物、三种责任方

| 动作 | 输入 → 输出 | 是否「编译」 | 谁做 | 出错后果 |
|---|---|---|---|---|
| **① 文本化 / 反序列化** | `.w3x`(MPQ) → `.wcc/ir/*.json` 文本 | ❌ 解析 | Python(mpyq 读) / `war3map` / `wc3maptranslator` / `w2l lni` | 解析不全 → 写回丢文件 |
| **② 序列化 + MPQ 打包** | IR / 文件夹 → `war3map.w3e` 等二进制 → `.w3x` | ❌ **组装**（最常被误称编译） | StormLib / `mdx-m3-viewer` / `w2l obj` / WE Save | 少 `wpm`/`shd` → 地形不可走、黑图 |
| **③ 脚本编译** | `*.wurst` / vJASS / `wtg`+`wct` → `war3map.j` 或 `war3map.lua` | ✅ **真编译** | **WE Save** / `jasshelper.exe` / `grill build` / YDWE 保存钩子 | 脚本没编进图 → 地图能打开但逻辑不跑 |

> 🔴 **WCC 目前① ② ③ 全缺**：`package-lock.json` 无 MPQ 依赖、`build-map.js:130-131,164` 只写 `dist/build/war3map.lua`、全仓零 `.w3x`（`MAP-GENERATION-PLAN.md §1/§2.5` 已逐项判空）。
> 🟠 `build_map` 产出的 `war3map.lua` **本身是「源码」不是「地图」**——它必须经 ② 塞进 MPQ、且经 ③ 被游戏识别，才有意义。

### 1.2 `.w3x` 内部文件里，哪些能直接当「文本中间文件」写

| 内部文件 | 格式 | 能直接文本编辑吗 | 写入方 |
|---|---|---|---|
| `war3map.j` / `war3map.lua` | **纯文本** | ✅ 可以 | 脚本编译器 / WE Save / `wc3_write_script` |
| `war3map.wts` / `war3map.imp` / `*.txt` / `*.slk` | 文本 | ✅ 可以 | 外部工具 |
| `war3map.w3e` / `war3map.wpm` / `war3map.shd` | 二进制 | ❌ 需序列化器 | `war3map` / `w3e` 解析器 |
| `war3mapUnits.doo` / `war3map.doo` / `.w3r` / `.w3c` / `.w3i` | 二进制 | ❌ 需序列化器 | `wc3maptranslator` / `mdx-m3-viewer` |
| `war3map.w3u/w3t/w3a/w3h/w3b/w3d/w3q` | 二进制（物编修改表） | ❌ 需序列化器 | `wc3maptranslator ObjectsTranslator` |
| **`war3map.wtg`** | 二进制（**GUI 触发器树**） | ❌ 需专用解析器 | WE / MCP `wtg.ts`（仅 modern） |
| **`war3map.wct`** | 二进制（**自定义脚本文本体**） | ❌ 需专用解析器 | WE / MCP `wct.ts`（仅 modern） |

> ✅ 关键机制（MCP Server `src/durable.ts` 顶部注释原文）：
> **"the World Editor recompiles `war3map.j` from the trigger tree (`war3map.wtg`) + custom-text bodies (`war3map.wct`) on every save"**.
> 所以**单独改 `war3map.j` 会在用户第一次按 Ctrl+S 时被覆盖**——这是 WCC 若走「直接塞脚本」路线必定踩的坑。

---

## 2. `.w3x` 的两个「中间形态」：文件夹 vs MPQ

| 形态 | 谁支持 | 证据 | 对 AI 的意义 |
|---|---|---|---|
| **Lni 文本文件夹** | `w3x2lni`（GPL-3.0） | ✅ `docs/zh-cn/README.md` 原文：「`Lni` 是一种对版本管理工具友好的格式，它看起来是一个文件夹。大多数的二进制文件会被转换为文本格式」 | **最理想的 IR 载体**：可 git diff、可让 AI 改文本 |
| **地图文件夹（官方）** | **WE 1.31+ / Reforged** | 🟠 Patch 1.31.0 更新说明：「Maps can be saved and loaded as folders (as well as MPQs)」「Loose files in a map are now auto-imported」「The map structure can now be updated outside of the editor」 | 外部工具直接改文件夹、WE 自动导入 → **理论上最省事的官方闭环**；🔴 本机 1.26 没有 |
| **`dir` 完全解压文件夹** | `w3x2lni` | ✅ `docs/zh-cn/insider.md`：「W3x2Lni 支持读取三种储存形式：`w3x`、`dir`、`lni`」 | `dir` 保留二进制原文件；`lni` 才是文本化 |
| **`.w3x` MPQ** | 全版本 | ✅ 本机 559 张 `.w3x` 实测 | 最终交付物 |

**⚠️ `w3x2lni` 的 Lni 目录结构（✅ 由源码反推，不是猜）**：
`script/map-builder/archive_dir.lua` 的 `flush()` 明确保留四类路径 —— `/table/`、`/trigger/`、`/w3x2lni/`、`/map/war3map.*`；
`template/Melee/` 下有 `ability.ini` / `buff.ini` / `destructable.ini` / `doodad.ini` / `item.ini` / `misc.ini` / `txt.ini` / `unit.ini` / `upgrade.ini` 共 9 张物编元数据表；
`share/config.ini` 的 `[lni] export_lua = true` 说明 **Lni 模式会导出地图内的 Lua 文件**。
另外 `archive_dir.lua` 把内部文件名里的 `/ : * ? " < > | $` 与控制字符转义成 `$XX`，并忽略 `.git` / `.svn` / `.vscode` / `.gitignore` —— 这就是「文本文件夹能被 git 管」的实现细节。

> 🟠 **别把 Lni 当万能**：`w3x2lni` README 的 TODO 里明确还留着「**地形文件**」「转换 doo, w3s, w3r 等文件」。也就是说 Lni 的文本化主要覆盖**物编/触发器数据**，地形 `w3e` 与 `doo` 仍需二进制序列化器。**这是「中间可编译文件」方案的真实边界。**

---

## 3. 五条真实存在的「中间文件 → 地图」链路（逐条给证据）

### 3.1 ✅ 官方 WE Save（唯一的 GUI 触发器编译入口）

| 项 | 内容 |
|---|---|
| 输入 | `war3map.wtg`（GUI 触发器树）+ `war3map.wct`（自定义文本 / Custom Script Code） |
| 输出 | `war3map.j`（1.26 及以前）/ `war3map.j` 或 `war3map.lua`（1.31+ 由 Map Options 的 Script Language 决定） |
| 触发 | 在 WE 里 **Save 一次**；Test Map (Ctrl+F9) 前必须 Save |
| 证据 | ✅ MCP `src/durable.ts` / `src/wct.ts` / `src/wtg.ts` 三处源码注释一致；✅ `src/wtg.ts`：「Verified byte-for-byte against World Editor 2.0 output」；🟠 Patch 1.31.0 更新说明「Added Lua as a supported scripting language… Select Lua from the Script Language dropdown」 |
| 适用 | 全版本；**本机 1.26 一定走 JASS** |

🔴 **对 WCC 的含义**：AI 写出的剧情若只落 `war3map.lua/j`，**必须在 WE 里 Save 一次才「进图」**，而且下一次 Save 会把单独写的脚本冲掉。解法只有两条：写进 `wct`（durable）或走外部编译器接管脚本生成（§3.3 / §3.4）。

### 3.2 ✅ `w3x2lni` 的 `w2l` CLI —— 最接近「生成中间文件再编译成地图」的现成工具

**上游**：`sumneko/w3x2lni`（✅ GitHub API 实测 **173★ / GPL-3.0 / 2025-12-18**；release `2.7.3` 含 `w3x2lni-2.7.3.zip` 9,048,496 B，**本轮未下载**）。

**官方中文帮助原文**（✅ `script/locale/zhCN/raw.lng` 抓取）：

```
用法: w2l lni <地图路径> [<输出路径>]
    地图可以是一个w3x文件也可以是一个文件夹。
    Lni是一个方便文本编辑与代码管理的地图格式。

用法: w2l obj <地图路径> [<输出路径>]
    地图可以是一个w3x文件也可以是一个文件夹。
    Obj是用于地图编辑器编辑的格式。

用法: w2l slk <地图路径> [<输出路径>]
    Slk是用于魔兽争霸游戏的格式，编辑器无法打开该格式的地图。

用法: w2l mpq <War3路径>          # 提取游戏数据文件（common.j / blizzard.j / SLK 元数据）
用法: w2l config [配置[=值]]       # 例如 w2l config lni.read_slk=false
```

**完整闭环（这才是最难那一项的直接答案）**：

```
MyMap.w3x
  → w2l lni MyMap.w3x MyMap_lni/     # ① 拆成文本文件夹（可 git diff，AI 只改这里）
  → [AI / Python 编辑 .ini / 文本]    # ② 中间可编译文件
  → w2l obj MyMap_lni/ MyMap_obj.w3x # ③ 重新打包成 WE 可打开的 .w3x
  → WE 打开 + Save 一次               # ④ 编译触发器
  → Test Map                          # ⑤ 试玩
  → w2l slk ... MyMap_release.w3x    # ⑥ 发布优化（可选，有损）
```

**实现凭据（✅ 全部来自上游源码原文）**：

| 文件 | 事实 |
|---|---|
| `script/backend/init.lua` | `local act = command[1]` → 动态 `require('backend.cli.'..act)`，所以子命令就是 `lni/obj/slk/mpq/config/...` |
| `script/backend/command.lua` | `arg[1]`=子命令，`arg[2..]` 为位置参数，`-k=v` 为开关 |
| `script/backend/unpack_setting.lua` | `command[2]` = input，`command[3]` = output；输入可为 `.w3x` 或文件夹（`.w3x` 标记文件会被识别为 Lni 目录） |
| `script/backend/convert.lua` | `target_storage == 'dir'` → 输出文件夹；`== 'mpq'` → 输出 `.w3x`；输入/输出都抽象成 `builder.load(path[, 'w'])` |
| `script/map-builder/archive_mpq.lua` | `require 'ffi.stormlib'`；先写 `HM3W` 512 字节地图头，再 `stormlib.create(path, filecount+3, encrypt)` 创建 MPQ |
| `script/map-builder/archive_dir.lua` | 文件夹形态：文件名 `$XX` 转义、忽略 `.git`，`flush()` 保留 table/trigger/w3x2lni/map 四类 |
| `script/map-builder/save_map.lua` | `output_ar:save(w3i, w3f, w2l, args)` 统一落盘 |
| `docs/zh-cn/insider.md` | **第四种隐藏格式 `Full`**：`Map → Full → Obj/Lni/Slk`；`Core Frontend` / `Core Backend`；Obj 用 WE 的 Metadata，Slk/Lni 用 War3 的 Metadata |
| `docs/zh-cn/README.md` | 「`Obj` 和 `Lni` 之间可以**无损转换**」；`Slk` 默认有损但可关优化；Slk 含物编转 SLK、去未引用对象、内联 wts、mdx 压缩、**移除脚本注释 / 压缩变量名** |
| `config.ini` | `[global] data = zhCN-1.24.4`；`[lni] export_lua = true`；`[slk] optimize_jass = true`；`data/` 下另有 `enUS-1.27.1` / `zhCN-1.32.8` |

🟠 **`w2l mpq <War3路径>` 是隐藏彩蛋**：它能从游戏 MPQ 提取 `common.j` / `Blizzard.j` / 各 `xxxMetaData.slk` / `UnitEditorData.txt`（`cli/mpq.lua` 源码列出全部文件）——**这正好是 `ASSETS-GUIDE.md` 判定的「物编 ID 字典为零」的现成数据来源**，也顺手解决 `JassHelper` 需要的 `common.j / blizzard.j`。本轮**未运行**，标为待验。（2026-11-11：字典骨架已建于 `wcc-skill/knowledge/wc3-object-ids.md`，但覆盖率 0；逐条核实流程见该文 §6。）

🔴 **许可红线**：GPL-3.0，**只能当外部进程调用**（`spawnSync` + 明确路径），源码绝不复制进 MIT 的 WCC（`FEASIBILITY-REVIEW.md` / `MAP-GENERATION-PLAN.md §9` 已定）。
🔴 **版本红线**：`config.ini` 默认 `zhCN-1.24.4`，本机是 **1.26**；数据目录另有 `enUS-1.27.1`。**转换前必须确认数据版本匹配**，否则物编字段会被转义或忽略（`insider.md` 明写此风险）。

### 3.3 🟠 `JassHelper` / vJASS / YDWE —— 老版本 1.26 的脚本编译路径

**命令行**（🟠 `JassHelper-manual/usage.html` 原文）：

```
jasshelper.exe common.j blizzard.j map.w3x          # 3 参数：处理地图内脚本并更新地图
jasshelper.exe common.j blizzard.j map.w3x war3map.j # 4 参数：忽略图内脚本，改用外部 vJass 源
jasshelper.exe --scriptonly <common.j> <blizzard.j> <input.j> <output.j>  # 纯脚本编译
clijasshelper.exe ...                                # 无 GUI 版，输出到 stdout
```

依赖 `sfmpq.dll`（写 MPQ）+ `pjass`（语法检查）。`--debug` / `--nooptimize` / `--nopreprocessor` / `//! import` / `//! novjass` 均可用。

**YDWE 的保存即编译链**（🟠 DeepWiki `actboy168/YDWE` → "Map Saving and Compilation"，引用了具体源码文件）：

```
EVENT_NEW_SAVE_MAP (ydwe_on_save.lua:70-117)
  → saveW3x / saveW3m（自动备份到 YDWE/backups）
  → init.lua:47-97 编译管线
      ① inject_code.lua   注入辅助代码
      ② wave.lua          C 风格预处理（#include / #define / #if）
      ③ 模板处理
      ④ jasshelper.lua   vJASS → 标准 JASS
      ⑤ slk.lua / w3x2lni 物编优化
  → 写回地图
```

> ✅ **本机实测**：`D:\净土\kkkk\魔兽争霸3冰封王座\change\SFmpq.dll` **184,320 B（2003-04-10）存在**；`change/` 下另有 `版本1.20e.zip` 至 `版本1.27b.zip` 共 9 个版本切换包。
> 🔴 **但本机没有** `jasshelper.exe` / `clijasshelper.exe` / `pjass.exe` / `common.j` / `blizzard.j` / `w2l.exe` / `grill.exe` / `ydwe.exe`（全目录 `find` 实测为空）。`jass_plugin/alpha/` 下只有一个空的 `2025-09-09/` 目录。
> 🟠 YDWE 是 GPL-3.0 / 551★ / 2024-06-16，兼容 1.20 与 1.24；本机 1.26 **未验证兼容**。YDWE 内置 Lua 引擎主要用于**保存期物编生成（`require 'slk'`）与调试**；Hive 上关于 1.26 兼容模式的说明明确写着不能用 Reforged Lua 作为主脚本语言（二手，未实测）。

### 3.4 ✅ `WurstScript` + `grill` —— 最完整的「源码 → 地图」工程链（Apache-2.0）

**上游**：`wurstscript/WurstScript`（✅ GitHub API 实测 **252★ / Apache-2.0 / 2026-11-07**，仓库内有 `AGENTS.md`、`CLAUDE.md`、`docs/MAP_COMMIT_REPLAY.md` 等；编译器是 Java 27 + Gradle）。

**官方命令**（✅ `wurstlang.org/start.html`，2026-03-02 更新；经 `wurstscript.github.io/start.html` 跳转）：

```
grill generate my-wurst-project     # 新建项目（向导选目标补丁 + Jass/Lua 输出）
grill install                       # 安装依赖 / 标准库
grill build                         # 只构建，不启动游戏
grill run [MyMap.w3x]               # 构建并启动 WC3（根目录只有一张 .w3x 时可省略参数）
grill typecheck / grill test        # 类型检查 / 单测
grill patch / grill patch align     # 对齐本机 WC3 补丁（更新 wurst.build 的 wc3Patch）
--wc3-path "/path/to/Warcraft III"  # 指定游戏目录
```

**项目结构 / `wurst.build`**（✅ 官方 Beginner Guide + 🟠 社区 skill 文档补充）：

```
my-project/
  wurst.build          # projectName / dependencies / buildMapData / wc3Patch / 输出语言
  wurst.dependencies   # 生成物
  wurst/*.wurst        # 源码（package + init；@compiletime 可在编译期生成物编对象）
  imports/             # 保存时自动导入地图，保留相对路径
  ExampleMap.w3x       # 底图：只放地形/装饰物，Wurst 只读不改
  _build/              # 编译产物（含编译后的地图）
  wurst_run.args       # -runmapaliases / -preloadFiles
```

**为什么它对本项目特别重要**：
- ✅ 官方明写 **"Older MPQ-era classic patches use Jass output and layered MPQ game data"**、**"Classic CASC-era patches such as 1.30/1.31 use Jass output"**、**"Reforged projects can use Lua or Jass output"**。也就是说 **1.26 这类老客户端有官方支持的 Jass 输出路径**，不必强求 Lua。
- ✅ `imports/` 自动导入 = 官方版「中间文件夹」；`_build/` 输出编译图 = 官方版「编译成地图」。
- ✅ `@compiletime` + `ObjectIdGenerator` 能在编译期生成物编并防四字码撞车（`HARNESS-IMPLEMENTATION.md §5.2` 已记，本轮从 Beginner Guide 再确认）。
- 🟠 但 WCC 已有资产全是 **Lua (`wcc-lib` + `war3map.lua`)**，接 Wurst 等于**换语言重写**，成本最高；且 Apache-2.0 虽比 GPL 宽松，仍是外部工具链，不宜塞进 Node 主进程。

### 3.5 ✅ Node 侧 MIT 全家桶 —— WCC 最贴合的「打包层」

| 库 | 许可 / 活跃度（✅ GitHub API 实测） | 角色 |
|---|---|---|
| `flowtsohg/mdx-m3-viewer` | **MIT** / 179★ / 2025-08-27 | **MPQ/W3X 容器**：load / list / get / set / `save()` / `archive.save()` |
| `ChiefOfGxBxL/WC3MapTranslator` (`wc3maptranslator`) | **MIT** / 123★ / 2026-07-12 | 物编 7 类 + w3e/doo/w3r/w3c/w3i/imp/wts ⇄ JSON；**不支持 wpm/shd** |
| `invoker-bot/war3map` (`war3map`) | **MIT** / 21★ / 2026-04-28 | 覆盖更全（含 **wpm / shd / wtg / wct**）、`readArchive/writeArchive` |
| `Drake53/War3Net` | **MIT** / 168★ / 2026-10-17 | C#：MPQ / SLK / `.w3x`，可提 ID 表 |
| `ladislav-zezula/StormLib` | **MIT** / 665★ / 2026-10-12 | C/C++ MPQ 读写，w3x2lni 的 `ffi.stormlib` 就是它的封装 |

> ✅ **这条链纠正了前篇的一处保守判断**：`MAP-GENERATION-PLAN.md §4.4` 写「MPQ 写回需实测预编译二进制，node-stormlib 仍是 alpha」。现在有源码证据表明 **纯 JS 的 `mdx-m3-viewer` 已完成容器级 read + repack**（Warcraft 3 MCP Server 生产代码在用），不必先啃原生 StormLib。
> 🔴 但**仍属「源码级证据，本机未实测」**：没有在本机 `npm install`、没有拿真实 `.w3x` 跑过 round-trip，不许写成「已打通」。

---

## 4. Warcraft 3 MCP Server：源码级档案（补全前篇 §5）

### 4.1 它到底是什么

✅ `YElwiddi/warcraft-3-mcp-server` v**1.1.0**，**MIT** / 12★ / TypeScript / 最后 push 2026-08-14 / Node ≥ 18。
`package.json` 依赖只有四个：`@modelcontextprotocol/sdk`、`mdx-m3-viewer@^5.12.0`、`wc3maptranslator@^5.0.0`、`zod@^4.4.3` —— **没有 StormLib、没有原生二进制、没有 WE 依赖**。

**准确定位**：一个 **「`.w3x` 文件编辑器 + MPQ 重打包器」**，不是编译器。它把地图内部文件读成 JSON 给模型看，改完再整体 repack 成 `MyMap.edited.w3x`。README 原话：「Warcraft's World Editor has no plugin/automation system, so this edits the map *file* directly.」

### 4.2 打包实现（✅ `src/map.ts` 源码）

```
openMap()  →  new War3MapCtor() 读 Uint8Array，暂存原 512B HM3W 头
  ↳ 容器：mdx-m3-viewer/dist/cjs/parsers/w3x/map.js
  ↳ 摆件：unitsdoo/file.js + doo/file.js（含 buildVersion 探测：load→save 逐字节比对 [200,1]）
  ↳ 物编：wc3maptranslator 的 ObjectsTranslator（w3u/w3t/w3a/w3h/w3b/w3d/w3q）
writeRawFile() → map.set(内部文件名, ArrayBuffer)
saveMap()  →  ① map.save()
              ② 若 w3i 解析抛错 → 降级 archive.save() + 原样贴回 512B 头
              ③ writeFile(outPath)
```

`index.ts` 的 `wc3_write_script`（替换 `war3map.j` / `war3map.lua`）、`wc3_replace_file`（塞任意内部文件）都走 `saveMap(map, "<map>.edited.w3x")`。`map.ts:480` 的错误串是 `No script file (war3map.j / war3map.lua) found in archive`，说明**两种脚本文本都能写**。

### 4.3 三个值得 WCC 直接抄的设计

| 设计 | 源码 | 对 WCC 的用处 |
|---|---|---|
| **byte-for-byte 安全闸门** | `src/wtg.ts` 顶部：`mutateWtg() refuses to write unless parse→serialize reproduces the original file byte-for-byte first`；`map.ts` 的 `detectDooBuildVersion()` 也用 load→save 逐字节比对来猜 buildVersion | 直接就是 `wcc.map.verify` 的实现范本：**不能无损重建就拒绝写** |
| **durable 双写** | `src/durable.ts` / `src/wct.ts`：脚本同时写进 `war3map.wct`（WE 可见、Save 后不丢）+ 用 sentinel 注释幂等镜像进 `war3map.j/lua`（立即生效）；`wtg` 保持逐字节不动 | 解决 §1.2 那个「单独改 war3map.j 会被 WE 覆盖」的坑 |
| **触发器格式版本分层** | `src/wtg.ts`：**modern**（magic `WTG!` + `0x8000000x`，Reforged / 1.31+）可 parse **且 serialize**；**classic**（v4/v7，1.31 之前）**只 parse 不 serialize**。`src/wct.ts`：`MODERN_WCT = 0x80000004`，其它版本直接抛 `Unsupported ... format` | 🔴 **对本机 1.26 是致命限制**，见 §5.2 |

### 4.4 它与 WE 的桥（✅ `src/editor.ts`）

```
openInEditor(mapPath, exePath?) → spawn(exe, ['-loadfile', mapPath], {detached:true})
testMap(mapPath, exePath?)      → spawn(exe, ['-launch','-window','-loadfile', mapPath])
```

🟠 内置候选路径全是 **Reforged 默认安装位置**（`C:/Program Files (x86)/Warcraft III/_retail_/x86_64/...`），**本机路径完全不匹配**；要用必须显式传 `exePath`（`D:\净土\kkkk\魔兽争霸3冰封王座\...`）。`testMap` 还提示：老版本可能要求地图位于 `Documents\Warcraft III\Maps` 才能直开。

### 4.5 工具到 WCC `map_*` 适配层的映射（🔴 设计稿，未实现）

| WCC 抽象 | MCP `wc3_*` | forge | 备注 |
|---|---|---|---|
| `map_open` | `wc3_overview` / `wc3_list_files` | `map_open` | 都要先关 WE 中打开的图 |
| `map_read_ir` | `wc3_read_objects` / `read_placements` / `read_terrain` / `read_triggers` | `map_extract_to_folder` | 两侧字段要归一 |
| `map_apply_diff` | `wc3_place_unit` / `write_objects` / `replace_file` | `units_*` / `terrain_*` | IR diff 是共同输入 |
| `map_set_script` | `wc3_write_script` / **`wc3_set_durable_script`** | `triggers_convert_to_lua` | 优先 durable 双写 |
| `map_save_as` | 默认 `.edited.w3x` | `map_save_as` | 一律写副本 |
| `map_verify` | wtg/doo 的 round-trip 闸门 | — | 抄 §4.3 |
| `map_open_editor` / `map_test` | `wc3_open_in_editor` / `wc3_test_map` | — | 必须传 exePath |

---

## 5. 🔴 本机版本硬约束（本轮最重要的新发现）

### 5.1 实测数据（✅ PowerShell `VersionInfo`）

| 项 | 实测 |
|---|---|
| `war3.exe` | **FileVersion 1.26.0.6401**，ProductVersion `Version 1.26.0` |
| `game.dll` | **1.26.0.6401** |
| `worldedit.exe` | 5,103,592 B，无版本资源 |
| 编译器 | 🔴 无 `jasshelper.exe` / `w2l.exe` / `grill` / `pjass` / `common.j` / `blizzard.j` |
| 现成零件 | ✅ `change\SFmpq.dll` 184,320 B；`change\版本1.20e.zip` … `版本1.27b.zip`（9 个）；`jass_plugin\alpha\2025-09-09\` 空目录 |
| 地图库 | 559 `.w3x` / 60 `.w3m` / 1 `.w3n`（前篇实测） |

### 5.2 由版本推出的四条硬结论

| # | 结论 | 证据 |
|---|---|---|
| 1 | 🔴 **Lua 地图脚本在本机 1.26 上不能作为主脚本运行**。Lua 支持是 **Patch 1.31.0（2019-05-28）** 才加入 WE（Scenario → Map Options → Script Language） | 🟠 Wowpedia / wc3modding 的 1.31.0 patch notes；🟠 Hive "Map Adapter" 帖明确「lua maps cannot be adapted for patches below 1.31」 |
| 2 | 🔴 **官方「文件夹地图 + auto-import」在本机不存在**（同为 1.31+ 能力） | 🟠 同上 patch notes |
| 3 | 🔴 **MCP Server 的 `wc3_set_durable_script` / `wc3_add_gui_trigger` 在 1.26 图上大概率不可用**：`wct.ts` 只接受 `0x80000004`，`wtg.ts` 的 classic v4/v7 只能读不能写 | ✅ MCP 源码（§4.3） |
| 4 | 🔴 **WCC 现有 `war3map.lua` + 全套 `wcc-lib` 与本机试玩链路不兼容**。这不是 bug，是「项目假设 1.31+、机器是 1.26」的目标版本错配 | ✅ `README.md:3` 自述 **「Lua 1.31+」**、`README.md:54` 要求「地图启用 Lua」；✅ 本机版本实测 1.26；✅ `build-map.js` 只产 `war3map.lua`、`wcc-lib` 全 Lua |

> 🟠 YDWE 在 1.20/1.24 上提供内置 Lua 引擎，但那是**保存期物编生成与调试**（`require 'slk'`、Lua-Debug 示例图），不是把 `war3map.lua` 当游戏主脚本；1.26 兼容模式的社区说明也写明「only Jass」。**二手资料，未实测，不作为可用依据。**

### 5.3 目标版本三选一（**2026-11-11 已拍板：B+A 双轨**）

| 方案 | 做法 | 代价 | 适配 MCP Server？ |
|---|---|---|---|
| **A. 守住 1.26**（最保守） | AI 产 **JASS**（或 Wurst→Jass / vJass→JASS），走 `jasshelper` / `grill build` / `w2l obj`；WCC 的 Lua 库需转译或只作离线逻辑 | 🔴 `wcc-lib` 全 Lua 要重写/转译；要装编译器 + 提取 `common.j`/`blizzard.j` | 🔴 不可用（modern 格式） |
| **B. 另装 1.27a/1.31+ 客户端**（推荐做验证机） | 本机 `change\` 已有 1.27a/1.27b 包；或直接装 1.31+ 测试端，**不动现有 1.26 游戏与存档** | 🟠 需要下载/安装、占空间；1.27 仍无 Lua，需真 1.31+ | ✅ 1.31+ 可用 |
| **C. 只做离线生成，试玩外包** | WCC 只产 `.edited.w3x` + 编译脚本包，明确声明「需 1.31+ 客户端试玩」 | 🟠 本机无法闭环验收，P0 端到端做不了 | 🟠 生成可用、验证受限 |

> **✅ 决策已定（2026-11-11）**：用户拍板 **B+A 双轨** —— 1.31+ / Lua 为开发主线，本机 1.26 只读保留、不升级不替换；1.31+ 验证环境由用户自备；`manifest.json` 记录 `targetPatch` 与 `language`；P2 阶段 B 走 E3 Lua 注入。下面三选一表与「我倾向」段落是**撰写当时的决策讨论（快照）**。
>
> 我倾向 **B + A 并行**：用一台 1.31+ 客户端打通端到端闭环，同时把「JASS 输出」作为可选项保留，避免把整个项目绑死在单一补丁上。这也和 Wurst 官方「patch-aware」的设计一致。**这一步需要你决定，我不替你装游戏、不升级现有 1.26。**

---

## 6. 面向 WCC 的推荐管线：把 IR 落成「可编译中间文件」

### 6.1 目录契约（**唯一权威**；🔴 尚未实现）

> 本节是 `.wcc/ir/` 目录契约的**唯一权威**；`MAP-GENERATION-PLAN.md` 与 `HARNESS-IMPLEMENTATION.md` 只保留指向本节的指针，不再各自定义目录树。

```
.wcc/ir/<map-id>/
  manifest.json          # schema 版本、源图 sha256、targetPatch="1.31+"、language="lua"、
                         #   每个内部文件「由哪个序列化器产出 + 输出 hash」
  terrain.json           # w3e tilepoint / 高度 / 水 / 悬崖
  doodads.json           # war3map.doo
  units.json             # war3mapUnits.doo（含建筑/人物/物品分类，依赖 wc3-object-ids.md）
  regions.json / cameras.json
  quests.json / dialogues.json / triggers.json   # 剧情层
  objects/*.ini          # 物编修改表（对齐 w3x2lni 的 table/ 9 张 ini）
  script/
    war3map.j            # 【可选支线】仅显式切 E2 时启用，本轮不施工
    war3map.lua          # 【主线】1.31+ / Lua，AI 写这里
    fragments/*.lua      # WCC 现有 wcc-lib 片段（按目标语言选择是否转译）
  patches/               # IR 级 diff（可审批、可回滚）
  build/                 # 【生成物，不进 git】
    war3map.w3e / war3mapUnits.doo / war3map.wpm / war3map.shd / ...
    war3map.wct / war3map.wtg          # 仅 modern 格式、且通过 round-trip 闸门才写
    <map>.edited.w3x
```

**三条硬约定**：
1. **AI 只写 `*.json` / `*.ini` / `script/*` 文本**，永不直接生成二进制，也永不直接生成坐标矩阵（沿用 `MAP-GENERATION-PLAN.md §3.0`）。
2. **`manifest.json` 必须记录 `targetPatch` 与 `language`**——§5 的教训，版本错配比代码 bug 更致命。
3. **`build/` 全量可重建**：任何一步失败都从 IR 重来，不手工修二进制。

> **落地状态（2026-11-11，P2 / G1）**：三条约定已有可执行的文本层实现，位于 `harness/src/scripts.js`，注册在 `SCRIPT_MANIFEST`（`wcc.map.snapshot` / `diff` / `verify`，纯 `node:fs` + `node:crypto`，零 npm 依赖）：
> - `wcc.map.snapshot` 改图前只读备份，写 `.wcc/ir/<map-id>/manifest.json`（`schema: wcc-ir/1`、`targetPatch: "1.31+"`、`language: "lua"`、每个 IR 文件的 `producer` + `sha256`、`serializersVerified: false`），并断言原图 sha256 前后一致；
> - `wcc.map.diff` 输出标准 unified diff 到 `patches/`，单测用 `git -c core.autocrlf=false apply -R` 证明可逐字节回滚；
> - `wcc.map.verify` 是**写 `.edited.w3x` 之前的闸门**：无外部序列化器时返回 `{ok:false, reason:'external-tool-missing', blocking:true}`，不一致返回 `round-trip-mismatch` 并阻断；`build/` 已显式加入 `.gitignore`。
>
> **🔴 边界**：以上只证明 sha256 / unified diff / 字节比较逻辑正确，用的是合成文本与字节块；**没有**跑过真实 `.w3x` 的 parse→serialize，**没有**证明 WE 能打开地图，也**不等于已打通编译链**。阶段 A / B 仍按主计划「条件触发」处理，环境就绪检查表全过之前不得写成已完成。

### 6.2 三条可切换的编译出口

| 出口 | 输入 | 编译器 / 打包器 | 产物 | 适用 |
|---|---|---|---|---|
| **E1 数据改写（无脚本编译）** | `terrain/units/doodads/objects` | `war3map` / `wc3maptranslator` → `mdx-m3-viewer.saveMap` | `.edited.w3x` | 拼图流 / 借鉴流 / 素材库微调；**P0 阶段 A** |
| **E2 JASS 编译（1.26）** | `script/war3map.j` 或 `*.wurst` / vJASS | `jasshelper.exe` 或 `grill build` → 得到 `war3map.j` → E1 打包 | `.edited.w3x` + WE Save | **本机 1.26 唯一可跑闭环** |
| **E3 Lua 注入（1.31+）** | `script/war3map.lua` + `war3map.wct` | MCP `wc3_set_durable_script` 双写 / `w2l obj` | `.edited.w3x` + WE Save | 项目现有 Lua 资产零改动 |

**统一收尾（三条出口共用）**：
`wcc.map.snapshot` → 关闭 WE 中该图 → `wcc.map.verify`（parse→serialize 逐字节比对，失败拒写）→ 写 `.edited.w3x` → WE 打开 + **Save 一次** → Test Map → 日志/截图回流 → `lua_check` + IR diff。

### 6.3 脚本注入的三种落点与「被覆盖」风险（最容易翻车的一格）

| 落点 | 立即生效 | WE 重存后 | 风险 |
|---|---|---|---|
| 只写 `war3map.j` / `.lua` | ✅ | 🔴 **被覆盖** | `durable.ts` 明确点名；WCC 现有 `build_map` 正是只产脚本包，**不能算「进图」** |
| 写 `war3map.wct`（Custom Script Code / custom-text trigger）+ 镜像脚本 | ✅ | ✅ 保留 | ✅ MCP 的 durable 方案；🔴 但 `wct.ts` 仅支持 modern `0x80000004` → 1.26 不适用 |
| 写 `war3map.wtg`（GUI 触发器树） | ❌ 需 Save 编译 | ✅ | ✅ WE 原生；🔴 classic v4/v7 无序列化器，1.26 上外部工具写不了 |

> **给 WCC 的直接建议**：`wcc.map.set_script` 接口必须显式带 `targetPatch` 与 `strategy` 参数，`strategy = script-only | durable | gui`，并在 `script-only` 时**明确警告「WE 重存会丢失」**，绝不静默假装成功。

> **落地状态（2026-11-11，见主计划附录 A.7）**：该**参数契约**已在 `harness/src/scripts.js` 实现——
> 缺 `targetPatch` / `strategy` 直接拒绝；`targetPatch` 只接受 `1.31+`（1.26 只读保留）；
> `script-only` 返回 `script-only-not-durable` + 上述警告且**不写图**；
> `durable` / `gui` 必须先过 `wcc.map.verify` 逐字节闸门、再显式注入 adapter，否则 fail-closed。
> 🔴 **只交付契约 + 假 adapter 单测**：真实 MCP / `w2l obj` adapter 未接入，本层从未写过 `.w3x`，
> 阶段 B2/B3/B4 仍未验证。这**不等于**「已支持脚本进图」。

---

## 7. P0 最小验证（在通过前，不许写「已支持地图生成」）

### 阶段 A：先只证明「读 → 改 → 打包 → 能打开」，不碰脚本

| 步 | 动作 | 验收标准 |
|---|---|---|
| A1 | 从本机 `Maps\` 选 **1 张官方 `Scenario` 小图**（先确认非加密/非保护） | 能列出内部文件清单 |
| A2 | `mdx-m3-viewer` 或 `w2l lni` 读出 `war3mapUnits.doo` | JSON 里有单位坐标；round-trip 逐字节一致 |
| A3 | 只把 **1 个单位平移 128**，写 `xxx.edited.w3x` | 原图 hash 不变；副本可生成 |
| A4 | **WE 打开 → Save 一次 → Test Map** | 不报错、单位在新位置、地形/树林/触发器未丢 |

> A 阶段刻意**不写任何脚本**，因为一旦混入 JASS/Lua 版本问题就无法定位失败原因。

### 阶段 B：再证明「脚本源码 → 编译 → 进图 → 跑起来」

| 步 | 动作 | 验收标准 |
|---|---|---|
| B1 | 按 §5.3 选定目标补丁（决定 JASS 还是 Lua） | `manifest.json` 里 `targetPatch` / `language` 有值 |
| B2 | 写一段最小脚本（如开局显示一行文字），经 E2 或 E3 编译/注入 | 产出 `.edited.w3x`，内部脚本文件存在且内容可核对 |
| B3 | WE Save 一次后**重新读回**，确认脚本未被覆盖 | 这是 `durable` 与否的分水岭 |
| B4 | Test Map 看到输出 | 截图 / 日志回流，`lua_check` 或 JASS 语法检查通过 |

🔴 **两阶段都没做**。本轮没有安装任何编译器、没有下载 `w3x2lni-2.7.3.zip`、没有 clone MCP Server、没有启动 WE/游戏。

---

## 8. 诚实清单：还缺哪些资料 / 哪些没验

| # | 缺口 | 状态 | 下一步 |
|---|---|---|---|
| 1 | `w2l.exe` 在本机实跑（尤其是 **1.26 地图 + `zhCN-1.24.4` 数据**是否兼容） | 🔴 未下载未运行 | 下载 release 2.7.3，用 1 张小图跑 `w2l lni` → `w2l obj` → 比对 |
| 2 | `grill` / Wurst 在 1.26 目标下 `grill build` 的真实产物与是否真能启动老客户端 | 🔴 未安装 | 独立临时目录试，不污染 WCC |
| 3 | `jasshelper.exe` + `common.j` + `blizzard.j` + `pjass` 的获取与本机实跑 | 🔴 本机全无 | 可用 `w2l mpq <War3路径>` 提取脚本；或从 YDWE 取 |
| 4 | `mdx-m3-viewer` 在 Node 里对**本机真实 1.26 图**做 read→repack 逐字节验证 | 🔴 源码级可行，未实测 | A2 阶段顺带做 |
| 5 | 1.26 的 `war3map.wtg` classic v4/v7 序列化器 | 🔴 MCP 明确「parse only」；未找到可写实现 | 若坚持 1.26 + GUI 触发器，需要自建或放弃该能力 |
| 6 | `wpm` / `shd` 与 `w3e` 改动的同步规则 | 🔴 无验证 | A 阶段验证地形不可走问题 |
| 7 | YDWE 对 1.26 的实际兼容性与「Lua 能否作主脚本」 | 🟠 二手且互相矛盾 | 不据此下结论 |
| 8 | 559 张图里有多少是加密/受保护图 | 🔴 未扫描 | 索引时优雅降级 |
| 9 | `WC3FORGE_EXE` 在当前 shell 仍读不到 | 🟠 前篇已记 | 需新登录 / 重启资源管理器；本轮未启动 forge |
| 10 | 目标补丁（1.26 / 1.31+ / 双轨） | ✅ **已拍板：B+A 双轨** | 1.31+ / Lua 主线，本机 1.26 只读保留；1.31+ 环境由用户自备，阶段 B 按条件触发 |

---

## 9. 证据索引

| 结论 | 来源 | 等级 |
|---|---|---|
| `w2l` 命令格式、Lni/Obj/Slk 语义、Full 中间态 | `sumneko/w3x2lni` → `script/locale/zhCN/raw.lng`、`docs/zh-cn/{README,insider,quickstart}.md` | ✅ 上游原文 |
| `w2l` 输入/输出参数、StormLib 打包、目录转义 | 同仓库 `script/backend/{command,unpack_setting,convert,init}.lua`、`script/map-builder/{archive_mpq,archive_dir,save_map}.lua` | ✅ 源码 |
| `config.ini` 数据版本与优化开关 | 同仓库 `config.ini` + `script/share/config.ini` + `data/` 目录 | ✅ 源码 |
| w3x2lni 2.7.3 / GPL-3.0 / 173★ | GitHub REST `/repos/sumneko/w3x2lni` + `/releases` | ✅ API 实测 |
| `grill generate/build/run/typecheck/test/patch`、patch-aware、项目结构 | `wurstlang.org/start.html`、`wurstlang.org/wurstbeginner`（经 `wurstscript.github.io` 跳转） | ✅ 官方 |
| `wurst.build` 字段、`_build/`、imports、Apache-2.0 / 252★ | 🟠 社区 skill 文档（字段表）+ ✅ GitHub API（许可/活跃度） | 🟠/✅ |
| `jasshelper.exe` 命令、YDWE 保存编译链 | 🟠 `warraft.github.io/JassHelper-manual/usage.html`、DeepWiki `actboy168/YDWE` "Map Saving and Compilation" | 🟠 二手 |
| WE Save 从 wtg+wct 重编译脚本、durable 双写、round-trip 闸门、格式版本 | `YElwiddi/warcraft-3-mcp-server` → `src/{map,durable,wct,wtg,editor,index}.ts` | ✅ 源码 |
| MCP 依赖与许可证 | 同仓库 `package.json` + GitHub API | ✅ |
| `mdx-m3-viewer` MIT / 179★、`StormLib` MIT / 665★、`War3Net` MIT / 168★ | GitHub REST `/repos/...` | ✅ API 实测 |
| Lua 脚本 / 文件夹地图 / auto-import 来自 1.31.0 | 🟠 Wowpedia、wc3modding、Hive 的 Patch 1.31.0 notes 与 Map Adapter 帖 | 🟠 二手 |
| 本机 1.26.0.6401、编译器缺失、SFmpq.dll 与版本包 | PowerShell `VersionInfo` + `find` + `ls` | ✅ 本机实测 |
| 仓库零 `.w3x`、`build_map` 只产 `war3map.lua`、20 个本地工具 | `MAP-GENERATION-PLAN.md §1/§2` 的 Read/Grep 结果 | ✅ |

---

## 10. 红线与边界（沿用并补强）

- 🔴 **许可**：`w3x2lni`(GPL-3.0) / `YDWE`(GPL-3.0) / `HiveWE`(AGPL-3.0) / `wc3-forge`(GPL-3.0) **只做外部进程调用**；`WurstScript`(Apache-2.0) 工具链同理保持进程隔离；`mdx-m3-viewer` / `wc3maptranslator` / `war3map` / `War3Net` / `StormLib` / MCP Server / Noise Library 为 MIT，可评估引入（仍须逐个核对依赖树）。
- 🔴 **版权**：不分发暴雪资产；`common.j` / `blizzard.j` / SLK 只在本机提取与使用；本机 `Maps\` 只做本机索引。
- 🔴 **不动用户环境**：**未升级、未替换、未修改本机 1.26 游戏与 `change\` 版本包**；`jass_plugin/` 与 `360MoveData` 只读。
- 🔴 **真实性**：本文所有 🔴 项不写成「已实现」；§7 两阶段 P0 未跑通前，仓库内任何「已支持地图生成 / 已打通编译链」的说法都不成立。
- 🔴 **安全**：写图一律 `.edited.w3x` 副本、改前快照、WE 中打开的图先关闭、GUI 触发器改动后必须 Save 一次。
- 🟠 **未验证**：所有外部工具本轮均**只查文档与源码，未安装、未运行、未联调**。

---

## 11. 决策记录（撰写当时的候选方案；目标补丁已定案）

> **⚠️ 历史快照（2026-11-11）**：本节第 1 项（目标补丁）已拍板为 B+A 双轨；第 2 项（编译器选型）与第 3 项（MCP Server 接入）在 1.31+ 验证环境就绪前不投入。现行排期见 [NEXT-DEVELOPMENT-PLAN.md](NEXT-DEVELOPMENT-PLAN.md)。
>
1. **目标补丁选哪个？** 这是本轮新增的**第 0 号决策（已拍板：双轨）**：**守 1.26 走 JASS**（保机器、要重写 Lua 资产）／**另装 1.31+ 验证机走 Lua**（保资产、要装客户端）／**双轨**（`manifest.json` 带 `targetPatch`，最稳但工作量最大）。我倾向双轨，先装 1.31+ 打通闭环。
2. **编译器用谁？** `w2l obj`（GPL，最接近「文件夹→地图」）／`grill build`（Apache，工程化最完整但要换语言）／`jasshelper`（老版本最贴，依赖最杂）／**只用 MIT 的 `mdx-m3-viewer` 自己打包**（最贴 WCC，但没有脚本编译能力）。我倾向：**打包走 MIT 自研，脚本编译先接 `w2l`/`grill` 外部进程**。
3. **Warcraft 3 MCP Server 还要不要接？** 许可上最合适，但本机 1.26 上它的两个招牌能力（durable 脚本 / GUI 触发器）都因格式版本不可用。建议**先不投入适配，等目标补丁定了再说**；或只复用它的 `map.ts` / `wtg.ts` 思路（MIT，可抄），不整包引入。

---

## 附：相关文档

- [MAP-GENERATION-PLAN.md](MAP-GENERATION-PLAN.md) — 四条路线、代码凭据、Python+Lua+WE、MCP Server 简介、优先级
- [HARNESS-IMPLEMENTATION.md](HARNESS-IMPLEMENTATION.md) — 已落地的 harness 层、`SCRIPT_MANIFEST`、WC3 工具链借鉴
- [ASSETS-GUIDE.md](ASSETS-GUIDE.md) — 本机素材与物编 ID 字典缺口
- [FORGE-INTEGRATION.md](FORGE-INTEGRATION.md) / [FEASIBILITY-REVIEW.md](FEASIBILITY-REVIEW.md) — forge 生态与 GPL 边界
