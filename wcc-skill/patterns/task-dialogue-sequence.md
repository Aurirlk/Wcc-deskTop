---
id: patterns-task-dialogue-sequence
mode: manual
keywords: 对话,过场,cinematic
priority: 30
---
﻿# 瀵硅瘽搴忓垪妯″紡妯℃澘 (Dialogue Sequence Pattern)

> 鏈枃妗ｅ畾涔変簡榄斿吔浜夐湼3瀵硅瘽涓庤繃鍦虹郴缁熺殑鏍囧噯瀹炵幇妯″紡銆?
---

## 1. 妯″紡姒傝堪 (Pattern Overview)

### 1.1 璁捐鐩爣

- 鏀寔澶氬彞鍙拌瘝鎸夐『搴忔挱鏀?- 鏀寔鐢靛奖妯″紡锛圕inematic Mode锛?- 鏀寔闀滃ご骞虫粦绉诲姩
- 鏀寔"璺宠繃"鍔熻兘
- 闃叉鍐呭瓨娉勬紡

### 1.2 鏍稿績缁勪欢

```
DialogueSystem
鈹溾攢鈹€ Sequence Manager (搴忓垪绠＄悊鍣?
鈹溾攢鈹€ Cinematic Controller (鐢靛奖鎺у埗鍣?
鈹溾攢鈹€ Camera Manager (闀滃ご绠＄悊鍣?
鈹斺攢鈹€ Input Handler (杈撳叆澶勭悊鍣?
```

---

## 2. 鍩虹瀹炵幇 (Basic Implementation)

### 2.1 Dialogue 妯″潡

