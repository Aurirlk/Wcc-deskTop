---
id: patterns-task-dialogue-sequence
mode: manual
keywords: 对话,过场,cinematic
priority: 30
---
# 对话序列模式模板 (Dialogue Sequence Pattern)

> 本文档定义了魔兽争霸3对话与过场系统的标准实现模式。

---

## 1. 模式概述 (Pattern Overview)

### 1.1 设计目标

- 支持多句台词按顺序播放
- 支持电影模式（Cinematic Mode）
- 支持镜头平滑移动
- 支持"跳过"功能
- 防止内存泄漏

### 1.2 核心组件

```
DialogueSystem
├── Sequence Manager (序列管理器)
├── Cinematic Controller (电影控制器)
├── Camera Manager (镜头管理器)
└── Input Handler (输入处理器)
```

---

## 2. 基础实现 (Basic Implementation)

### 2.1 Dialogue 模块

```lua
--[[
    对话与过场系统
    支持多句台词、电影模式、镜头控制、跳过功能
]]

local Core = require("src.lib.wcc-core")
local Timer = require("src.lib.wcc-timer")
local Logger = require("src.lib.wcc-logger")

local Dialogue = {}

-- 状态管理
local state = {
    isPlaying = false,
    currentSequence = nil,
    currentIndex = 0,
    skipRequested = false,
    player = GetLocalPlayer()
}

-- 配置
local config = {
    textSpeed = 0.05,      -- 每个字符显示时间
    autoAdvance = false,    -- 自动推进
    autoAdvanceDelay = 3.0, -- 自动推进延迟
    cameraTransition = 2.0, -- 镜头过渡时间
    fadeTime = 1.0          -- 淡入淡出时间
}

--- 初始化对话系统
function Dialogue.Init()
    Logger.Log("对话系统初始化")
    
    -- 注册跳过事件
    Dialogue.RegisterSkipEvent()
end

--- 播放对话序列
--- @param sequence table 对话序列
--- @param callback function 完成回调
function Dialogue.Play(sequence, callback)
    if state.isPlaying then
        Logger.LogWarning("对话正在播放中")
        return
    end
    
    state.isPlaying = true
    state.currentSequence = sequence
    state.currentIndex = 0
    state.skipRequested = false
    
    -- 进入电影模式
    Dialogue.EnterCinematicMode()
    
    -- 播放第一句
    Dialogue.PlayNext(callback)
end

--- 播放下一句
--- @param callback function 完成回调
function Dialogue.PlayNext(callback)
    state.currentIndex = state.currentIndex + 1
    
    if state.currentIndex > #state.currentSequence then
        -- 对话结束
        Dialogue.End(callback)
        return
    end
    
    local line = state.currentSequence[state.currentIndex]
    
    -- 设置镜头
    if line.camera then
        Dialogue.MoveCamera(line.camera)
    end
    
    -- 显示对话
    Dialogue.ShowLine(line, function()
        -- 等待玩家输入或自动推进
        if config.autoAdvance then
            Timer.SetTimeout(config.autoAdvanceDelay, function()
                Dialogue.PlayNext(callback)
            end)
        else
            -- 等待玩家点击
            Dialogue.WaitForInput(callback)
        end
    end)
end

--- 显示一行对话
--- @param line table 对话行
--- @param callback function 完成回调
function Dialogue.ShowLine(line, callback)
    local speaker = line.speaker or ""
    local text = line.text or ""
    local portrait = line.portrait
    
    -- 显示说话者名字
    if speaker ~= "" then
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, "|cffffcc00" .. speaker .. "|r")
    end
    
    -- 逐字显示文本
    Dialogue.TypewriterEffect(text, function()
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
function Dialogue.TypewriterEffect(text, callback)
    local displayed = ""
    local index = 0
    local length = string.len(text)
    
    local timer = Timer.SetInterval(config.textSpeed, function()
        index = index + 1
        if index > length then
            Timer.ClearTimer(timer)
            if callback then
                callback()
            end
            return
        end
        
        displayed = displayed .. string.sub(text, index, index)
        -- 更新显示（这里简化处理，实际需要清除旧文本）
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, displayed)
    end)
end

--- 等待玩家输入
--- @param callback function 回调
function Dialogue.WaitForInput(callback)
    local trig = CreateTrigger()
    
    -- 注册鼠标点击事件
    for i = 0, 15 do
        TriggerRegisterPlayerEvent(trig, Player(i), EVENT_PLAYER_MOUSE_DOWN)
    end
    
    TriggerAddAction(trig, function()
        DestroyTrigger(trig)
        if callback then
            callback()
        end
    end)
end

--- 进入电影模式
function Dialogue.EnterCinematicMode()
    -- 开启电影模式
    CinematicModeBJ(true, GetPlayersAll())
    
    -- 隐藏UI
    ShowInterface(false, 0)
    
    -- 淡入
    CinematicFadeBJ(bj_CINEFADETYPE_FADEIN, config.fadeTime, "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
end

--- 退出电影模式
function Dialogue.ExitCinematicMode()
    -- 淡出
    CinematicFadeBJ(bj_CINEFADETYPE_FADEOUT, config.fadeTime, "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
    
    Timer.SetTimeout(config.fadeTime, function()
        -- 显示UI
        ShowInterface(true, 0)
        
        -- 关闭电影模式
        CinematicModeBJ(false, GetPlayersAll())
    end)
end

--- 移动镜头
--- @param camera table 镜头配置
function Dialogue.MoveCamera(camera)
    local x = camera.x or 0
    local y = camera.y or 0
    local distance = camera.distance or 1650
    local angle = camera.angle or 90
    local rotation = camera.rotation or 0
    local fov = camera.fov or 70
    local duration = camera.duration or config.cameraTransition
    
    -- 设置镜头
    PanCameraToTimedLocForPlayer(state.player, Location(x, y), duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_TARGET_DISTANCE, distance, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ANGLE_OF_ATTACK, angle, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ROTATION, rotation, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_FIELD_OF_VIEW, fov, duration)
end

--- 注册跳过事件
function Dialogue.RegisterSkipEvent()
    local trig = CreateTrigger()
    
    -- 注册ESC键
    for i = 0, 15 do
        TriggerRegisterPlayerEvent(trig, Player(i), EVENT_PLAYER_END_CINEMATIC)
    end
    
    TriggerAddAction(trig, function()
        if state.isPlaying then
            state.skipRequested = true
            Dialogue.Skip()
        end
    end)
end

--- 跳过对话
function Dialogue.Skip()
    if not state.isPlaying then
        return
    end
    
    Logger.Log("跳过对话")
    
    -- 快速显示所有剩余文本
    for i = state.currentIndex, #state.currentSequence do
        local line = state.currentSequence[i]
        DisplayTimedTextToPlayer(state.player, 0, 0, 10, 
            "|cffffcc00" .. (line.speaker or "") .. "|r\n" .. (line.text or ""))
    end
    
    -- 结束对话
    Dialogue.End()
end

--- 结束对话
--- @param callback function 完成回调
function Dialogue.End(callback)
    state.isPlaying = false
    state.currentSequence = nil
    state.currentIndex = 0
    
    -- 退出电影模式
    Dialogue.ExitCinematicMode()
    
    Logger.Log("对话结束")
    
    if callback then
        Timer.SetTimeout(config.fadeTime + 0.1, function()
            callback()
        end)
    end
end

--- 获取播放状态
--- @return boolean 是否正在播放
function Dialogue.IsPlaying()
    return state.isPlaying
end

return Dialogue
```

