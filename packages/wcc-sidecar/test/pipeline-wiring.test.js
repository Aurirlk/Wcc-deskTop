/**
 * Product wiring acceptance (2026-11-12).
 *
 * Proves that agent.js really runs the harness 7-layer pipeline on EVERY model
 * call — not just imports it. Specifically:
 *   - planning/spec + steering land in the system message each turn
 *   - tool injection supplies the schemas
 *   - the pipeline journal contains all 7 layers in order
 *   - recordHistory:false keeps ONE conversation history (no second copy)
 *   - a fresh per-turn budget means 10 user turns do not exhaust a cumulative one
 *   - large tool results go through the harness scratch offload
 *   - the offline (no key) path still invokes no tools
 *
 * Everything runs against a local mock SSE server. No network, no real key.
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
const ENV_KEYS = ["WCC_MODEL_BASE_URL", "WCC_MODEL_API_KEY", "WCC_MODEL_NAME"];

function sse(res, chunks) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const delta of chunks) res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function toolCall(id, name, args) {
  return {
    tool_calls: [{
      index: 0, id, type: "function",
      function: { name, arguments: JSON.stringify(args) },
    }],
  };
}

async function startMockModel(t, script) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const raw = await new Promise((resolve) => {
      let buf = "";
      req.on("data", (c) => (buf += c));
      req.on("end", () => resolve(buf));
    });
    requests.push(JSON.parse(raw || "{}"));
    sse(res, script[Math.min(requests.length - 1, script.length - 1)]);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { port: server.address().port, requests };
}

function cleanEnv(t) {
  const prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  t.after(() => {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

function tmpProject(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-pipeline-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

function buildAgent(root, tools, port, harnessOverride) {
  const harness = harnessOverride || createHarness({
    projectRoot: root, skillRoot: SKILL,
    catalog: tools.list(), steeringBudget: 8000, maxTools: 14,
  });
  const agent = createAgent({
    tools, projectRoot: root, skillRoot: SKILL, harness,
    getConfig: () => port
      ? { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "test-key", model: "mock-model", expert: "writer" }
      : {},
  });
  return { agent, harness };
}

const systemOf = (body) =>
  (body.messages || []).find((m) => m.role === "system")?.content || "";

test("product: all 7 layers run per model call; spec + steering injected; ONE history", async (t) => {
  cleanEnv(t);
  const root = tmpProject(t);
  const { port, requests } = await startMockModel(t, [[{ content: "管线已跑通" }]]);
  const tools = createToolRegistry({
    projectRoot: root, skillRoot: SKILL, approval: { request: async () => true },
  });
  const { agent, harness } = buildAgent(root, tools, port);

  const text = await agent.runTurnStream("写一个战役章节", () => {});
  assert.match(text, /管线已跑通/);
  assert.equal(requests.length, 1);

  const system = systemOf(requests[0]);
  assert.match(system, /# Spec/, "planning layer must inject the spec EVERY turn");
  assert.match(system, /# Steering/, "steering layer must inject selected docs");
  assert.match(system, /艾泽拉斯织码者/, "product role header must survive the pipeline");
  assert.ok(Array.isArray(requests[0].tools) && requests[0].tools.length > 0,
    "tool injection layer must supply schemas");

  assert.deepEqual(
    harness.pipeline.journal().map((j) => j.name),
    ["planning", "steering", "tools", "compaction", "approval", "budget", "scratch"],
    "the journal is proof the pipeline actually executed, not just imported"
  );
  assert.equal(harness.history.length, 0,
    "recordHistory:false — the product owns the ONE conversation history");

  const state = agent.harnessState();
  assert.equal(state.pipelineWired, true);
  assert.equal(state.pipeline.journal.length, 7);
  assert.equal(state.pipeline.specStage, "none");
  assert.ok(state.budget.turns >= 1);
});

test("product: 10 user turns do not drain a cumulative budget; spec injected each turn", async (t) => {
  cleanEnv(t);
  const root = tmpProject(t);
  const { port, requests } = await startMockModel(t, [[{ content: "ok" }]]);
  const tools = createToolRegistry({
    projectRoot: root, skillRoot: SKILL, approval: { request: async () => true },
  });
  const { agent, harness } = buildAgent(root, tools, port);

  for (let i = 0; i < 10; i++) {
    const text = await agent.runTurnStream(`第 ${i + 1} 轮`, () => {});
    assert.match(text, /ok/, `turn ${i + 1} must still reach the model`);
  }
  assert.equal(requests.length, 10);
  for (const [i, r] of requests.entries()) {
    assert.match(systemOf(r), /# Spec/, `spec missing on turn ${i + 1}`);
  }

  // Each user turn creates a FRESH budget. A cumulative one would have hit
  // MAX_TURNS long before turn 10 (the bug P1 originally fixed).
  const snap = agent.harnessState().budget;
  assert.equal(snap.turns, 1);
  assert.equal(snap.stopReason, null);
  assert.equal(harness.budget.snapshot().turns, 0,
    "the harness-scoped budget must stay untouched by the product");
});

test("product: big tool results offloaded via harness scratch; offline path invokes no tools", async (t) => {
  cleanEnv(t);
  const root = tmpProject(t);
  const { port } = await startMockModel(t, [
    [toolCall("c1", "list_dir", { subpath: "." })],
    [{ content: "已列出" }],
  ]);
  const realTools = createToolRegistry({
    projectRoot: root, skillRoot: SKILL, approval: { request: async () => true },
  });
  const big = "X".repeat(9000); // scratch threshold is 4000
  let calls = 0;
  const tools = {
    list: () => realTools.list(),
    dispatch: async () => { calls += 1; return { ok: true, output: big }; },
  };
  const { agent, harness } = buildAgent(root, tools, port);

  const events = [];
  const text = await agent.runTurnStream("列出项目目录", (e) => events.push(e));
  assert.match(text, /已列出/);
  assert.equal(calls, 1);

  const end = events.find((e) => e.type === "tool_end" && e.name === "list_dir");
  assert.ok(end, "tool_end event must exist");
  assert.equal(end.offloaded, true);
  assert.match(end.output, /\[offloaded\]/);
  assert.ok(harness.scratch.list().length >= 1,
    "the offloaded result must land in the SAME scratch store the pipeline uses");

  // Offline agent: no baseUrl/key -> structured plan, zero tool calls.
  const { agent: offline } = buildAgent(root, tools, null);
  const offlineText = await offline.runTurnStream("检查一下", () => {});
  assert.match(offlineText, /离线模式/);
  assert.equal(calls, 1, "offline path must not invoke any tool");
});