```lua
--[[
    瀵硅瘽涓庤繃鍦虹郴缁?    鏀寔澶氬彞鍙拌瘝銆佺數褰辨ā寮忋€侀暅澶存帶鍒躲€佽烦杩囧姛鑳?]]

local Core = require("src.lib.wcc-core")
local Timer = require("src.lib.wcc-timer")
local Logger = require("src.lib.wcc-logger")

local Dialogue = {}

-- 鐘舵€佺鐞?local state = {
    isPlaying = false,
    currentSequence = nil,
    currentIndex = 0,
    skipRequested = false,
    player = GetLocalPlayer()
}

-- 閰嶇疆
local config = {
    textSpeed = 0.05,      -- 姣忎釜瀛楃鏄剧ず鏃堕棿
    autoAdvance = false,    -- 鑷姩鎺ㄨ繘
    autoAdvanceDelay = 3.0, -- 鑷姩鎺ㄨ繘寤惰繜
    cameraTransition = 2.0, -- 闀滃ご杩囨浮鏃堕棿
    fadeTime = 1.0          -- 娣″叆娣″嚭鏃堕棿
}

--- 鍒濆鍖栧璇濈郴缁?function Dialogue.Init()
    Logger.Log("瀵硅瘽绯荤粺鍒濆鍖?)
    
    -- 娉ㄥ唽璺宠繃浜嬩欢
    Dialogue.RegisterSkipEvent()
end

--- 鎾斁瀵硅瘽搴忓垪
--- @param sequence table 瀵硅瘽搴忓垪
--- @param callback function 瀹屾垚鍥炶皟
function Dialogue.Play(sequence, callback)
    if state.isPlaying then
        Logger.LogWarning("瀵硅瘽姝ｅ湪鎾斁涓?)
        return
    end
    
    state.isPlaying = true
    state.currentSequence = sequence
    state.currentIndex = 0
    state.skipRequested = false
    
    -- 杩涘叆鐢靛奖妯″紡
    Dialogue.EnterCinematicMode()
    
    -- 鎾斁绗竴鍙?    Dialogue.PlayNext(callback)
end

--- 鎾斁涓嬩竴鍙?--- @param callback function 瀹屾垚鍥炶皟
function Dialogue.PlayNext(callback)
    state.currentIndex = state.currentIndex + 1
    
    if state.currentIndex > #state.currentSequence then
        -- 瀵硅瘽缁撴潫
        Dialogue.End(callback)
        return
    end
    
    local line = state.currentSequence[state.currentIndex]
    
    -- 璁剧疆闀滃ご
    if line.camera then
        Dialogue.MoveCamera(line.camera)
    end
    
    -- 鏄剧ず瀵硅瘽
    Dialogue.ShowLine(line, function()
        -- 绛夊緟鐜╁杈撳叆鎴栬嚜鍔ㄦ帹杩?        if config.autoAdvance then
            Timer.SetTimeout(config.autoAdvanceDelay, function()
                Dialogue.PlayNext(callback)
            end)
        else
            -- 绛夊緟鐜╁鐐瑰嚮
            Dialogue.WaitForInput(callback)
        end
    end)
end

--- 鏄剧ず涓€琛屽璇?--- @param line table 瀵硅瘽琛?--- @param callback function 瀹屾垚鍥炶皟
function Dialogue.ShowLine(line, callback)
    local speaker = line.speaker or ""
    local text = line.text or ""
    local portrait = line.portrait
    
    -- 鏄剧ず璇磋瘽鑰呭悕瀛?    if speaker ~= "" then
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, "|cffffcc00" .. speaker .. "|r")
    end
    
    -- 閫愬瓧鏄剧ず鏂囨湰
    Dialogue.TypewriterEffect(text, function()
        -- 鏄剧ず缁х画鎻愮ず
        DisplayTimedTextToPlayer(state.player, 0, 0, 999, "|cff888888[鐐瑰嚮缁х画]|r")
        
        if callback then
            callback()
        end
    end)
end

--- 鎵撳瓧鏈烘晥鏋?--- @param text string 鏂囨湰
--- @param callback function 瀹屾垚鍥炶皟
function Dialogue.TypewriterEffect(text, callback)
    local displayed = ""
    local index = 0
    local length = string.len(text)
    
    local timer = Timer.SetInterval(config.textSpeed, function()
        index = index + 1
        if index > length then
            Timer.Clear(timer)
            if callback then
                callback()
            end
            return
        end
        
        displayed = displayed .. string.sub(text, index, index)
        -- 鏇存柊鏄剧ず锛堣繖閲岀畝鍖栧鐞嗭紝瀹為檯闇€瑕佹竻闄ゆ棫鏂囨湰锛?        DisplayTimedTextToPlayer(state.player, 0, 0, 999, displayed)
    end)
end

--- 绛夊緟鐜╁杈撳叆
--- @param callback function 鍥炶皟
function Dialogue.WaitForInput(callback)
    local trig = CreateTrigger()
    
    -- 娉ㄥ唽榧犳爣鐐瑰嚮浜嬩欢
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

--- 杩涘叆鐢靛奖妯″紡
function Dialogue.EnterCinematicMode()
    -- 寮€鍚數褰辨ā寮?    CinematicModeBJ(true, GetPlayersAll())
    
    -- 闅愯棌UI
    ShowInterface(false, 0)
    
    -- 娣″叆
    CinematicFadeBJ(bj_CINEFADETYPE_FADEIN, config.fadeTime, "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
end

--- 閫€鍑虹數褰辨ā寮?function Dialogue.ExitCinematicMode()
    -- 娣″嚭
    CinematicFadeBJ(bj_CINEFADETYPE_FADEOUT, config.fadeTime, "ReplaceableTextures\\CameraMasks\\White_mask.tga", 0, 0, 0, 0)
    
    Timer.SetTimeout(config.fadeTime, function()
        -- 鏄剧ずUI
        ShowInterface(true, 0)
        
        -- 鍏抽棴鐢靛奖妯″紡
        CinematicModeBJ(false, GetPlayersAll())
    end)
end

--- 绉诲姩闀滃ご
--- @param camera table 闀滃ご閰嶇疆
function Dialogue.MoveCamera(camera)
    local x = camera.x or 0
    local y = camera.y or 0
    local distance = camera.distance or 1650
    local angle = camera.angle or 90
    local rotation = camera.rotation or 0
    local fov = camera.fov or 70
    local duration = camera.duration or config.cameraTransition
    
    -- 璁剧疆闀滃ご
    PanCameraToTimedLocForPlayer(state.player, Location(x, y), duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_TARGET_DISTANCE, distance, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ANGLE_OF_ATTACK, angle, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_ROTATION, rotation, duration)
    SetCameraFieldForPlayer(state.player, CAMERA_FIELD_FIELD_OF_VIEW, fov, duration)
end

--- 娉ㄥ唽璺宠繃浜嬩欢
function Dialogue.RegisterSkipEvent()
    local trig = CreateTrigger()
    
    -- 娉ㄥ唽ESC閿?    for i = 0, 15 do
        TriggerRegisterPlayerEvent(trig, Player(i), EVENT_PLAYER_END_CINEMATIC)
    end
    
    TriggerAddAction(trig, function()
        if state.isPlaying then
            state.skipRequested = true
            Dialogue.Skip()
        end
    end)
end

--- 璺宠繃瀵硅瘽
function Dialogue.Skip()
    if not state.isPlaying then
        return
    end
    
    Logger.Log("璺宠繃瀵硅瘽")
    
    -- 蹇€熸樉绀烘墍鏈夊墿浣欐枃鏈?    for i = state.currentIndex, #state.currentSequence do
        local line = state.currentSequence[i]
        DisplayTimedTextToPlayer(state.player, 0, 0, 10, 
            "|cffffcc00" .. (line.speaker or "") .. "|r\n" .. (line.text or ""))
    end
    
    -- 缁撴潫瀵硅瘽
    Dialogue.End()
end

--- 缁撴潫瀵硅瘽
--- @param callback function 瀹屾垚鍥炶皟
function Dialogue.End(callback)
    state.isPlaying = false
    state.currentSequence = nil
    state.currentIndex = 0
    
    -- 閫€鍑虹數褰辨ā寮?    Dialogue.ExitCinematicMode()
    
    Logger.Log("瀵硅瘽缁撴潫")
    
    if callback then
        Timer.SetTimeout(config.fadeTime + 0.1, function()
            callback()
        end)
    end
end

--- 鑾峰彇鎾斁鐘舵€?--- @return boolean 鏄惁姝ｅ湪鎾斁
function Dialogue.IsPlaying()
    return state.isPlaying
end

return Dialogue
```

