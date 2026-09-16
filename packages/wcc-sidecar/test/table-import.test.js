import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importTableToJobs, parseTableFile } from "../src/table-import.js";
import { runCodegen } from "../src/codegen.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sample = path.join(repoRoot, "examples/demo-campaign/tables-sample.json");

test("import sample json produces jobs", () => {
  const { tables, jobs } = importTableToJobs(sample);
  assert.ok(tables.units.length >= 2);
  assert.ok(tables.waves.length >= 1);
  assert.ok(tables.dialogue.length >= 2);
  assert.ok(tables.quests.length >= 1);
  assert.ok(jobs.length >= 5);
  const wave = jobs.find((j) => j.template === "unit_wave");
  assert.equal(wave.args.unitId, "ugho");
});

test("csv import", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-csv-"));
  const f = path.join(dir, "t.csv");
  fs.writeFileSync(f, "kind,rawcode,hp,name\nunit,n001,100,A\nunit,n002,200,B\n", "utf8");
  const { tables, jobs } = importTableToJobs(f);
  assert.equal(tables.units.length, 2);
  const lua = runCodegen(jobs[0].template, jobs[0].args);
  assert.match(lua, /n001/);
});

test("parseTableFile rejects bad ext", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-bad-"));
  const f = path.join(dir, "x.txt");
  fs.writeFileSync(f, "nope");
  assert.throws(() => parseTableFile(f));
});
