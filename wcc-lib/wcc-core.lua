--[[
    Warcraft Campaign Craft (WCC) - Core Library
    核心安全沙库，提供 API 安全封装，防止内存泄漏和游戏崩溃。
    
    功能:
    - 安全执行封装 (pcall)
    - 单位管理安全封装
    - 内存泄漏防护
    - 日志系统
    
    作者: 艾泽拉斯织码者
    版本: 1.0.0
]]

local WCC_Core = {}

-- 版本号
WCC_Core.VERSION = "1.0.0"

-- ==========================================
-- 日志模块
-- ==========================================

--- 输出普通日志
--- @param msg string 日志信息
function WCC_Core.Log(msg)
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 10.0, "|cff00ff00[WCC]|r " .. tostring(msg))
end

--- 输出警告日志
--- @param msg string 警告信息
function WCC_Core.LogWarning(msg)
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 15.0, "|cffffff00[WCC WARN]|r " .. tostring(msg))
end

--- 输出错误日志
--- @param msg string 错误信息
function WCC_Core.LogError(msg)
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 20.0, "|cffff0000[WCC ERROR]|r " .. tostring(msg))
end

-- ==========================================
-- 安全沙箱机制 (Pcall Wrapper)
-- ==========================================

--- 安全执行函数
--- @param func function 要执行的函数
--- @param ... any 传递给函数的参数
--- @return boolean 是否成功
--- @return any 返回值或错误信息
function WCC_Core.SafeExecute(func, ...)
    local status, result = pcall(func, ...)
    if not status then
        WCC_Core.LogError("执行失败: " .. tostring(result))
        return false, result
    end
    return true, result
end

-- ==========================================
-- 单位管理安全封装
-- ==========================================

--- 安全创建单位
--- @param idPlayer player 玩家句柄
--- @param unitid integer 单位四字ID (如 'hfoo')
--- @param x number X坐标
--- @param y number Y坐标
--- @param face number 朝向
--- @return unit|nil 返回单位句柄，如果失败返回nil
function WCC_Core.SafeCreateUnit(idPlayer, unitid, x, y, face)
    if not idPlayer or not unitid then
        WCC_Core.LogError("SafeCreateUnit: 无效参数")
        return nil
    end

    local status, newUnit = pcall(CreateUnit, idPlayer, unitid, x, y, face or 0)
    
    if not status or newUnit == nil then
        WCC_Core.LogError("SafeCreateUnit: 创建单位失败 ID: " .. tostring(unitid))
        return nil
    end

    return newUnit
end

--- 安全移除单位
--- @param unit unit 要移除的单位
--- @return boolean 是否成功
function WCC_Core.SafeRemoveUnit(unit)
    if not unit then
        WCC_Core.LogWarning("SafeRemoveUnit: 单位为nil")
        return false
    end

    -- 检查单位是否存活
    if GetUnitState(unit, UNIT_STATE_LIFE) <= 0 then
        WCC_Core.LogWarning("SafeRemoveUnit: 单位已死亡，延迟移除")
        -- 延迟移除死亡单位，避免崩溃
        local timer = CreateTimer()
        TimerStart(timer, 0.1, false, function()
            RemoveUnit(unit)
            DestroyTimer(timer)
        end)
        return true
    end

    local status, result = pcall(RemoveUnit, unit)
    if not status then
        WCC_Core.LogError("SafeRemoveUnit: 移除失败 - " .. tostring(result))
        return false
    end

    return true
end

-- ==========================================
-- 计时器管理
-- ==========================================

--- 安全创建计时器
--- @return timer|nil 计时器句柄
function WCC_Core.SafeCreateTimer()
    local status, timer = pcall(CreateTimer)
    if not status then
        WCC_Core.LogError("SafeCreateTimer: 创建计时器失败")
        return nil
    end
    return timer
end

--- 安全销毁计时器
--- @param timer timer 计时器句柄
--- @return boolean 是否成功
function WCC_Core.SafeDestroyTimer(timer)
    if not timer then
        WCC_Core.LogWarning("SafeDestroyTimer: 计时器为nil")
        return false
    end

    local status, result = pcall(DestroyTimer, timer)
    if not status then
        WCC_Core.LogError("SafeDestroyTimer: 销毁失败 - " .. tostring(result))
        return false
    end

    return true
end

-- ==========================================
-- 特效管理
-- ==========================================

--- 创建带自动销毁的特效
--- @param modelName string 模型路径
--- @param x number X坐标
--- @param y number Y坐标
--- @param duration number 持续时间(秒)
--- @return effect|nil 特效句柄
function WCC_Core.CreateEffectWithTimer(modelName, x, y, duration)
    local status, effect = pcall(AddSpecialEffect, modelName, x, y)
    if not status or not effect then
        WCC_Core.LogError("CreateEffectWithTimer: 创建特效失败")
        return nil
    end

    local timer = CreateTimer()
    TimerStart(timer, duration or 5.0, false, function()
        DestroyEffect(effect)
        DestroyTimer(timer)
    end)

    return effect
end

--- 安全销毁特效
--- @param effect effect 特效句柄
--- @return boolean 是否成功
function WCC_Core.SafeDestroyEffect(effect)
    if not effect then
        WCC_Core.LogWarning("SafeDestroyEffect: 特效为nil")
        return false
    end

    local status, result = pcall(DestroyEffect, effect)
    if not status then
        WCC_Core.LogError("SafeDestroyEffect: 销毁失败 - " .. tostring(result))
        return false
    end

    return true
end

-- ==========================================
-- 位置管理
-- ==========================================

--- 安全创建位置
--- @param x number X坐标
--- @param y number Y坐标
--- @return location|nil 位置句柄
function WCC_Core.SafeCreateLocation(x, y)
    local status, loc = pcall(Location, x, y)
    if not status or not loc then
        WCC_Core.LogError("SafeCreateLocation: 创建位置失败")
        return nil
    end
    return loc
end

--- 安全销毁位置
--- @param loc location 位置句柄
--- @return boolean 是否成功
function WCC_Core.SafeRemoveLocation(loc)
    if not loc then
        WCC_Core.LogWarning("SafeRemoveLocation: 位置为nil")
        return false
    end

    local status, result = pcall(RemoveLocation, loc)
    if not status then
        WCC_Core.LogError("SafeRemoveLocation: 销毁失败 - " .. tostring(result))
        return false
    end

    return true
end

-- ==========================================
-- 单位组管理
-- ==========================================

--- 安全创建单位组
--- @return group|nil 单位组句柄
function WCC_Core.SafeCreateGroup()
    local status, group = pcall(CreateGroup)
    if not status or not group then
        WCC_Core.LogError("SafeCreateGroup: 创建单位组失败")
        return nil
    end
    return group
end

--- 安全销毁单位组
--- @param group group 单位组句柄
--- @return boolean 是否成功
function WCC_Core.SafeDestroyGroup(group)
    if not group then
        WCC_Core.LogWarning("SafeDestroyGroup: 单位组为nil")
        return false
    end

    local status, result = pcall(DestroyGroup, group)
    if not status then
        WCC_Core.LogError("SafeDestroyGroup: 销毁失败 - " .. tostring(result))
        return false
    end

    return true
end

-- ==========================================
-- 初始化函数
-- ==========================================

--- 初始化WCC核心系统
function WCC_Core.Init()
    WCC_Core.Log("WCC Core v" .. WCC_Core.VERSION .. " 初始化完成")
end

return WCC_Core
