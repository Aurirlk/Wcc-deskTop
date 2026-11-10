---
id: patterns-task-boss-fight
mode: manual
keywords: boss,阶段,技能循环
priority: 30
---
# Boss战模式模板 (Boss Fight Pattern)

> 本文档定义了魔兽争霸3 Boss战的标准实现模式。

---

## 1. 模式概述 (Pattern Overview)

### 1.1 设计目标

- 支持多阶段战斗
- 支持技能循环和机制
- 支持环境交互
- 防止内存泄漏

### 1.2 核心组件

```
BossFight
├── Phase Manager (阶段管理器)
├── Skill System (技能系统)
├── Threat Table (仇恨表)
└── Event Handler (事件处理器)
```

---

## 2. 基础实现 (Basic Implementation)

### 2.1 BossFight 模块

```lua
--[[
    Boss战系统
    支持多阶段战斗、技能循环、仇恨管理
]]

local Core = require("src.lib.wcc-core")
local Timer = require("src.lib.wcc-timer")
local Logger = require("src.lib.wcc-logger")

local BossFight = {}
BossFight.__index = BossFight

--- 创建新的Boss战实例
--- @param config table 配置表
--- @return table Boss战实例
function BossFight.New(config)
    local self = setmetatable({}, BossFight)
    
    -- 基础配置
    self.bossId = config.bossId
    self.spawnX = config.spawnX or 0
    self.spawnY = config.spawnY or 0
    self.facing = config.facing or 0
    
    -- 阶段配置
    self.phases = config.phases or {}
    self.currentPhase = 0
    
    -- 状态
    self.boss = nil
    self.isActive = false
    self.isPaused = false
    
    -- 仇恨表
    self.threatTable = {}
    
    -- 技能配置
    self.skills = config.skills or {}
    self.skillTimers = {}
    
    return self
end

--- 初始化Boss战
function BossFight:Init()
    Logger.Log("Boss战初始化: " .. tostring(self.bossId))
    
    -- 注册事件
    self:RegisterEvents()
    
    -- 创建Boss
    self:SpawnBoss()
end

--- 生成Boss
function BossFight:SpawnBoss()
    self.boss = Core.SafeCreateUnit(
        Player(PLAYER_NEUTRAL_AGGRESSIVE),
        self.bossId,
        self.spawnX,
        self.spawnY,
        self.facing
    )
    
    if not self.boss then
        Logger.LogError("Boss生成失败!")
        return false
    end
    
    -- 进入第一阶段
    self:EnterPhase(1)
    
    return true
end

--- 进入指定阶段
--- @param phaseNumber number 阶段编号
function BossFight:EnterPhase(phaseNumber)
    if phaseNumber > #self.phases then
        Logger.LogError("阶段 " .. phaseNumber .. " 不存在!")
        return
    end
    
    self.currentPhase = phaseNumber
    local phase = self.phases[phaseNumber]
    
    Logger.Log("进入阶段 " .. phaseNumber)
    
    -- 执行阶段进入回调
    if phase.onEnter then
        Core.SafeExecute(phase.onEnter, self)
    end
    
    -- 设置阶段技能
    if phase.skills then
        self:SetupSkills(phase.skills)
    end
end

--- 设置技能循环
--- @param skills table 技能配置表
function BossFight:SetupSkills(skills)
    -- 清除旧的技能计时器
    self:ClearSkillTimers()
    
    -- 设置新技能
    for _, skill in ipairs(skills) do
        local timer = Timer.SetInterval(skill.interval, function()
            if self.isActive and not self.isPaused then
                self:ExecuteSkill(skill)
            end
        end)
        table.insert(self.skillTimers, timer)
    end
end

--- 执行技能
--- @param skill table 技能配置
function BossFight:ExecuteSkill(skill)
    if not self.boss or not IsUnitAliveBJ(self.boss) then
        return
    end
    
    Logger.Log("Boss使用技能: " .. skill.name)
    
    -- 执行技能逻辑
    if skill.execute then
        Core.SafeExecute(skill.execute, self.boss, self)
    end
end

--- 清除技能计时器
function BossFight:ClearSkillTimers()
    for _, timer in ipairs(self.skillTimers) do
        Timer.ClearTimer(timer)
    end
    self.skillTimers = {}
end

--- 注册事件
function BossFight:RegisterEvents()
    -- Boss死亡事件
    local trig = CreateTrigger()
    TriggerRegisterUnitEvent(trig, self.boss, EVENT_UNIT_DEATH)
    TriggerAddAction(trig, function()
        self:OnBossDeath()
    end)
    
    -- Boss受击事件
    local trig2 = CreateTrigger()
    TriggerRegisterUnitEvent(trig2, self.boss, EVENT_UNIT_DAMAGED)
    TriggerAddAction(trig2, function()
        self:OnBossDamaged()
    end)
end

--- Boss死亡处理
function BossFight:OnBossDeath()
    Logger.Log("Boss死亡!")
    
    self.isActive = false
    self:ClearSkillTimers()
    
    -- 执行胜利回调
    if self.onVictory then
        Core.SafeExecute(self.onVictory, self)
    end
end

--- Boss受击处理
function BossFight:OnBossDamaged()
    if not self.boss then
        return
    end
    
    local healthPercent = GetUnitLifePercent(self.boss)
    
    -- 检查阶段转换
    for i = #self.phases, 1, -1 do
        local phase = self.phases[i]
        if healthPercent <= phase.healthPercent and self.currentPhase < i then
            self:EnterPhase(i)
            break
        end
    end
end

--- 暂停战斗
function BossFight:Pause()
    self.isPaused = true
    Logger.Log("Boss战暂停")
end

--- 恢复战斗
function BossFight:Resume()
    self.isPaused = false
    Logger.Log("Boss战恢复")
end

--- 结束战斗
function BossFight:Stop()
    self.isActive = false
    self:ClearSkillTimers()
    Logger.Log("Boss战结束")
end

return BossFight
```

