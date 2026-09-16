# Warcraft Campaign Craft (WCC)

## 🌟 项目愿景 (Vision)

WCC 是一个基于 LLM（大型语言模型）和 Lua 的《魔兽争霸3》战役级开发脚手架。它通过提供**安全封装库**、**标准化模式**和**AI专家提示词**，让开发者能使用自然语言与AI结对编程，快速构建复杂的游戏逻辑、剧情演出和Boss战。

## 🏗️ 核心架构 (Architecture)

本系统放弃了传统的WE图文触发器，采用 **"WE负责数据与视觉，VSCode+Lua负责逻辑"** 的现代开发管线。

### 1. 引擎层 (Engine Layer)

- **环境**: 魔兽争霸3 v1.31+ (或重制版)，开启 Lua 模式。

- **入口**: 在WE中仅保留一个触发器，内容为 `require("src.main")`。

### 2. 核心代码层 (WCC-Lib)

- **`wcc-core.lua`**: 提供 `pcall` 安全沙箱、句柄(Handle)泄漏防护、异步(Desync)安全保证。

- **`wcc-logger.lua`**: 将游戏内报错重定向到本地文件，以便于喂给LLM进行除错。

- **模块化系统**: 任务(`quest`)、对话(`dialogue`)、计时器管理(`timer`)。

### 3. AI 驱动层 (WCC-Agent)

- **IDE**: VSCode + [Lua插件(Sumneko)] + [AI助手(Copilot/Cline)]。

- **外部脑 (EmmyLua)**: 使用开源的 War3 EmmyLua 注解库，让AI助手通过LSP精准掌握原生API，消除幻觉。

- **系统指令 (`skill.md`)**: 定义AI的编程规范、代码风格和战役业务逻辑。

## 🚀 MVP 行动计划 (Action Plan)

**Phase 1: 基建与验证 (Week 1)**

1. 初始化GitHub仓库，放入本架构文档。

2. 完善 `wcc-core.lua` 的基础封装（创建单位、安全计时器）。

3. 在WE中创建一张空白测试图，测试本地 `require` 机制和报错日志捕获。

**Phase 2: 模式注入 (Week 2)**

1. 编写 `task-boss-fight.md` 模板。

2. 使用 `skill.md` 配合测试Prompt，让AI生成一段“刷怪与击杀判定”代码，直接放入游戏测试。

**Phase 3: 社区开源 (Week 3)**

1. 提供一个拥有3个小任务和1段对话的 `demo-campaign` 示例。

2. 在NGA、HiveWorkshop等论坛发布概念验证视频和仓库地址。
