--[[
    模块名称: wcc-hotreload
    功能描述: 开发期模块热重载（h-lua 风格思路）：清缓存 + 重新 require
    警告: 仅调试用；线上战役不要 Init
    版本: 0.1.0
]]
local Core = require("src.lib.wcc-core")

local WCC_Hot = {}
WCC_Hot.VERSION = "0.1.0"

local enabled = false
local watched = {}

--- 开启热重载（需要游戏支持 package.loaded；失败则退回手动）
function WCC_Hot.Init()
    if package == nil then
        Core.LogWarning("hotreload: package 表不可用，热重载不可用")
        return false
    end
    enabled = true
    Core.Log("hotreload 已开启（开发模式）")
    return true
end

function WCC_Hot.IsEnabled()
    return enabled
end

--- 卸载模块缓存，下次 require 重新加载源文件
---@param modname string 如 "src.map.chapter_01"
---@return boolean
function WCC_Hot.Unload(modname)
    if not enabled then return false end
    if package.loaded[modname] ~= nil then
        package.loaded[modname] = nil
        Core.Log("hotreload unload: " .. modname)
        return true
    end
    return false
end

--- 卸载并重新 require
---@param modname string
---@return any|nil module
function WCC_Hot.Reload(modname)
    if not enabled then return nil end
    WCC_Hot.Unload(modname)
    local ok, mod = pcall(require, modname)
    if not ok then
        Core.LogError("hotreload reload failed: " .. tostring(mod))
        return nil
    end
    watched[modname] = true
    return mod
end

--- 批量重载已登记模块（顺序按注册先后）
function WCC_Hot.ReloadAll()
    local n = 0
    for name, _ in pairs(watched) do
        if WCC_Hot.Reload(name) then n = n + 1 end
    end
    Core.Log("hotreload ReloadAll: " .. n)
    return n
end

function WCC_Hot.Watch(modname)
    watched[modname] = true
end

function WCC_Hot.List()
    local t = {}
    for name, _ in pairs(watched) do
        t[#t + 1] = name
    end
    return t
end

return WCC_Hot
