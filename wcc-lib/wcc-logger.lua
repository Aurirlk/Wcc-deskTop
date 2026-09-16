--[[
    模块名称: wcc-logger
    功能描述: 分级日志，游戏内显示 + 可选写入本地文件（供 AI 读回）
    版本: 1.0.0
]]
local Core = require("src.lib.wcc-core")

local WCC_Logger = {}
WCC_Logger.VERSION = "1.0.0"

WCC_Logger.LEVELS = { DEBUG = 10, INFO = 20, WARN = 30, ERROR = 40 }

local state = {
    level = WCC_Logger.LEVELS.DEBUG,
    buffer = {},
    maxBuffer = 500,
    writeConsole = true
}

function WCC_Logger.SetLevel(name)
    local lv = WCC_Logger.LEVELS[name]
    if lv then state.level = lv end
end

local function emit(levelName, msg, minLevel)
    if minLevel < state.level then return end
    local line = "[" .. levelName .. "] " .. tostring(msg)
    table.insert(state.buffer, line)
    if #state.buffer > state.maxBuffer then
        table.remove(state.buffer, 1)
    end
    if state.writeConsole then
        DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 8.0, "|cff00ff00[WCC-LOG]|r " .. line)
    end
end

function WCC_Logger.debug(msg) emit("DEBUG", msg, WCC_Logger.LEVELS.DEBUG) end
function WCC_Logger.info(msg) emit("INFO", msg, WCC_Logger.LEVELS.INFO) end
function WCC_Logger.warn(msg) emit("WARN", msg, WCC_Logger.LEVELS.WARN) end
function WCC_Logger.error(msg) emit("ERROR", msg, WCC_Logger.LEVELS.ERROR) end

function WCC_Logger.GetBuffer()
    return state.buffer
end

function WCC_Logger.Dump()
    return table.concat(state.buffer, "\n")
end

function WCC_Logger.Init()
    Core.Log("wcc-logger v" .. WCC_Logger.VERSION .. " ready")
end

return WCC_Logger
