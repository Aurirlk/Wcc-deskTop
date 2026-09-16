# WCC 完整项目计划（Warcraft Campaign Craft）

> 版本：**v1.2 · 对齐 3.0 调研**  
> 外部审计：`WCC-深度调研与优化方案-3.0.md`（Qwen workspace，2026-09-15）  
> 选型约束：前端/UI 用 **TypeScript**；侧车/业务可用 **Python / Rust**；游戏脚本 **Lua**

## 现实偏差表（先读这个）

| 计划口径 | 当前真实 |
|----------|----------|
| React+Vite+Zustand | 原生 JS 渲染层（更轻，可跑） |
| Rust wcc-lua-check | Node 正则启发式（已加强规则，非 AST） |
| 可交付 .w3x | 仅 war3map.lua 脚本包；MPQ 未接 |
| forge 152 tools 可用 | **协议未对真机验证**，最大风险 |
| 会话 JSONL resume | 内存 history.slice(-20) |
| 密钥 OS keychain | `.wcc/config.json`（已 gitignore） |
| busted Lua 测试 | 无；JS 侧 22 测试 |
| utilityProcess.fork | spawn(PATH node) + 健康重启 |

**3.0 主线**：接通 · 验证 · 补测 · 对齐（见调研 §8）。  
M0 止血项（preload/.gitignore/codegen/dialogue/gc/quest/autoApprove/监护）**已完成**。

---

## 〇、v1.1 架构变更（相对 v1.0）

| 维度 | v1.0（旧） | **v1.1（现行）** |
|------|------------|------------------|
| 产品形态 | Web Studio 为主 + CLI | **桌面 App（WorkBuddy 式 Harness）为主** |
| UI 宿主 | 浏览器 | **Electron 桌面壳**（main / preload / renderer） |
| 运行时 | 浏览器 + 远端 API 思维 | **本地 Sidecar 会话运行时**（常驻、可恢复） |
| 改图 | 自研后端为主 | **主挂 wc3-forge MCP**；自研仅逻辑层 + 最小构建 |
| Studio | 独立 Web 产品 | **并入桌面壳内的战役工作台面板** |
| API 服务 | FastAPI 常驻中心 | 降为可选；默认全本地 |

**一句话**：WCC = **魔兽领域的桌面 AI 工作台**（类比 WorkBuddy），不是又一个纯 Web SaaS。

---

## 一、项目是什么

### 1.1 一句话定位

**WCC 是《魔兽争霸3》（v1.31+ / Reforged）桌面端 AI 战役编辑 Harness**：以 WorkBuddy 同级的「桌面 Agent 操作系统」模型，承载对话/任务/地图编排、安全 Lua 运行时、Skill 与 MCP 工具，让中文用户用自然语言完成可玩战役，而不是在 World Editor 里堆 GUI 触发器。

### 1.2 产品主张

> **魔兽圈的 WorkBuddy / 国产桌面 AI 编辑器**  
> 模型负责聪明；Harness 负责会话、记忆、权限、工具与可交付的 `.w3x`。  
> 地图数据层优先对接 **wc3-forge MCP**；逻辑与战役模式由 **WCC Skill + Lua + 静态检查** 把关。

### 1.3 当前仓库结构（审查结论）

| 路径 | 作用 | 状态 |
|------|------|------|
| `wcc-lib/` | 核心运行时库：core / dialogue / quest / spawner | 已有可用实现 |
| `wcc-skill/` | AI 技能包：规范、API、项目结构、Boss/对话模式 | 文档较完整 |
| `examples/demo-campaign/` | 示例战役 | 可跑通对话+任务 |
| `wcc-core.lua`（根） | 旧版 core | 应与 lib 合并后删除 |
| `.novel-workflow/` | 小说工作流模板 | **与主线无关**，迁 `attic/` |
| `PROJECT-PLAN.md` / `docs/` | 计划与 WorkBuddy 调研 | v1.1 已对齐桌面 |

### 1.4 已有能力 vs 缺口

**已有**：安全沙箱、对话、任务、刷怪池、AI Skill 铁律。

**缺口（对齐桌面后的优先补齐）**
1. **无桌面壳**：无 Electron/主进程/IPC/Sidecar  
2. **无 Agent Loop**：无会话、工具分发、记忆、权限 Hooks  
3. **无领域 MCP/工具桥**：不能稳定驱动 wc3-forge / 自研 check / build  
4. **运行时缺模块**：timer / gc / math / logger / boss-fight  
5. **无测试与分发**：busted / 桌面打包（NSIS / dmg）/ CI  

