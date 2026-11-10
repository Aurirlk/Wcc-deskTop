# Warcraft Campaign Craft (WCC)

> ⚠️ **本目录为历史版本（v1.0），已停止维护。**  
> 主线已迁移至：**https://github.com/Aurirlk/Wcc-deskTop**  
> 现状计划见 `PROJECT-PLAN.md`（v1.2）与 `PROJECT-PLAN-2.0.md`。  
> 对照分析与改进路线见本目录 [`项目状态与改进报告.md`](项目状态与改进报告.md)。

> 🎮 让 AI 成为你的魔兽争霸3战役开发搭档

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Warcraft III](https://img.shields.io/badge/Warcraft%20III-v1.31%2B-blue.svg)]()
[![Lua](https://img.shields.io/badge/Lua-5.3-green.svg)]()

## 🌟 项目愿景

WCC 是一个基于 LLM（大型语言模型）和 Lua 的《魔兽争霸3》战役级开发脚手架。它通过提供**安全封装库**、**标准化模式**和**AI专家提示词**，让开发者能使用自然语言与AI结对编程，快速构建复杂的游戏逻辑、剧情演出和Boss战。

### 为什么选择 WCC？

| 传统WE触发器 | WCC + AI |
|-------------|----------|
| 图形化节点，难以版本控制 | 纯Lua代码，Git友好 |
| 复制粘贴，难以复用 | 模块化设计，一次编写多处使用 |
| 调试困难，只能在游戏中测试 | 日志系统 + AI辅助除错 |
| 学习曲线陡峭 | 自然语言描述需求，AI生成代码 |

## 🚀 快速开始

### 前置条件

1. **魔兽争霸3** v1.31+ (或重制版)
2. **VSCode** + [Lua插件(Sumneko)](https://marketplace.visualstudio.com/items?itemName=sumneko.lua)
3. **AI助手** (GitHub Copilot / Cline / Cursor)
4. **Node.js** (用于本地开发服务器，可选)

### 安装步骤

```bash
# 1. 克隆新仓库
git clone https://github.com/Aurirlk/Wcc-deskTop.git
cd Wcc-deskTop

# 2. 将 wcc-lib 复制到你的地图项目
cp -r wcc-lib/ /path/to/your/map/src/lib/

# 3. 在 VSCode 中打开项目
code .
```

### 第一个战役脚本

1. 在 World Editor 中创建一个触发器，内容为：
   ```lua
   require("src.main")
   ```

2. 创建 `src/main.lua`：
   ```lua
   local core = require("src.lib.wcc-core")
   local dialogue = require("src.lib.wcc-dialogue")
   
   -- 初始化WCC
   core.Log("WCC 已加载！")
   
   -- 创建一段对话
   dialogue.Play({
       {speaker = "阿尔萨斯", text = "我们到了，斯坦恩布莱德。"},
       {speaker = "乌瑟尔", text = "保持警惕，王子殿下。"}
   })
   ```

3. 保存并运行游戏测试！

## 📚 核心组件

### wcc-lib (核心库)

| 模块 | 功能 |
|------|------|
| `wcc-core.lua` | 安全沙箱、内存泄漏防护、日志系统 |
| `wcc-dialogue.lua` | 对话与过场系统 |
| `wcc-quest.lua` | 任务追踪系统 |
| `wcc-timer.lua` | 计时器管理 (setTimeout/setInterval) |
| `wcc-spawner.lua` | 刷怪池系统 |
| `wcc-math.lua` | 数学与坐标系工具库 |
| `wcc-gc.lua` | 内存清理器 |

### wcc-skill (AI技能包)

让AI助手理解魔兽争霸3开发的最佳实践：

- `skill.md` - AI角色定义与全局约束
- `knowledge/` - 编码规范、API最佳实践
- `patterns/` - 常见任务模板（Boss战、对话序列等）

## 🎯 使用示例

### Boss战模板

```lua
local core = require("src.lib.wcc-core")
local bossFight = require("src.lib.wcc-boss-fight")

-- 配置Boss战
bossFight.Start({
    bossId = 'Nbal',  -- 恐惧魔王
    spawnX = 1000,
    spawnY = 1000,
    phases = {
        {
            healthPercent = 100,
            onEnter = function()
                core.Log("战斗开始！")
            end
        },
        {
            healthPercent = 50,
            onEnter = function()
                core.Log("Boss进入狂暴状态！")
            end
        }
    }
})
```

### AI辅助开发

在VSCode中对AI助手说：

> "帮我写一个刷怪系统，每30秒在区域gg_rct_spawn_point生成5只食尸鬼，向玩家基地移动"

AI会自动生成符合WCC规范的代码！

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 贡献类型

- 🐛 **Bug修复** - 修复现有代码的问题
- ✨ **新功能** - 添加新的系统模块
- 📚 **文档** - 改进文档和示例
- 🎨 **模式模板** - 添加新的任务模式（如护送、防守等）
- 🗺️ **示例地图** - 创建演示用的战役地图

### 代码规范

- 遵循 `wcc-skill/knowledge/conventions.md` 中的编码规范
- 所有公共API必须有 EmmyLua 注解
- 提交前运行测试（如果有）

## 📖 文档

- [架构设计](wcc-architecture.md) - 系统架构详解
- [AI执行蓝图](wcc-ai-blueprint.md) - AI编程规范
- [编码规范](wcc-skill/knowledge/conventions.md) - 代码风格指南
- [API参考](wcc-skill/knowledge/api-best-practices.md) - 魔兽API最佳实践

## 🗺️ 路线图

> 以下为本历史目录的旧路线图。**现行进度以新仓库为准**（Desktop MVP / Sidecar / lua-check / 完整 wcc-lib 已落地）。

- [x] 核心安全沙箱 (wcc-core)
- [x] 对话系统 (wcc-dialogue)
- [x] 任务系统 (wcc-quest)
- [ ] Boss战模板（新仓库已有 wcc-boss-fight）
- [x] 刷怪池系统 (wcc-spawner)
- [ ] 完整的示例战役
- [ ] 社区模式模板库
- [ ] **桌面 Harness**（见新仓库 apps/wcc-desktop）

## 💬 社区

- 新仓库：[Aurirlk/Wcc-deskTop](https://github.com/Aurirlk/Wcc-deskTop)
- Issues / 讨论请到新仓库提交

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Warcraft III Lua API](https://www.hiveworkshop.com/) - Hive Workshop社区
- [EmmyLua War3](https://github.com/sumneko/war3-lua) - 类型注解库
- 所有贡献者和使用者

---

<p align="center">
  Made with ❤️ by Warcraft III modding community
</p>
