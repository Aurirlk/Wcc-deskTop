import test from "node:test";
import assert from "node:assert/strict";
import { createAgent } from "../src/agent.js";
import { createToolRegistry } from "../src/tools.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-agent-"));
  const tools = createToolRegistry({
    projectRoot: root,
    skillRoot: path.join(repoRoot, "wcc-skill"),
    approval: { request: async () => true },
  });
  return createAgent({ tools, projectRoot: root, skillRoot: path.join(repoRoot, "wcc-skill") });
}

test("offline runTurnStream emits delta and done", async () => {
  const prevBase = process.env.WCC_MODEL_BASE_URL;
  const prevKey = process.env.WCC_MODEL_API_KEY;
  delete process.env.WCC_MODEL_BASE_URL;
  delete process.env.WCC_MODEL_API_KEY;
  try {
    const agent = setup();
    const events = [];
    const text = await agent.runTurnStream("请帮我检查 src", (e) => events.push(e));
    assert.ok(text.includes("离线"));
    assert.ok(events.some((e) => e.type === "delta"));
    assert.ok(events.some((e) => e.type === "done"));
  } finally {
    if (prevBase) process.env.WCC_MODEL_BASE_URL = prevBase;
    if (prevKey) process.env.WCC_MODEL_API_KEY = prevKey;
  }
});