---

## 二、目标产品形态：WorkBuddy 式桌面 Harness

### 2.1 六层架构（WCC 版）

```text
┌─────────────────────────────────────────────────────────────┐
│ L1 桌面 UI（Electron Renderer + TS）                          │
│   会话 · 任务 · 战役工作台 · 项目 · 设置 · 审批面板             │
└──────────────────────────┬──────────────────────────────────┘
                           │ contextBridge / IPC（窄桥）
┌──────────────────────────▼──────────────────────────────────┐
│ L2 主进程（Electron Main）                                    │
│   窗口 · 登录/模型配置 · 配置持久化 · 生命周期 · 自动更新钩子    │
└──────────────────────────┬──────────────────────────────────┘
                           │ localhost RPC / 子进程
┌──────────────────────────▼──────────────────────────────────┐
│ Sidecar 会话运行时（Node 或 Python）                           │
│   Session 可恢复 · Agent Loop · JSONL 转写 · 模型路由          │
└───────┬─────────────┬─────────────┬─────────────────────────┘
        │             │             │
   工具注册表      记忆系统      安全治理
   Skill/MCP      工作区/项目    权限/Hooks/审计
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│ L3 世界动作（领域层，★WCC 自研重点）                           │
│  · wcc-mcp / Tool Bridge：逻辑项目、lua_check、build、日志     │
│  · 外部 MCP：wc3-forge（单位/地形/物编/触发器/保存 .w3x）       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              游戏内 wcc-lib（Lua）· .w3x
```

### 2.2 与 WorkBuddy / wc3-forge 的分工

| 能力 | 归属 |
|------|------|
| 通用桌面 Agent 骨架 | **对齐 WorkBuddy**（本地会话、记忆、Skill、权限） |
| 改图、放人、物编、地形、GUI 触发器 | **wc3-forge MCP**（不重复造 152 工具） |
| 战役 Lua、对话/任务/Boss 模式、静态检查、构建注入 | **WCC 自研** |
| 模型 | 用户自备（API / 本地），Harness **零密钥业务逻辑** |

### 2.3 用户旅程（目标态）

1. 安装 **WCC Desktop**（Windows 优先，后续 macOS）  
2. 配置模型（DeepSeek / 兼容 OpenAI / 可选本地）  
3. 「新建战役项目」→ 生成目录骨架 + 可选空图路径  
4. 在对话里说：「第一章：阿尔萨斯开场对话 + 救援任务 + 3 波食尸鬼」  
5. Agent：读 Skill → 写 Lua → `lua_check` → 经 wc3-forge MCP 改图 → 汇报  
6. 侧栏「战役工作台」：对话时间轴 / 任务图 / 刷怪预演（本地模拟）  
7. 「构建并测试」→ 注入 `war3map.lua` → 拉起游戏或提示 WE 路径  
8. 游戏日志回流 → AI 修复 → 再构建  

### 2.4 桌面壳内信息架构（渲染层）

| 区域 | 内容 |
|------|------|
| 左侧导航 | 会话 / 项目 / 工作台 / 记忆 / 插件 Skill / 设置 |
| 主区 | 对话流、工具调用卡、权限确认、差异与构建结果 |
| 侧栏/抽屉 | 当前战役：章节树、物编引用、WE 前置清单 |
| 状态栏 | Sidecar 状态、wc3-forge 是否连接、Lua check 红绿灯 |

---

## 三、深度技术调研摘要（保留结论）

### 3.1 引擎与生态

- WC3 1.31+：**Lua 5.3**；禁 `Wait` / `TriggerSleepAction` / 死亡事件中直接 `RemoveUnit`  
- 暴雪**无官方 WC3 MCP**；地图自动化靠社区改文件（wc3-forge / warcraft-3-mcp-server）  
- **wc3-forge**：Go+TS (Wails) 编辑器，**内嵌 MCP ~152 tools**，GUI 与 Agent 共 Session——**最佳地图数据依赖**  
- YDWE / Wurst / War3Net / wc3-ts：生态与规格参考，不作默认 UI  

### 3.2 WorkBuddy 对齐要点（详见 `docs/workbuddy-research.md`）

- 六层：UI → Main → Sidecar → Agent Loop → Tools/Memory → Safety  
- Prompt **运行时拼装**；Skill **懒加载**；大输出 **外部化**；多模型 **lite/default/craft**  
- Bench 思维：真实工作可评测（后续做「战役任务 bench」）  

