import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMapSources, MAP_SOURCES } from "../src/map-sources.js";

test("catalog has Chinese platforms and forge", () => {
  assert.ok(MAP_SOURCES.some((s) => s.id === "wc3-forge"));
  assert.ok(MAP_SOURCES.some((s) => s.kind === "platform-client"));
  assert.ok(MAP_SOURCES.length >= 8);
});

test("scanLocal finds w3x in project maps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-maps-"));
  const dir = path.join(root, "maps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "demo.w3x"), "x");
  const ms = createMapSources({ projectRoot: root });
  const r = ms.scanLocal();
  assert.ok(r.count >= 1);
  assert.ok(r.maps.some((m) => m.name === "demo.w3x"));
});
