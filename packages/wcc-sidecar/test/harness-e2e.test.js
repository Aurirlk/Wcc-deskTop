/**
 * P1 acceptance: mock-model end-to-end.
 *
 * Drives the real sidecar Agent + the real standalone Harness against a local
 * OpenAI-compatible SSE server. No network, no API key, no real model.
 *
 * Covered chain:
 *   user text -> streaming delta -> tool_call(write_file, bad Lua with Wait(1))
 *   -> file.write quality gate blocks -> feedback is fed back into the model
 *   -> tool_call(write_file, corrected Lua) -> tool_call(lua_check)
 *   -> final answer.
 *
 * Also asserts that steering / injector / budget / scratch are actually used
 * (not just imported), so "harness is wired" is a verifiable fact.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAgent } from "../src/agent.js";
import { createToolRegistry } from "../src/tools.js";
import { createHarness } from "../../../harness/src/index.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SKILL = path.join(REPO, "wcc-skill");

function sse(res, chunks) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const delta of chunks) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

function toolCall(id, name, args) {
  return {
    tool_calls: [{
      index: 0,
      id,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    }],
  };
}

const BAD_LUA = 'local Core = require("src.lib.wcc-core")\nWait(1)\nreturn {}\n';
const GOOD_LUA = 'local Core = require("src.lib.wcc-core")\nCore.SetTimeout(1, function() end)\nreturn {}\n';

async function startMockModel(t, script) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const body = await new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => resolve(raw));
    });
    requests.push(JSON.parse(body || "{}"));
    const step = requests.length - 1;
    const chunks = script[Math.min(step, script.length - 1)];
    sse(res, chunks);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { port: server.address().port, requests };
}

test("E2E: mock model streams, calls tools, gate feedback reaches model, loop completes", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-e2e-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const script = [
    [{ content: "我先生成一版 Lua。" }, toolCall("c1", "write_file", { path: "src/chapter_01.lua", content: BAD_LUA })],
    [{ content: "收到门禁反馈，修正。" }, toolCall("c2", "write_file", { path: "src/chapter_01.lua", content: GOOD_LUA })],
    [toolCall("c3", "lua_check", { subpath: "src" })],
    [{ content: "已修正并通过检查。" }],
  ];
  const { port, requests } = await startMockModel(t, script);

  const tools = createToolRegistry({
    projectRoot: root,
    skillRoot: SKILL,
    approval: { request: async () => true },
  });

  // ONE harness instance shared by the agent (双表面可以，双数据源不行).
  const harness = createHarness({
    projectRoot: root,
    skillRoot: SKILL,
    catalog: tools.list(),
    steeringBudget: 8000,
    maxTools: 14,
  });

  const prev = {
    base: process.env.WCC_MODEL_BASE_URL,
    key: process.env.WCC_MODEL_API_KEY,
    model: process.env.WCC_MODEL_NAME,
  };
  process.env.WCC_MODEL_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.WCC_MODEL_API_KEY = "test-key";
  process.env.WCC_MODEL_NAME = "mock-model";
  t.after(() => {
    for (const [k, v] of Object.entries(prev)) {
      const envKey = { base: "WCC_MODEL_BASE_URL", key: "WCC_MODEL_API_KEY", model: "WCC_MODEL_NAME" }[k];
      if (v === undefined) delete process.env[envKey];
      else process.env[envKey] = v;
    }
  });

  const agent = createAgent({
    tools, projectRoot: root, skillRoot: SKILL, harness,
    getConfig: () => ({
      baseUrl: `http://127.0.0.1:${port}/v1`,
      apiKey: "test-key",
      model: "mock-model",
      expert: "writer",
    }),
  });

  const events = [];
  const text = await agent.runTurnStream("请写一个 boss 战章节并检查", (e) => events.push(e));

  // 1) the loop completed with the final answer
  assert.match(text, /已修正并通过检查/);
  assert.ok(events.some((e) => e.type === "delta"));
  assert.ok(events.some((e) => e.type === "done"));

  // 2) tools really executed through the shared registry
  assert.ok(events.some((e) => e.type === "tool_start" && e.name === "write_file"));
  assert.ok(events.some((e) => e.type === "tool_start" && e.name === "lua_check"));
  assert.ok(events.some((e) => e.type === "tool_end" && e.name === "lua_check"));
  assert.equal(fs.readFileSync(path.join(root, "src", "chapter_01.lua"), "utf8"), GOOD_LUA);

  // 3) the file.write quality gate fired on the bad file and BLOCKED it
  const gate = events.find((e) => e.type === "harness" && e.kind === "file-write-gate");
  assert.ok(gate, "file.write hook must fire");
  assert.equal(gate.blocking, true, "Wait(1) must be blocked by the quality gate");

  // 4) the feedback really reached the model on the NEXT request
  assert.ok(requests.length >= 4, `expected >= 4 model calls, got ${requests.length}`);
  const secondBody = requests[1].messages.map((m) => String(m.content || "")).join("\n");
  assert.match(secondBody, /\[WCC 质量门禁\]/, "gate feedback must be fed back into the model");
  assert.match(secondBody, /Wait\(1\)|no-wait|未通过/);

  // 5) steering / injector / budget / scratch are genuinely in the product path
  const state = agent.harnessState();
  assert.equal(state.wired, true);
  assert.ok(state.steering, "steering selection must be recorded");
  assert.ok(state.steering.selectedIds.length > 0);
  assert.ok(state.steering.savedChars > 0, "conditional injection must save characters");
  assert.ok(state.tools, "tool injection plan must be recorded");
  assert.ok(state.tools.selected.length <= 14);
  assert.ok(state.budget.turns >= 1, "budget must track the tool loop");
  assert.ok(state.layers.length >= 7);
});

test("E2E: offline path is preserved (no key -> plan text, no tools invoked)", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-e2e-off-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tools = createToolRegistry({
    projectRoot: root, skillRoot: SKILL, approval: { request: async () => false },
  });
  const harness = createHarness({ projectRoot: root, skillRoot: SKILL, catalog: tools.list() });
  const prevKey = process.env.WCC_MODEL_API_KEY;
  const prevBase = process.env.WCC_MODEL_BASE_URL;
  delete process.env.WCC_MODEL_API_KEY;
  delete process.env.WCC_MODEL_BASE_URL;
  t.after(() => {
    if (prevKey !== undefined) process.env.WCC_MODEL_API_KEY = prevKey;
    if (prevBase !== undefined) process.env.WCC_MODEL_BASE_URL = prevBase;
  });

  const agent = createAgent({ tools, projectRoot: root, skillRoot: SKILL, harness, getConfig: () => ({}) });
  const events = [];
  const text = await agent.runTurnStream("请帮我检查 src", (e) => events.push(e));
  assert.match(text, /离线/);
  assert.equal(events.some((e) => e.type === "tool_start"), false);
  assert.ok(events.some((e) => e.type === "done"));
});

test("E2E: a failing lua_check is fed back so the model can self-correct", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-e2e-feedback-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "bad.lua"), "Wait(1)\n", "utf8");

  const script = [
    [{ content: "我先检查。" }, toolCall("c1", "lua_check", { subpath: "src" })],
    [{ content: "已按报告修正。" }],
  ];
  const { port, requests } = await startMockModel(t, script);
  const tools = createToolRegistry({
    projectRoot: root, skillRoot: SKILL, approval: { request: async () => true },
  });
  const harness = createHarness({ projectRoot: root, skillRoot: SKILL, catalog: tools.list() });
  const env = {
    WCC_MODEL_BASE_URL: `http://127.0.0.1:${port}/v1`,
    WCC_MODEL_API_KEY: "test-key",
    WCC_MODEL_NAME: "mock-model",
  };
  const prev = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const agent = createAgent({
    tools, projectRoot: root, skillRoot: SKILL, harness,
    getConfig: () => ({ baseUrl: env.WCC_MODEL_BASE_URL, apiKey: env.WCC_MODEL_API_KEY, model: "mock-model" }),
  });
  const events = [];
  const text = await agent.runTurnStream("请检查 src", (e) => events.push(e));

  assert.match(text, /已按报告修正/);
  assert.ok(events.some((e) => e.type === "tool_end" && e.name === "lua_check"));
  assert.ok(requests.length >= 2, "model must be called again after the failed check");
  const second = requests[1].messages.map((m) => String(m.content || "")).join("\n");
  assert.match(second, /\[WCC 质量门禁\]/);
  assert.match(second, /no-wait|ERROR|errors, 1/);
});

test("E2E: harness-owned tools are dispatched to harness.dispatch", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-e2e-dispatch-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tools = createToolRegistry({ projectRoot: root, skillRoot: SKILL, approval: { request: async () => true } });
  const harness = createHarness({ projectRoot: root, skillRoot: SKILL, catalog: tools.list() });
  const agent = createAgent({ tools, projectRoot: root, skillRoot: SKILL, harness });

  const r = await agent.dispatchTool("spec_status", {});
  assert.equal(r.ok, true);
  assert.match(r.output, /stage/);
  await assert.rejects(() => tools.dispatch("spec_status", {}), /unknown tool/);
});