### 3.3 `.novel-workflow`

迁至 `attic/novel-workflow`；若做剧情 AI，用 WCC 专用战役剧本 schema，不绑通用小说引擎。

---

## 四、技术选型（v1.1）

### 4.1 总览

| 层 | 选型 | 理由 |
|----|------|------|
| 桌面壳 | **Electron**（主进程 TS） | 与 WorkBuddy 同构；生态成熟、CDP/调试友好；后续可评估 Tauri |
| 渲染 UI | **React 18 + TypeScript + Vite + Zustand** | 与壳同语言；战役工作台组件化 |
| Sidecar 运行时 | **Node/TypeScript**（首选，与壳一体） | Agent Loop、会话、MCP 客户端；避免首期三语言并行爆炸 |
| 可选 Python 侧车 | FastAPI / 纯 Python MCP | 仅当工具链必须 Python 时引入；**非默认** |
| 领域工具 CLI | **Rust**（`wcc-lua-check` / `wcc-map` / `wcc`） | 解析与静态检查性能；独立可测 |
| 游戏脚本 | **Lua 5.3** | 引擎唯一真相源 |
| 改图 | **wc3-forge MCP**（外置进程） | 不重做地图编辑器 |
| 自研 MCP | `wcc-mcp`（Node 或 Rust，stdio） | 逻辑层：项目/src/check/build/日志；也可 **进程内 Tool Bridge** 免 MCP |
| 记忆/转写 | JSONL + 本地 SQLite（可选） | 崩溃可恢复、会话 resume |
| 打包 | electron-builder | Windows NSIS 优先 |

**进程模型（MVP）**

```text
WCC-Desktop.exe
 ├─ Electron Main
 ├─ Renderer (UI)
 ├─ Sidecar（child process：Agent Loop + Tools）
 └─ （可选）wc3-forge.exe  （用户安装，由 Sidecar 通过 MCP 发现）
```

### 4.2 Monorepo 目录规划（v1.1）

```
wcc/
├── apps/
│   └── wcc-desktop/           # Electron 壳（main / preload / renderer）
│       ├── src/main/
│       ├── src/preload/
│       ├── src/renderer/      # React UI：会话·工作台·设置
│       └── electron-builder 配置
├── packages/
│   ├── wcc-lib/               # 纯 Lua 运行时（进地图）
│   ├── wcc-skill/             # AI Skill + patterns
│   ├── wcc-sidecar/           # Agent Loop、会话、工具注册、记忆、权限（Node）
│   ├── wcc-tools-client/      # 调 Rust CLI / 外部 MCP 的客户端
│   └── wcc-shared/            # 类型、协议（Main↔Sidecar↔Renderer）
├── crates/
│   ├── wcc-lua-check/         # 静态检查
│   ├── wcc-map/               # 最小 w3x 读写/打包
│   └── wcc-cli/               # wcc check/build/new
├── examples/
│   └── demo-campaign/
├── docs/
│   ├── workbuddy-research.md
│   ├── wcc-harness-vs-workbuddy.svg
│   └── ...
└── attic/
    └── novel-workflow/        # 自 .novel-workflow 迁出
```

---

## 五、Sidecar / Agent 设计要点（桌面核心）

### 5.1 Agent Loop（对齐 WorkBuddy 模式）

```text
while session alive:
  assemble_context(identity, memory, project, skills, history)
  model_call()  →  tool_calls | text
  if tool:
    permission_gate(tool)
    dispatch(tool)          # 本地 tools + 外部 MCP
    externalize_large_output()
    append JSONL
  if text: renderer streaming
  compact_if_needed()
```

### 5.2 工具注册表（v1）

| 类别 | 示例 | 说明 |
|------|------|------|
| 会话/文件 | `read_file` `write_file` `list_dir` | 项目工作区沙箱路径 |
| 战役 | `src_read` `src_write` `dialogue_validate` `quest_validate` | 逻辑层 |
| 质量 | `lua_check` | 调 Rust；不通过则拒绝「构建」 |
| 构建 | `build_map` `log_pull` | 调 CLI / 读游戏日志 |
| Skill | `skill_list` `skill_load` | 懒加载 SKILL.md |
| 外部 MCP | wc3-forge `units_*` `terrain_*` `objects_*` `map_save` | 按需转发 |
| UI | `request_approval` `open_workbench` | 与渲染层协作 |

### 5.3 权限（L6）

