--[[
    WCC 示例战役 - 第一章
    演示对话系统、任务系统的基本用法
]]

local Core = require("src.lib.wcc-core")
local Dialogue = require("src.lib.wcc-dialogue")
local Quest = require("src.lib.wcc-quest")

local Chapter01 = {}

-- 任务定义
local rescueVillagersQuest = nil

--- 开始第一章
function Chapter01.Start()
    Core.Log("第一章开始")
    
    -- 播放开场对话
    Chapter01.PlayIntroDialogue()
end

--- 播放开场对话
function Chapter01.PlayIntroDialogue()
    Dialogue.Play({
        {
            speaker = "阿尔萨斯",
            text = "我们终于到了，斯坦恩布莱德。",
            camera = {
                x = 1000,
                y = 2000,
                distance = 1650,
                angle = 30,
                duration = 2.0
            }
        },
        {
            speaker = "乌瑟尔",
            text = "保持警惕，王子殿下。这里到处都是亡灵的踪迹。",
            camera = {
                x = 1200,
                y = 2200,
                distance = 1650,
                angle = 30,
                duration = 1.5
            }
        },
        {
            speaker = "阿尔萨斯",
            text = "我知道该怎么做，乌瑟尔。让我们先拯救被困的村民。",
            camera = {
                x = 1000,
                y = 2000,
                distance = 1650,
                angle = 30,
                duration = 1.0
            }
        }
    }, function()
        -- 对话结束后创建任务
        Chapter01.CreateRescueQuest()
    end)
end

--- 创建拯救村民任务
function Chapter01.CreateRescueQuest()
    rescueVillagersQuest = Quest.Create({
        id = "rescue_villagers",
        title = "拯救村民",
        description = "消灭攻击村庄的亡灵，拯救被困的村民。",
        type = Quest.TYPE_MAIN,
        objectives = {
            {text = "消灭亡灵入侵者", completed = false},
            {text = "拯救被困村民 (0/5)", completed = false}
        },
        rewards = {
            "经验值: 500",
            "金币: 100"
        },
        onDiscover = function()
            Core.Log("任务发现：拯救村民")
        end,
        onStart = function()
            Core.Log("任务开始：拯救村民")
            -- 这里可以触发刷怪等逻辑
        end,
        onComplete = function()
            Core.Log("任务完成：拯救村民")
            -- 播放完成对话
            Chapter01.PlayCompleteDialogue()
        end
    })
    
    -- 发现并开始任务
    if rescueVillagersQuest then
        rescueVillagersQuest:Discover()
        rescueVillagersQuest:Start()
    end
end

--- 播放完成对话
function Chapter01.PlayCompleteDialogue()
    Dialogue.Play({
        {
            speaker = "村民",
            text = "谢谢你，勇士！你救了我们！",
            camera = {
                x = 1000,
                y = 2000,
                distance = 1650,
                angle = 30,
                duration = 1.0
            }
        },
        {
            speaker = "阿尔萨斯",
            text = "这是我的职责。现在，告诉我发生了什么？",
            camera = {
                x = 1000,
                y = 2000,
                distance = 1650,
                angle = 30,
                duration = 1.0
            }
        },
        {
            speaker = "村民",
            text = "一个恐惧魔王出现在北方的城堡里，他召唤了这些亡灵。",
            camera = {
                x = 2000,
                y = 3000,
                distance = 2000,
                angle = 45,
                duration = 2.0
            }
        },
        {
            speaker = "阿尔萨斯",
            text = "我明白了。乌瑟尔，准备战斗。我们要去会会这个恐惧魔王。",
            camera = {
                x = 1000,
                y = 2000,
                distance = 1650,
                angle = 30,
                duration = 1.0
            }
        }
    }, function()
        Core.Log("第一章结束")
        -- 这里可以触发下一章或显示胜利画面
    end)
end

--- 更新任务目标
--- @param objectiveIndex number 目标索引
--- @param completed boolean 是否完成
function Chapter01.UpdateObjective(objectiveIndex, completed)
    if rescueVillagersQuest then
        rescueVillagersQuest:UpdateObjective(objectiveIndex, completed)
    end
end

--- 获取任务对象
--- @return table|nil 任务对象
function Chapter01.GetQuest()
    return rescueVillagersQuest
end

return Chapter01
