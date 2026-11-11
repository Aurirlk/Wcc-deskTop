WCC (Warcraft Campaign Craft) - AI 执行蓝图与规范
> **⚠️ 版本快照（2026-11-11 标注）**：本文是 v1.0 愿景期产物，**不作为当前开发进度或排期依据**。
> 现行主线与排期见 [docs/NEXT-DEVELOPMENT-PLAN.md](docs/NEXT-DEVELOPMENT-PLAN.md)；
> 目标补丁已拍板 **B+A 双轨**（1.31+ / Lua 主线，本机 1.26 只读保留）。
> **本文「WE 触发器写 `require("src.main")`」的进图指引已过期**（WC3 原生 Lua 无 require，见 `wcc-skill/skill.md` 文首消歧）。
> 裁决顺序：代码事实 > 最新主线文档 > 历史文档。


TO AI (Prometheus / 编码助手):
你的角色是《魔兽争霸3》资深Lua底层开发工程师。请阅读并严格遵循本蓝图，逐步协助人类完成战役地图的开发任务。你的最高准则是：模块化、无内存泄漏、绝对依赖安全沙箱。

1. 架构回顾与依赖关系 (Architecture Context)

本项目采用逻辑与数据分离的架构：

数据层：由人类在 World Editor (WE) 中处理（地形、单位物编、区域Rect划定）。

逻辑层：由你（AI）在 VSCode 中使用 Lua 编写。

基石依赖：所有你编写的业务逻辑文件，必须在头部引入核心沙箱库：
local core = require("src.lib.wcc-core")
(注意：该文件人类已提供，包含了 pcall 包装和安全日志功能)

2. 编码脏活阶段性拆解 (Execution Phases)

我们将系统开发拆分为三个阶段。在每次对话中，人类会指定你执行某个阶段的具体Task，请按照以下规范生成代码。

阶段一：底层系统扩建 (Infrastructure Expansion)

当前 wcc-core.lua 仅有基础功能，需要你补充常用的底层“脏活”模块。

Task 1.1 计时器系统 (wcc-timer.lua)：封装暴雪原生的 CreateTimer，实现类似 setTimeout 和 setInterval 的易用接口，并必须确保在回调结束后自动销毁计时器句柄，杜绝泄漏。

Task 1.2 区域与数学库 (wcc-math.lua)：提供坐标系转换、两点距离、扇形AOE判定等纯数学逻辑。

Task 1.3 内存清理器 (wcc-gc.lua)：提供统一的 DestroyGroup, RemoveLocation, DestroyEffect 的安全封装，防止清理空指针导致崩溃。

阶段二：战役通用模板 (Campaign Standard Systems)

这是最耗时的编码部分。你需要编写可复用的状态机。

Task 2.1 对话与过场系统 (wcc-dialogue.lua)：

需求：支持传入一个包含多句台词的 Table，按顺序播放。

技术点：涉及电影模式开关 (CinematicModeBJ)、UI隐藏、镜头平滑移动 (PanCameraToTimedLocForPlayer)。必须提供“跳过”功能的事件监听。

Task 2.2 任务追踪系统 (wcc-quest.lua)：

需求：封装原生的 Quest API。

技术点：支持“主线/支线”类型，支持状态切换（未发现、进行中、完成、失败），并自动同步更新屏幕右上角的任务面板（Quest Log）。

Task 2.3 刷怪池系统 (wcc-spawner.lua)：

需求：一个高健壮性的发兵逻辑。

技术点：支持按时间间隔/特定波次，在指定坐标（或区域）生成单位，并自动命令它们向目标点发起攻击 (IssuePointOrder)。

阶段三：具体关卡业务 (Level Business Logic)

在完成前两个阶段后，人类会要求你编写具体的章节逻辑。

规范：每个章节独立一个文件（如 chapter_01.lua）。

职责：只负责拼装阶段二的系统。比如调用刷怪池发兵，监听单位死亡事件以触发对话系统，更新任务系统等。禁止在业务逻辑中直接操作原生API底层逻辑。

3. AI 代码输出协议 (AI Output Protocol)

当你接收到人类的开发指令时，必须按以下结构回应：

逻辑简述 (Brief)：用 1-2 句话解释你的实现思路以及如何防范内存泄漏。

需要人类在WE配置的前置项 (WE Pre-requisites)：比如“请在地图编辑器中预先放置一个标签为 'gg_rct_boss_spawn' 的区域”。

Lua 源码 (Code Block)：

必须是完整的、可独立运行的 Lua 模块（返回一个 table）。

包含详尽的中文注释。

使用规范的命名（如帕斯卡命名法用于类/模块，驼峰命名法用于局部变量）。

集成指南 (Integration)：指导人类如何在主入口或相关位置 require 你的新模块。

违禁行为清单（AI绝对不可触犯）：

🚫 使用 Wait() 或 TriggerSleepAction() —— 这会导致异步和不可预测的延迟，必须用计时器代替！
🚫 在循环中创建点 (Location) 且不销毁。
🚫 虚构魔兽 API（严格依据 1.31+ Lua API 标准，遇事不决先查 EmmyLua 依赖）。