| 级别 | 动作 | 默认 |
|------|------|------|
| allow | 读项目、跑 lua_check | 自动 |
| ask | 写 `src/**`、调 wc3-forge 改图、build | 弹窗确认 |
| deny | 任意路径写入、执行未知脚本 | 默认关；高级开关 |

### 5.4 记忆（L5）

- **工作区**：当前战役目录摘要、最近章节  
- **用户**：默认模型、WE/WC3 路径、偏好铁律  
- **会话**：JSONL 全量转写，支持 resume  
- 不把整图二进制塞进上下文；大输出写 `artifacts/`

### 5.5 模型路由

| 用途 | 档位 |
|------|------|
| 章节创作 / 改图规划 | strong |
| 检查解释 / 摘要 | cheap |
| 工具结果压缩 | cheap |

兼容：OpenAI 风格 base_url + key；预留 DeepSeek。密钥仅存本地 OS keychain / 用户配置。

---

## 六、分阶段实施计划（桌面优先）

### Phase 0 — 仓库卫生与基线（第 1 周）

| 任务 | 产出 |
|------|------|
| 合并 `wcc-core.lua` → `wcc-lib`，删重复 | 单一 core |
| `.novel-workflow` → `attic/novel-workflow` | 语义清晰 |
| 初始化 monorepo：`apps/` + `packages/` + `crates/` | pnpm + cargo 骨架 |
| 补 Lua：timer / gc / math / logger | 蓝图阶段一 |
| busted + mock natives | 测试安全网 |

**验收**：测试绿；demo 仍可在 WE require。

### Phase 1 — 运行时 v1 + Rust 检查（第 2–3 周）

- 完善 `wcc-timer` / `wcc-gc` / `wcc-logger` / `wcc-boss-fight`  
- `crates/wcc-lua-check`：禁 Wait、死亡移除、Location 泄漏、require 存在性  
- `wcc` CLI：`check` / `init`  

**验收**：demo 0 error；坏代码可检出。

### Phase 2 — 桌面壳 MVP（第 3–5 周）★提前

| 任务 | 说明 |
|------|------|
| Electron 应用骨架 | main / preload / renderer 三目录 |
| 窗口与导航 | 会话页、项目页、设置页（先不做完整工作台） |
| Sidecar 拉起 | Main spawn Sidecar；健康检查与重启 |
| 假 Agent Loop | 回显 + 读写项目文件 + 权限对话框 |
| JSONL 会话落盘 | 崩溃可 resume |

**验收**：安装包/开发模式可打开；能建项目文件夹；写文件有确认。

### Phase 3 — Agent Loop + 领域工具 + wc3-forge 桥（第 5–8 周）

| 任务 | 说明 |
|------|------|
| 真实模型接入 | OpenAI 兼容；工具调用 |
| Skill 加载器 | 读 `wcc-skill`；懒加载 |
| Tool Bridge | `lua_check` / `build` / `src_*` |
| MCP 客户端 | 发现并调用 **wc3-forge**；连接失败有 UI 提示 |
| 权限 Hooks | ask 增强；审计日志 |

**验收**：一句话生成 chapter Lua → check →（若 forge 在线）创建单位/区域 → 构建提示。

### Phase 4 — 战役工作台面板（第 7–10 周）

| 模块 | 功能 |
|------|------|
| 章节树 | `src/map/*` 浏览 |
| 对话时间轴 | 编辑/预览 → 导出 Dialogue 表 |
| 任务状态机 | 可视化 + 校验 |
| 刷怪波次 | 本地甘特/点位模拟 |
| check/build 面板 | 红绿灯 + 日志 |
| （后期）MDX 缩略 | 可选 |

**技术**：仍在 Renderer 内，不另开浏览器产品。

### Phase 5 — 示例战役与文档（第 9–11 周）

- 3 章 demo + 桌面「打开示例」向导  
- 安装说明（WC3 路径、WE、wc3-forge 可选）  
- B 站概念视频脚本  

### Phase 6 — 分发与生态（第 11–14 周）

| 渠道 | 内容 |
|------|------|
| GitHub Release | Windows 安装包（NSIS）；说明 macOS 计划 |
| 文档站 | Astro/Docusaurus：Harness、铁律、MCP 配置 |
| Skill 市场雏形 | 本地目录加载社区 Skill |
| 可选 | 将 `wcc-mcp` 以 stdio 发布，供 Claude Code 等复用 |
| Bench | 5–10 条「战役任务」评测集（可后置） |

---

## 七、关键架构决策（ADR · v1.1）

