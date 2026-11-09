# WCC 2.0 产品计划（对标 AI_novelsTool_obsdian 桌面形态）

> 参考：`D:\Program Files\AI_novelsTool_obsdian`（PyQt6 网文写作桌面，多 Agent + 记忆 + MCP + 工作台）  
> 本仓库对照物：`PROJECT-PLAN.md` v1.1 MVP（Electron + Sidecar + forge 转发 + 流式）  
> 日期：2026-09-15
>
> ⚠️ 状态校正（2026-11-09）：下表「导出：`wcc build`：库+业务打进 w3x」**尚未实现** ——
> 现有 `build_map`（`packages/wcc-sidecar/src/build-map.js`）只产出 `dist/build/war3map.lua` + `src-tree/`，
> 不写二进制 `.w3x`；仓库内也没有 `.w3x` 与 MPQ 依赖。
> 该功能的实现路线、四条替代方案与代码凭据见 [docs/MAP-GENERATION-PLAN.md](docs/MAP-GENERATION-PLAN.md) §2.6。

---

## 0. 从参考项目学到的「产品成熟度阶梯」

| 参考项目能力 | 对 WCC 2.0 的映射 |
|--------------|-------------------|
| 首次启动向导 | 配置 WC3 路径 / 模型 / Forge，降低冷启动 |
| 概览页（功能入口） | 战役首页：新建项目、打开 demo、健康状态 |
| AI 助手（@文件 / 技能 / 专家） | 会话：@ 章节、/ 技能、专家角色（编剧/Boss/任务） |
| 写作工作台（文件树+编辑器） | 战役工作台：章节树 + Lua 预览/编辑 + WE 前置清单 |
| 12 智能体 | 渐进：单 Agent + 专家系统提示 → 子 Agent 工具 |
| 7 模块记忆 | 战役圣经：单位表、区域表、章节进度、铁律缓存 |
| MCP + Skills | 已有 forge MCP；技能市场目录化 |
| 时间线/大纲库/批评师 | 对话时间轴、任务状态图、lua_check 审查页 |
| 导出 | `wcc build`：库+业务打进 w3x |
| 设置：9 家 LLM | 设置页多提供商 + 本地密钥 |

**技术栈决策（不跟风 PyQt）**：继续 **Electron + TS Sidecar**（与 WorkBuddy 同构、与已有 MVP 连续）。Python 小说工具的价值在**产品分层**，不在语言本身。

---

## 1. 2.0 目标（可验收）

1. **冷启动 10 分钟**：向导配好模型 → 打开 demo → AI 生成第一章并 `lua_check` 通过。  
2. **工作台可编辑战役**：章节树、对话表校验、任务状态、刷怪波次（纯数据，不跑引擎）。  
3. **Forge 可用**：检测会话 → 连接 → 审批后 `units_create` / `map_save` 等。  
4. **设置可多提供商**：DeepSeek / OpenAI 兼容 / 自定义 base_url，密钥本机存储。  
5. **记忆可见**：项目圣经（四字码、区域、章节 checklist）可查可改。

非 2.0：完整 3D 地图、Wurst/TS 编译、云同步、插件商店审核。

---

## 2. 信息架构（UI 2.0）

```text
┌ Side nav ──────────────────────────────────────┐
│ 首页 │ 会话 │ 工作台 │ 检查 │ 构建 │ 扩展 │ 设置 │
└────────────────────────────────────────────────┘
        │
        ├ 首页：向导状态卡 / 最近项目 / 三步引导
        ├ 会话：流式、工具卡、审批、@文件、/技能、专家下拉
        ├ 工作台：章节树 | Lua 代码 | 对话时间轴 | 任务图 | 刷怪表 | 圣经
        ├ 检查：run lua_check、规则说明、issue 列表
        ├ 构建：wcc build、WE 路径、日志回流（2.1 可先占位）
        ├ 扩展：forge 会话、技能包、MCP 状态
        └ 设置：模型、路径、审批策略、关于
```

视觉：沿用 **convention mode** 深色工具风（与 v1 一致），签名元素 = 左侧 Azurite 竖条 + 会话工具卡片。

---

## 3. 架构（2.0 增量）

