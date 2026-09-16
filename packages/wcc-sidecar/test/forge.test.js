import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listForgeSessions, createForgeClientFromSession } from "../src/forge-mcp.js";

test("listForgeSessions returns [] when lock dir missing", () => {
  process.env.WC3FORGE_MCP_LOCK_DIR = path.join(os.tmpdir(), "no-such-forge-mcp-" + Date.now());
  assert.deepEqual(listForgeSessions(), []);
});

test("listForgeSessions reads lock files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-lock-"));
  process.env.WC3FORGE_MCP_LOCK_DIR = dir;
  fs.writeFileSync(
    path.join(dir, "12345.lock"),
    JSON.stringify({ pid: 12345, port: 19001, token: "secret-token", label: "map-A" })
  );
  const s = listForgeSessions();
  assert.equal(s.length, 1);
  assert.equal(s[0].port, 19001);
  assert.equal(s[0].token, "secret-token");
});

test("createForgeClientFromSession fails cleanly on closed port", async () => {
  const client = createForgeClientFromSession({
    pid: 1,
    port: 1,
    token: "x",
    label: "t",
  });
  await assert.rejects(() => client.listTools());
  client.close();
});