---

## 3. 配置示例 (Configuration Examples)

### 3.1 基础对话配置

```lua
local dialogueSequence = {
    {
        speaker = "阿尔萨斯",
        text = "我们到了，斯坦恩布莱德。",
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
        text = "保持警惕，王子殿下。这里到处都是亡灵。",
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
        text = "我知道该怎么做，乌瑟尔。",
        camera = {
            x = 1000,
            y = 2000,
            distance = 1650,
            angle = 30,
            duration = 1.0
        }
    }
}
```

### 3.2 带特效的对话配置

```lua
local cinematicDialogue = {
    {
        speaker = "旁白",
        text = "在遥远的北方，一股黑暗力量正在苏醒...",
        camera = {
            x = 0,
            y = 5000,
            distance = 3000,
            angle = 80,
            duration = 3.0
        },
        effect = {
            model = "Environment\\LargeBuildingFire\\LargeBuildingFire1.mdl",
            x = 0,
            y = 5000
        }
    },
    {
        speaker = "梅尔甘尼斯",
        text = "阿尔萨斯，你的王国将化为灰烬！",
        camera = {
            x = 1000,
            y = 3000,
            distance = 1000,
            angle = 30,
            duration = 2.0
        }
    }
}
```

---

## 4. 使用方法 (Usage)

