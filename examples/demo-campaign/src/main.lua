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
-- 章节 2 / 3 是 few-shot 示例骨架（🔴 未进图）：一并打包以便 build_map 校验
-- require 图与 lua_check，但不自动 Start()。真实战役流程需显式调用。
local Chapter02 = require("src.chapter_02")
local Chapter03 = require("src.chapter_03")

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
    version = "1.1.0",
    chapter01 = Chapter01,
    chapter02 = Chapter02,
    chapter03 = Chapter03
}
