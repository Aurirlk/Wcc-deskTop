/**
 * Guard for the frozen `@wcc/shared` placeholder (see docs/P0-DISPOSITIONS.md N5).
 *
 * This package is intentionally NOT built and NOT imported. The assertions here
 * prevent it from silently becoming a second protocol source of truth: if
 * someone starts importing it at runtime, or ships a dist/ without aligning the
 * IPC names with main.js / preload.cjs, this test fails loudly.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");
const REPO = path.resolve(PKG, "..", "..");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist") continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(abs, out);
    else if (/\.(js|mjs|cjs|ts)$/.test(ent.name)) out.push(abs);
  }
  return out;
}

test("@wcc/shared stays a frozen types-only placeholder", () => {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));
  assert.equal(pkgJson.name, "@wcc/shared");
  assert.equal(pkgJson.private, true);

  // No built artifact: main/types deliberately point at a missing dist/.
  assert.equal(fs.existsSync(path.join(PKG, "dist")), false,
    "dist/ appeared: align IPC names with main.js/preload.cjs before shipping it");

  // No runtime consumer anywhere in the repo.
  const importers = walk(REPO)
    .filter((f) => !f.startsWith(path.join(PKG, path.sep)))
    .filter((f) => /@wcc\/shared/.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(REPO, f).replace(/\\/g, "/"));
  assert.deepEqual(importers, [],
    `@wcc/shared gained runtime importer(s): ${importers.join(", ")}`);
});