### 4.1 基本使用

```lua
local Dialogue = require("src.systems.wcc-dialogue")

-- 初始化
Dialogue.Init()

-- 播放对话
Dialogue.Play({
    {speaker = "阿尔萨斯", text = "你好，乌瑟尔。"},
    {speaker = "乌瑟尔", text = "你好，王子殿下。"}
}, function()
    -- 对话结束后的回调
    print("对话结束")
end)
```

### 4.2 与Boss战集成

```lua
local BossFight = require("src.systems.boss-fight")
local Dialogue = require("src.systems.wcc-dialogue")

-- Boss战前对话
Dialogue.Play({
    {speaker = "阿尔萨斯", text = "终于找到你了！"},
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
local Dialogue = require("src.systems.wcc-dialogue")

-- 接任务时的对话
Dialogue.Play({
    {speaker = "村民", text = "勇士，请帮帮我们！"},
    {speaker = "阿尔萨斯", text = "发生了什么事？"},
    {speaker = "村民", text = "我们的村庄被亡灵攻击了！"}
}, function()
    -- 对话结束后创建任务
    Quest.Create({
        title = "拯救村庄",
        description = "消灭攻击村庄的亡灵",
        type = "main"
    })
end)
```

---

## 5. 高级功能 (Advanced Features)

### 5.1 条件分支

```lua
local dialogueWithBranch = {
    {
        speaker = "神秘人",
        text = "你想要哪条路？",
        choices = {
            {
                text = "左边的路",
                action = function()
                    -- 选择左边的路
                end
            },
            {
                text = "右边的路",
                action = function()
                    -- 选择右边的路
                end
            }
        }
    }
}
```

### 5.2 多语言支持

```lua
local dialogueMultiLang = {
    {
        speaker = "阿尔萨斯",
        text = {
            zhCN = "我们到了，斯坦恩布莱德。",
            enUS = "We've arrived, Strahnbrad."
        }
    }
}

-- 使用时根据语言选择文本
local function GetLocalizedText(textTable)
    local lang = GetLocale()
    return textTable[lang] or textTable["enUS"]
end
```

### 5.3 镜头动画序列

```lua
local cameraSequence = {
    {
        -- 起始镜头
        x = 0,
        y = 0,
        distance = 3000,
        angle = 80,
        duration = 0
    },
    {
        -- 移动到目标
        x = 1000,
        y = 2000,
        distance = 1650,
        angle = 30,
        duration = 3.0
    },
    {
        -- 拉近
        x = 1000,
        y = 2000,
        distance = 800,
        angle = 30,
        duration = 1.5
    }
}
```

---

## 6. 最佳实践 (Best Practices)

### 6.1 对话设计

- 每句对话保持简洁（不超过20个字）
- 说话者名字使用颜色区分
- 重要对话使用电影模式

### 6.2 镜头控制

- 镜头移动要平滑
- 避免过于频繁的镜头切换
- 给玩家足够的时间阅读

### 6.3 性能优化

- 及时销毁触发器和计时器
- 避免在对话中创建大量特效
- 使用对象池管理频繁创建的对象

---

## 7. 常见问题 (FAQ)

### Q: 对话不显示怎么办？

A: 检查是否正确初始化：
```lua
Dialogue.Init()
```

### Q: 如何跳过对话？

A: 按ESC键或调用：
```lua
Dialogue.Skip()
```

### Q: 镜头不移动？

A: 检查镜头配置是否正确：
```lua
camera = {
    x = 1000,      -- X坐标
    y = 2000,      -- Y坐标
    distance = 1650, -- 镜头距离
    angle = 30,    -- 俯视角
    duration = 2.0 -- 过渡时间
}
```

---

## 8. 扩展阅读 (Further Reading)

- [Boss战模式](task-boss-fight.md) - Boss战系统
- [任务系统](../wcc-skill/patterns/task-quest.md) - 任务追踪系统
- [计时器管理](../wcc-lib/wcc-timer.lua) - 计时器安全封装

---

*本文档由 WCC 项目维护，最后更新: 2026-07-09*
