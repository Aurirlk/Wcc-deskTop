import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkPaths } from "../src/check.js";

test("detects Wait and TriggerSleepAction", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-check-"));
  const f = path.join(dir, "bad.lua");
  fs.writeFileSync(f, "function x()\n  Wait(1)\n  TriggerSleepAction(0.1)\nend\n");
  const r = checkPaths([dir]);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.rule === "no-wait"));
  assert.ok(r.issues.some((i) => i.rule === "no-trigger-sleep"));
});

test("clean file passes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-check-"));
  const f = path.join(dir, "ok.lua");
  fs.writeFileSync(f, "local Core = require('src.lib.wcc-core')\nCore.Log('hi')\n");
  const r = checkPaths([dir]);
  assert.equal(r.ok, true);
  assert.equal(r.issues.length, 0);
});
