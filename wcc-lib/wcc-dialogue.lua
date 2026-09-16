--[[
    Warcraft Campaign Craft (WCC) - Dialogue System
    对话与过场：电影模式、镜头、打字机、跳过。

    修复 (v1.0.1):
    - MoveCamera 使用共享 Location 复用，禁止每次新建泄漏
    - 不在模块加载时缓存 GetLocalPlayer；跳过/推进用全玩家同步事件，避免本地状态 desync
    - 中文打字机按 UTF-8 字符步进（不是按字节）
]]
local Core = require("src.lib.wcc-core")
local Timer = require("src.lib.wcc-timer")

local WCC_Dialogue = {}
WCC_Dialogue.VERSION = "1.0.1"

local state = {
    isPlaying = false,
    currentSequence = nil,
    currentIndex = 0,
    skipRequested = false,
    skipTrig = nil,
    advanceTrig = nil,
    typewriterTimer = nil,
}

local config = {
    textSpeed = 0.05,
    autoAdvance = false,
    autoAdvanceDelay = 3.0,
    cameraTransition = 2.0,
    fadeTime = 1.0,
    useLocalDisplay = true, -- 仅显示用；逻辑状态仍全同步
}

-- 共享镜头 Location（复用，避免泄漏）
local camLoc = nil

local function ensureCamLoc(x, y)
    if camLoc == nil then
        camLoc = Core.SafeCreateLocation(x or 0, y or 0)
    else
        MoveLocation(camLoc, x or 0, y or 0)
    end
    return camLoc
end

local function localDisplay(msg, duration)
    if config.useLocalDisplay then
        DisplayTimedTextToPlayer(GetLocalPlayer(), 0, 0, duration or 10.0, msg)
    else
        DisplayTextToForce(GetPlayersAll(), msg)
    end
end

