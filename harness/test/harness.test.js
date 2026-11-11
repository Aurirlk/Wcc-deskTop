/**
 * Harness self-test. Run: node --test harness/test/harness.test.js
 * Zero deps; uses temp dirs and the real wcc-skill tree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  parseFrontMatter, globToRegExp, matchesGlob, collectSteering, selectSteering, renderSteering, createSteering, annotationFor,
  createSpecStore, createScratch,
  resolveProvider, listProviders, providerPatch, PROVIDERS,
  createBudget, estimateTokens, summarizeHistory, patchToolCalls, STOP_REASONS,
  createHookBus, installDefaultHooks, EVENTS,
  createToolInjector, mergeCatalog, TOOL_CATALOG,
  createPipeline, withBudget,
  SCRIPT_MANIFEST, findScript, runScript, describeScripts, probeForge,
  unifiedDiff, mapSnapshot, mapDiff, mapVerify, mapSetScript,
  SET_SCRIPT_STRATEGIES, SUPPORTED_TARGET_PATCHES,
  renderStatic, diffPreview, clip, displayWidth, createTui,
  createHarness,
  defaultGateRunner,
} from "../src/index.js";
import { checkPaths as checkLuaPaths, formatReport as formatLuaReport } from "../../packages/wcc-lua-check/src/check.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SKILL = path.join(ROOT, "wcc-skill");

function tmp(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "wcc-harness-test-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

test("front matter: parses yaml-ish header and keeps body", () => {
  const text = '---\nid: conventions\nmode: conditional\nfileMatch: "**/*.lua,**/lib/**"\npriority: 60\n---\n# Body\nhello\n';
  const r = parseFrontMatter(text);
  assert.equal(r.hasFrontMatter, true);
  assert.equal(r.meta.id, "conventions");
  assert.equal(r.meta.mode, "conditional");
  assert.equal(r.meta.priority, 60);
  assert.deepEqual(r.meta.fileMatch, ["**/*.lua", "**/lib/**"]);
  assert.match(r.body, /# Body/);
  assert.equal(parseFrontMatter("# plain").hasFrontMatter, false);
});

test("glob: nested and bare patterns", () => {
  assert.equal(globToRegExp("**/*.lua").test("src/map/chapter_01.lua"), true);
  assert.equal(globToRegExp("src/*.lua").test("src/a/b.lua"), false);
  assert.equal(matchesGlob("src/map/chapter_01.lua", "*.lua"), true);
  assert.equal(matchesGlob("src\\map\\chapter_01.lua", "**/*.lua"), true);
});

test("steering: real wcc-skill tree is loaded, selection is conditional and saves chars", () => {
  const docs = collectSteering({ skillRoot: SKILL });
  assert.ok(docs.length >= 8, `expected >= 8 skill docs, got ${docs.length}`);
  const luaCtx = selectSteering({ docs, context: { files: ["src/map/chapter_01.lua"], intent: "写 boss 战对话", maxChars: 8000 } });
  const emptyCtx = selectSteering({ docs, context: { files: [], intent: "", maxChars: 8000 } });
  assert.ok(luaCtx.selectedIds.some((id) => id.includes("conventions")), JSON.stringify(luaCtx.selectedIds));
  assert.ok(luaCtx.usedChars <= 8000);
  assert.ok(luaCtx.savedChars > 0);
  assert.ok(emptyCtx.selectedIds.length <= luaCtx.selectedIds.length);
  assert.ok(renderSteering(luaCtx).includes("# Steering"));
});

test("steering: budget truncation is reported, front matter annotation is stable", () => {
  const docs = collectSteering({ skillRoot: SKILL });
  const r = selectSteering({ docs, context: { files: ["a.lua"], intent: "boss 对话 表格 物编 地图", maxChars: 600 } });
  assert.ok(r.usedChars <= 600);
  assert.ok(r.truncated.length > 0);
  assert.match(annotationFor("knowledge/conventions.md"), /mode: conditional/);
  assert.equal(annotationFor("unknown.md"), null);
  const s = createSteering({ skillRoot: SKILL });
  const before = s.docs.length;
  assert.equal(s.reload().length, before);
});

