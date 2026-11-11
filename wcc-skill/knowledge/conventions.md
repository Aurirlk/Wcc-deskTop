---
id: knowledge-conventions
mode: conditional
fileMatch: "**/*.lua"
priority: 60
---
> **⚠️ require 消歧（2026-11-11）**：本文示例里的 `require("src.*")` 是 **WCC 源码组织方式**，
> 由 `build-map.js` 内联成单文件 `war3map.lua`（自造 `__wcc_require`）。WC3 原生 Lua **没有 require**，
> **不要在 World Editor 触发器里写 `require("src.main")`**；进图请用 `dist/build/war3map.lua` 全文。

# WCC 编码规范 (Coding Conventions)

> 本文档定义了 WCC 项目中的代码风格和命名规范。

---

## 1. 文件组织 (File Organization)

### 1.1 文件结构

```lua
--[[
    模块名称: [模块名]
    功能描述: [简述]
    作者: [作者名]
    日期: YYYY-MM-DD
    依赖: [依赖的其他模块]
]]

-- 1. 导入依赖
local Core = require("src.lib.wcc-core")
local Logger = require("src.lib.wcc-logger")

-- 2. 模块定义
local M = {}

-- 3. 私有变量和函数
local privateVar = 0
local function privateFunction()
    -- ...
end

-- 4. 公共API
function M.PublicFunction()
    -- ...
end

-- 5. 返回模块
return M
```

### 1.2 文件命名

- 使用小写字母和连字符：`wcc-core.lua`, `boss-fight.lua`
- 模块名与文件名一致：`wcc-core.lua` → `local WccCore = require("wcc-core")`

---

## 2. 命名规范 (Naming Conventions)

### 2.1 变量命名

| 类型 | 风格 | 示例 |
|------|------|------|
| 局部变量 | 驼峰命名 | `local playerCount = 0` |
| 常量 | 全大写+下划线 | `local MAX_PLAYERS = 4` |
| 私有变量 | 下划线前缀 | `local _internalState = {}` |
| 全局变量 | 避免使用 | - |

### 2.2 函数命名

| 类型 | 风格 | 示例 |
|------|------|------|
| 公共函数 | 帕斯卡命名 | `function M.CreateUnit()` |
| 私有函数 | 驼峰命名 | `local function calculateDamage()` |
| 回调函数 | 描述性命名 | `local function onUnitDeath()` |
| 布尔返回 | `is`/`has`前缀 | `function M.IsAlive()` |

### 2.3 表和类命名

| 类型 | 风格 | 示例 |
|------|------|------|
| 模块表 | 单字母 `M` 或描述性名称 | `local M = {}` |
| 类 | 帕斯卡命名 | `local BossFight = {}` |
| 实例 | 驼峰命名 | `local currentBoss = BossFight.New()` |

---

## 3. 注释规范 (Comments)

### 3.1 文件头注释

```lua
--[[
    模块名称: BossFight
    功能描述: Boss战系统，支持多阶段战斗和技能循环
    作者: WCC Team
    日期: 2026-07-09
    依赖: wcc-core, wcc-timer, wcc-gc
]]
```

### 3.2 EmmyLua 函数注解

```lua
--- 创建一个安全的单位
--- @param player player 所属玩家
--- @param unitId integer 单位类型ID (如 'hfoo')
--- @param x number X坐标
--- @param y number Y坐标
--- @param facing number 朝向角度
--- @return unit|nil 成功返回单位句柄，失败返回nil
function M.SafeCreateUnit(player, unitId, x, y, facing)
    -- 实现...
end
```

### 3.3 行内注释

```lua
-- ✅ 好的注释：解释为什么
local delay = 0.1  -- 延迟0.1秒避免在死亡事件中直接移除单位

-- ❌ 坏的注释：解释是什么
local delay = 0.1  -- 设置延迟为0.1秒
```

### 3.4 TODO 注释

```lua
-- TODO: 添加Boss第二阶段技能
-- FIXME: 单位死亡时偶尔崩溃
-- HACK: 临时解决方案，需要重构
```

---

## 4. 代码格式 (Code Formatting)

### 4.1 缩进

- 使用 **4个空格** 缩进
- 不使用 Tab 字符
- 保持一致的缩进层级