--- UTF-8 字符切片：按码点而非字节
local function utf8Chars(s)
    local t = {}
    local i = 1
    local n = #s
    while i <= n do
        local c = s:byte(i)
        local len = 1
        if c >= 0xF0 then len = 4
        elseif c >= 0xE0 then len = 3
        elseif c >= 0xC0 then len = 2
        end
        if i + len - 1 > n then len = 1 end
        t[#t + 1] = s:sub(i, i + len - 1)
        i = i + len
    end
    return t
end

function WCC_Dialogue.Init()
    camLoc = Core.SafeCreateLocation(0, 0)
    WCC_Dialogue.RegisterSkipEvent()
    WCC_Dialogue.RegisterAdvanceEvent()
    Core.Log("对话系统 v" .. WCC_Dialogue.VERSION .. " 初始化")
end

function WCC_Dialogue.Play(sequence, callback)
    if state.isPlaying then
        Core.LogWarning("对话正在播放中")
        return
    end
    if not sequence or #sequence == 0 then
        Core.LogWarning("对话序列为空")
        if callback then callback() end
        return
    end

    state.isPlaying = true
    state.currentSequence = sequence
    state.currentIndex = 0
    state.skipRequested = false
    if camLoc == nil then camLoc = Core.SafeCreateLocation(0, 0) end

    WCC_Dialogue.EnterCinematicMode()
    WCC_Dialogue.PlayNext(callback)
end

function WCC_Dialogue.PlayNext(callback)
    state.currentIndex = state.currentIndex + 1

    if state.currentIndex > #state.currentSequence then
        WCC_Dialogue.End(callback)
        return
    end

    local line = state.currentSequence[state.currentIndex]
    if line.camera then
        WCC_Dialogue.MoveCamera(line.camera)
    end

    WCC_Dialogue.ShowLine(line, function()
        if state.skipRequested then return end
        if config.autoAdvance then
            Timer.SetTimeout(config.autoAdvanceDelay, function()
                WCC_Dialogue.PlayNext(callback)
            end)
        else
            -- 等待全玩家同步的「继续」事件（非仅本地鼠标）
        end
    end)
end

function WCC_Dialogue.ShowLine(line, callback)
    local speaker = line.speaker or ""
    local text = line.text or ""

    if speaker ~= "" then
        localDisplay("|cffffcc00" .. speaker .. "|r", 999)
    end

    WCC_Dialogue.TypewriterEffect(text, function()
        if state.skipRequested then return end
        localDisplay("|cff888888[按 ESC 跳过 / 点击继续]|r", 999)
        state._lineDoneCallback = callback
        if config.autoAdvance and callback then
            Timer.SetTimeout(config.autoAdvanceDelay, function()
                if state._lineDoneCallback == callback then
                    state._lineDoneCallback = nil
                    callback()
                end
            end)
        end
    end)
end

function WCC_Dialogue.TypewriterEffect(text, callback)
    if state.skipRequested then
        localDisplay(text, 999)
        if callback then callback() end
        return
    end

    local chars = utf8Chars(text)
    local count = #chars
    local index = 0

    if state.typewriterTimer then
        Timer.Clear(state.typewriterTimer)
        state.typewriterTimer = nil
    end

    state.typewriterTimer = Timer.SetInterval(config.textSpeed, function()
        if state.skipRequested then
            localDisplay(text, 999)
            state.typewriterTimer = nil
            if callback then callback() end
            return true
        end

        index = index + 1
        if index > count then
            state.typewriterTimer = nil
            if callback then callback() end
            return true
        end

        local shown = ""
        for i = 1, index do
            shown = shown .. chars[i]
        end
        localDisplay(shown, 999)
        return false
    end)
end

--- 推进（全玩家事件，避免本地鼠标推进共享状态导致 desync）
function WCC_Dialogue.Advance()
    if not state.isPlaying then return end
    if state._lineDoneCallback then
        local cb = state._lineDoneCallback
        state._lineDoneCallback = nil
        cb()
        return
    end
    -- 若打字机未完成则跳过整段
    WCC_Dialogue.Skip()
end

function WCC_Dialogue.RegisterAdvanceEvent()
    if state.advanceTrig then return end
    state.advanceTrig = CreateTrigger()
    for i = 0, 15 do
        -- 全玩家同步的任意聊天/按键类推进：用 ESC（End Cinematic）统一
        TriggerRegisterPlayerEvent(state.advanceTrig, Player(i), EVENT_PLAYER_END_CINEMATIC)
    end
    TriggerAddAction(state.advanceTrig, function()
        if state.isPlaying then
            WCC_Dialogue.Advance()
        end
    end)
end

function WCC_Dialogue.EnterCinematicMode()
    CinematicModeBJ(true, GetPlayersAll())
    ShowInterface(false, 0)
    CinematicFadeBJ(bj_CINEFADETYPE_FADEIN, config.fadeTime,
        "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
end

function WCC_Dialogue.ExitCinematicMode()
    CinematicFadeBJ(bj_CINEFADETYPE_FADEOUT, config.fadeTime,
        "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
    Timer.SetTimeout(config.fadeTime, function()
        ShowInterface(true, 0)
        CinematicModeBJ(false, GetPlayersAll())
    end)
end

--- 镜头：对全玩家生效；Location 复用 camLoc
function WCC_Dialogue.MoveCamera(camera)
    local x = camera.x or 0
    local y = camera.y or 0
    local distance = camera.distance or 1650
    local angle = camera.angle or 30
    local rotation = camera.rotation or 0
    local fov = camera.fov or 70
    local duration = camera.duration or config.cameraTransition

    local loc = ensureCamLoc(x, y)
    PanCameraToTimedLocForPlayer(GetLocalPlayer(), loc, duration)
    -- 注意：多人需各玩家自算；战役单人可对 local 仅镜头
    for i = 0, 15 do
        local p = Player(i)
        if GetPlayerSlotState(p) == PLAYER_SLOT_STATE_PLAYING then
            SetCameraFieldForPlayer(p, CAMERA_FIELD_TARGET_DISTANCE, distance, duration)
            SetCameraFieldForPlayer(p, CAMERA_FIELD_ANGLE_OF_ATTACK, angle, duration)
            SetCameraFieldForPlayer(p, CAMERA_FIELD_ROTATION, rotation, duration)
            SetCameraFieldForPlayer(p, CAMERA_FIELD_FIELD_OF_VIEW, fov, duration)
        end
    end
end

function WCC_Dialogue.RegisterSkipEvent()
    if state.skipTrig then return end
    state.skipTrig = CreateTrigger()
    for i = 0, 15 do
        TriggerRegisterPlayerEvent(state.skipTrig, Player(i), EVENT_PLAYER_END_CINEMATIC)
    end
    TriggerAddAction(state.skipTrig, function()
        if state.isPlaying then
            state.skipRequested = true
            WCC_Dialogue.Skip()
        end
    end)
end

function WCC_Dialogue.Skip()
    if not state.isPlaying then return end
    Core.Log("跳过对话")
    state.skipRequested = true
    if state.typewriterTimer then
        Timer.Clear(state.typewriterTimer)
        state.typewriterTimer = nil
    end
    for i = state.currentIndex, #state.currentSequence do
        local line = state.currentSequence[i]
        localDisplay("|cffffcc00" .. (line.speaker or "") .. "|r\n" .. (line.text or ""), 10)
    end
    WCC_Dialogue.End()
end

function WCC_Dialogue.End(callback)
    state.isPlaying = false
    state.currentSequence = nil
    state.currentIndex = 0
    state.skipRequested = false
    state._lineDoneCallback = nil
    if state.typewriterTimer then
        Timer.Clear(state.typewriterTimer)
        state.typewriterTimer = nil
    end
    WCC_Dialogue.ExitCinematicMode()
    Core.Log("对话结束")
    if callback then
        Timer.SetTimeout(config.fadeTime + 0.1, function()
            callback()
        end)
    end
end

function WCC_Dialogue.IsPlaying()
    return state.isPlaying
end

function WCC_Dialogue.SetConfig(newConfig)
    for k, v in pairs(newConfig) do
        config[k] = v
    end
end

function WCC_Dialogue.Destroy()
    if state.skipTrig then
        DestroyTrigger(state.skipTrig)
        state.skipTrig = nil
    end
    if state.advanceTrig then
        DestroyTrigger(state.advanceTrig)
        state.advanceTrig = nil
    end
    if camLoc then
        Core.SafeRemoveLocation(camLoc)
        camLoc = nil
    end
end

return WCC_Dialogue