```text
Renderer (pages)
    │ IPC
Main (Electron)
    │ HTTP
Sidecar
    ├── Agent Loop（已有流式）
    ├── Tools（已有 + build_map 占位）
    ├── Forge MCP（已有）
    ├── ModelConfig  ← NEW 本地 JSON + 读 env
    ├── ProjectBible ← NEW .wcc/bible.json
    └── WorkbenchAPI ← NEW 章节树 / 对话 schema 校验
```

数据：项目内 `.wcc/`（bible.json、checklist、history）；密钥 `%APPDATA%/wcc-desktop/secrets.json`（2.1 可选，先 env）。

---

## 4. 分期

### 2.0-M1 导航与设置（1 周）

- [ ] 7 页导航壳（可先静态，再逐页活）  
- [ ] 设置页：Base URL / Key / Model / 审批策略 → Sidecar `/config`  
- [ ] 首页：三步「配模型 → 开 demo → 生成第一章」  
- [ ] 状态栏统一：model / forge / check 红绿灯  

### 2.0-M2 工作台（1–2 周）★核心

- [ ] 章节树扫描 `src/map/*.lua`  
- [ ] 对话时间轴：读 `Dialogue.Play({...})` 近似解析 / 或 JSON 侧车文件  
- [ ] 任务列表：`wcc-quest` 配置块解析  
- [ ] 圣经编辑：单位四字码、区域名、章节 checklist  
- [ ] Sidecar `workbench_*` 工具，供 AI 同步读写  

### 2.0-M3 会话增强（1 周）

- [ ] `@` 提及文件插入上下文  
- [ ] `/` 技能（读 wcc-skill 目录）  
- [ ] 专家模式：系统提示切换（战役编剧 / Boss 设计 / 防泄漏审查）  
- [ ] 工具卡片折叠与输出下载  

### 2.0-M4 构建与扩展（1–2 周）

- [ ] `build_map`：复制模板图 + 注入 `war3map.lua`（Node/Python 二选一）  
- [ ] Forge 工具搜索框（152 tools 过滤）  
- [ ] electron-builder Windows 安装包  
- [ ] 首次运行 onboarding 向导（可全屏模态）  

### 2.0-M5 质量（并行）

- [ ] Sidecar E2E：mock model 流式 + 工具  
- [ ] 章节 schema 测试  
- [ ] README 截图与安装说明（对标 novels 项目）  

---

## 5. 专家角色（对标 12 Agent 的最小集）

| 专家 | 系统提示侧重 | 默认工具 |
|------|--------------|----------|
| 战役编剧 | 对话、任务链、章节节奏 | dialogue/quest/write_file |
| Boss 设计 | 阶段机、技能循环、泄漏 | boss-fight + check |
| 任务刷怪 | 波次、区域、攻击移动 | spawner |
| 防泄漏审查 | 只读审查，不改写 | lua_check、read_file |

2.0 先做 **提示切换**；2.1 再考虑并行子 Agent。

---

## 6. 战役圣经（记忆）JSON 草案

```json
{
  "title": "demo-campaign",
  "wc3Version": "1.31+",
  "units": [{ "id": "hfoo", "name": "步兵", "note": "第一章" }],
  "regions": [{ "name": "gg_rct_spawn_point", "x": 1000, "y": 2000 }],
  "chapters": [
    { "file": "src/map/chapter_01.lua", "status": "draft", "quests": ["rescue_villagers"] }
  ],
  "rules": ["no-wait", "safe-handle"]
}
```

---

## 7. 与参考项目的差异（明确不抄的部分）

- 领域不是小说而是 **WC3 地图/战役**；记忆不是钩子而是 **物编/区域/章节**。  
- 不引入 LangGraph/ChromaDB（2.0 不需要向量库；技能与圣经用文件即可）。  
- UI 用 Web 技术栈，不迁移 PyQt。  

---

## 8. 立即执行顺序（本周）

1. 设置 + `/config` 持久化  
2. 首页三步引导  
3. 工作台章节树 + 圣经  
4. 专家下拉 + 技能列表  
5. 安装包与文档截图  

完成后 WCC 具备与 novels 工具同级的「可日常使用桌面产品」骨架，而不仅是 Harness 演示。