1. **桌面优先，Web 降级为「同 UI 技术栈可复用」**  
   不承诺独立 Web SaaS；未来若做网页版，复用 Renderer 组件与 Sidecar 协议。

2. **Electron + Sidecar，不用「后端中心」**  
   对齐 WorkBuddy：本地进程即产品；减少部署复杂度。

3. **地图数据外包 wc3-forge；逻辑层自研**  
   与 Forge 互补不互斥；Forge 未安装时降级为「仅 Lua 工作流」。

4. **进程内 Tool Bridge 优先，MCP 兼容并行**  
   桌面内部性能与简单性优先；同时提供 stdio MCP 以便外部 Agent 接入。

5. **Lua 是游戏真相源；权限先于自主**  
   所有写图/构建必须过审批或策略。

6. **`.novel-workflow` 出库**；剧作文案走战役 schema。

---

## 八、风险与缓解

| 风险 | 缓解 |
|------|------|
| Electron 体积/更新 | 侧车拆分；自动更新可选；国产镜像分发 |
| Sidecar 崩溃导致会话丢 | JSONL + resume；Main 监护重启 |
| wc3-forge 未装/版本漂移 | 探测与一键文档；工具表 capability 检测 |
| 双语言栈复杂度 | MVP：TS 壳+Sidecar，Rust 仅 check/build；Python 延后 |
| 权限疲劳 | 策略级 allow/ask；高危才弹窗 |
| API 文档不全 | Skill + EmmyLua 桩版本化 |
| 多人 Desync | check 规则 + Skill 铁律 |
| 版权 | 不分发暴雪资产；MIT 工具链 |

---

## 九、里程碑与工作量

| 里程碑 | 周期 | 完成定义 |
|--------|------|----------|
| M0 基线 | 1 周 | 仓库瘦身 + Lua 测试 |
| M1 Runtime+Check | +2 周 | 全 lib + CLI check |
| **M2 Desktop 壳** | +2 周 | 可安装、Sidecar、假 Agent、文件权限 |
| **M3 真 Agent+Forge** | +3 周 | 模型+工具+wc3-forge 桥+构建 |
| M4 工作台 | +2 周 | 对话/任务/刷怪面板 |
| M5 Demo+Docs | +1 周 | 示例与安装文档 |
| M6 发布 | +2 周 | Windows 安装包 |

单人约 **4–5 个月**；2–3 人全职约 **10–14 周**。  
（桌面壳提前至 M2，故总周期略长于「纯 Web Studio」旧估，但更贴近可分发产品。）

---

## 十、立即可执行清单（Do Now）

1. 合并 `wcc-lib`；根目录 `wcc-core.lua` 删除。  
2. `.novel-workflow` → `attic/`。  
3. 创建 `apps/wcc-desktop` Electron 空壳（TS + React + Vite）。  
4. 创建 `packages/wcc-sidecar` 最小 Agent Loop（echo + write_file + approval）。  
5. 落地 `wcc-timer` / `wcc-gc` / `wcc-logger` + busted。  
6. `crates/wcc-lua-check` 三条规则。  
7. 写 `docs/main-sidecar-protocol.md`：Main↔Sidecar↔Renderer 消息类型冻结。  
8. 更新 README：桌面产品定位、架构图、wc3-forge 可选依赖。  

---

## 十一、关联文档

| 文件 | 内容 |
|------|------|
| `docs/workbuddy-research.md` | WorkBuddy 原理与功能 |
| `docs/wcc-harness-vs-workbuddy.svg` | 六层对照 |
| `index.html` | 调研摘要预览页 |
| `wcc-architecture.md` / `wcc-ai-blueprint.md` | 游戏侧架构与 AI 蓝图（仍有效） |

---

## 十二、调研索引

**开源**  
- YDWE · WurstScript · War3Net · wc3-forge · warcraft-3-mcp-server  
- wc3-ts-template · wc3ts · war3_lua · PyWC3 · emmylua-analyzer-rust  

**WorkBuddy 生态**  
- Tencent/workbuddy-bench · WorkBuddyGuide · zhijian Harness 蓝皮书 · learn-workbuddy · WorkDaddy  

**小说（已隔离）**  
- NovelForge · novelforge-agent  

**B 站**  
- BV1zJ411X7YK · BV13cgB6pEuf · BV1ce75zMErf · BV1rq4y1E7UN  

---

*v1.1：桌面 Harness 为唯一主形态。确认后从 Phase 0 + Electron 空壳并行开工。*
