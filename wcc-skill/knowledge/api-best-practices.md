# 魔兽争霸3 Lua API 最佳实践 (API Best Practices)

> 本文档汇总了魔兽争霸3 Lua API 的使用注意事项和最佳实践。

---

## 1. 核心原则 (Core Principles)

### 1.1 沙箱优先

所有高危API必须通过 WCC 安全封装调用：

```lua
-- ❌ 禁止直接调用
CreateUnit(Player(0), 'hfoo', 0, 0, 0)

-- ✅ 必须使用安全封装
WCC.SafeCreateUnit(Player(0), 'hfoo', 0, 0, 0)
```

### 1.2 资源即用即毁

创建的 Handle 资源必须在使用后立即销毁：

```lua
local loc = Location(x, y)
-- 使用 loc...
RemoveLocation(loc)
loc = nil
```

---

## 2. 单位管理 (Unit Management)

### 2.1 创建单位

```lua
--- 安全创建单位
--- @param player player 所属玩家
--- @param unitId integer 单位类型ID
--- @param x number X坐标
--- @param y number Y坐标
--- @param facing number 朝向
--- @return unit|nil
function M.SafeCreateUnit(player, unitId, x, y, facing)
    if not player or not unitId then
        return nil
    end
    
    local status, unit = pcall(CreateUnit, player, unitId, x, y, facing or 0)
    if not status then
        Logger.LogError("创建单位失败: " .. tostring(unit))
        return nil
    end
    
    return unit
end
```

### 2.2 移除单位

**⚠️ 关键警告**：在单位死亡事件中直接移除单位会导致游戏崩溃！

```lua
-- ❌ 致命错误
TriggerAddAction(trig, function()
    local dying = GetTriggerUnit()
    RemoveUnit(dying)  -- 崩溃！
end)

-- ✅ 正确做法：延迟移除
TriggerAddAction(trig, function()
    local dying = GetTriggerUnit()
    local timer = CreateTimer()
    TimerStart(timer, 0.1, false, function()
        RemoveUnit(dying)
        DestroyTimer(timer)
    end)
end)
```

### 2.3 单位组操作

```lua
-- 创建单位组
local group = CreateGroup()
GroupEnumUnitsInRange(group, x, y, radius, nil)

-- 遍历单位组
ForGroup(group, function()
    local u = GetEnumUnit()
    -- 处理单位
end)

-- ✅ 必须销毁
DestroyGroup(group)
group = nil
```

---

## 3. 计时器管理 (Timer Management)

### 3.1 基本计时器

```lua
-- 创建一次性计时器 (类似 setTimeout)
local timer = CreateTimer()
TimerStart(timer, 5.0, false, function()
    -- 5秒后执行
    Logger.Log("计时器触发")
    DestroyTimer(timer)  -- 必须销毁
end)

-- 创建重复计时器 (类似 setInterval)
local timer = CreateTimer()
local count = 0
TimerStart(timer, 1.0, true, function()
    count = count + 1
    Logger.Log("第 " .. count .. " 次触发")
    
    if count >= 10 then
        DestroyTimer(timer)  -- 条件满足时销毁
    end
end)
```

### 3.2 计时器安全封装

```lua
local M = {}
local activeTimers = {}

--- 安全创建一次性计时器
--- @param timeout number 超时时间(秒)
--- @param callback function 回调函数
--- @return timer 计时器句柄
function M.SetTimeout(timeout, callback)
    local timer = CreateTimer()
    activeTimers[timer] = true
    
    TimerStart(timer, timeout, false, function()
        activeTimers[timer] = nil
        SafeExecute(callback)
        DestroyTimer(timer)
    end)
    
    return timer
end

--- 安全创建重复计时器
--- @param interval number 间隔时间(秒)
--- @param callback function 回调函数
--- @return timer 计时器句柄
function M.SetInterval(interval, callback)
    local timer = CreateTimer()
    activeTimers[timer] = true
    
    TimerStart(timer, interval, true, function()
        local success, shouldStop = SafeExecute(callback)
        if not success or shouldStop then
            activeTimers[timer] = nil
            DestroyTimer(timer)
        end
    end)
    
    return timer
end

--- 取消计时器
--- @param timer timer 计时器句柄
function M.ClearTimer(timer)
    if activeTimers[timer] then
        activeTimers[timer] = nil
        DestroyTimer(timer)
    end
end

return M
```

---

## 4. 事件处理 (Event Handling)

### 4.1 触发器创建与销毁

```lua
-- 创建触发器
local trig = CreateTrigger()

-- 注册事件
TriggerRegisterAnyUnitEventBJ(trig, EVENT_PLAYER_UNIT_DEATH)

-- 添加条件 (可选)
TriggerAddCondition(trig, Condition(function()
    return IsUnitType(GetTriggerUnit(), UNIT_TYPE_HERO)
end))

-- 添加动作
TriggerAddAction(trig, function()
    local hero = GetTriggerUnit()
    Logger.Log("英雄死亡: " .. GetUnitName(hero))
end)

-- ✅ 不再需要时销毁
DestroyTrigger(trig)
```

### 4.2 避免重复注册

