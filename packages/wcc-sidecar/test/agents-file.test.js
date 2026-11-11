/**
 * WP6/WP7 sidecar surface regressions:
 *  - the repo-root AGENTS.md must be injected even when the active campaign
 *    dir has no AGENTS.md of its own (the desktop default is the demo campaign);
 *  - /health no longer hard-codes `harnessWired: true` but reports a real probe;
 *  - /check returns a real lua_check report for the renderer's 检查 view.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAgent } from "../src/agent.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SERVER = path.join(REPO, "packages/wcc-sidecar/src/server.js");
const DEMO = path.join(REPO, "examples/demo-campaign");

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(port, child, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`sidecar exited early: ${child.exitCode}`);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch {
      /* not listening yet */
    }
    await delay(100);
  }
  throw new Error("sidecar did not become ready in time");
}

test("standalone createAgent injects the repo AGENTS.md from a campaign projectRoot", () => {
  assert.equal(fs.existsSync(path.join(DEMO, "AGENTS.md")), false,
    "precondition: the demo campaign must NOT have its own AGENTS.md");

  const agent = createAgent({
    projectRoot: DEMO,
    skillRoot: path.join(REPO, "wcc-skill"),
    tools: { list: () => [], dispatch: async () => ({ ok: true, output: "" }) },
    getConfig: () => ({}),
  });

  const state = agent.harnessState();
  assert.equal(state.wired, true, "wired must be a real capability probe, true here");
  assert.equal(state.agentsFile, "AGENTS.md");
  const sel = agent.harnessInstance.steering.select({ intent: "写 lua", maxChars: 8000 });
  assert.ok(sel.selectedIds.includes("agents"),
    `repo contract must be selected; got ${JSON.stringify(sel.selectedIds)}`);
});

test("sidecar /health, steering and /check all report real values with a bare projectRoot", async (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-wp6-"));
  fs.mkdirSync(path.join(projectRoot, "src"));
  for (const name of ["main.lua", "chapter_01.lua"]) {
    fs.copyFileSync(path.join(DEMO, "src", name), path.join(projectRoot, "src", name));
  }
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER], {
    cwd: REPO,
    env: { ...process.env, WCC_PROJECT_ROOT: projectRoot, WCC_SIDECAR_PORT: String(port) },
    stdio: "ignore",
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  await waitReady(port, child);
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.harnessWired, true);
  assert.equal(health.harnessAgentsFile, "AGENTS.md");
  assert.ok(health.harnessLayers >= 7);

  const steering = await (await fetch(
    `http://127.0.0.1:${port}/harness/steering?intent=${encodeURIComponent("写lua并检查")}`
  )).json();
  assert.ok(steering.selectedIds.includes("agents"),
    `expected agents in ${JSON.stringify(steering.selectedIds)}`);

  const checked = await fetch(`http://127.0.0.1:${port}/check?subpath=src`);
  const report = await checked.json();
  assert.equal(checked.status, 200);
  assert.equal(report.ok, true);
  assert.match(report.output, /wcc-lua-check:/);
  assert.match(report.output, /files/);

  const missing = await fetch(`http://127.0.0.1:${port}/check?subpath=definitely-missing-dir`);
  const missingBody = await missing.json();
  assert.equal(missingBody.ok, false, "a missing target must not be reported as a success");
});
