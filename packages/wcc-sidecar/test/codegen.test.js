import test from "node:test";
import assert from "node:assert/strict";
import { runCodegen, listCodegenTemplates } from "../src/codegen.js";
import { createToolRegistry, EXPERT_TOOL_CATEGORIES } from "../src/tools.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("codegen unit_wave emits Spawner.Create", () => {
  const lua = runCodegen("unit_wave", {
    moduleId: "ch1",
    unitId: "ugho",
    count: 5,
    interval: 30,
    waves: 3,
    x: 100,
    y: 200,
    targetX: 0,
    targetY: 0,
  });
  assert.match(lua, /Spawner\.Create/);
  assert.match(lua, /ugho/);
  assert.match(lua, /waves = 3/);
  assert.doesNotMatch(lua, /\bWait\s*\(/);
});

test("codegen dialogue_table", () => {
  const lua = runCodegen("dialogue_table", {
    lines: [{ speaker: "阿尔萨斯", text: "我们到了", x: 1, y: 2 }],
  });
  assert.match(lua, /Dialogue\.Play/);
  assert.match(lua, /阿尔萨斯/);
});

test("codegen unit_registry", () => {
  const lua = runCodegen("unit_registry", { rawcode: "n001", hp: 1200, name: "卫士" });
  assert.match(lua, /RegisterUnit/);
  assert.match(lua, /n001/);
});

test("list templates has schemas", () => {
  const list = listCodegenTemplates();
  assert.ok(list.length >= 4);
  assert.ok(list.every((t) => t.inputSchema));
});

test("expert filter hides forge for audit", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-tools-"));
  const reg = createToolRegistry({
    projectRoot: root,
    skillRoot: path.join(process.cwd(), "wcc-skill"),
    approval: { request: async () => true },
  });
  const audit = reg.list({ expert: "audit" }).map((t) => t.name);
  assert.ok(audit.includes("lua_check"));
  assert.ok(!audit.some((n) => n.startsWith("forge_")));
  assert.ok(audit.includes("read_file"));
  assert.ok(!audit.includes("write_file") || EXPERT_TOOL_CATEGORIES.audit.includes("src"));
  // audit has src category so write_file exists but is ok; forge should be absent
  const writer = reg.list({ expert: "writer" }).map((t) => t.name);
  assert.ok(writer.includes("codegen_run"));
  assert.ok(writer.includes("build_map"));
});
