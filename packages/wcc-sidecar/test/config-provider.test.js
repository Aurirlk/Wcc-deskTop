/**
 * P1-5: provider presets applied to config, and env mirror stays in sync.
 * Kept as a unit test (server.js starts a listener, so it is not imported).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createConfigStore } from "../src/config-store.js";
import { providerPatch, resolveProvider, listProviders } from "../../../harness/src/index.js";

function withEnv(t, patch) {
  const keys = Object.keys(patch);
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) {
    if (patch[k] === undefined) delete process.env[k];
    else process.env[k] = patch[k];
  }
  t.after(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

test("providerPatch fills baseUrl/model; unknown id throws", () => {
  const p = providerPatch("qwen", "sk-x");
  assert.equal(p.provider, "qwen");
  assert.match(p.baseUrl, /dashscope/);
  assert.equal(p.model, "qwen-plus");
  assert.equal(p.apiKey, "sk-x");
  assert.throws(() => providerPatch("nope"), /unknown provider/);
  assert.equal(listProviders().length, 7);
});

test("resolveProvider: ollama needs no key, deepseek needs one", (t) => {
  withEnv(t, { WCC_MODEL_API_KEY: undefined, WCC_MODEL_BASE_URL: undefined });
  assert.equal(resolveProvider({ provider: "ollama" }).configured, true);
  assert.equal(resolveProvider({ provider: "deepseek" }).configured, false);
  assert.equal(resolveProvider({ provider: "deepseek", apiKey: "k" }).configured, true);
});

test("configStore: provider preset persists and env mirror is cleared on reset", (t) => {
  withEnv(t, {
    WCC_MODEL_BASE_URL: undefined,
    WCC_MODEL_API_KEY: undefined,
    WCC_MODEL_NAME: undefined,
    WCC_AUTO_APPROVE: undefined,
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-cfg-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const store = createConfigStore({ projectRoot: root });
  // Emulate what server.js /config POST does for { provider: "qwen" }.
  const preset = providerPatch("qwen", "sk-x");
  const saved = store.save({ ...preset, expert: "writer", autoApprove: false });
  assert.equal(saved.provider, "qwen");
  assert.equal(saved.apiKeySet, true);
  assert.match(store.getRaw().baseUrl, /dashscope/);
  assert.equal(process.env.WCC_MODEL_BASE_URL, preset.baseUrl);
  assert.equal(process.env.WCC_MODEL_API_KEY, "sk-x");

  const p = resolveProvider(store.getRaw());
  assert.equal(p.configured, true);
  assert.equal(p.provider, "qwen");

  // Clearing a value must clear the env mirror too (P1-5 regression).
  const cleared = store.save({ baseUrl: "", apiKey: "", provider: "custom" });
  assert.equal(cleared.apiKeySet, false);
  assert.equal(process.env.WCC_MODEL_BASE_URL, undefined);
  assert.equal(process.env.WCC_MODEL_API_KEY, undefined);
});

test("empty baseUrl/model must not clobber a preset", () => {
  const payload = { provider: "zhipu", apiKey: "k", baseUrl: "", model: "", expert: "writer" };
  const preset = providerPatch(payload.provider, payload.apiKey);
  const overrides = { ...payload };
  for (const k of ["baseUrl", "model"]) if (overrides[k] === "") delete overrides[k];
  const effective = { ...preset, ...overrides };
  assert.match(effective.baseUrl, /bigmodel/);
  assert.equal(effective.model, "glm-4-flash");
  assert.equal(effective.apiKey, "k");
});
