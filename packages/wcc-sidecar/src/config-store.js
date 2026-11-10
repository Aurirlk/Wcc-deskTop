/**
 * Model / app config persisted under project .wcc/config.json
 * Env vars still override for CI/headless.
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULTS = {
  provider: "deepseek",
  baseUrl: "",
  apiKey: "",
  model: "deepseek-chat",
  autoApprove: false,
  expert: "writer",
  wc3Path: "",
  wePath: "",
};

export function createConfigStore({ projectRoot }) {
  const dir = path.join(projectRoot, ".wcc");
  const file = path.join(dir, "config.json");
  let cache = { ...DEFAULTS };

  function load() {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch {
      cache = { ...DEFAULTS };
    }
    // env override
    if (process.env.WCC_MODEL_BASE_URL) cache.baseUrl = process.env.WCC_MODEL_BASE_URL;
    if (process.env.WCC_MODEL_API_KEY) cache.apiKey = process.env.WCC_MODEL_API_KEY;
    if (process.env.WCC_MODEL_NAME) cache.model = process.env.WCC_MODEL_NAME;
    if (process.env.WCC_AUTO_APPROVE === "1") cache.autoApprove = true;
    return get();
  }

  function get() {
    const { apiKey, ...rest } = cache;
    return { ...rest, apiKeySet: Boolean(cache.apiKey) };
  }

  function getRaw() {
    return { ...cache };
  }

  function save(patch) {
    cache = { ...cache, ...patch };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), "utf8");
    // Mirror to process.env for headless callers. Clearing a field must also
    // clear the env var, otherwise switching providers leaves a stale value.
    if (cache.baseUrl) process.env.WCC_MODEL_BASE_URL = cache.baseUrl;
    else delete process.env.WCC_MODEL_BASE_URL;
    if (cache.apiKey) process.env.WCC_MODEL_API_KEY = cache.apiKey;
    else delete process.env.WCC_MODEL_API_KEY;
    if (cache.model) process.env.WCC_MODEL_NAME = cache.model;
    else delete process.env.WCC_MODEL_NAME;
    if (cache.autoApprove) process.env.WCC_AUTO_APPROVE = "1";
    else delete process.env.WCC_AUTO_APPROVE;
    return get();
  }

  load();
  return { load, get, getRaw, save, file };
}

export const EXPERTS = {
  writer: {
    id: "writer",
    name: "战役编剧",
    system: "侧重对话叙事、任务链、章节节奏；输出完整 Lua 模块与 WE 前置清单。",
  },
  boss: {
    id: "boss",
    name: "Boss 设计",
    system: "侧重阶段机、技能循环、仇恨与内存；使用 wcc-boss-fight；禁止泄漏。",
  },
  spawn: {
    id: "spawn",
    name: "任务刷怪",
    system: "侧重刷怪池、区域随机、攻击移动；使用 wcc-spawner。",
  },
  audit: {
    id: "audit",
    name: "防泄漏审查",
    system: "只读审查：报告 Wait/泄漏/虚构 API；默认不写文件，先 lua_check。",
  },
};
