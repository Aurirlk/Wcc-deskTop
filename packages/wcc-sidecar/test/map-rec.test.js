import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMapSources } from "../src/map-sources.js";

test("custom recommendation add/list/remove", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-rec-"));
  const ms = createMapSources({ projectRoot: root });
  const item = ms.addCustomRecommendation({
    title: "自定义主题",
    hint: "测试",
    links: [{ label: "例", url: "https://example.com/maps" }],
  });
  assert.ok(item.id.startsWith("custom_"));
  const list = ms.listThemeRecommendations();
  assert.ok(list.some((t) => t.custom && t.id === item.id));
  assert.ok(ms.removeCustomRecommendation(item.id));
  assert.ok(!ms.listThemeRecommendations().some((t) => t.id === item.id));
});

test("add rejects bad url", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-rec-"));
  const ms = createMapSources({ projectRoot: root });
  assert.throws(() =>
    ms.addCustomRecommendation({ title: "x", links: [{ url: "ftp://bad" }] })
  );
});