```lua
-- ✅ 正确
function M.Init()
    if condition then
        doSomething()
    end
end

-- ❌ 错误
function M.Init()
if condition then
doSomething()
end
end
```

### 4.2 行长度

- 建议最大行长度：**120 字符**
- 超长行应在操作符后换行：

```lua
-- ✅ 正确
local result = veryLongVariableName + anotherLongVariableName +
               thirdLongVariableName

-- ❌ 错误
local result = veryLongVariableName + anotherLongVariableName + thirdLongVariableName
```

### 4.3 空行

- 函数之间：**2个空行**
- 逻辑块之间：**1个空行**
- 不使用多余的空行

```lua
function M.Function1()
    -- 实现
end


function M.Function2()
    -- 实现
end
```

### 4.4 括号和空格

```lua
-- ✅ 正确
if (a > b) and (c < d) then
    result = (a + b) * c
end

-- ❌ 错误
if (a>b)and(c<d) then
    result=(a+b)*c
end
```

---

## 5. 模块设计 (Module Design)

### 5.1 模块模式

```lua
local M = {}

-- 私有状态
local state = {
    isInitialized = false,
    count = 0
}

-- 私有函数
local function validateInput(value)
    return value ~= nil
end

--- 初始化模块
function M.Init()
    if state.isInitialized then
        return
    end
    state.isInitialized = true
    -- 初始化逻辑
end

--- 获取计数
--- @return number 当前计数
function M.GetCount()
    return state.count
end

return M
```

### 5.2 构造函数模式

```lua
local BossFight = {}
BossFight.__index = BossFight

--- 创建新的Boss战实例
--- @param config table 配置表
--- @return table Boss战实例
function BossFight.New(config)
    local self = setmetatable({}, BossFight)
    self.config = config
    self.currentPhase = 1
    self.isActive = false
    return self
end

--- 开始战斗
function BossFight:Start()
    self.isActive = true
    -- 战斗逻辑
end

return BossFight
```

---

## 6. 错误处理 (Error Handling)

### 6.1 使用 pcall

```lua
--- 安全执行函数
--- @param func function 要执行的函数
--- @param ... any 传递给函数的参数
--- @return boolean 是否成功
--- @return any 返回值或错误信息
function M.SafeExecute(func, ...)
    local status, result = pcall(func, ...)
    if not status then
        Logger.LogError("执行失败: " .. tostring(result))
        return false, result
    end
    return true, result
end
```

### 6.2 参数验证

```lua
--- 创建单位
--- @param player player 玩家句柄
--- @param unitId integer 单位ID
--- @return unit|nil
function M.CreateUnit(player, unitId)
    -- 参数验证
    if not player then
        Logger.LogError("CreateUnit: player 不能为 nil")
        return nil
    end
    if not unitId then
        Logger.LogError("CreateUnit: unitId 不能为 nil")
        return nil
    end
    
    -- 安全创建
    local status, unit = pcall(CreateUnit, player, unitId, 0, 0, 0)
    if not status then
        Logger.LogError("CreateUnit 失败: " .. tostring(unit))
        return nil
    end
    
    return unit
end
```

---

## 7. 性能优化 (Performance)

### 7.1 避免重复创建

```lua
-- ❌ 错误：循环中重复创建
for i = 1, 100 do
    local loc = Location(x, y)
    -- 使用 loc
    RemoveLocation(loc)
end

-- ✅ 正确：复用资源
local loc = Location(x, y)
for i = 1, 100 do
    MoveLocation(loc, x, y)
    -- 使用 loc
end
RemoveLocation(loc)
```

### 7.2 局部变量优先

```lua
-- ❌ 错误：全局查找
function M.Process()
    for i = 1, 1000 do
        SomeGlobalFunction(i)
    end
end

-- ✅ 正确：局部缓存
function M.Process()
    local func = SomeGlobalFunction
    for i = 1, 1000 do
        func(i)
    end
end
```

---

## 8. 测试规范 (Testing)

### 8.1 测试文件命名

- 测试文件：`*_test.lua` 或 `test_*.lua`
- 测试目录：`tests/` 或 `test/`

### 8.2 测试函数命名

```lua
function M.TestCreateUnit()
    -- 测试用例
end

function M.TestCreateUnitWithInvalidParams()
    -- 边界测试
end
```

---

*本文档由 WCC 项目维护，最后更新: 2026-07-09*
