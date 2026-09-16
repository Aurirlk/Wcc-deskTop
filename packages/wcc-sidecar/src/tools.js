/**
 * Tool registry — categorized, schema-aware, expert-filtered.
 */
import fs from "node:fs";
import path from "node:path";
import { checkPaths, formatReport } from "../../wcc-lua-check/src/check.js";
import { listCodegenTemplates, runCodegen } from "./codegen.js";
import { importTableToJobs } from "./table-import.js";
import { createMapSources } from "./map-sources.js";

function resolveInProject(projectRoot, rel) {
  const abs = path.resolve(projectRoot, rel);
  const root = path.resolve(projectRoot);
  const relOut = path.relative(root, abs);
  if (relOut.startsWith("..") || path.isAbsolute(relOut)) {
    throw new Error("path escapes project root");
  }
  return abs;
}

/** Which tool categories each expert prefers (function-calling surface). */
export const EXPERT_TOOL_CATEGORIES = {
  writer: ["project", "src", "skill", "check", "codegen", "obj", "build"],
  boss: ["project", "src", "skill", "check", "codegen", "obj"],
  spawn: ["project", "src", "skill", "check", "codegen", "obj"],
  audit: ["project", "src", "check", "skill"],
};

export function createToolRegistry({ projectRoot, skillRoot, approval, forgeManager, workbench, buildMap, mapSources }) {
  const maps = mapSources || createMapSources({ projectRoot });
  const tools = {
    list_dir: {
      category: "project",
      description: "List files under project root",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { subpath: { type: "string", description: "相对项目根的路径" } },
      },
      async run({ subpath = "." }) {
        const dir = resolveInProject(projectRoot, subpath);
        return fs
          .readdirSync(dir, { withFileTypes: true })
          .map((d) => (d.isDirectory() ? d.name + "/" : d.name))
          .join("\n");
      },
    },
    read_file: {
      category: "src",
      description: "Read a text file in the project",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "项目内相对路径" } },
        required: ["path"],
      },
      async run({ path: rel }) {
        return fs.readFileSync(resolveInProject(projectRoot, rel), "utf8");
      },
    },
    write_file: {
      category: "src",
      description: "Write a text file in the project (requires approval)",
      needsApproval: true,
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
      async run({ path: rel, content }) {
        const abs = resolveInProject(projectRoot, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, String(content ?? ""), "utf8");
        return `wrote ${rel} (${String(content ?? "").length} chars)`;
      },
    },
    lua_check: {
      category: "check",
      description: "Run WCC Lua static checks (no Wait / leaks / fake APIs)",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { subpath: { type: "string", default: "src" } },
      },
      async run({ subpath = "src" }) {
        const target = resolveInProject(projectRoot, subpath);
        const report = checkPaths([target]);
        return formatReport(report, projectRoot);
      },
    },
    skill_load: {
      category: "skill",
      description: "Load WCC skill doc: skill.md | conventions.md | api.md | boss.md | dialogue.md | object-batch.md | data-codegen.md",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      async run({ name = "skill.md" }) {
        const candidates = [
          skillRoot && path.resolve(skillRoot),
          path.resolve(projectRoot, "wcc-skill"),
          path.resolve(projectRoot, "..", "wcc-skill"),
          path.resolve(projectRoot, "..", "..", "wcc-skill"),
          path.resolve(process.cwd(), "wcc-skill"),
        ].filter(Boolean);
        const map = {
          "skill.md": "skill.md",
          "conventions.md": path.join("knowledge", "conventions.md"),
          "api.md": path.join("knowledge", "api-best-practices.md"),
          "boss.md": path.join("patterns", "task-boss-fight.md"),
          "dialogue.md": path.join("patterns", "task-dialogue-sequence.md"),
          "object-batch.md": path.join("patterns", "task-object-batch.md"),
          "data-codegen.md": path.join("patterns", "task-data-codegen.md"),
        };
        const rel = map[name] || name;
        for (const root of candidates) {
          const abs = path.join(root, rel);
          if (fs.existsSync(abs)) return fs.readFileSync(abs, "utf8");
        }
        return `(skill file not found: ${rel})`;
      },
    },
    chapter_tree: {
      category: "project",
      description: "List campaign Lua chapters and lib files",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        if (!workbench) return "workbench not wired";
        return JSON.stringify(workbench.chapterTree(), null, 2);
      },
    },
    bible_get: {
      category: "project",
      description: "Read campaign bible (units, regions, chapters)",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        if (!workbench) return "workbench not wired";
        return JSON.stringify(workbench.readBible(), null, 2);
      },
    },
    bible_set: {
      category: "project",
      description: "Merge-patch campaign bible JSON",
      needsApproval: true,
      inputSchema: {
        type: "object",
        properties: {
          patch: {
            type: "object",
            description: "要合并进圣经的字段",
            additionalProperties: true,
          },
        },
        required: ["patch"],
      },
      async run({ patch }) {
        if (!workbench) return "workbench not wired";
        const next = { ...workbench.readBible(), ...(patch || {}) };
        workbench.writeBible(next);
        return JSON.stringify(next, null, 2);
      },
    },
    codegen_list: {
      category: "codegen",
      description: "List codegen templates (JSON → Lua snippets)",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        return JSON.stringify(listCodegenTemplates(), null, 2);
      },
    },
    codegen_run: {
      category: "codegen",
      description: "Generate Lua from template: unit_wave | dialogue_table | unit_registry | quest_table",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            enum: ["unit_wave", "dialogue_table", "unit_registry", "quest_table"],
          },
          args: { type: "object", additionalProperties: true },
        },
        required: ["template", "args"],
      },
      async run({ template, args }) {
        return runCodegen(template, args || {});
      },
    },
    table_import: {
      category: "codegen",
      description: "Import Excel-export JSON/CSV table → list codegen jobs (War3ExcelTool style)",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "项目内 .json 或 .csv 路径" },
          generate: {
            type: "boolean",
            description: "true 时按 jobs 顺序拼接生成完整 Lua 并返回",
          },
        },
        required: ["path"],
      },
      async run({ path: rel, generate }) {
        const abs = resolveInProject(projectRoot, rel);
        const { tables, jobs } = importTableToJobs(abs);
        if (!generate) {
          return JSON.stringify({ count: jobs.length, jobs, tables }, null, 2);
        }
        const parts = jobs.map((j, i) => {
          const code = runCodegen(j.template, j.args);
          return `-- job ${i + 1} ${j.template}\n${code}`;
        });
        const header = `-- table_import ${rel} → ${jobs.length} jobs\n`;
        return header + parts.join("\n\n");
      },
    },
    forge_status: {
      category: "forge",
      description: "Check wc3-forge MCP sessions",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        if (!forgeManager) return "forge manager not wired";
        return JSON.stringify(await forgeManager.status(), null, 2);
      },
    },
    forge_connect: {
      category: "forge",
      description: "Connect to a wc3-forge session",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { pid: { type: "number" }, port: { type: "number" } },
      },
      async run({ pid, port }) {
        if (!forgeManager) return "forge manager not wired";
        const r = await forgeManager.selectSession(pid || port);
        return JSON.stringify(r || { connected: false }, null, 2);
      },
    },
    forge_list_tools: {
      category: "forge",
      description: "List tools from connected wc3-forge",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        if (!forgeManager) return "forge manager not wired";
        const st = await forgeManager.status();
        if (!st.connected) return `not connected: ${st.hint || st.error || ""}`;
        return forgeManager
          .getToolsForAgent()
          .map((t) => `${t.name}: ${t.description}`)
          .join("\n")
          .slice(0, 20_000);
      },
    },
    build_map: {
      category: "build",
      description: "Bundle src + wcc-lib into dist/build/war3map.lua",
      needsApproval: true,
      inputSchema: {
        type: "object",
        properties: { entry: { type: "string", default: "src.main" } },
      },
      async run({ entry = "src.main" } = {}) {
        if (!buildMap) return "build not wired";
        return JSON.stringify(buildMap({ entry }), null, 2);
      },
    },
    map_sources_list: {
      category: "project",
      description: "List curated WC3 map sites/platforms/editors (links only, no scraping)",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["community", "download-site", "platform-client", "editor", "editor-mcp"],
          },
        },
      },
      async run({ kind }) {
        return JSON.stringify(maps.listSources(kind), null, 2);
      },
    },
    map_recommendations: {
      category: "project",
      description: "Theme + custom map-site recommendation links (user opens browser)",
      needsApproval: false,
      inputSchema: { type: "object", properties: {} },
      async run() {
        return JSON.stringify(maps.listThemeRecommendations(), null, 2);
      },
    },
    map_recommendation_add: {
      category: "project",
      description: "Add a custom map-site recommendation theme (title + links) to .wcc/map-recommendations.json",
      needsApproval: true,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          hint: { type: "string" },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["title", "links"],
      },
      async run({ title, hint, links }) {
        return JSON.stringify(maps.addCustomRecommendation({ title, hint, links }), null, 2);
      },
    },
    map_open_site: {
      category: "project",
      description: "Open a map site/platform URL in the system browser (user downloads manually)",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "来源 id，如 hive / epicwar" } },
        required: ["id"],
      },
      async run({ id }) {
        return JSON.stringify(await maps.openSite(id), null, 2);
      },
    },
    local_maps_scan: {
      category: "project",
      description: "Scan local Maps folders and project maps/ for .w3x/.w3m (user-owned files)",
      needsApproval: false,
      inputSchema: {
        type: "object",
        properties: {
          roots: {
            type: "array",
            items: { type: "string" },
            description: "额外扫描目录",
          },
        },
      },
      async run({ roots } = {}) {
        return JSON.stringify(maps.scanLocal(roots || []), null, 2);
      },
    },
  };

  async function dispatch(name, args, { autoApprove = false } = {}) {
    if (name.startsWith("forge_") && !tools[name]) {
      const forgeName = name.slice("forge_".length);
      if (!forgeManager) return { ok: false, output: "forge manager not wired" };
      if (!autoApprove) {
        const ok = await approval.request({ name, args });
        if (!ok) return { ok: false, output: "user denied approval", denied: true };
      }
      try {
        const output = await forgeManager.callForgeTool(forgeName, args || {});
        return { ok: true, output: String(output).slice(0, 200_000) };
      } catch (e) {
        return { ok: false, output: String(e.message || e) };
      }
    }

    const tool = tools[name];
    if (!tool) throw new Error(`unknown tool: ${name}`);
    if (tool.needsApproval && !autoApprove) {
      const ok = await approval.request({ name, args });
      if (!ok) return { ok: false, output: "user denied approval", denied: true };
    }
    try {
      const output = await tool.run(args || {});
      return { ok: true, output: String(output).slice(0, 200_000) };
    } catch (e) {
      return { ok: false, output: String(e.message || e) };
    }
  }

  function list({ expert } = {}) {
    const allow = expert ? new Set(EXPERT_TOOL_CATEGORIES[expert] || []) : null;
    const base = Object.entries(tools)
      .filter(([, t]) => !allow || allow.has(t.category))
      .map(([name, t]) => ({
        name,
        description: t.description,
        category: t.category,
        needsApproval: t.needsApproval,
        inputSchema: t.inputSchema || { type: "object", properties: {} },
      }));
    if (forgeManager && (!allow || allow.has("forge"))) {
      for (const t of forgeManager.getToolsForAgent()) {
        base.push({
          name: t.name,
          description: t.description,
          category: "forge",
          needsApproval: true,
          inputSchema: t.schema || { type: "object", properties: {} },
        });
      }
    }
    return base;
  }

  return { list, dispatch, EXPERT_TOOL_CATEGORIES };
}
