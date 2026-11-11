--[[
    WCC 示例战役 - 第二章：村庄外围
    演示：支线任务、刷怪池、计时器延迟回调。

    ⚠️ 示例骨架，🔴 未进图：本文件只作 few-shot 样例，不产出 .w3x。
    目标补丁 1.31+ / Lua；本机 War3 1.26 只读保留，不能试玩。
    DEMO_UNIT_ID 是「未核实示例值」，真实进图前必须用物编 ID 字典核实：
    wcc-skill/knowledge/wc3-object-ids.md（当前覆盖率 0，🔴 不可用）。
]]

local Core = require("src.lib.wcc-core")
local Quest = require("src.lib.wcc-quest")
local Spawner = require("src.lib.wcc-spawner")
local Timer = require("src.lib.wcc-timer")

local Chapter02 = {}

local holdQuest = nil
local pools = {}
local hintTimer = nil

-- 与 tables-sample.json 一致的示例值；未核实，不可直接抄进真实战役。
local DEMO_UNIT_ID = "ugho"

--- 开始第二章（需由调用方显式触发）
function Chapter02.Start()
    Core.Log("第二章开始（示例）")
    Chapter02.CreateSideQuest()
    Chapter02.SetupWaves()
end

--- 创建支线任务
function Chapter02.CreateSideQuest()
    holdQuest = Quest.Create({
        id = "hold_the_roads",
        title = "守住路口",
        description = "挡住村庄外围的两波亡灵。",
        type = Quest.TYPE_SIDE,
        objectives = {
            { text = "守住东侧路口", completed = false },
            { text = "守住北侧路口", completed = false }
        },
        rewards = { "经验值: 300" },
        onComplete = function()
            Core.Log("支线完成：守住路口")
            Chapter02.StopWaves()
        end
    })

    if holdQuest then
        holdQuest:Discover()
        holdQuest:Start()
    end
end

--- 布置两路刷怪池 + 一个延迟提示（用计时器，不用 Wait / TriggerSleepAction / PolledWait）
function Chapter02.SetupWaves()
    pools.east = Spawner.Create({
        id = "ch2_wave_a",
        unitId = DEMO_UNIT_ID,
        x = 1600, y = 2400,
        targetX = 1000, targetY = 2000,
        count = 6, interval = 25.0, waves = 2
    })
    pools.north = Spawner.Create({
        id = "ch2_wave_b",
        unitId = DEMO_UNIT_ID,
        x = 2000, y = 2800,
        targetX = 1000, targetY = 2000,
        count = 8, interval = 20.0, waves = 3
    })

    for _, pool in pairs(pools) do
        if pool then Spawner.Start(pool) end
    end

    hintTimer = Timer.SetTimeout(90.0, function()
        Core.Log("第二章示例：90 秒战术提示")
    end)
end

--- 任务完成后收尾：停刷怪池、清计时器（避免遗留句柄）
function Chapter02.StopWaves()
    for _, pool in pairs(pools) do
        if pool then Spawner.Stop(pool) end
    end
    if hintTimer then
        Timer.Clear(hintTimer)
        hintTimer = nil
    end
end

--- @return table|nil 当前支线任务
function Chapter02.GetQuest()
    return holdQuest
end

return Chapter02
