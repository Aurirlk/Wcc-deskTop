--[[
    WCC 示例战役 - 主入口文件
    演示 WCC 系统的基本用法
]]

-- 导入核心库
local Core = require("src.lib.wcc-core")
local Dialogue = require("src.lib.wcc-dialogue")
local Quest = require("src.lib.wcc-quest")

-- 导入关卡逻辑
local Chapter01 = require("src.chapter_01")

-- 初始化函数
local function Init()
    Core.Log("=== WCC 示例战役 ===")
    
    -- 初始化系统
    Core.Init()
    Dialogue.Init()
    
    -- 启动第一章
    Chapter01.Start()
    
    Core.Log("=== 初始化完成 ===")
end

-- 安全执行初始化
Core.SafeExecute(Init)

return {
    version = "1.0.0",
    chapter01 = Chapter01
}