```lua
-- ❌ 错误：重复注册导致内存泄漏
for i = 1, 100 do
    local trig = CreateTrigger()
    TriggerRegisterAnyUnitEventBJ(trig, EVENT_PLAYER_UNIT_DEATH)
    TriggerAddAction(trig, function() ... end)
    -- trig 从未销毁！
end

-- ✅ 正确：复用触发器或及时销毁
local trig = CreateTrigger()
TriggerRegisterAnyUnitEventBJ(trig, EVENT_PLAYER_UNIT_DEATH)
TriggerAddAction(trig, function() ... end)
```

---

## 5. 特效管理 (Effect Management)

### 5.1 创建与销毁特效

```lua
-- 创建特效
local eff = AddSpecialEffect("Abilities\\Spells\\Human\\ThunderClap\\ThunderClap.mdl", x, y)

-- 设置特效属性（可选）
BlzSetSpecialEffectScale(eff, 2.0)
BlzSetSpecialEffectColor(eff, 255, 0, 0)

-- ✅ 必须销毁
DestroyEffect(eff)
eff = nil
```

### 5.2 延迟销毁特效

```lua
--- 创建带自动销毁的特效
--- @param modelPath string 模型路径
--- @param x number X坐标
--- @param y number Y坐标
--- @param duration number 持续时间(秒)
function M.CreateEffectWithDuration(modelPath, x, y, duration)
    local eff = AddSpecialEffect(modelPath, x, y)
    
    local timer = CreateTimer()
    TimerStart(timer, duration, false, function()
        DestroyEffect(eff)
        DestroyTimer(timer)
    end)
end
```

---

## 6. 位置管理 (Location Management)

### 6.1 基本操作

```lua
-- 创建位置
local loc = Location(1000, 2000)

-- 获取坐标
local x = GetLocationX(loc)
local y = GetLocationY(loc)

-- 移动位置
MoveLocation(loc, newX, newY)

-- ✅ 必须销毁
RemoveLocation(loc)
loc = nil
```

### 6.2 位置复用模式

```lua
-- ❌ 错误：循环中创建位置
for i = 1, 100 do
    local loc = Location(x, y)
    -- 使用 loc
    RemoveLocation(loc)
end

-- ✅ 正确：复用位置
local loc = Location(0, 0)
for i = 1, 100 do
    MoveLocation(loc, x, y)
    -- 使用 loc
end
RemoveLocation(loc)
```

---

## 7. 玩家操作 (Player Operations)

### 7.1 获取玩家

```lua
-- 获取玩家句柄
local player = Player(0)  -- 玩家1 (红色)
local player = Player(1)  -- 玩家2 (蓝色)

-- 获取本地玩家
local localPlayer = GetLocalPlayer()

-- 获取玩家属性
local playerId = GetPlayerId(player)
local playerName = GetPlayerName(player)
```

### 7.2 玩家组操作

```lua
-- 创建玩家组
local playerGroup = CreateForce()

-- 添加玩家
ForceAddPlayer(playerGroup, Player(0))
ForceAddPlayer(playerGroup, Player(1))

-- 遍历玩家组
ForForce(playerGroup, function()
    local p = GetEnumPlayer()
    -- 处理玩家
end)

-- ✅ 必须销毁
DestroyForce(playerGroup)
```

---

## 8. 常见陷阱 (Common Pitfalls)

### 8.1 等待函数

```lua
-- ❌ 绝对禁止
function M.DoSomething()
    Wait(5.0)  -- 阻塞主线程！
    -- 后续代码...
end

-- ✅ 正确做法
function M.DoSomething()
    local timer = CreateTimer()
    TimerStart(timer, 5.0, false, function()
        -- 后续代码...
        DestroyTimer(timer)
    end)
end
```

### 8.2 全局变量污染

```lua
-- ❌ 错误：污染全局命名空间
function CreateBoss()
    -- ...
end

-- ✅ 正确：使用模块模式
local M = {}
function M.CreateBoss()
    -- ...
end
return M
```

### 8.3 虚构API

```lua
-- ❌ 错误：虚构不存在的API
SetUnitMaxMana(unit, 1000)  -- 不存在！

-- ✅ 正确：使用真实API
BlzSetUnitMaxMana(unit, 1000)
```

---

## 9. 调试技巧 (Debugging Tips)

### 9.1 日志输出

```lua
-- 输出调试信息
Logger.Log("变量值: " .. tostring(value))

-- 输出警告
Logger.LogWarning("可能存在问题")

-- 输出错误
Logger.LogError("发生错误: " .. errorMsg)
```

### 9.2 安全执行

```lua
-- 包装可能出错的代码
local success, result = pcall(function()
    -- 可能出错的代码
end)

if not success then
    Logger.LogError("执行失败: " .. tostring(result))
end
```

---

## 10. API 参考资源 (API References)

### 10.1 官方文档

- [Blizzard Lua API](https://www.hiveworkshop.com/)
- [Warcraft III Trigger Documentation](https://www.hiveworkshop.com/)

### 10.2 EmmyLua 注解

使用 EmmyLua 注解让 AI 助手理解 API：

```lua
--- 创建单位
--- @param id player 所属玩家
--- @param unitid integer 单位类型ID
--- @param x number X坐标
--- @param y number Y坐标
--- @param face number 朝向
--- @return unit
function CreateUnit(id, unitid, x, y, face) end
```

---

*本文档由 WCC 项目维护，最后更新: 2026-07-09*
