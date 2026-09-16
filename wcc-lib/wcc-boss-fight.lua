--[[
    模块名称: wcc-boss-fight
    功能描述: 多阶段 Boss 战模板（阶段机 + 血量阈值回调）
    版本: 1.0.0
]]
local Core = require("src.lib.wcc-core")
local Timer = require("src.lib.wcc-timer")

local WCC_BossFight = {}
WCC_BossFight.VERSION = "1.0.0"
WCC_BossFight.__index = WCC_BossFight

--- 创建 Boss 战
---@param config table bossId, spawnX, spawnY, facing, phases[], tickInterval
---@return table|nil
function WCC_BossFight.New(config)
    if not config or not config.bossId then
        Core.LogError("WCC_BossFight.New: missing bossId")
        return nil
    end
    local self = setmetatable({}, WCC_BossFight)
    self.bossId = config.bossId
    self.spawnX = config.spawnX or 0
    self.spawnY = config.spawnY or 0
    self.facing = config.facing or 0
    self.owner = config.owner or Player(PLAYER_NEUTRAL_AGGRESSIVE)
    self.phases = config.phases or {}
    self.tickInterval = config.tickInterval or 0.25
    self.boss = nil
    self.phaseIndex = 0
    self.active = false
    self.tickTimer = nil
    self.onPhaseChange = config.onPhaseChange
    self.onDefeat = config.onDefeat
    return self
end

function WCC_BossFight:Spawn()
    self.boss = Core.SafeCreateUnit(self.owner, self.bossId, self.spawnX, self.spawnY, self.facing)
    return self.boss ~= nil
end

function WCC_BossFight:EnterPhase(index)
    if index == self.phaseIndex or index < 1 or index > #self.phases then
        return
    end
    self.phaseIndex = index
    local p = self.phases[index]
    Core.Log("Boss phase " .. index .. " / " .. #self.phases)
    if p.onEnter then Core.SafeExecute(p.onEnter, self, self.boss) end
    if self.onPhaseChange then Core.SafeExecute(self.onPhaseChange, self, index) end
end

local function currentHpPercent(unit)
    local life = GetUnitState(unit, UNIT_STATE_LIFE)
    local max = GetUnitState(unit, UNIT_STATE_MAX_LIFE)
    if max <= 0 then return 0 end
    return (life / max) * 100
end

function WCC_BossFight:Start()
    if self.active then return false end
    if not self:Spawn() then return false end
    self.active = true
    self:EnterPhase(1)

    self.tickTimer = Timer.SetInterval(self.tickInterval, function()
        if not self.active or self.boss == nil then return true end
        if GetUnitState(self.boss, UNIT_STATE_LIFE) <= 0 then
            self:OnDeath()
            return true
        end
        local hp = currentHpPercent(self.boss)
        for i = #self.phases, 1, -1 do
            local threshold = self.phases[i].healthPercent or 0
            if hp <= threshold and i > self.phaseIndex then
                self:EnterPhase(i)
                break
            end
        end
    end)
    return true
end

function WCC_BossFight:OnDeath()
    self.active = false
    Core.Log("Boss defeated")
    if self.onDefeat then Core.SafeExecute(self.onDefeat, self) end
end

function WCC_BossFight:Stop()
    self.active = false
    if self.tickTimer then
        Timer.Clear(self.tickTimer)
        self.tickTimer = nil
    end
end

return WCC_BossFight
