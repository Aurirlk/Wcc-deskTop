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

test("bundleCampaign fails instead of emitting a fake-success bundle when modules are missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-build-empty-"));
  const out = path.join(tmp, "out");
  // Empty project: even the entry module src.main cannot be resolved.
  assert.throws(
    () => bundleCampaign({ projectRoot: tmp, entry: "src.main", outDir: out }),
    /unresolved modules.*src\.main/
  );
  // No artifact may be written on failure.
  assert.equal(fs.existsSync(path.join(out, "war3map.lua")), false);
  assert.equal(fs.existsSync(path.join(out, "build-stats.json")), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("bundleCampaign reports the first missing dependency by name", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-build-partial-"));
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "src", "main.lua"),
    'local x = require("src.lib.does_not_exist")\nreturn x\n',
    "utf8"
  );
  assert.throws(
    () => bundleCampaign({ projectRoot: tmp, entry: "src.main", outDir: path.join(tmp, "out") }),
    /src\.lib\.does_not_exist/
  );
  assert.equal(fs.existsSync(path.join(tmp, "out", "war3map.lua")), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});