---

## 3. 閰嶇疆绀轰緥 (Configuration Examples)

### 3.1 鍩虹瀵硅瘽閰嶇疆

```lua
local dialogueSequence = {
    {
        speaker = "闃垮皵钀ㄦ柉",
        text = "鎴戜滑鍒颁簡锛屾柉鍧︽仼甯冭幈寰枫€?,
        camera = {
            x = 1000,
            y = 2000,
            distance = 1650,
            angle = 30,
            duration = 2.0
        }
    },
    {
        speaker = "涔岀憻灏?,
        text = "淇濇寔璀︽儠锛岀帇瀛愭涓嬨€傝繖閲屽埌澶勯兘鏄骸鐏点€?,
        camera = {
            x = 1200,
            y = 2200,
            distance = 1650,
            angle = 30,
            duration = 1.5
        }
    },
    {
        speaker = "闃垮皵钀ㄦ柉",
        text = "鎴戠煡閬撹鎬庝箞鍋氾紝涔岀憻灏斻€?,
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

### 3.2 甯︾壒鏁堢殑瀵硅瘽閰嶇疆

```lua
local cinematicDialogue = {
    {
        speaker = "鏃佺櫧",
        text = "鍦ㄩ仴杩滅殑鍖楁柟锛屼竴鑲￠粦鏆楀姏閲忔鍦ㄨ嫃閱?..",
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
        speaker = "姊呭皵鐢樺凹鏂?,
        text = "闃垮皵钀ㄦ柉锛屼綘鐨勭帇鍥藉皢鍖栦负鐏扮儸锛?,
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

## 4. 浣跨敤鏂规硶 (Usage)

### 4.1 鍩烘湰浣跨敤

```lua
local Dialogue = require("src.systems.wcc-dialogue")

-- 鍒濆鍖?Dialogue.Init()

-- 鎾斁瀵硅瘽
Dialogue.Play({
    {speaker = "闃垮皵钀ㄦ柉", text = "浣犲ソ锛屼箤鐟熷皵銆?},
    {speaker = "涔岀憻灏?, text = "浣犲ソ锛岀帇瀛愭涓嬨€?}
}, function()
    -- 瀵硅瘽缁撴潫鍚庣殑鍥炶皟
    print("瀵硅瘽缁撴潫")
end)
```

### 4.2 涓嶣oss鎴橀泦鎴?
```lua
local BossFight = require("src.systems.boss-fight")
local Dialogue = require("src.systems.wcc-dialogue")

-- Boss鎴樺墠瀵硅瘽
Dialogue.Play({
    {speaker = "闃垮皵钀ㄦ柉", text = "缁堜簬鎵惧埌浣犱簡锛?},
    {speaker = "姊呭皵鐢樺凹鏂?, text = "浣犱互涓轰綘鑳介樆姝㈡垜鍚楋紵"}
}, function()
    -- 瀵硅瘽缁撴潫鍚庡紑濮婤oss鎴?    local boss = BossFight.New(bossConfig)
    boss:Init()
end)
```

### 4.3 涓庝换鍔＄郴缁熼泦鎴?
```lua
local Quest = require("src.systems.wcc-quest")
local Dialogue = require("src.systems.wcc-dialogue")

-- 鎺ヤ换鍔℃椂鐨勫璇?Dialogue.Play({
    {speaker = "鏉戞皯", text = "鍕囧＋锛岃甯府鎴戜滑锛?},
    {speaker = "闃垮皵钀ㄦ柉", text = "鍙戠敓浜嗕粈涔堜簨锛?},
    {speaker = "鏉戞皯", text = "鎴戜滑鐨勬潙搴勮浜＄伒鏀诲嚮浜嗭紒"}
}, function()
    -- 瀵硅瘽缁撴潫鍚庡垱寤轰换鍔?    Quest.Create({
        title = "鎷晳鏉戝簞",
        description = "娑堢伃鏀诲嚮鏉戝簞鐨勪骸鐏?,
        type = "main"
    })
end)
```

---

## 5. 楂樼骇鍔熻兘 (Advanced Features)

### 5.1 鏉′欢鍒嗘敮

```lua
local dialogueWithBranch = {
    {
        speaker = "绁炵浜?,
        text = "浣犳兂瑕佸摢鏉¤矾锛?,
        choices = {
            {
                text = "宸﹁竟鐨勮矾",
                action = function()
                    -- 閫夋嫨宸﹁竟鐨勮矾
                end
            },
            {
                text = "鍙宠竟鐨勮矾",
                action = function()
                    -- 閫夋嫨鍙宠竟鐨勮矾
                end
            }
        }
    }
}
```

### 5.2 澶氳瑷€鏀寔

```lua
local dialogueMultiLang = {
    {
        speaker = "闃垮皵钀ㄦ柉",
        text = {
            zhCN = "鎴戜滑鍒颁簡锛屾柉鍧︽仼甯冭幈寰枫€?,
            enUS = "We've arrived, Strahnbrad."
        }
    }
}

-- 浣跨敤鏃舵牴鎹瑷€閫夋嫨鏂囨湰
local function GetLocalizedText(textTable)
    local lang = GetLocale()
    return textTable[lang] or textTable["enUS"]
end
```

### 5.3 闀滃ご鍔ㄧ敾搴忓垪

```lua
local cameraSequence = {
    {
        -- 璧峰闀滃ご
        x = 0,
        y = 0,
        distance = 3000,
        angle = 80,
        duration = 0
    },
    {
        -- 绉诲姩鍒扮洰鏍?        x = 1000,
        y = 2000,
        distance = 1650,
        angle = 30,
        duration = 3.0
    },
    {
        -- 鎷夎繎
        x = 1000,
        y = 2000,
        distance = 800,
        angle = 30,
        duration = 1.5
    }
}
```

---

## 6. 鏈€浣冲疄璺?(Best Practices)

### 6.1 瀵硅瘽璁捐

- 姣忓彞瀵硅瘽淇濇寔绠€娲侊紙涓嶈秴杩?0涓瓧锛?- 璇磋瘽鑰呭悕瀛椾娇鐢ㄩ鑹插尯鍒?- 閲嶈瀵硅瘽浣跨敤鐢靛奖妯″紡

### 6.2 闀滃ご鎺у埗

- 闀滃ご绉诲姩瑕佸钩婊?- 閬垮厤杩囦簬棰戠箒鐨勯暅澶村垏鎹?- 缁欑帺瀹惰冻澶熺殑鏃堕棿闃呰

### 6.3 鎬ц兘浼樺寲

- 鍙婃椂閿€姣佽Е鍙戝櫒鍜岃鏃跺櫒
- 閬垮厤鍦ㄥ璇濅腑鍒涘缓澶ч噺鐗规晥
- 浣跨敤瀵硅薄姹犵鐞嗛绻佸垱寤虹殑瀵硅薄

---

## 7. 甯歌闂 (FAQ)

### Q: 瀵硅瘽涓嶆樉绀烘€庝箞鍔烇紵

A: 妫€鏌ユ槸鍚︽纭垵濮嬪寲锛?```lua
Dialogue.Init()
```

### Q: 濡備綍璺宠繃瀵硅瘽锛?
A: 鎸塃SC閿垨璋冪敤锛?```lua
Dialogue.Skip()
```

### Q: 闀滃ご涓嶇Щ鍔紵

A: 妫€鏌ラ暅澶撮厤缃槸鍚︽纭細
```lua
camera = {
    x = 1000,      -- X鍧愭爣
    y = 2000,      -- Y鍧愭爣
    distance = 1650, -- 闀滃ご璺濈
    angle = 30,    -- 淇瑙?    duration = 2.0 -- 杩囨浮鏃堕棿
}
```

---

## 8. 鎵╁睍闃呰 (Further Reading)

- [Boss鎴樻ā寮廬(task-boss-fight.md) - Boss鎴樼郴缁?- [浠诲姟绯荤粺](../wcc-skill/patterns/task-quest.md) - 浠诲姟杩借釜绯荤粺
- [璁℃椂鍣ㄧ鐞哴(../wcc-lib/wcc-timer.lua) - 璁℃椂鍣ㄥ畨鍏ㄥ皝瑁?
---

*鏈枃妗ｇ敱 WCC 椤圭洰缁存姢锛屾渶鍚庢洿鏂? 2026-07-09*

