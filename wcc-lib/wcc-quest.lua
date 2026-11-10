--[[
    Warcraft Campaign Craft (WCC) - Quest System
    任务追踪系统，支持主线/支线、状态管理、任务面板同步。
    
    功能:
    - 任务创建与管理
    - 主线/支线类型
    - 状态切换（未发现、进行中、完成、失败）
    - 任务面板自动同步
    
    作者: 艾泽拉斯织码者
    版本: 1.0.0
]]

local Core = require("src.lib.wcc-core")

local WCC_Quest = {}

-- 版本号
WCC_Quest.VERSION = "1.0.0"

-- ==========================================
-- 常量定义
-- ==========================================

-- 任务类型
WCC_Quest.TYPE_MAIN = "main"       -- 主线任务
WCC_Quest.TYPE_SIDE = "side"       -- 支线任务
WCC_Quest.TYPE_HIDDEN = "hidden"   -- 隐藏任务

-- 任务状态
WCC_Quest.STATUS_HIDDEN = 0        -- 未发现
WCC_Quest.STATUS_DISCOVERED = 1    -- 已发现
WCC_Quest.STATUS_IN_PROGRESS = 2   -- 进行中
WCC_Quest.STATUS_COMPLETED = 3     -- 已完成
WCC_Quest.STATUS_FAILED = 4        -- 已失败

-- ==========================================
-- 任务存储
-- ==========================================

local quests = {}  -- 所有任务
local questLog = {} -- 任务日志

-- ==========================================
-- 任务创建
-- ==========================================

--- 创建新任务
--- @param config table 任务配置
--- @return table 任务对象
function WCC_Quest.Create(config)
    if not config or not config.id then
        Core.LogError("WCC_Quest.Create: 缺少任务ID")
        return nil
    end
    
    -- 检查是否已存在
    if quests[config.id] then
        Core.LogWarning("WCC_Quest.Create: 任务已存在 - " .. config.id)
        return quests[config.id]
    end
    
    -- 创建任务对象
    local quest = {
        id = config.id,
        title = config.title or "未命名任务",
        description = config.description or "",
        type = config.type or WCC_Quest.TYPE_SIDE,
        status = WCC_Quest.STATUS_HIDDEN,
        
        -- 目标
        objectives = config.objectives or {},
        
        -- 奖励
        rewards = config.rewards or {},
        
        -- 回调
        onDiscover = config.onDiscover,
        onStart = config.onStart,
        onComplete = config.onComplete,
        onFail = config.onFail,
        
        -- 原生任务句柄
        questHandle = nil,
        
        -- 方法
        Discover = function(self) WCC_Quest.Discover(self) end,
        Start = function(self) WCC_Quest.Start(self) end,
        Complete = function(self) WCC_Quest.Complete(self) end,
        Fail = function(self) WCC_Quest.Fail(self) end,
        UpdateObjective = function(self, index, completed) 
            WCC_Quest.UpdateObjective(self, index, completed) 
        end,
        GetStatus = function(self) return self.status end,
        IsCompleted = function(self) return self.status == WCC_Quest.STATUS_COMPLETED end
    }
    
    -- 存储任务
    quests[config.id] = quest
    
    Core.Log("任务创建: " .. quest.title)
    
    return quest
end

-- ==========================================
-- 任务状态管理
-- ==========================================

--- 发现任务
--- @param quest table 任务对象
function WCC_Quest.Discover(quest)
    if quest.status ~= WCC_Quest.STATUS_HIDDEN then
        return
    end
    
    quest.status = WCC_Quest.STATUS_DISCOVERED
    
    -- 创建原生任务
    WCC_Quest.CreateNativeQuest(quest)
    
    -- 显示发现提示
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 5.0, 
        "|cffffcc00新任务发现:|r " .. quest.title)
    
    -- 执行回调
    if quest.onDiscover then
        Core.SafeExecute(quest.onDiscover, quest)
    end
    
    Core.Log("任务发现: " .. quest.title)
end

--- 开始任务
--- @param quest table 任务对象
function WCC_Quest.Start(quest)
    if quest.status ~= WCC_Quest.STATUS_DISCOVERED then
        return
    end
    
    quest.status = WCC_Quest.STATUS_IN_PROGRESS
    
    -- 更新原生任务
    WCC_Quest.UpdateNativeQuest(quest)
    
    -- 显示开始提示
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 5.0, 
        "|cff00ff00任务开始:|r " .. quest.title)
    
    -- 执行回调
    if quest.onStart then
        Core.SafeExecute(quest.onStart, quest)
    end
    
    Core.Log("任务开始: " .. quest.title)
end

--- 完成任务
--- @param quest table 任务对象
function WCC_Quest.Complete(quest)
    if quest.status ~= WCC_Quest.STATUS_IN_PROGRESS then
        return
    end
    
    quest.status = WCC_Quest.STATUS_COMPLETED
    
    -- 更新原生任务
    WCC_Quest.UpdateNativeQuest(quest)
    
    -- 显示完成提示
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 10.0, 
        "|cffffcc00任务完成:|r " .. quest.title)
    
    -- 显示奖励
    if quest.rewards then
        for _, reward in ipairs(quest.rewards) do
            DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 10.0, 
                "|cff00ff00奖励:|r " .. reward)
        end
    end
    
    -- 执行回调
    if quest.onComplete then
        Core.SafeExecute(quest.onComplete, quest)
    end
    
    Core.Log("任务完成: " .. quest.title)
end

