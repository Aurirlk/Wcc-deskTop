--[[
    模块名称: wcc-gc
    功能描述: Handle 统一安全清理，防空指针崩溃
    版本: 1.0.1
]]
local Core = require("src.lib.wcc-core")

local WCC_GC = {}
WCC_GC.VERSION = "1.0.1"

local scratchLoc = nil

function WCC_GC.DestroyGroup(group)
    if group == nil then return false end
    return Core.SafeDestroyGroup(group)
end

function WCC_GC.RemoveLocation(loc)
    if loc == nil then return false end
    return Core.SafeRemoveLocation(loc)
end

function WCC_GC.DestroyEffect(effect)
    if effect == nil then return false end
    return Core.SafeDestroyEffect(effect)
end

--- 死亡事件中安全延迟移除单位（必须延迟，否则崩溃）
---@param unit unit
---@param delay number|nil 默认 0.1s
function WCC_GC.DeferredRemoveUnit(unit, delay)
    if unit == nil then return end
    local d = delay or 0.1
    local Timer = require("src.lib.wcc-timer")
    Timer.SetTimeout(d, function()
        Core.SafeRemoveUnit(unit)
    end)
end

--- 取得可复用 Scratch Location（循环内 MoveLocation，勿 new）
---@return location|nil
function WCC_GC.ScratchLocation(x, y)
    if scratchLoc == nil then
        scratchLoc = Core.SafeCreateLocation(x or 0, y or 0)
    else
        MoveLocation(scratchLoc, x or 0, y or 0)
    end
    return scratchLoc
end

--- 释放 Scratch Location
function WCC_GC.ReleaseScratchLocation()
    if scratchLoc then
        Core.SafeRemoveLocation(scratchLoc)
        scratchLoc = nil
        return true
    end
    return false
end

return WCC_GC
