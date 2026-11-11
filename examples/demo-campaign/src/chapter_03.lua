--[[
    WCC 示例战役 - 第三章：恐惧魔王的城堡
    演示：Boss 阶段机的调用形状 + 结局对话。

    ⚠️ 示例骨架，🔴 未进图：本文件只作 few-shot 样例，不产出 .w3x。
    目标补丁 1.31+ / Lua；本机 War3 1.26 只读保留，不能试玩。

    🔴 刻意不硬编码任何 Boss 四字码：物编 ID 字典覆盖率 0
    （wcc-skill/knowledge/wc3-object-ids.md），任何 rawcode 都必须先核实。
    因此 Start() 走「未核实 → 跳过创建 → 只播结局」的诚实分支，
    绝不臆造 'Nbal' 之类看起来合理的 ID。
]]

local Core = require("src.lib.wcc-core")
local Dialogue = require("src.lib.wcc-dialogue")
local BossFight = require("src.lib.wcc-boss-fight")

local Chapter03 = {}

local boss = nil

--- 由外部注入「已核实的 rawcode」。当前字典未建成，示例阶段恒为 nil。
--- @param verifiedBossId string|nil 必须来自物编 ID 字典 §7 已核实条目
--- @return table|nil BossFight 实例；未核实时返回 nil
function Chapter03.CreateBoss(verifiedBossId)
    if not verifiedBossId then
        Core.Log("第三章示例：bossId 未核实，跳过 Boss 创建（不臆造四字码）")
        return nil
    end

    boss = BossFight.New({
        bossId = verifiedBossId,
        spawnX = 2000,
        spawnY = 3000,
        phases = {
            { healthPercent = 100, onEnter = function() Core.Log("战斗开始！") end },
            { healthPercent = 50, onEnter = function() Core.Log("首领进入狂暴！") end }
        },
        onPhaseChange = function(index)
            Core.Log("阶段切换: " .. tostring(index))
        end,
        onDefeat = function()
            Core.Log("首领已被击败")
            Chapter03.PlayEnding()
        end
    })
    if boss then boss:Start() end
    return boss
end

--- 结局对话
function Chapter03.PlayEnding()
    Dialogue.Play({
        {
            speaker = "乌瑟尔",
            text = "城堡的门开了，那股气息……是恐惧魔王。",
            camera = { x = 2000, y = 3000, distance = 2000, angle = 45, duration = 2.0 }
        },
        {
            speaker = "阿尔萨斯",
            text = "那就在此做个了结。",
            camera = { x = 1000, y = 2000, distance = 1650, angle = 30, duration = 1.0 }
        }
    }, function()
        Core.Log("示例战役结束（未进图）")
    end)
end

--- 开始第三章（需由调用方显式触发）
function Chapter03.Start()
    Core.Log("第三章开始（示例骨架，未进图）")
    -- 真实进图时改为传入已核实的 rawcode；此处显式传 nil 以示「未核实」。
    local created = Chapter03.CreateBoss(nil)
    if not created then Chapter03.PlayEnding() end
end

--- @return table|nil 当前 Boss 实例
function Chapter03.GetBoss()
    return boss
end

return Chapter03