test("spec: init / tasks / done / stage / progress", (t) => {
  const d = tmp(t);
  const s = createSpecStore({ projectRoot: d });
  assert.equal(s.stage(), "none");
  assert.deepEqual(s.init("第一章").written, ["requirements", "design", "tasks"]);
  assert.equal(s.stage(), "tasks");
  assert.equal(s.parseTasks().length, 5);
  assert.equal(s.setTask("T1", true).ok, true);
  assert.equal(s.progress().done, 1);
  assert.equal(s.stage(), "executing");
  for (const x of s.parseTasks()) s.setTask(x.id, true);
  assert.equal(s.stage(), "done");
  assert.equal(s.summary().progress.percent, 100);
  assert.equal(fs.existsSync(path.join(d, ".wcc", "spec", "requirements.md")), true);
});

test("scratch: offload / recall / grep / wrapToolResult", (t) => {
  const d = tmp(t);
  const s = createScratch({ projectRoot: d, threshold: 100 });
  assert.equal(s.wrapToolResult("small", "short output"), "short output");
  const off = s.offload("forge_units", "alpha\nWait(1)\nbeta\n" + "x".repeat(300), { meta: { tool: "forge" } });
  assert.equal(off.offloaded, true);
  assert.match(off.summary, /offloaded/);
  assert.equal(s.recall(off.id).ok, true);
  assert.ok(s.grep("Wait").count >= 1);
  assert.ok(s.list().length >= 1);
  assert.match(s.wrapToolResult("big", "x".repeat(500)), /offloaded/);
});

test("providers: presets are domestic/local and ollama needs no key", () => {
  assert.equal(listProviders().length, Object.keys(PROVIDERS).length);
  assert.equal(resolveProvider({ provider: "deepseek" }).configured, false);
  assert.equal(resolveProvider({ provider: "deepseek", apiKey: "sk-x" }).configured, true);
  assert.equal(resolveProvider({ provider: "ollama" }).configured, true);
  assert.equal(resolveProvider({ provider: "ollama" }).requiresKey, false);
  assert.equal(providerPatch("qwen", "k").baseUrl, PROVIDERS.qwen.baseUrl);
  assert.throws(() => providerPatch("nope"));
});

test("budget: consume / cancel / compaction / tool-call repair", () => {
  const b = createBudget({ maxTurns: 2, maxTokens: 100 });
  b.beginTurn();
  b.consume("x".repeat(800), { label: "demo" });
  const v = b.check();
  assert.equal(v.stopReason, STOP_REASONS.MAX_TOKENS);
  assert.equal(b.cancel("user").stopReason, STOP_REASONS.CANCELLED);
  assert.ok(estimateTokens("中文".repeat(20)) >= 30);
  const msgs = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: "x".repeat(200) + i }));
  const sum = summarizeHistory(msgs, { maxTokens: 300 });
  assert.equal(sum.compacted, true);
  assert.ok(sum.removed > 0);
  assert.match(sum.messages[1].content, /history-compacted/);
  const broken = [
    { role: "assistant", content: null, tool_calls: [{ id: "c1" }, { id: "c2" }] },
    { role: "tool", tool_call_id: "c1", content: "ok" },
    { role: "tool", tool_call_id: "orphan", content: "?" },
  ];
  const patched = patchToolCalls(broken);
  assert.equal(patched.patched, 2);
  assert.equal(patched.messages.filter((m) => m.role === "tool").length, 2);
  assert.ok(patched.messages.some((m) => m.role === "tool" && /cancelled/.test(m.content)));
  assert.equal(patched.messages.some((m) => m.tool_call_id === "orphan"), false);
});

