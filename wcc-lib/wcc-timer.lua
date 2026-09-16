--[[
    模块名称: wcc-timer
    功能描述: setTimeout / setInterval，回调结束自动销毁，防泄漏
    版本: 1.0.0
]]
local Core = require("src.lib.wcc-core")

local WCC_Timer = {}
WCC_Timer.VERSION = "1.0.0"

local active = {}

--- 一次性计时器
---@param timeout number 秒
---@param callback function
---@return timer|nil
function WCC_Timer.SetTimeout(timeout, callback)
    local timer = Core.SafeCreateTimer()
    if not timer then return nil end
    active[timer] = true
    TimerStart(timer, timeout, false, function()
        active[timer] = nil
        Core.SafeExecute(callback)
        Core.SafeDestroyTimer(timer)
    end)
    return timer
end

--- 重复计时器；callback 返回 true 时停止
---@param interval number 秒
---@param callback function
---@return timer|nil
function WCC_Timer.SetInterval(interval, callback)
    local timer = Core.SafeCreateTimer()
    if not timer then return nil end
    active[timer] = true
    TimerStart(timer, interval, true, function()
        local ok, shouldStop = Core.SafeExecute(callback)
        if not ok or shouldStop == true then
            active[timer] = nil
            Core.SafeDestroyTimer(timer)
        end
    end)
    return timer
end

function WCC_Timer.Clear(timer)
    if timer and active[timer] then
        active[timer] = nil
        Core.SafeDestroyTimer(timer)
        return true
    end
    return false
end

function WCC_Timer.ClearAll()
    for t, _ in pairs(active) do
        Core.SafeDestroyTimer(t)
    end
    active = {}
end

function WCC_Timer.Count()
    local n = 0
    for _ in pairs(active) do n = n + 1 end
    return n
end

return WCC_Timer
