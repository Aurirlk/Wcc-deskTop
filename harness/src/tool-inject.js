/**
 * Tool injection: do not put all tools (and all 152 forge_* schemas) into every
 * request — Kiro "powers / MCP governance" + Deep Agents "skills on demand".
 *
 * Two sources:
 *  - `source: "sidecar"`  -> real tools in packages/wcc-sidecar/src/tools.js
 *  - `source: "harness"`  -> tools implemented by harness/src/index.js dispatch()
 *  - `source: "forge"`    -> dynamic forge_* tools supplied by the caller
 *
 * Schemas here are minimal (for budget estimation / TUI preview). When the real
 * Sidecar tool list is passed via createToolInjector({ catalog }), its schemas
 * win. No duplicated schema maintenance.
 */
const S = (props = {}, required = []) => ({ type: "object", properties: props, required });
const P = (desc, type = "string") => ({ type, description: desc });

export const TOOL_CATALOG = Object.freeze([
  // --- always-on core (cheap, read-only) ---
  { name: "list_dir", group: "project", source: "sidecar", risk: "read", needsApproval: false, always: true,
    description: "列出项目内目录", inputSchema: S({ subpath: P("相对路径") }) },
  { name: "read_file", group: "src", source: "sidecar", risk: "read", needsApproval: false, always: true,
    description: "读取项目内文本文件", inputSchema: S({ path: P("相对路径") }, ["path"]) },
  { name: "lua_check", group: "check", source: "sidecar", risk: "read", needsApproval: false, always: true,
    description: "WCC Lua 静态检查", inputSchema: S({ subpath: P("检查路径") }) },
  { name: "skill_load", group: "skill", source: "sidecar", risk: "read", needsApproval: false, always: true,
    description: "加载 WCC skill 文档", inputSchema: S({ name: P("文档名") }, ["name"]) },
  { name: "spec_status", group: "spec", source: "harness", risk: "read", needsApproval: false, always: true,
    description: "读 spec 阶段、任务与进度", inputSchema: S() },

  // --- conditional groups ---
  { name: "write_file", group: "src", source: "sidecar", risk: "local-write", needsApproval: true,
    description: "写项目内文件（需审批）", inputSchema: S({ path: P("相对路径"), content: P("完整内容") }, ["path", "content"]) },
  { name: "wcc_check", group: "check", source: "harness", risk: "read", needsApproval: false,
    description: "按脚本清单执行 Lua 检查", inputSchema: S({ target: P("路径") }) },
  { name: "steering_select", group: "skill", source: "harness", risk: "read", needsApproval: false,
    description: "查看本轮条件注入了哪些规范", inputSchema: S({ intent: P("意图"), files: P("文件，逗号分隔") }) },

  { name: "codegen_list", group: "codegen", source: "sidecar", risk: "read", needsApproval: false,
    description: "列出代码生成模板", inputSchema: S() },
  { name: "codegen_run", group: "codegen", source: "sidecar", risk: "local-write", needsApproval: true,
    description: "运行代码生成模板", inputSchema: S({ name: P("模板名"), params: P("参数 JSON") }, ["name"]) },
  { name: "table_import", group: "codegen", source: "sidecar", risk: "local-write", needsApproval: true,
    description: "导入表格为批量任务", inputSchema: S({ path: P("表格路径") }, ["path"]) },

  { name: "forge_status", group: "forge", source: "sidecar", risk: "read", needsApproval: false,
    description: "forge 会话状态", inputSchema: S() },
  { name: "forge_connect", group: "forge", source: "sidecar", risk: "external", needsApproval: true,
    description: "连接 forge 会话", inputSchema: S({ session: P("会话 id") }) },
  { name: "forge_list_tools", group: "forge", source: "sidecar", risk: "read", needsApproval: false,
    description: "列出 forge 可用工具", inputSchema: S() },
  { name: "forge_probe", group: "forge", source: "harness", risk: "read", needsApproval: false,
    description: "检查 WC3FORGE_EXE，不启动 exe", inputSchema: S() },

  { name: "chapter_tree", group: "workbench", source: "sidecar", risk: "read", needsApproval: false,
    description: "章节树", inputSchema: S() },
  { name: "bible_get", group: "workbench", source: "sidecar", risk: "read", needsApproval: false,
    description: "读取设定集", inputSchema: S() },
  { name: "bible_set", group: "workbench", source: "sidecar", risk: "local-write", needsApproval: true,
    description: "写入设定集", inputSchema: S({ key: P("键"), value: P("值") }, ["key"]) },
  { name: "build_map", group: "build", source: "sidecar", risk: "local-write", needsApproval: true,
    description: "打包战役地图", inputSchema: S() },

  { name: "map_sources_list", group: "assets", source: "sidecar", risk: "read", needsApproval: false,
    description: "列出地图站点目录", inputSchema: S() },
  { name: "map_recommendations", group: "assets", source: "sidecar", risk: "read", needsApproval: false,
    description: "素材推荐", inputSchema: S() },
  { name: "local_maps_scan", group: "assets", source: "sidecar", risk: "read", needsApproval: false,
    description: "扫描本地地图库", inputSchema: S({ roots: P("额外目录，逗号分隔") }) },

  { name: "scratch_grep", group: "scratch", source: "harness", risk: "read", needsApproval: false,
    description: "在被卸载的工具结果中检索", inputSchema: S({ pattern: P("正则"), maxHits: P("上限") }, ["pattern"]) },
  { name: "scratch_recall", group: "scratch", source: "harness", risk: "read", needsApproval: false,
    description: "取回被卸载的完整结果", inputSchema: S({ id: P("scratch id") }, ["id"]) },
  { name: "spec_done", group: "spec", source: "harness", risk: "local-write", needsApproval: false,
    description: "勾选 spec 任务并触发质量门禁", inputSchema: S({ id: P("任务 id，如 T1") }, ["id"]) },
  { name: "spec_init", group: "spec", source: "harness", risk: "local-write", needsApproval: false,
    description: "生成 spec 三阶段文档", inputSchema: S({ goal: P("目标"), force: P("覆盖") }) },
  { name: "provider_list", group: "config", source: "harness", risk: "read", needsApproval: false,
    description: "列出国产/本地模型预设", inputSchema: S() },
  { name: "budget_status", group: "config", source: "harness", risk: "read", needsApproval: false,
    description: "turn/token 预算与 stop reason", inputSchema: S() },
  { name: "hook_emit", group: "config", source: "harness", risk: "read", needsApproval: false,
    description: "手动触发一个 hook 事件（诊断用）", inputSchema: S({ event: P("事件名"), path: P("路径") }, ["event"]) },
]);

