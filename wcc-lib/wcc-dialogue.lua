--[[
    Warcraft Campaign Craft (WCC) - Dialogue System
    对话与过场系统，支持多句台词、电影模式、镜头控制、跳过功能。
    
    功能:
    - 多句台词按顺序播放
    - 电影模式开关
    - 镜头平滑移动
    - 跳过功能
    
    作者: 艾泽拉斯织码者
    版本: 1.0.0
]]

local Core = require("src.lib.wcc-core")

local WCC_Dialogue = {}

-- 版本号
WCC_Dialogue.VERSION = "1.0.0"

-- ==========================================
-- 状态管理
-- ==========================================

local state = {
    isPlaying = false,
    currentSequence = nil,
    currentIndex = 0,
    skipRequested = false,
    player = GetLocalPlayer(),
    skipTrig = nil
}

-- 配置
local config = {
    textSpeed = 0.05,       -- 每个字符显示时间
    autoAdvance = false,    -- 自动推进
    autoAdvanceDelay = 3.0, -- 自动推进延迟
    cameraTransition = 2.0, -- 镜头过渡时间
    fadeTime = 1.0          -- 淡入淡出时间
}

-- ==========================================
-- 初始化
-- ==========================================

--- 初始化对话系统
function WCC_Dialogue.Init()
    Core.Log("对话系统初始化")
    WCC_Dialogue.RegisterSkipEvent()
end

-- ==========================================
-- 核心功能
-- ==========================================

--- 播放对话序列
--- @param sequence table 对话序列
--- @param callback function 完成回调
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
    
    -- 进入电影模式
    WCC_Dialogue.EnterCinematicMode()
    
    -- 播放第一句
    WCC_Dialogue.PlayNext(callback)
end

--- 播放下一句
--- @param callback function 完成回调
function WCC_Dialogue.PlayNext(callback)
    state.currentIndex = state.currentIndex + 1
    
    if state.currentIndex > #state.currentSequence then
        -- 对话结束
        WCC_Dialogue.End(callback)
        return
    end
    
    local line = state.currentSequence[state.currentIndex]
    
    -- 设置镜头
    if line.camera then
        WCC_Dialogue.MoveCamera(line.camera)
    end
    
    -- 显示对话
    WCC_Dialogue.ShowLine(line, function()
        if state.skipRequested then
            return
        end
        
        -- 等待玩家输入或自动推进
        if config.autoAdvance then
            WCC_Dialogue.CreateTimer(config.autoAdvanceDelay, function()
                WCC_Dialogue.PlayNext(callback)
            end)
        else
            WCC_Dialogue.WaitForInput(callback)
        end
    end)
end

--- 显示一行对话
--- @param line table 对话行
--- @param callback function 完成回调
function WCC_Dialogue.ShowLine(line, callback)
    local speaker = line.speaker or ""
    local text = line.text or ""
    
    -- 显示说话者名字
    if speaker ~= "" then
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, "|cffffcc00" .. speaker .. "|r")
    end
    
    -- 逐字显示文本
    WCC_Dialogue.TypewriterEffect(text, function()
        if state.skipRequested then
            return
        end
        
        -- 显示继续提示
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, "|cff888888[点击继续]|r")
        
        if callback then
            callback()
        end
    end)
end

--- 打字机效果
--- @param text string 文本
--- @param callback function 完成回调
function WCC_Dialogue.TypewriterEffect(text, callback)
    if state.skipRequested then
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, text)
        if callback then callback() end
        return
    end
    
    local displayed = ""
    local index = 0
    local length = string.len(text)
    
    local timer = CreateTimer()
    TimerStart(timer, config.textSpeed, true, function()
        if state.skipRequested then
            DestroyTimer(timer)
            DisplayTimedTextToPlayer(state.player, 0, 0, 999, text)
            if callback then callback() end
            return
        end
        
        index = index + 1
        if index > length then
            DestroyTimer(timer)
            if callback then callback() end
            return
        end
        
        displayed = displayed .. string.sub(text, index, index)
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, displayed)
    end)
