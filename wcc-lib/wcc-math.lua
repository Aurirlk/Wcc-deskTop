--[[
    模块名称: wcc-math
    功能描述: 坐标与几何工具（纯逻辑，无 Handle 分配）
    版本: 1.0.0
]]
local WCC_Math = {}
WCC_Math.VERSION = "1.0.0"

function WCC_Math.Dist(x1, y1, x2, y2)
    local dx, dy = x2 - x1, y2 - y1
    return math.sqrt(dx * dx + dy * dy)
end

function WCC_Math.Angle(x1, y1, x2, y2)
    return bj_RADTODEG * math.atan(y2 - y1, x2 - x1)
end

function WCC_Math.Polar(x, y, dist, angleDeg)
    local rad = angleDeg * bj_DEGTORAD
    return x + dist * math.cos(rad), y + dist * math.sin(rad)
end

--- 点是否在扇形内
function WCC_Math.InSector(px, py, ox, oy, facingDeg, range, arcDeg)
    local d = WCC_Math.Dist(ox, oy, px, py)
    if d > range then return false end
    local a = WCC_Math.Angle(ox, oy, px, py)
    local diff = math.abs(((a - facingDeg + 180) % 360) - 180)
    return diff <= (arcDeg * 0.5)
end

function WCC_Math.Clamp(v, lo, hi)
    if v < lo then return lo end
    if v > hi then return hi end
    return v
end

function WCC_Math.Lerp(a, b, t)
    return a + (b - a) * t
end

function WCC_Math.RectCenter(rect)
    return (GetRectMinX(rect) + GetRectMaxX(rect)) * 0.5,
           (GetRectMinY(rect) + GetRectMaxY(rect)) * 0.5
end

function WCC_Math.RandomInRect(rect)
    return GetRandomReal(GetRectMinX(rect), GetRectMaxX(rect)),
           GetRandomReal(GetRectMinY(rect), GetRectMaxY(rect))
end

return WCC_Math