export const GROUP_RULES = Object.freeze([
  { group: "src", keywords: ["写", "生成", "修改", "新建", "chapter", "lua"], fileMatch: ["**/*.lua"], tools: ["write_file"] },
  { group: "check", keywords: ["检查", "check", "扫", "审查", "lint"], tools: ["wcc_check"] },
  { group: "skill", keywords: ["规范", "铁律", "steering", "skill"], tools: ["steering_select"] },
  { group: "codegen", keywords: ["物编", "批量", "单位", "表格", "excel", "数据驱动", "codegen"], tools: ["codegen_list", "codegen_run", "table_import"] },
  { group: "forge", keywords: ["地图", "改图", "地形", "forge", "放置", "区域"], tools: ["forge_status", "forge_connect", "forge_list_tools", "forge_probe"] },
  { group: "workbench", keywords: ["章节", "剧情", "设定", "任务链", "对话"], tools: ["chapter_tree", "bible_get", "bible_set"] },
  { group: "build", keywords: ["打包", "构建", "发布", "build"], tools: ["build_map"] },
  { group: "assets", keywords: ["素材", "地图站", "找图", "下载", "模型"], tools: ["map_sources_list", "map_recommendations", "local_maps_scan"] },
  { group: "scratch", keywords: ["刚才", "之前的结果", "找回", "grep", "卸载"], tools: ["scratch_grep", "scratch_recall"] },
  { group: "spec", keywords: ["spec", "计划", "任务", "阶段", "验收"], tools: ["spec_init", "spec_done"] },
  { group: "config", keywords: ["模型", "provider", "预算", "hook", "token"], tools: ["provider_list", "budget_status", "hook_emit"] },
]);