end

--- 等待玩家输入
--- @param callback function 回调
function WCC_Dialogue.WaitForInput(callback)
    if state.skipRequested then
        if callback then callback() end
        return
    end
    
    local trig = CreateTrigger()
    
    -- 注册鼠标点击事件
    for i = 0, 15 do
        TriggerRegisterPlayerEvent(trig, Player(i), EVENT_PLAYER_MOUSE_DOWN)
    end
    
    TriggerAddAction(trig, function()
        DestroyTrigger(trig)
        if callback and not state.skipRequested then
            callback()
        end
    end)
end

-- ==========================================
-- 电影模式控制
-- ==========================================

--- 进入电影模式
function WCC_Dialogue.EnterCinematicMode()
    CinematicModeBJ(true, GetPlayersAll())
    ShowInterface(false, 0)
    CinematicFadeBJ(bj_CINEFADETYPE_FADEIN, config.fadeTime, 
        "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
end

--- 退出电影模式
function WCC_Dialogue.ExitCinematicMode()
    CinematicFadeBJ(bj_CINEFADETYPE_FADEOUT, config.fadeTime, 
        "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
    
    local timer = CreateTimer()
    TimerStart(timer, config.fadeTime, false, function()
        ShowInterface(true, 0)
        CinematicModeBJ(false, GetPlayersAll())
        DestroyTimer(timer)
    end)
end

--- 移动镜头
--- @param camera table 镜头配置
function WCC_Dialogue.MoveCamera(camera)
    local x = camera.x or 0
    local y = camera.y or 0
    local distance = camera.distance or 1650
    local angle = camera.angle or 30
    local rotation = camera.rotation or 0
    local fov = camera.fov or 70
    local duration = camera.duration or config.cameraTransition
    
    PanCameraToTimedLocForPlayer(state.player, Location(x, y), duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_TARGET_DISTANCE, distance, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ANGLE_OF_ATTACK, angle, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ROTATION, rotation, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_FIELD_OF_VIEW, fov, duration)
end

-- ==========================================
-- 跳过功能
-- ==========================================

--- 注册跳过事件
function WCC_Dialogue.RegisterSkipEvent()
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

--- 跳过对话
function WCC_Dialogue.Skip()
    if not state.isPlaying then
        return
    end
    
    Core.Log("跳过对话")
    
    -- 快速显示所有剩余文本
    for i = state.currentIndex, #state.currentSequence do
        local line = state.currentSequence[i]
        DisplayTimedTextToPlayer(state.player, 0, 0, 10, 
            "|cffffcc00" .. (line.speaker or "") .. "|r\n" .. (line.text or ""))
    end
    
    -- 结束对话
    WCC_Dialogue.End()
end

-- ==========================================
-- 结束对话
-- ==========================================

--- 结束对话
--- @param callback function 完成回调
function WCC_Dialogue.End(callback)
    state.isPlaying = false
    state.currentSequence = nil
    state.currentIndex = 0
    state.skipRequested = false
    
    WCC_Dialogue.ExitCinematicMode()
    
    Core.Log("对话结束")
    
    if callback then
        local timer = CreateTimer()
        TimerStart(timer, config.fadeTime + 0.1, false, function()
            DestroyTimer(timer)
            callback()
        end)
    end
end

-- ==========================================
-- 工具函数
-- ==========================================

--- 获取播放状态
--- @return boolean 是否正在播放
function WCC_Dialogue.IsPlaying()
    return state.isPlaying
end

--- 设置配置
--- @param newConfig table 新配置
function WCC_Dialogue.SetConfig(newConfig)
    for k, v in pairs(newConfig) do
        config[k] = v
    end
end

--- 创建安全计时器
--- @param timeout number 超时时间
--- @param callback function 回调
function WCC_Dialogue.CreateTimer(timeout, callback)
    local timer = CreateTimer()
    TimerStart(timer, timeout, false, function()
        DestroyTimer(timer)
        if callback and not state.skipRequested then
            callback()
        end
    end)
end

return WCC_Dialogue
