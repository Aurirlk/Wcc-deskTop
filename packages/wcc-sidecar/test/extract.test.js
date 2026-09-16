import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractDialogues, extractQuests, extractSpawners } from "../src/lua-extract.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const chapter = path.join(repoRoot, "examples/demo-campaign/src/chapter_01.lua");
const src = fs.readFileSync(chapter, "utf8");

test("extractDialogues from demo chapter", () => {
  const ds = extractDialogues(src);
  assert.ok(ds.length >= 1);
  assert.ok(ds[0].lineCount >= 3);
  assert.equal(ds[0].lines[0].speaker, "阿尔萨斯");
  assert.match(ds[0].lines[0].text || "", /斯坦恩布莱德/);
});

test("extractQuests from demo chapter", () => {
  const qs = extractQuests(src);
  assert.ok(qs.length >= 1);
  const q = qs.find((x) => x.id === "rescue_villagers") || qs[0];
  assert.equal(q.title, "拯救村民");
  assert.equal(q.type, "main");
  assert.ok(q.objectives.length >= 2);
  assert.ok(q.rewards.some((r) => /经验|金币/.test(r)));
});

test("extractSpawners empty on demo", () => {
  const ss = extractSpawners(src);
  assert.equal(ss.length, 0);
});

test("extractSpawners on synthetic", () => {
  const lua = `
Spawner.Create({
  unitId = 'ugho',
  count = 5,
  interval = 30,
  waves = 3,
  x = 100, y = 200,
  targetX = 0, targetY = 0
})
`;
  const ss = extractSpawners(lua);
  assert.equal(ss.length, 1);
  assert.equal(ss[0].unitId, "ugho");
  assert.equal(ss[0].count, 5);
  assert.equal(ss[0].waves, 3);
});