test("hooks: .lua write fires the real WCC checker; non-lua is skipped", async (t) => {
  const d = tmp(t);
  const bus = createHookBus();
  installDefaultHooks(bus, { projectRoot: d });
  fs.writeFileSync(path.join(d, "clean.lua"), "local x = 1\nreturn x\n", "utf8");
  fs.writeFileSync(path.join(d, "bad.lua"), "Wait(1)\n", "utf8");
  const ok = await bus.emit("file.write", { path: "clean.lua" });
  const bad = await bus.emit("file.write", { path: "bad.lua" });
  const md = await bus.emit("file.write", { path: "README.md" });
  assert.equal(ok.results[0].result.ok, true);
  assert.equal(bad.results[0].result.ok, false);
  assert.equal(bad.results[0].result.gate, "lua_check");
  assert.equal(md.results[0].result.skipped, true);
  assert.ok(EVENTS.includes("task.complete"));
  assert.ok(Object.keys(bus.list()).length >= 3);
});

test("AGENTS.md is a single, always-on repo contract (no duplicated iron rules)", (t) => {
  const agents = path.join(ROOT, "AGENTS.md");
  assert.equal(fs.existsSync(agents), true, "repo-root AGENTS.md must exist");
  const docs = collectSteering({ skillRoot: SKILL, agentsFile: agents });
  const a = docs.find((d) => d.rel === "AGENTS.md");
  assert.ok(a, "steering must see AGENTS.md");
  assert.equal(a.mode, "always");
  assert.ok(a.priority >= 100);
  const sel = selectSteering({ docs, context: { files: [], intent: "", maxChars: 20000 } });
  assert.ok(sel.selectedIds.includes(a.id), "always-on doc must be selected even with no context");
  const body = fs.readFileSync(agents, "utf8");
  assert.match(body, /wcc-skill\/skill\.md/);
  assert.match(body, /不复述编程铁律全文|不复制/);
  assert.doesNotMatch(body, /^### 2\.1 语言强制/m, "must not copy the iron rules verbatim");
});

test("lua-check: errors and warnings are counted separately; warnings never fail ok", (t) => {
  const d = tmp(t);
  fs.writeFileSync(path.join(d, "clean.lua"), "local x = 1\nreturn x\n", "utf8");
  fs.writeFileSync(path.join(d, "warn.lua"), "local l = Location(0, 0)\n", "utf8");
  fs.writeFileSync(path.join(d, "err.lua"), "Wait(1)\n", "utf8");
  const clean = checkLuaPaths([path.join(d, "clean.lua")]);
  assert.equal(clean.ok, true);
  assert.equal(clean.errors, 0);
  assert.equal(clean.warnings, 0);
  const warn = checkLuaPaths([path.join(d, "warn.lua")]);
  assert.equal(warn.ok, true, "warnings must not break the existing corpus");
  assert.equal(warn.errors, 0);
  assert.ok(warn.warnings >= 1);
  const err = checkLuaPaths([path.join(d, "err.lua")]);
  assert.equal(err.ok, false);
  assert.ok(err.errors >= 1);
  const text = formatLuaReport(warn, d);
  assert.match(text, /0 errors, 1 warnings|0 errors, \d+ warnings/);
  assert.match(text, /review prompts/);
});

test("hooks: task.complete gate actually executes and blocks on errors", async (t) => {
  const d = tmp(t);
  const bus = createHookBus();
  installDefaultHooks(bus, { projectRoot: d, gateOnTaskComplete: true });
  const okGate = await bus.emit("task.complete", { taskId: "T1", run: true });
  assert.equal(okGate.results[0].result.executed, true);
  assert.equal(okGate.results[0].result.skipped, undefined);
  assert.equal(okGate.results[0].result.verdict, "allow");

  const failingGate = defaultGateRunner(d, { targets: ["bad"] });
  fs.mkdirSync(path.join(d, "bad"), { recursive: true });
  fs.writeFileSync(path.join(d, "bad", "x.lua"), "Wait(1)\n", "utf8");
  assert.equal((await failingGate()).ok, false);

  const badBus = createHookBus();
  installDefaultHooks(badBus, { projectRoot: d, gateOnTaskComplete: true, runGate: failingGate });
  const blocked = await badBus.emit("task.complete", { taskId: "T2", run: true });
  assert.equal(blocked.results[0].result.verdict, "block");
  assert.equal(blocked.blocking, true);
});

test("WP8: task.complete gate resolves repo targets from a campaign projectRoot", async () => {
  // Desktop default: a campaign dir with no repo-relative target paths.
  // Before WP8 every target missed and the gate returned skipped:true.
  const h = createHarness({ projectRoot: path.join(ROOT, "examples/demo-campaign") });
  const r = await h.hooks.emit("task.complete", { taskId: "WP8", run: true });
  const hook = r.results[0].result;
  assert.equal(hook.executed, true);
  assert.equal(hook.result.skipped, false, "gate must not silently skip");
  assert.equal(typeof hook.result.errors, "number");
  assert.equal(hook.result.errors, 0);
  assert.equal(hook.verdict, "allow");
});

test("hooks: file.write blocks on errors but allows warning-only files", async (t) => {
  const d = tmp(t);
  const bus = createHookBus();
  installDefaultHooks(bus, { projectRoot: d, blockOnIssues: true });
  fs.writeFileSync(path.join(d, "bad.lua"), "Wait(1)\n", "utf8");
  fs.writeFileSync(path.join(d, "warn.lua"), "local l = Location(0, 0)\n", "utf8");
  const bad = await bus.emit("file.write", { path: "bad.lua" });
  const warn = await bus.emit("file.write", { path: "warn.lua" });
  assert.equal(bad.results[0].result.verdict, "block");
  assert.equal(warn.results[0].result.verdict, "allow");
  assert.ok(warn.results[0].result.warnings >= 1);
});

test("tool injection: always-on core, conditional groups, cap, expert filter", () => {
  const inj = createToolInjector({ maxTools: 20 });
  const plain = inj.select({ intent: "随便看看" });
  assert.ok(plain.plan.selected.includes("lua_check"));
  assert.ok(plain.plan.selected.includes("spec_status"));
  assert.ok(plain.plan.selected.length >= 5);
  const forge = inj.select({ intent: "改地图地形，放一批单位" });
  assert.ok(forge.plan.selected.some((n) => n.startsWith("forge_")));
  assert.ok(forge.plan.selected.includes("codegen_run"));
  assert.ok(forge.plan.savedChars > 0);
  const audit = inj.select({ intent: "改地图地形并写文件", expert: "audit" });
  assert.equal(audit.plan.selected.includes("write_file"), false);
  const capped = inj.select({ intent: "改地图地形 物编 表格 章节 素材 spec 模型 打包 检查 规范 grep", maxTools: 7 });
  assert.ok(capped.plan.selected.length <= 7);
  assert.ok(capped.plan.omitted.length >= 0);
});

test("tool injection: real sidecar schemas override minimal ones", () => {
  const merged = mergeCatalog([{ name: "lua_check", description: "REAL", inputSchema: { type: "object", properties: { real: { type: "string" } } } }]);
  const t = merged.find((x) => x.name === "lua_check");
  assert.equal(t.description, "REAL");
  assert.ok(t.inputSchema.properties.real);
  assert.ok(TOOL_CATALOG.some((x) => x.source === "harness"));
});

test("pipeline: layers can be disabled and budget short-circuits", async () => {
  const p = createPipeline({ trace: true });
  p.use("tag", async (ctx, next) => { ctx.order = ["tag"]; await next(); });
  p.use("budget", withBudget(createBudget({ maxTokens: 1 })));
  p.use("after", async (ctx) => { ctx.order.push("after"); });
  const ctx = { system: "x".repeat(200), tools: [] };
  await p.run(ctx);
  assert.equal(ctx.order.includes("after"), false);
  assert.equal(ctx.budget.exceeded, true);
  assert.equal(p.list().length, 3);
  p.setEnabled("budget", false);
  const ctx2 = { order: [] };
  await p.run(ctx2);
  assert.deepEqual(ctx2.order, ["tag", "after"]);
  assert.ok(p.journal().length > 0);
});

test("createHarness: prepareTurn composes system/tools/spec/budget, dispatch works", async (t) => {
  const d = tmp(t);
  const h = createHarness({ projectRoot: d, skillRoot: SKILL, steeringBudget: 6000, maxTools: 8 });
  assert.equal(h.layers().length, 7);
  const ctx = await h.prepareTurn({ userText: "写一个 boss 战并改地图", files: ["src/map/chapter_01.lua"] });
  assert.match(ctx.system, /# Spec/);
  assert.match(ctx.system, /# Steering/);
  assert.ok(ctx.tools.length > 0 && ctx.tools.length <= 8);
  assert.ok(ctx.toolPlan.plan.savedChars > 0);
  assert.equal(ctx.budget.exceeded, false);
  const r1 = await h.dispatch("spec_status");
  assert.equal(r1.ok, true);
  const r2 = await h.dispatch("spec_init", { goal: "h" });
  assert.equal(r2.ok, true);
  assert.match((await h.dispatch("spec_done", { id: "T1" })).output, /"ok": true/);
  assert.equal((await h.dispatch("forge_probe")).ok, true);
  assert.equal((await h.dispatch("nope")).ok, false);
  const ann = h.annotateSteering({ write: false });
  assert.ok(ann.count >= 0);
});

test("scripts: manifest is honest, approval gate works, probe never launches exe", () => {
  assert.ok(SCRIPT_MANIFEST.some((s) => s.id === "wcc.check"));
  assert.ok(SCRIPT_MANIFEST.some((s) => s.cmd === null));
  assert.equal(findScript("missing"), null);
  const dry = runScript("wcc.check", { root: ROOT, dryRun: true });
  assert.equal(dry.dryRun, true);
  const gated = runScript("wcc.steering.annotate", { root: ROOT, dryRun: true });
  assert.equal(gated.reason, "approval-required");
  const probe = probeForge({ root: ROOT, env: { WC3FORGE_EXE: "Z:\\definitely\\missing.exe" } });
  assert.equal(probe.exists, false);
  assert.match(probe.note, /不启动/);
});

test("TUI: static render, command handling, approval, diff, CJK width", async () => {
  assert.equal(displayWidth("中文"), 4);
  assert.equal(displayWidth(clip("中文abc", 6)), 6);
  const tui = createTui({ interactive: false, onCommand: async (c) => `handled ${c}` });
  const r = await tui.handleLine("/tools");
  assert.equal(r.type, "command");
  const empty = await tui.handleLine("");
  assert.equal(empty.type, "empty");
  tui.setState({ approval: "write_file" });
  const a = await tui.handleLine("y");
  assert.equal(a.type, "approval");
  assert.equal(a.decision, "y");
  assert.match(tui.renderStatic({ color: false }), /commands:/);
  assert.match(renderStatic({ events: [{ kind: "ok", text: "hello" }] }, { color: false }), /hello/);
  assert.match(diffPreview("a\nb", "a\nc"), /\+ c/);
});

// ---------------------------------------------------------------------------
// P2 / G1 — text-IR gates. These tests use synthetic files only: they prove
// sha256 / diff / byte-comparison logic, NOT that WE can open a real .w3x.
// ---------------------------------------------------------------------------

test("P2 mapSnapshot: copies bytes, keeps the source sha256, writes an IR manifest", (t) => {
  const d = tmp(t);
  const src = path.join(d, "demo.w3x");
  const bytes = Buffer.from("FAKE-MAP-BYTES-0001-not-a-real-w3x");
  fs.writeFileSync(src, bytes);
  const before = cryptoHash(bytes);

  const r = mapSnapshot({ root: d, map: src });
  assert.equal(r.ok, true);
  assert.equal(r.sha256, before);
  assert.equal(cryptoHash(fs.readFileSync(src)), before, "source must not change");
  assert.equal(cryptoHash(fs.readFileSync(r.snapshot)), before, "copy must be byte-identical");

  const manifest = JSON.parse(fs.readFileSync(r.manifest, "utf8"));
  assert.equal(manifest.targetPatch, "1.31+");
  assert.equal(manifest.language, "lua");
  assert.equal(manifest.source.sha256, before);
  assert.equal(manifest.serializersVerified, false);
  assert.equal(manifest.files[0].producer, "wcc.map.snapshot");
  assert.equal(typeof manifest.files[0].sha256, "string");
});

test("P2 mapSnapshot: missing map is rejected, no artifact is written", (t) => {
  const d = tmp(t);
  const r = mapSnapshot({ root: d, map: "nope.w3x" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "map-not-found");
  assert.equal(fs.existsSync(path.join(d, ".wcc")), false);
  assert.equal(mapSnapshot({ root: d }).reason, "map-required");
});

test("P2 mapDiff: unified diff really reverses with git apply -R", (t) => {
  const d = tmp(t);
  const oldText = "alpha\nbeta\ngamma\ndelta\n";
  const newText = "alpha\nBETA\ngamma\ndelta\nepsilon\n";
  fs.writeFileSync(path.join(d, "old.txt"), oldText);
  fs.writeFileSync(path.join(d, "new.txt"), newText);

  const r = mapDiff({ root: d, mapId: "demo", from: "old.txt", to: "new.txt", name: "units", rel: "units.json" });
  assert.equal(r.ok, true);
  assert.equal(r.removed, 1);
  assert.equal(r.added, 2);
  assert.match(r.patch, /^--- a\/units\.json/m);
  assert.match(r.patch, /^@@ -1,4 \+1,5 @@/m);
  assert.ok(fs.existsSync(r.patchPath));

  // The patch must be a real, reversible unified diff — not a decorative log.
  const target = path.join(d, "units.json");
  fs.writeFileSync(target, newText);
  // Windows git defaults to core.autocrlf=true, which rewrites the reverted
  // file as CRLF. Disable it so this is a genuine byte-for-byte reversal.
  const applied = spawnSync("git", ["-c", "core.autocrlf=false", "apply", "-R", "-p1", r.patchPath],
    { cwd: d, encoding: "utf8" });
  assert.equal(applied.status, 0, `git apply -R failed: ${applied.stderr}`);
  assert.equal(fs.readFileSync(target, "utf8"), oldText);
});

test("P2 mapDiff: identical IR produces no patch; missing input is rejected", (t) => {
  const d = tmp(t);
  fs.writeFileSync(path.join(d, "a.txt"), "same\n");
  fs.writeFileSync(path.join(d, "b.txt"), "same\n");
  const same = mapDiff({ root: d, from: "a.txt", to: "b.txt" });
  assert.equal(same.ok, true);
  assert.equal(same.identical, true);
  assert.equal(same.patchPath, null);
  const missing = mapDiff({ root: d, from: "a.txt", to: "missing.txt" });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "to-not-found");
  assert.equal(unifiedDiff("a\n", "a\n").identical, true);
});

test("P2 mapVerify: byte-identical round-trip passes; one changed byte blocks", (t) => {
  const d = tmp(t);
  // Synthetic buffer: proves the comparison logic only, NOT a real .w3x parse.
  const bytes = Buffer.from([0, 1, 2, 255, 10, 13, 0, 128]);
  const src = path.join(d, "source.bin");
  const rebuilt = path.join(d, "rebuilt.bin");
  fs.writeFileSync(src, bytes);
  fs.writeFileSync(rebuilt, bytes);

  const ok = mapVerify({ root: d, source: src, rebuilt });
  assert.equal(ok.ok, true);
  assert.equal(ok.verified, true);
  assert.equal(ok.evidence, "byte-for-byte");
  assert.match(ok.note, /不证明 WE 能打开/);

  const changed = Buffer.from(bytes);
  changed[3] = 254;
  fs.writeFileSync(rebuilt, changed);
  const bad = mapVerify({ root: d, source: src, rebuilt });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "round-trip-mismatch");
  assert.equal(bad.blocking, true, "a mismatch must block writing the map");
  assert.notEqual(bad.sourceSha256, bad.rebuiltSha256);
});

test("P2 mapVerify: no external serializer fails closed (🔴 not measured)", (t) => {
  const d = tmp(t);
  const src = path.join(d, "source.bin");
  fs.writeFileSync(src, Buffer.from([1, 2, 3]));
  const r = mapVerify({ root: d, source: src, env: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "external-tool-missing");
  assert.equal(r.blocking, true);
  assert.match(r.note, /未实测|round-trip/);
  assert.equal(mapVerify({ root: d, env: {} }).reason, "source-required");
});

test("P2 scripts: map handlers are executable, wcc.map.build stays declared-only", (t) => {
  const d = tmp(t);
  const list = describeScripts();
  for (const id of ["wcc.map.snapshot", "wcc.map.diff", "wcc.map.verify"]) {
    assert.equal(list.find((s) => s.id === id)?.executable, true, id);
  }
  assert.equal(list.find((s) => s.id === "wcc.map.build")?.executable, false);
  assert.equal(runScript("wcc.map.build", { root: d }).reason, "declared-only");

  const src = path.join(d, "demo.w3x");
  fs.writeFileSync(src, Buffer.from("fake"));
  const dry = runScript("wcc.map.snapshot", { root: d, args: { map: src }, dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.handler, "mapSnapshot");
  const real = runScript("wcc.map.snapshot", { root: d, args: { map: src } });
  assert.equal(real.ok, true);
  assert.equal(real.runBy, "handler");
});

function cryptoHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---------------------------------------------------------------------------
// P2-6 — wcc.map.set_script parameter contract. These tests prove ONLY the
// contract (missing params refused, script-only warns, fail-closed without a
// real adapter). They do NOT prove that WE can open a generated .w3x.
// ---------------------------------------------------------------------------
function setScriptFixture(t) {
  const d = tmp(t);
  const map = path.join(d, "demo.w3x");
  fs.writeFileSync(map, Buffer.from("synthetic-map-bytes-not-a-real-w3x"));
  const script = 'print("hello from WCC")\n';
  const base = { root: d, map, script, targetPatch: "1.31+", strategy: "durable" };
  return { d, map, script, base };
}

test("P2-6 set_script: targetPatch / strategy / map / script are all mandatory", (t) => {
  const { base, map, script } = setScriptFixture(t);
  assert.deepEqual([...SET_SCRIPT_STRATEGIES], ["script-only", "durable", "gui"]);
  assert.deepEqual([...SUPPORTED_TARGET_PATCHES], ["1.31+"]);

  const noPatch = mapSetScript({ ...base, targetPatch: null });
  assert.equal(noPatch.reason, "targetPatch-required");
  assert.equal(noPatch.blocking, true);
  assert.equal(noPatch.written, false);

  // Local 1.26 is read-only by decision; never silently retarget to JASS.
  const legacy = mapSetScript({ ...base, targetPatch: "1.26" });
  assert.equal(legacy.reason, "unsupported-target-patch");
  assert.deepEqual(legacy.supported, ["1.31+"]);

  assert.equal(mapSetScript({ ...base, strategy: null }).reason, "strategy-required");
  const bad = mapSetScript({ ...base, strategy: "magic" });
  assert.equal(bad.reason, "unsupported-strategy");
  assert.deepEqual(bad.supported, ["script-only", "durable", "gui"]);

  assert.equal(mapSetScript({ ...base, script: "  " }).reason, "script-required");
  assert.equal(mapSetScript({ ...base, map: "missing.w3x" }).reason, "map-not-found");
  assert.equal(fs.existsSync(map), true, "no input file was touched");
});

test("P2-6 set_script: script-only warns about WE re-save and NEVER writes", (t) => {
  const { d, base, script } = setScriptFixture(t);
  const r = mapSetScript({ ...base, strategy: "script-only" });
  assert.equal(r.ok, false, "script-only must not report success silently");
  assert.equal(r.reason, "script-only-not-durable");
  assert.equal(r.blocking, true);
  assert.equal(r.written, false);
  assert.match(r.warning, /WE 重存会丢失/);
  assert.match(r.warning, /World Editor/);
  assert.equal(r.scriptSha256, cryptoHash(Buffer.from(script, "utf8")));
  assert.equal(fs.readdirSync(d).filter((f) => f.includes(".edited")).length, 0);
});

test("P2-6 set_script: durable/gui fail closed without round-trip evidence or a real adapter", (t) => {
  const { d, map, base } = setScriptFixture(t);
  assert.equal(mapSetScript(base).reason, "round-trip-not-verified");

  // A forged "verified" flag is not enough in itself...
  const forged = { ok: true, verified: true };
  assert.equal(mapSetScript({ ...base, roundTrip: forged }).reason, "external-tool-missing");

  // ...and even a REAL mapVerify() byte-for-byte result on a synthetic buffer
  // still has no external adapter wired -> still fail closed.
  const rebuilt = path.join(d, "rebuilt.w3x");
  fs.writeFileSync(rebuilt, fs.readFileSync(map));
  const verified = mapVerify({ root: d, source: map, rebuilt });
  assert.equal(verified.verified, true);
  const gated = mapSetScript({ ...base, roundTrip: verified });
  assert.equal(gated.reason, "external-tool-missing");
  assert.equal(gated.blocking, true);
  assert.equal(gated.written, false);
  assert.match(gated.note, /🔴/);
  assert.equal(fs.readdirSync(d).filter((f) => f.includes(".edited")).length, 0);
});

test("P2-6 set_script: fake adapter proves the parameter contract, not map generation", (t) => {
  const { d, map, script, base } = setScriptFixture(t);
  const rebuilt = path.join(d, "rebuilt.w3x");
  fs.writeFileSync(rebuilt, fs.readFileSync(map));
  const verified = mapVerify({ root: d, source: map, rebuilt });

  const seen = [];
  const adapter = (req) => {
    seen.push(req);
    return { ok: true, written: false, evidence: "fake-adapter-no-io" };
  };
  const r = mapSetScript({ ...base, roundTrip: verified, adapter });
  assert.equal(r.ok, true);
  assert.equal(r.written, false, "the fake adapter performs no binary write");
  assert.equal(seen.length, 1);

  const req = seen[0];
  assert.equal(req.targetPatch, "1.31+");
  assert.equal(req.strategy, "durable");
  assert.equal(req.language, "lua");
  assert.equal(req.mapId, "demo");
  assert.equal(req.script, script);
  assert.equal(req.scriptSha256, cryptoHash(Buffer.from(script, "utf8")));
  assert.equal(req.roundTrip.verified, true);
  assert.match(req.outFile, /demo\.edited\.w3x$/);
  assert.notEqual(req.outFile, map, "red line: never overwrite the source map");
  assert.equal(fs.existsSync(path.join(d, "demo.edited.w3x")), false);
  assert.match(r.note, /🔴/);

  // An adapter that fails or throws must never be turned into a success.
  const failed = mapSetScript({ ...base, roundTrip: verified, adapter: () => ({ ok: false }) });
  assert.equal(failed.reason, "adapter-failed");
  assert.equal(failed.written, false);
  const threw = mapSetScript({ ...base, roundTrip: verified, adapter: () => { throw new Error("boom"); } });
  assert.equal(threw.reason, "adapter-error");
  assert.equal(threw.written, false);
});

test("P2-6 set_script: runScript routes to the handler and enforces approval", (t) => {
  const { d, map, script } = setScriptFixture(t);
  const list = describeScripts();
  assert.equal(list.find((s) => s.id === "wcc.map.set_script")?.executable, true);
  assert.equal(list.find((s) => s.id === "wcc.map.build")?.executable, false);

  const args = { map, script, targetPatch: "1.31+", strategy: "script-only" };
  const gated = runScript("wcc.map.set_script", { root: d, args });
  assert.equal(gated.reason, "approval-required");

  const r = runScript("wcc.map.set_script", { root: d, approved: true, args });
  assert.equal(r.runBy, "handler");
  assert.equal(r.reason, "script-only-not-durable");
  assert.equal(r.written, false);
  assert.equal(r.id, "wcc.map.set_script");
});
