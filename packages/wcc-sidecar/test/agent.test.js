import test from "node:test";
import assert from "node:assert/strict";
import { createToolRegistry } from "../src/tools.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const skillRoot = path.join(repoRoot, "wcc-skill");

test("write_file requires approval and is denied by default", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-side-"));
  const tools = createToolRegistry({
    projectRoot: root,
    skillRoot,
    approval: { request: async () => false },
  });
  const r = await tools.dispatch("write_file", { path: "a.lua", content: "x" });
  assert.equal(r.ok, false);
  assert.equal(r.denied, true);
});

test("lua_check runs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-side-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "t.lua"), "Wait(1)\n");
  const tools = createToolRegistry({
    projectRoot: root,
    skillRoot,
    approval: { request: async () => true },
  });
  const r = await tools.dispatch("lua_check", { subpath: "src" });
  assert.equal(r.ok, true);
  assert.match(r.output, /no-wait/);
});

test("skill_load works", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-side-"));
  const tools = createToolRegistry({
    projectRoot: root,
    skillRoot,
    approval: { request: async () => true },
  });
  const r = await tools.dispatch("skill_load", { name: "skill.md" });
  assert.equal(r.ok, true);
  assert.match(r.output, /艾泽拉斯|WCC|Lua/i);
});