--- 任务失败
--- @param quest table 任务对象
function WCC_Quest.Fail(quest)
    if quest.status ~= WCC_Quest.STATUS_IN_PROGRESS then
        return
    end
    
    quest.status = WCC_Quest.STATUS_FAILED
    
    -- 更新原生任务
    WCC_Quest.UpdateNativeQuest(quest)
    
    -- 显示失败提示
    DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, 10.0, 
        "|cffff0000任务失败:|r " .. quest.title)
    
    -- 执行回调
    if quest.onFail then
        Core.SafeExecute(quest.onFail, quest)
    end
    
    Core.Log("任务失败: " .. quest.title)
end

-- ==========================================
-- 任务目标管理
-- ==========================================

--- 更新任务目标
--- @param quest table 任务对象
--- @param index number 目标索引
--- @param completed boolean 是否完成
function WCC_Quest.UpdateObjective(quest, index, completed)
    if not quest.objectives or not quest.objectives[index] then
        Core.LogWarning("WCC_Quest.UpdateObjective: 目标不存在")
        return
    end
    
    local objective = quest.objectives[index]
    objective.completed = completed
    
    -- 检查是否所有目标都完成
    local allCompleted = true
    for _, obj in ipairs(quest.objectives) do
        if not obj.completed then
            allCompleted = false
            break
        end
    end
    
    -- 如果所有目标完成，自动完成任务
    if allCompleted and quest.status == WCC_Quest.STATUS_IN_PROGRESS then
        WCC_Quest.Complete(quest)
    end
    
    -- 更新原生任务
    WCC_Quest.UpdateNativeQuest(quest)
    
    Core.Log("任务目标更新: " .. quest.title .. " - 目标 " .. index)
end

-- ==========================================
-- 原生任务管理
-- ==========================================

--- 创建原生任务
--- @param quest table 任务对象
function WCC_Quest.CreateNativeQuest(quest)
    -- 创建任务
    quest.questHandle = CreateQuest()
    
    -- 设置任务类型
    if quest.type == WCC_Quest.TYPE_MAIN then
        QuestSetType(quest.questHandle, bj_QUESTTYPE_REQ_DISCOVERED)
    else
        QuestSetType(quest.questHandle, bj_QUESTTYPE_OPT_DISCOVERED)
    end
    
    -- 设置任务标题
    QuestSetTitle(quest.questHandle, quest.title)
    
    -- 设置任务描述
    QuestSetDescription(quest.questHandle, quest.description)
    
    -- 添加任务目标
    for i, objective in ipairs(quest.objectives) do
        QuestItemCreate(quest.questHandle, objective.text)
    end
    
    -- 显示任务
    QuestSetEnabled(quest.questHandle, true)
end

--- 更新原生任务
--- @param quest table 任务对象
function WCC_Quest.UpdateNativeQuest(quest)
    if not quest.questHandle then
        return
    end
    
    -- 更新任务目标状态
    local questItems = QuestGetItems(quest.questHandle)
    for i, item in ipairs(questItems) do
        if quest.objectives[i] then
            QuestItemSetCompleted(item, quest.objectives[i].completed)
        end
    end
    
    -- 如果任务完成，标记为已完成
    if quest.status == WCC_Quest.STATUS_COMPLETED then
        QuestSetCompleted(quest.questHandle, true)
    elseif quest.status == WCC_Quest.STATUS_FAILED then
        QuestSetFailed(quest.questHandle, true)
    end
end

-- ==========================================
-- 查询功能
-- ==========================================

--- 获取任务
--- @param questId string 任务ID
--- @return table|nil 任务对象
function WCC_Quest.Get(questId)
    return quests[questId]
end

--- 获取所有任务
--- @return table 所有任务
function WCC_Quest.GetAll()
    return quests
end

--- 获取指定状态的任务
--- @param status number 任务状态
--- @return table 任务列表
function WCC_Quest.GetByStatus(status)
    local result = {}
    for _, quest in pairs(quests) do
        if quest.status == status then
            table.insert(result, quest)
        end
    end
    return result
end

--- 获取进行中的任务数量
--- @return number 任务数量
function WCC_Quest.GetInProgressCount()
    local count = 0
    for _, quest in pairs(quests) do
        if quest.status == WCC_Quest.STATUS_IN_PROGRESS then
            count = count + 1
        end
    end
    return count
end

-- ==========================================
-- 工具函数
-- ==========================================

--- 打印所有任务状态
function WCC_Quest.PrintStatus()
    Core.Log("=== 任务状态 ===")
    for id, quest in pairs(quests) do
        local statusText = "未知"
        if quest.status == WCC_Quest.STATUS_HIDDEN then
            statusText = "未发现"
        elseif quest.status == WCC_Quest.STATUS_DISCOVERED then
            statusText = "已发现"
        elseif quest.status == WCC_Quest.STATUS_IN_PROGRESS then
            statusText = "进行中"
        elseif quest.status == WCC_Quest.STATUS_COMPLETED then
            statusText = "已完成"
        elseif quest.status == WCC_Quest.STATUS_FAILED then
            statusText = "已失败"
        end
        
        Core.Log(quest.title .. " [" .. statusText .. "]")
    end
end

--- 清空所有任务
function WCC_Quest.Clear()
    for _, quest in pairs(quests) do
        if quest.questHandle then
            DestroyQuest(quest.questHandle)
        end
    end
    quests = {}
    Core.Log("所有任务已清空")
end

return WCC_Quest
