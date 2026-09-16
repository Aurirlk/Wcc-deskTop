--[[
    模块名称: wcc-objects
    功能描述: 程序化物编/单位与物品创建（提百万式 Lua 批量生成，减少 WE 物编 UI）
    参考: 对齐 Blz* API；所有 Handle 经 core 安全封装
    版本: 0.2.0
]]
local Core = require("src.lib.wcc-core")

local WCC_Objects = {}
WCC_Objects.VERSION = "0.2.0"

-- 已注册的自定义单位/物品 ID 追踪（便于 build 与调试）
local registry = {
    units = {},
    items = {},
    abilities = {},
}

--- 注册自定义单位四字码（运行时用 Blz 创建；物编字段仍可在 WE 补全）
---@param rawcode string 如 'h001'
---@param fields table|nil { hp, mana, name, ... } 可选，用 Blz 直接改
---@return string rawcode
function WCC_Objects.RegisterUnit(rawcode, fields)
    registry.units[rawcode] = fields or {}
    return rawcode
end

function WCC_Objects.RegisterItem(rawcode, fields)
    registry.items[rawcode] = fields or {}
    return rawcode
end

--- 按注册表安全创建单位，并可选应用运行时字段
function WCC_Objects.CreateUnit(player, rawcode, x, y, face)
    local u = Core.SafeCreateUnit(player, rawcode, x, y, face)
    if not u then return nil end
    local f = registry.units[rawcode]
    if f then
        if f.hp then
            pcall(function()
                BlzSetUnitMaxHP(u, f.hp)
                SetUnitState(u, UNIT_STATE_LIFE, f.hp)
            end)
        end
        if f.mana then
            pcall(function()
                BlzSetUnitMaxMana(u, f.mana)
                SetUnitState(u, UNIT_STATE_MANA, f.mana)
            end)
        end
        if f.name then
            pcall(function() BlzSetUnitName(u, f.name) end)
        end
    end
    return u
end

--- 批量刷一排单位（间距默认 64）
function WCC_Objects.LineSpawn(player, rawcode, x, y, count, spacing, face)
    local sp = spacing or 64
    local made = 0
    for i = 0, (count or 1) - 1 do
        local u = WCC_Objects.CreateUnit(player, rawcode, x + i * sp, y, face)
        if u then made = made + 1 end
    end
    return made
end

--- 给单位物品（需要地图中已有 item rawcode 或运行时创建）
function WCC_Objects.UnitAddItemRaw(unit, itemRaw)
    if not unit or not itemRaw then return false end
    local ok = pcall(function()
        UnitAddItemById(unit, itemRaw)
    end)
    return ok
end

function WCC_Objects.GetRegistry()
    return registry
end

return WCC_Objects
