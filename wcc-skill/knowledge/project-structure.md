---
id: knowledge-project-structure
mode: conditional
fileMatch: "**/src/**,**/wcc.project.json"
keywords: 目录,结构,require
priority: 40
---
# WCC 项目结构规范 (Project Structure)

> 本文档定义了 WCC 项目的标准目录结构和文件组织方式。

---

## 1. 标准目录结构 (Standard Structure)

```
地图项目根目录/
│
├── map.w3x                           # 魔兽地图文件（World Editor）
│
├── src/                              # Lua 源码目录
│   │
│   ├── main.lua                      # 入口文件
│   │
│   ├── lib/                          # 核心库目录
│   │   ├── wcc-core.lua              # 安全沙箱、内存防护
│   │   ├── wcc-logger.lua            # 日志系统
│   │   ├── wcc-timer.lua             # 计时器管理
│   │   ├── wcc-math.lua              # 数学工具库
│   │   └── wcc-gc.lua                # 内存清理器
│   │
│   ├── systems/                      # 通用系统目录
│   │   ├── wcc-dialogue.lua          # 对话与过场系统
│   │   ├── wcc-quest.lua             # 任务追踪系统
│   │   ├── wcc-spawner.lua           # 刷怪池系统
│   │   └── wcc-boss-fight.lua        # Boss战模板
│   │
│   └── map/                          # 地图业务逻辑目录
│       ├── chapter_01.lua            # 第一章逻辑
│       ├── chapter_02.lua            # 第二章逻辑
│       └── ...
│
├── scripts/                          # 构建脚本（可选）
│   ├── build.lua                     # 构建脚本
│   └── deploy.lua                    # 部署脚本
│
├── tests/                            # 测试目录（可选）
│   ├── test_core.lua                 # 核心库测试
│   └── test_systems.lua              # 系统测试
│
├── docs/                             # 文档目录
│   ├── README.md                     # 项目说明
│   ├── CHANGELOG.md                  # 更新日志
│   └── CONTRIBUTING.md               # 贡献指南
│
└── tools/                            # 工具目录（可选）
    ├── map_extractor.lua             # 地图提取工具
    └── validator.lua                 # 代码验证工具
```

---

## 2. 目录职责 (Directory Responsibilities)

### 2.1 src/ - 源码目录

所有 Lua 源码文件都应存放在此目录下。

**规则**：
- 所有文件必须使用 `require` 导入
- 禁止使用绝对路径
- 模块名与文件名一致

### 2.2 src/lib/ - 核心库目录

存放 WCC 核心库文件。

**包含**：
- `wcc-core.lua` - 安全沙箱、内存泄漏防护
- `wcc-logger.lua` - 日志系统
- `wcc-timer.lua` - 计时器管理
- `wcc-math.lua` - 数学工具库
- `wcc-gc.lua` - 内存清理器

**规则**：
- 这些文件是项目基石，其他所有模块都依赖它们
- 修改时需要格外谨慎
- 必须保持向后兼容

### 2.3 src/systems/ - 通用系统目录

存放可复用的游戏系统模块。

**包含**：
- `wcc-dialogue.lua` - 对话与过场系统
- `wcc-quest.lua` - 任务追踪系统
- `wcc-spawner.lua` - 刷怪池系统
- `wcc-boss-fight.lua` - Boss战模板

**规则**：
- 每个系统应该是独立的、可复用的
- 系统之间不应有循环依赖
- 提供清晰的公共API

### 2.4 src/map/ - 地图业务逻辑目录

存放具体地图的业务逻辑。

**包含**：
- 按章节划分：`chapter_01.lua`, `chapter_02.lua`
- 按区域划分：`area_forest.lua`, `area_dungeon.lua`
- 按功能划分：`intro.lua`, `outro.lua`

**规则**：
- 只负责拼装 systems/ 中的系统
- 禁止直接操作原生API底层逻辑
- 保持文件职责单一

---

## 3. 入口文件规范 (Entry Point)

### 3.1 main.lua 结构

```lua
--[[
    主入口文件
    负责初始化所有模块并启动游戏逻辑
]]

-- 1. 导入核心库
local Core = require("src.lib.wcc-core")
local Logger = require("src.lib.wcc-logger")
local Timer = require("src.lib.wcc-timer")

-- 2. 导入系统模块
local Dialogue = require("src.systems.wcc-dialogue")
local Quest = require("src.systems.wcc-quest")
local Spawner = require("src.systems.wcc-spawner")

-- 3. 导入地图逻辑
local Chapter01 = require("src.map.chapter_01")
local Chapter02 = require("src.map.chapter_02")

-- 4. 初始化函数
local function Init()
    Logger.Log("=== WCC 初始化开始 ===")
    
    -- 初始化核心系统
    Core.Init()
    Timer.Init()
    Dialogue.Init()
    Quest.Init()
    Spawner.Init()
    
    -- 启动第一章
    Chapter01.Start()
    
    Logger.Log("=== WCC 初始化完成 ===")
end

-- 5. 执行初始化
Core.SafeExecute(Init)

-- 6. 返回模块（可选）
return {
    version = "1.0.0",
    chapters = {
        chapter01 = Chapter01,
        chapter02 = Chapter02
    }
}
```