/** Replace minimal schemas with real Sidecar ones when available. */
export function mergeCatalog(catalog = []) {
  const byName = new Map(catalog.map((t) => [t.name, t]));
  return TOOL_CATALOG.map((t) => {
    const real = byName.get(t.name);
    if (!real) return t;
    return {
      ...t,
      description: real.description || t.description,
      inputSchema: real.inputSchema || real.schema || t.inputSchema,
      needsApproval: real.needsApproval ?? t.needsApproval,
    };
  }).concat(
    catalog
      .filter((t) => !TOOL_CATALOG.some((x) => x.name === t.name))
      .map((t) => ({
        name: t.name, group: t.category || "dynamic", source: t.name.startsWith("forge_") ? "forge" : "sidecar",
        risk: "external", needsApproval: t.needsApproval ?? true,
        description: t.description || "", inputSchema: t.inputSchema || t.schema || S(),
      }))
  );
}

export function createToolInjector({ catalog = [], maxTools = 12, allowExternal = false } = {}) {
  const all = mergeCatalog(catalog);
  const byName = new Map(all.map((t) => [t.name, t]));

  function select({ files = [], intent = "", expert = "", maxTools: cap = maxTools, needForge = false, dynamicForgeTools = [] } = {}) {
    const text = String(intent).toLowerCase();
    const normalizedFiles = files.map((f) => String(f).replace(/\\/g, "/"));
    const matched = new Map();
    const reasons = [];

    const add = (name, reason) => {
      if (!byName.has(name) || matched.has(name)) return;
      matched.set(name, byName.get(name));
      reasons.push({ name, reason });
    };

    for (const t of all) if (t.always) add(t.name, "always");

    for (const rule of GROUP_RULES) {
      const byKeyword = rule.keywords.some((k) => text.includes(String(k).toLowerCase()));
      const byFile = (rule.fileMatch || []).some((g) => normalizedFiles.some((f) => f.endsWith(g.replace(/^\*\*\//, "").replace(/\*/g, ""))));
      if (byKeyword || byFile || (rule.group === "forge" && needForge)) {
        for (const name of rule.tools) add(name, byFile ? "fileMatch" : byKeyword ? "keyword" : "needForge");
      }
    }

    if (dynamicForgeTools.length) {
      const room = Math.max(0, Math.min(cap, 24) - matched.size);
      for (const t of dynamicForgeTools.slice(0, room)) {
        add(t.name, "dynamic-forge");
      }
    }

    // Expert filter: audit is read-only by design. Record every rejection so
    // the plan never claims a tool was injected when it was filtered out.
    let candidates = [...matched.values()];
    const filtered = [];
    const drop = (predicate, reason) => {
      const kept = [];
      for (const t of candidates) {
        if (predicate(t)) kept.push(t);
        else filtered.push({ name: t.name, reason });
      }
      candidates = kept;
    };
    if (expert === "audit") drop((t) => t.risk === "read", "expert-audit-read-only");
    if (!allowExternal && !needForge) drop((t) => t.group !== "forge" || t.risk === "read", "external-not-allowed");

    const omitted = candidates.slice(cap).map((t) => t.name);
    const selected = candidates.slice(0, cap);
    const selectedNames = new Set(selected.map((t) => t.name));
    const finalReasons = reasons.filter((r) => selectedNames.has(r.name));
    const tools = selected.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: `[${t.group}/${t.risk}] ${t.description}`,
        parameters: t.inputSchema || S(),
      },
    }));

    const schemaChars = JSON.stringify(tools).length;
    const fullChars = JSON.stringify(all.map((t) => ({ name: t.name, parameters: t.inputSchema }))).length;
    return {
      tools,
      plan: {
        selected: selected.map((t) => t.name),
        omitted,
        filtered,
        reasons: finalReasons,
        counts: { selected: selected.length, total: all.length, dynamicForge: dynamicForgeTools.length },
        schemaChars,
        fullChars,
        savedChars: Math.max(0, fullChars - schemaChars),
        maxTools: cap,
        expert: expert || "(default)",
      },
    };
  }

  return { select, catalog: all, byName };
}
