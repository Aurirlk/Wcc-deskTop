/**
 * Codegen: structured JSON → WCC Lua snippets
 * (data-driven path from War3ExcelTool / 提百万 batch patterns)
 */

const TEMPLATES = {
  unit_wave: {
    name: "unit_wave",
    description: "生成 wcc-spawner 波次配置 + 注册单位",
    inputSchema: {
      type: "object",
      properties: {
        moduleId: { type: "string", description: "模块名，如 wave_ch1" },
        unitId: { type: "string", description: "四字码如 ugho" },
        count: { type: "integer" },
        interval: { type: "number" },
        waves: { type: "integer" },
        x: { type: "number" },
        y: { type: "number" },
        targetX: { type: "number" },
        targetY: { type: "number" },
      },
      required: ["moduleId", "unitId", "count"],
    },
  },
  dialogue_table: {
    name: "dialogue_table",
    description: "生成 Dialogue.Play 台词表 Lua",
    inputSchema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              speaker: { type: "string" },
              text: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["speaker", "text"],
          },
        },
      },
      required: ["lines"],
    },
  },
  unit_registry: {
    name: "unit_registry",
    description: "生成 wcc-objects.RegisterUnit 注册块",
    inputSchema: {
      type: "object",
      properties: {
        rawcode: { type: "string" },
        hp: { type: "number" },
        mana: { type: "number" },
        name: { type: "string" },
      },
      required: ["rawcode"],
    },
  },
  quest_table: {
    name: "quest_table",
    description: "生成 Quest.Create 配置",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string", enum: ["main", "side"] },
        objectives: { type: "array", items: { type: "string" } },
        rewards: { type: "array", items: { type: "string" } },
      },
      required: ["id", "title", "objectives"],
    },
  },
};

export function listCodegenTemplates() {
  return Object.values(TEMPLATES).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

function luaStr(s) {
  return `"${String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")}"`;
}

export function runCodegen(template, args = {}) {
  switch (template) {
    case "unit_wave": {
      const lines = [
        `-- codegen: unit_wave`,
        `local Spawner = require("src.lib.wcc-spawner")`,
        `return Spawner.Create({`,
        `  id = ${luaStr(args.moduleId)},`,
        `  unitId = ${luaStr(args.unitId)},`,
        `  count = ${Number(args.count ?? 1)},`,
        `  interval = ${Number(args.interval ?? 30)},`,
        args.waves != null ? `  waves = ${Number(args.waves)},` : null,
        args.x != null ? `  x = ${Number(args.x)},` : null,
        args.y != null ? `  y = ${Number(args.y)},` : null,
        args.targetX != null ? `  targetX = ${Number(args.targetX)},` : null,
        args.targetY != null ? `  targetY = ${Number(args.targetY)},` : null,
        `})`,
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "dialogue_table": {
      const rows = (args.lines || [])
        .map((l) => {
          const cam =
            l.x != null && l.y != null
              ? `,\n    camera = { x = ${Number(l.x)}, y = ${Number(l.y)} }`
              : "";
          return `  {\n    speaker = ${luaStr(l.speaker)},\n    text = ${luaStr(l.text)}${cam}\n  }`;
        })
        .join(",\n");
      return `-- codegen: dialogue_table\nlocal Dialogue = require("src.lib.wcc-dialogue")\nDialogue.Play({\n${rows}\n})`;
    }
    case "unit_registry": {
      const fields = [];
      if (args.hp != null) fields.push(`    hp = ${Number(args.hp)},`);
      if (args.mana != null) fields.push(`    mana = ${Number(args.mana)},`);
      if (args.name) fields.push(`    name = ${luaStr(args.name)},`);
      const fieldBlock = fields.length ? `{\n${fields.join("\n")}\n  }` : "{}";
      return `-- codegen: unit_registry\nlocal Objects = require("src.lib.wcc-objects")\nObjects.RegisterUnit(${luaStr(args.rawcode)}, ${fieldBlock})`;
    }
    case "quest_table": {
      const objs = (args.objectives || [])
        .map((o) => `    { text = ${luaStr(o)}, completed = false }`)
        .join(",\n");
      const rew = (args.rewards || [])
        .map((r) => `    ${luaStr(r)}`)
        .join(",\n");
      return `-- codegen: quest_table\nlocal Quest = require("src.lib.wcc-quest")\nQuest.Create({\n  id = ${luaStr(args.id)},\n  title = ${luaStr(args.title)},\n  description = ${luaStr(args.description || "")},\n  type = Quest.TYPE_${String(args.type || "side").toUpperCase()},\n  objectives = {\n${objs}\n  },\n  rewards = {\n${rew}\n  }\n})`;
    }
    default:
      throw new Error(`unknown codegen template: ${template}`);
  }
}