---

## 4. 模块导入规范 (Module Import)

### 4.1 导入路径

```lua
-- ✅ 正确：使用相对路径
local Core = require("src.lib.wcc-core")
local Dialogue = require("src.systems.wcc-dialogue")
local Chapter01 = require("src.map.chapter_01")

-- ❌ 错误：使用绝对路径
local Core = require("D:\\maps\\my_map\\src\\lib\\wcc-core")
```

### 4.2 导入顺序

```lua
-- 1. 核心库（必须最先导入）
local Core = require("src.lib.wcc-core")
local Logger = require("src.lib.wcc-logger")

-- 2. 工具库
local Timer = require("src.lib.wcc-timer")
local Math = require("src.lib.wcc-math")

-- 3. 系统模块
local Dialogue = require("src.systems.wcc-dialogue")
local Quest = require("src.systems.wcc-quest")

-- 4. 业务模块
local Chapter01 = require("src.map.chapter_01")
```

### 4.3 循环依赖处理

```lua
-- ❌ 错误：循环依赖
-- a.lua
local B = require("b")
local M = {}
function M.DoSomething()
    B.OtherFunction()
end
return M

-- b.lua
local A = require("a")  -- 循环依赖！
local M = {}
function M.OtherFunction()
    A.DoSomething()
end
return M

-- ✅ 正确：使用延迟导入或重构
-- a.lua
local M = {}
function M.DoSomething()
    local B = require("b")  -- 延迟导入
    B.OtherFunction()
end
return M
```

---

## 5. 文件命名规范 (File Naming)

### 5.1 命名规则

| 文件类型 | 命名规则 | 示例 |
|---------|---------|------|
| 核心库 | `wcc-*.lua` | `wcc-core.lua`, `wcc-logger.lua` |
| 系统模块 | `wcc-*.lua` | `wcc-dialogue.lua`, `wcc-quest.lua` |
| 业务模块 | 描述性名称 | `chapter_01.lua`, `boss_arena.lua` |
| 测试文件 | `test_*.lua` | `test_core.lua`, `test_dialogue.lua` |
| 配置文件 | `config.lua` | `config.lua`, `settings.lua` |

### 5.2 命名风格

- 使用小写字母
- 使用连字符 `-` 分隔单词
- 保持名称简洁但有描述性

```lua
-- ✅ 好的命名
wcc-core.lua
wcc-dialogue.lua
chapter_01.lua
boss_arena.lua

-- ❌ 坏的命名
WCC_Core.lua
dialogue system.lua
Chapter1.lua
BossArena.lua
```

---

## 6. 配置文件 (Configuration)

### 6.1 全局配置

```lua
-- src/config.lua
local Config = {}

-- 游戏设置
Config.GAME_VERSION = "1.0.0"
Config.DEBUG_MODE = true

-- 系统设置
Config.TIMER_PRECISION = 0.01
Config.LOG_LEVEL = "DEBUG"  -- DEBUG, INFO, WARN, ERROR

-- 地图设置
Config.MAP_NAME = "我的战役"
Config.MAP_AUTHOR = "作者名"

return Config
```

### 6.2 系统配置

```lua
-- src/systems/dialogue_config.lua
local DialogueConfig = {}

-- 对话设置
DialogueConfig.TEXT_SPEED = 0.05  -- 每个字符显示时间
DialogueConfig.AUTO_ADVANCE = false
DialogueConfig.SKIP_KEY = "ESC"

-- 镜头设置
DialogueConfig.CAMERA_TRANSITION = 2.0
DialogueConfig.CAMERA_DISTANCE = 1650

return DialogueConfig
```

---

## 7. 版本控制 (Version Control)

### 7.1 .gitignore

```gitignore
# 魔兽地图文件（二进制）
*.w3x
*.w3m

# 编译输出
/dist/
/build/

# 日志文件
*.log
logs/

# 临时文件
*.tmp
*.bak
*.swp

# IDE配置
.vscode/
.idea/

# 系统文件
.DS_Store
Thumbs.db
```

### 7.2 提交规范

```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建过程或辅助工具的变动
```

---

## 8. 依赖管理 (Dependencies)

### 8.1 依赖声明

```lua
-- 在文件头部声明依赖
--[[
    依赖:
    - wcc-core (核心库)
    - wcc-logger (日志系统)
    - wcc-timer (计时器管理)
]]
```

### 8.2 版本兼容

```lua
-- 检查依赖版本
local Core = require("src.lib.wcc-core")

if Core.VERSION < "1.0.0" then
    error("需要 wcc-core 1.0.0 或更高版本")
end
```

---

*本文档由 WCC 项目维护，最后更新: 2026-07-09*
