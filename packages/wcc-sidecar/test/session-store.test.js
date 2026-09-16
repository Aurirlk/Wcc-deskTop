import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSessionStore } from "../src/session-store.js";

test("jsonl append and resume", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-sess-"));
  const store = createSessionStore({ projectRoot: root });
  const id = store.newSession();
  store.append({ type: "user", text: "你好" });
  store.append({ type: "assistant", text: "在" });
  store.append({ type: "tool_end", name: "lua_check", ok: true, output: "0 issues" });
  const list = store.listSessions();
  assert.ok(list.some((s) => s.id === id));
  const prior = store.resume(id);
  assert.equal(prior.filter((m) => m.role === "user").length, 1);
  assert.equal(prior.filter((m) => m.role === "assistant").length, 1);
  assert.ok(prior.some((m) => m.role === "tool"));
});
