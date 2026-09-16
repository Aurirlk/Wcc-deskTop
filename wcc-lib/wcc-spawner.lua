--[[
    Warcraft Campaign Craft (WCC) - Spawner System
    刷怪池系统，按时间间隔/波次在指定坐标或区域生成单位，
    并自动命令它们向目标点发起攻击 (IssuePointOrder)。

    功能:
    - 定时刷怪 (setInterval 式)，支持无限波次/有限波次
    - 指定坐标生成，或区域内随机生成
    - 自动发布攻击移动命令 (attack)，可切换为纯移动 (move)
    - 每波/全部完成回调
    - 暂停/恢复/停止/清理
    - 工具: 命令区域内所有单位进攻 (对应 GUI 触发器模式)

    作者: 艾泽拉斯织码者
    版本: 1.0.0
]]

local Core = require("src.lib.wcc-core")

local WCC_Spawner = {}

-- 版本号
WCC_Spawner.VERSION = "1.0.0"

-- ==========================================
-- 存储与计数器
-- ==========================================

local pools = {}   -- 所有刷怪池，按 id 索引
local autoId = 0   -- 自动生成 id 的计数器

-- ==========================================
-- 内部工具函数
-- ==========================================

--- 获取生成点坐标：区域则随机取内部一点，坐标则直接使用
--- @param pool table 刷怪池
--- @return number, number 生成点X, Y
local function GetSpawnPoint(pool)
    if pool.region then
        return GetRandomReal(GetRectMinX(pool.region), GetRectMaxX(pool.region)),
               GetRandomReal(GetRectMinY(pool.region), GetRectMaxY(pool.region))
    end
    return pool.x, pool.y
end

--- 获取进攻目标点坐标：目标区域取其中心点
--- @param pool table 刷怪池
--- @return number, number 目标X, Y
local function GetTargetPoint(pool)
    if pool.targetRegion then
        return GetRectCenterX(pool.targetRegion), GetRectCenterY(pool.targetRegion)
    end
    return pool.targetX, pool.targetY
end

--- 对单位发布进攻命令
--- attack 为攻击移动（沿途攻击敌人），move 为纯移动
--- @param unit unit 单位
--- @param pool table 刷怪池
--- @param tx number 目标X
--- @param ty number 目标Y
local function OrderUnitToTarget(unit, pool, tx, ty)
    local orderId = pool.orderId or (pool.attackMove and "attack" or "move")
    IssuePointOrder(unit, orderId, tx, ty)
end

--- 生成一波单位
--- @param pool table 刷怪池
local function SpawnWave(pool)
    local tx, ty = GetTargetPoint(pool)
    local spawned = 0

    for i = 1, pool.count do
        local x, y = GetSpawnPoint(pool)

        -- 面朝目标点生成
        local face = bj_RADTODEG * math.atan(ty - y, tx - x)
        local unit = Core.SafeCreateUnit(pool.owner, pool.unitId, x, y, face)
        if unit then
            spawned = spawned + 1
            OrderUnitToTarget(unit, pool, tx, ty)

            if pool.spawnEffect then
                Core.CreateEffectWithTimer(pool.spawnEffect, x, y, 0.5)
            end
        end
    end

    pool.waveCount = pool.waveCount + 1
    pool.totalSpawned = pool.totalSpawned + spawned

    Core.Log("刷怪池 [" .. pool.id .. "] 第 " .. pool.waveCount .. " 波生成 " .. spawned .. " 个单位")

    -- 每波回调
    if pool.onWave then
        Core.SafeExecute(pool.onWave, pool, pool.waveCount, spawned)
    end

    -- 有限波次结束时停止并回调
    if pool.waves and pool.waveCount >= pool.waves then
        WCC_Spawner.Stop(pool)
        Core.Log("刷怪池 [" .. pool.id .. "] 全部 " .. pool.waves .. " 波次完成")
        if pool.onComplete then
            Core.SafeExecute(pool.onComplete, pool)
        end
    end
end

-- ==========================================
-- 刷怪池创建与管理
-- ==========================================

