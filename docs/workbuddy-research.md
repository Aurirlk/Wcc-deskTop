# WorkBuddy 调研报告

> 调研日期：2026-09-13  
> 用途：为 WCC「国内 AI 魔兽编辑器 / Harness」提供产品与架构参考  
> 性质：独立社区资料综合，非腾讯官方文档

---

## 1. 产品定位

**WorkBuddy** 是腾讯系**桌面端 AI 工作助手**（国内 [workbuddy.cn](https://www.workbuddy.cn/)，国际版 WorkBuddy AI / workbuddy.ai），与 CodeBuddy 同属腾讯编码/办公 Agent 生态。

它不是「网页聊天框」，而是完整 **桌面 Agent Harness**：

- 常驻会话与任务
- 可调用本机工具改文件、跑自动化
- 支持 Skill、MCP Connector、多 Agent
- 中文办公与中国互联网场景生态密

社区常用类比：**国产 Claude Code / 桌面 Agent 操作系统**——「模型是大脑，Harness 是操作系统」。

### 主要证据来源

| 来源 | 说明 |
|------|------|
| [Tencent/workbuddy-bench](https://github.com/Tencent/workbuddy-bench) | 官方评测框架（Code/Web/Office/Security） |
| [AlephAITech/WorkBuddyGuide](https://github.com/AlephAITech/WorkBuddyGuide) | 社区《实战蓝皮书》（约 3k★） |
| 智见 AI · WorkBuddy Harness 拆解 | 针对 5.3.13，从 UI 反推本地文件与请求拼装 |
| [adongwanai/learn-workbuddy](https://github.com/adongwanai/learn-workbuddy) | 24 章 clean-room 教学，复刻桌面 Agent 架构 |
| WorkDaddy 等增强工具 | CDP 注入，证实官方端为 Electron |

---

## 2. 核心优势

| 优势 | 说明 |
|------|------|
| 桌面原生 Harness | 会话常驻、本机文件、长任务，不止问答 |
| 工程化完整 | 记忆、权限、Hooks、Skill 懒加载、MCP、多 Agent |
| Skill / MCP 生态 | 国内技能包与自动化大量宣称兼容 |
| 中国场景 | 公众号、办公文档、多账号、签到等周边密集 |
| 官方评测 | WorkBuddy Bench 证明按「角色化真实工作」定义能力 |
| 与编码产品同源 | 与 CodeBuddy 并行，用户心智接近「会写代码也会办公」 |

**短板**：桌面闭源；积分/账号带来大量第三方增强工具；长任务权限弹窗曾是体验痛点。

---

## 3. 使用原理（Harness）

### 3.1 分层架构（社区拆解 + 教学归纳）

```text
桌面 UI (Electron)
    │ IPC / preload
主进程（窗口 / 登录 / 配置）
    │
Sidecar / Session Runtime（可恢复会话）
    │
Agent Loop：模型 → 工具 → 结果 → 再模型
    ├── 工具注册表（内置 / Skill / MCP）
    ├── 记忆（工作区 / 用户 / 远端）
    ├── 持久化（JSONL / SQLite / artifacts）
    └── 安全（权限 / Hooks / 沙盒 / 审计）
```

### 3.2 关键机制

1. **UI 不直接改世界**：高风险动作经权限与工具层。  
2. **Prompt 是运行时组装的**：身份、记忆、项目上下文、Skill 片段按优先级与预算拼装。  
3. **记忆分层**：工作区日志、用户偏好、远端 profile；避免无脑塞满上下文。  
4. **能力懒加载**：Skill 先目录后展开，降低 token 成本。  
5. **多模型档位**：lite / default / craft 类路由控制成本与质量。  
6. **子 Agent 隔离**：探索/摘要不污染主窗口完整推理。  
7. **可插拔 Harness**：官方 Bench 将「任意 Agent CLI」放入沙盒评测，模型与外壳解耦。

### 3.3 客户端形态

WorkDaddy 等工具通过 **Chrome DevTools Protocol** 连接运行中的 Electron 渲染进程注入 UI，不修改官方二进制——说明官方客户端是典型 Electron 桌面应用。

---

## 4. 核心功能

### 4.1 产品向

- 对话式工作助理（办公、文件、知识、资讯、内容等）
- Skill 技能包安装与调用
- Connector / MCP 外接
- 专家角色、SubAgent、Agents Team
- 自动化长任务
- 记忆与项目上下文

### 4.2 官方 Bench（Tencent/workbuddy-bench）

| 子集 | 约任务数 | 域 |
|------|----------|-----|
| Code | 80 | 仓库级 SWE |
| Web | 70 | 前端 / GUI |
| Office | 50 | xlsx / csv / pdf / docx |
| Security | 60 | 红蓝与漏洞相关 |

### 4.3 生态侧面

- WorkDaddy：多账号、免打扰、中断续接、定时任务  
- 签到自动化、公众号发布 Skill、各类行业 Skill  
- workbuddy2api：桥成 OpenAI 兼容服务（社区用法）

---

## 5. 对 WCC Harness 的映射

| WorkBuddy 机制 | WCC（AI 魔兽 Harness）对应 |
|----------------|---------------------------|
| Agent Loop + Sidecar | 会话运行时；改图经 MCP 子进程 |
| Skill 懒加载 | `wcc-skill` + patterns |
| Connector / MCP | **wc3-forge MCP** + 自研 `wcc-mcp`（逻辑层） |
| 权限 / Hooks | 写地图、物编前确认；`wcc-lua-check` 门禁 |
| 记忆 | 战役项目状态、章节进度、用户偏好 |
| Bench | 自建战役任务评测（对话/任务/刷怪合法性） |
| 模型档位 | 规划用强模型，校验/摘要用轻模型 |

### 产品主张（v1.1：桌面优先，与 wc3-forge 互补）

> **魔兽圈的桌面 AI 编辑 Harness（WorkBuddy 式）**：Electron 壳 + Sidecar Agent Loop；中文工作流与战役模式库打头；地图数据层交给 wc3-forge 等 MCP；逻辑层由 WCC Lua + 静态检查保证可玩与不泄漏。计划主文档：`PROJECT-PLAN.md`。

---

## 6. 参考链接

- https://github.com/Tencent/workbuddy-bench  
- https://github.com/AlephAITech/WorkBuddyGuide  
- https://workbuddy.homes/  
- https://github.com/zjp1997720/zhijian-ai-bluebook-workbuddy-harness  
- https://github.com/adongwanai/learn-workbuddy  
- https://github.com/babygoton/WorkDaddy  
- https://www.workbuddy.cn/ · https://www.workbuddy.ai/  

---

*本文件为 WCC 项目内部调研资料，可随官方版本更新修订。*
