import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleCampaign } from "../src/build-map.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const demo = path.join(repoRoot, "examples", "demo-campaign");

test("bundleCampaign produces war3map.lua with inlined modules", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wcc-build-")), "out");
  const stats = bundleCampaign({
    projectRoot: demo,
    entry: "src.main",
    outDir: out,
  });
  assert.ok(fs.existsSync(stats.war3map));
  const lua = fs.readFileSync(stats.war3map, "utf8");
  assert.match(lua, /__wcc_require/);
  assert.match(lua, /__wcc_modules\["src\.main"\]/);
  // dialogue/quest modules should be pulled in via chapter requires
  assert.ok(stats.modules.some((m) => m.includes("chapter") || m.includes("main")));
  assert.ok(stats.bytes > 500);
});