--- 创建刷怪池
--- @param config table 刷怪池配置
---   id            string   刷怪池ID（可选，自动生成 "spawner_N"）
---   unitId        string   单位四字ID，如 'ugho'（必填）
---   owner         player   单位所有者（默认中立敌对）
---   x, y          number   生成坐标（与 region 二选一）
---   region        rect     生成区域 gg_rct_xxx（区域内随机生成）
---   count         number   每波生成数量（默认1）
---   interval      number   波次间隔秒数（默认30）
---   waves         number   总波次，nil 表示无限（默认nil）
---   initialDelay  number   首次生成延迟秒数（默认0）
---   targetX, targetY number 进攻目标坐标（必填，或 targetRegion）
---   targetRegion  rect     进攻目标区域（取其中心点）
---   attackMove    boolean  是否攻击移动，true=沿途攻击（默认true）
---   orderId       string   自定义命令覆盖（如"patrol"）
---   spawnEffect   string   生成时播放的特效模型路径
---   onWave        function 每波回调 (pool, waveCount, spawnedCount)
---   onComplete    function 全部波次完成回调 (pool)
---   autoStart     boolean  创建后自动开始（默认true）
--- @return table|nil 刷怪池对象，参数错误返回nil
function WCC_Spawner.Create(config)
    if not config or not config.unitId then
        Core.LogError("WCC_Spawner.Create: 缺少 unitId")
        return nil
    end

    if not (config.x and config.y) and not config.region then
        Core.LogError("WCC_Spawner.Create: 必须指定生成坐标 (x, y) 或生成区域 (region)")
        return nil
    end

    if not (config.targetX and config.targetY) and not config.targetRegion then
        Core.LogError("WCC_Spawner.Create: 必须指定进攻目标 (targetX, targetY) 或目标区域 (targetRegion)")
        return nil
    end

    autoId = autoId + 1
    local id = config.id or ("spawner_" .. autoId)

    if pools[id] then
        Core.LogWarning("WCC_Spawner.Create: 刷怪池已存在 - " .. id)
        return pools[id]
    end

    local pool = {
        id = id,
        unitId = config.unitId,
        owner = config.owner or Player(PLAYER_NEUTRAL_AGGRESSIVE),
        x = config.x,
        y = config.y,
        region = config.region,
        count = config.count or 1,
        interval = config.interval or 30.0,
        waves = config.waves,
        initialDelay = config.initialDelay or 0.0,
        targetX = config.targetX,
        targetY = config.targetY,
        targetRegion = config.targetRegion,
        attackMove = config.attackMove ~= false,
        orderId = config.orderId,
        spawnEffect = config.spawnEffect,
        onWave = config.onWave,
        onComplete = config.onComplete,

        -- 运行时状态
        timer = nil,
        running = false,
        waveCount = 0,
        totalSpawned = 0,

        -- 方法
        Start = function(self) WCC_Spawner.Start(self) end,
        Stop = function(self) WCC_Spawner.Stop(self) end,
        Pause = function(self) WCC_Spawner.Pause(self) end,
        Resume = function(self) WCC_Spawner.Resume(self) end,
        IsRunning = function(self) return WCC_Spawner.IsRunning(self) end,
        GetWaveCount = function(self) return self.waveCount end,
        GetTotalSpawned = function(self) return self.totalSpawned end
    }

    pools[id] = pool
    Core.Log("刷怪池创建: " .. id .. "，单位 " .. tostring(config.unitId) .. "，每波 " .. pool.count .. " 个")

    if config.autoStart ~= false then
        WCC_Spawner.Start(pool)
    end

    return pool
end

--- 开始刷怪（首次波次按 initialDelay，之后按 interval）
--- @param pool table 刷怪池
--- @return boolean 是否成功
function WCC_Spawner.Start(pool)
    if not pool then
        Core.LogError("WCC_Spawner.Start: 刷怪池为nil")
        return false
    end
    if pool.running then
        return false
    end

    local timer = Core.SafeCreateTimer()
    if not timer then
        return false
    end
    pool.timer = timer
    pool.running = true

    local delay = pool.waveCount == 0 and pool.initialDelay or pool.interval
    TimerStart(timer, delay, true, function()
        SpawnWave(pool)
    end)

    return true
end

--- 停止刷怪（保留波次计数，可再次 Start 继续）
--- @param pool table 刷怪池
--- @return boolean 是否成功
function WCC_Spawner.Stop(pool)
    if not pool then
        return false
    end
    if not pool.running then
        return false
    end

    if pool.timer then
        Core.SafeDestroyTimer(pool.timer)
        pool.timer = nil
    end
    pool.running = false
    return true
end

--- 暂停刷怪（计时暂停）
--- @param pool table 刷怪池
--- @return boolean 是否成功
function WCC_Spawner.Pause(pool)
    if not pool or not pool.running or not pool.timer then
        return false
    end
    PauseTimer(pool.timer)
    return true
end

--- 恢复刷怪（从完整间隔重新计时）
--- @param pool table 刷怪池
--- @return boolean 是否成功
function WCC_Spawner.Resume(pool)
    if not pool or not pool.running or not pool.timer then
        return false
    end
    TimerStart(pool.timer, pool.interval, true, function()
        SpawnWave(pool)
    end)
    return true
end

-- ==========================================
-- 查询与清理
-- ==========================================

--- 获取刷怪池
--- @param poolId string 刷怪池ID
--- @return table|nil 刷怪池对象
function WCC_Spawner.Get(poolId)
    return pools[poolId]
end

--- 获取所有刷怪池
--- @return table 所有刷怪池
function WCC_Spawner.GetAll()
    return pools
end

--- 判断刷怪池是否运行中
--- @param pool table 刷怪池
--- @return boolean
function WCC_Spawner.IsRunning(pool)
    return pool ~= nil and pool.running
end

--- 停止并清理所有刷怪池
function WCC_Spawner.Clear()
    for _, pool in pairs(pools) do
        WCC_Spawner.Stop(pool)
    end
    pools = {}
    Core.Log("所有刷怪池已清理")
end

-- ==========================================
-- 工具函数
-- ==========================================

--- 命令区域内所有存活单位向目标点进攻
--- 对应 GUI 触发器: 选取区域单位 + 攻击移动到目标点 + 销毁单位组
--- @param region rect 单位所在区域 (gg_rct_xxx)
--- @param targetX number 目标X
--- @param targetY number 目标Y
--- @param attackMove boolean 是否攻击移动，true=沿途攻击（默认true）
--- @return number 被命令的单位数量
function WCC_Spawner.OrderRegionToAttack(region, targetX, targetY, attackMove)
    if not region or not targetX or not targetY then
        Core.LogError("WCC_Spawner.OrderRegionToAttack: 无效参数")
        return 0
    end

    local group = Core.SafeCreateGroup()
    if not group then
        return 0
    end

    local orderId = attackMove ~= false and "attack" or "move"
    local count = 0

    GroupEnumUnitsInRect(group, region, nil)
    ForGroup(group, function()
        local unit = GetEnumUnit()
        if IsUnitAliveBJ(unit) then
            IssuePointOrder(unit, orderId, targetX, targetY)
            count = count + 1
        end
    end)

    Core.SafeDestroyGroup(group)
    return count
end

return WCC_Spawner