---

## 3. 配置示例 (Configuration Examples)

### 3.1 基础Boss配置

```lua
local bossConfig = {
    -- 基础设置
    bossId = 'Nbal',  -- 恐惧魔王
    spawnX = 1000,
    spawnY = 1000,
    facing = 270,
    
    -- 阶段配置
    phases = {
        {
            healthPercent = 100,
            onEnter = function(self)
                Core.Log("战斗开始！")
            end,
            skills = {
                {
                    name = "腐臭蜂群",
                    interval = 8.0,
                    execute = function(boss, fight)
                        local target = fight:GetRandomTarget()
                        if target then
                            IssueTargetOrder(boss, "carrionswarm", target)
                        end
                    end
                }
            }
        },
        {
            healthPercent = 50,
            onEnter = function(self)
                Core.Log("Boss进入狂暴状态！")
                -- 增加攻击力
                SetUnitAttackDamage(self.boss, 100)
            end,
            skills = {
                {
                    name = "地狱火",
                    interval = 15.0,
                    execute = function(boss, fight)
                        local x, y = GetUnitX(boss), GetUnitY(boss)
                        CreateNUnitsAtLoc(1, 'ninf', GetOwningPlayer(boss), Location(x, y), 0)
                    end
                }
            }
        }
    },
    
    -- 胜利回调
    onVictory = function(self)
        Core.Log("恭喜击败Boss！")
        -- 发放奖励
    end
}
```

### 3.2 复杂Boss配置

```lua
local complexBossConfig = {
    bossId = 'Uwar',  -- 混乱之王
    spawnX = 0,
    spawnY = 0,
    
    phases = {
        -- 阶段1: 普通战斗
        {
            healthPercent = 100,
            onEnter = function(self)
                self:SetInvulnerable(false)
            end,
            skills = {
                {
                    name = "暗影箭",
                    interval = 3.0,
                    execute = function(boss)
                        local target = GetRandomUnit(GetUnitsInRangeOfLocAll(500, GetUnitLoc(boss)))
                        IssueTargetOrder(boss, "shadowstrike", target)
                    end
                },
                {
                    name = "召唤小怪",
                    interval = 20.0,
                    execute = function(boss)
                        for i = 1, 3 do
                            CreateNUnitsAtLoc(1, 'ugho', GetOwningPlayer(boss), GetUnitLoc(boss), 0)
                        end
                    end
                }
            }
        },
        
        -- 阶段2: 狂暴 (50%血量)
        {
            healthPercent = 50,
            onEnter = function(self)
                Core.Log("第二阶段：狂暴！")
                self:SetInvulnerable(true)  -- 短暂无敌
                
                -- 3秒后取消无敌
                Timer.SetTimeout(3.0, function()
                    self:SetInvulnerable(false)
                end)
            end,
            skills = {
                {
                    name = "死亡凋零",
                    interval = 10.0,
                    execute = function(boss)
                        local x, y = GetUnitX(boss), GetUnitY(boss)
                        CreateNUnitsAtLoc(1, 'u000', GetOwningPlayer(boss), Location(x, y), 0)
                    end
                }
            }
        },
        
        -- 阶段3: 濒死 (20%血量)
        {
            healthPercent = 20,
            onEnter = function(self)
                Core.Log("第三阶段：最后的疯狂！")
                -- 全屏AOE警告
                DisplayTimedTextToForce(GetPlayersAll(), 5.0, "|cffff0000警告：Boss即将释放毁灭之触！|r")
            end,
            skills = {
                {
                    name = "毁灭之触",
                    interval = 5.0,
                    execute = function(boss, fight)
                        -- 对所有玩家造成伤害
                        ForGroup(GetUnitsInRectAll(GetWorldBounds()), function()
                            local u = GetEnumUnit()
                            if IsUnitAlly(u, GetOwningPlayer(boss)) == false then
                                UnitDamageTarget(boss, u, 100, true, false, ATTACK_TYPE_CHAOS, DAMAGE_TYPE_NORMAL, WEAPON_TYPE_WHOKNOWS)
                            end
                        end)
                    end
                }
            }
        }
    }
}
```

---

## 4. 使用方法 (Usage)

### 4.1 基本使用

```lua
-- 创建Boss战实例
local BossFight = require("src.systems.boss-fight")
local boss = BossFight.New(bossConfig)

-- 初始化并开始
boss:Init()
```

### 4.2 与对话系统集成

```lua
local Dialogue = require("src.systems.wcc-dialogue")

-- Boss战前对话
Dialogue.Play({
    {speaker = "阿尔萨斯", text = "终于找到你了，恐惧魔王！"},
    {speaker = "梅尔甘尼斯", text = "你以为你能阻止我吗？"}
}, function()
    -- 对话结束后开始Boss战
    local boss = BossFight.New(bossConfig)
    boss:Init()
end)
```

### 4.3 与任务系统集成

```lua
local Quest = require("src.systems.wcc-quest")

-- 创建Boss任务
local bossQuest = Quest.Create({
    title = "击败恐惧魔王",
    description = "在斯坦恩布莱德击败梅尔甘尼斯",
    type = "main"
})

-- Boss战胜利后完成任务
bossConfig.onVictory = function()
    bossQuest:Complete()
    Dialogue.Play({
        {speaker = "系统", text = "任务完成！"}
    })
end
```

---

## 5. 最佳实践 (Best Practices)

### 5.1 阶段设计

- 每个阶段应有明确的机制和技能
- 阶段转换应有视觉和音效反馈
- 避免过于复杂的阶段转换条件

### 5.2 技能设计

- 技能应有明确的施放条件
- 技能应有合理的冷却时间
- 技能应有视觉反馈

### 5.3 性能优化

- 避免在技能中创建大量单位
- 及时清理特效和单位
- 使用对象池管理频繁创建的对象

---

## 6. 常见问题 (FAQ)

### Q: Boss不攻击怎么办？

A: 检查是否正确设置了AI：
```lua
SetUnitCreepGuard(self.boss, true)
IssuePointOrder(self.boss, "attack", targetX, targetY)
```

### Q: 阶段转换不触发？

A: 检查血量百分比是否正确配置：
```lua
-- 确保 phases 数组按血量从高到低排序
phases = {
    {healthPercent = 100, ...},
    {healthPercent = 50, ...},
    {healthPercent = 20, ...}
}
```

---

*本文档由 WCC 项目维护，最后更新: 2026-07-09*
