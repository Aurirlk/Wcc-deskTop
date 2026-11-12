/**
 * Agent loop with OpenAI-compatible streaming (SSE) + tool calling.
 *
 * Product wiring (2026-11-12): EVERY model call now runs the harness 7-layer
 * pipeline through prepareTurn() — planning/spec, steering, tool injection,
 * context compaction, approval, budget, scratch. The product passes its own
 * messages (recordHistory:false) and a fresh per-turn budget (budgetOverride),
 * so there is still ONE conversation history and no cumulative-budget drain.
 * Hooks (lua_check quality gate), harness-owned tool dispatch and offline mode
 * are unchanged. `harness` stays injectable: server.js and the renderer share
 * ONE instance (双表面可以，双数据源不行).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPERTS } from "./config-store.js";
import {
  createHarness,
  createBudget,
  resolveProvider,
  patchToolCalls,
  STOP_REASONS,
} from "../../../harness/src/index.js";

// packages/wcc-sidecar/src -> repo root. server.js passes its own harness, but
// a standalone createAgent() must still see the ONE repo-level contract even
// when projectRoot points at a campaign dir with no AGENTS.md of its own.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// Role header only. The iron rules / output protocol / forbidden actions are
// NOT duplicated here — wcc-skill/skill.md is the single authority and is
// injected by steering (see AGENTS.md §1).
const SYSTEM_ROLE = `你是艾泽拉斯织码者，WCC 魔兽争霸3战役开发助手。
编程铁律、代码输出协议与违禁行为以本轮注入的 # Steering 段为准；
未列出的规范文档视为未生效，不要凭记忆假设其内容。`;

/** Runtime capability probe — replaces the previous hard-coded `wired: true`. */
function harnessUsable(h) {
  return Boolean(
    h &&
      typeof h.steering?.select === "function" &&
      typeof h.injector?.select === "function" &&
      typeof h.dispatch === "function" &&
      typeof h.layers === "function" &&
      h.layers().length > 0
  );
}

export function createAgent({
  tools, projectRoot, skillRoot, logger, getConfig, sessionStore,
  harness = null,
  steeringBudget = 8000,
  maxTools = 14,
} = {}) {
  const history = [];

  // One harness instance for the whole product. When absent, build a local one
  // so a standalone createAgent() can never silently bypass the harness.
  const h = harness || createHarness({
    projectRoot: projectRoot || process.cwd(),
    skillRoot: skillRoot || undefined,
    agentsFile: path.join(REPO_ROOT, "AGENTS.md"),
    catalog: tools?.list?.() || [],
    steeringBudget,
    maxTools,
  });

  const harnessToolNames = new Set(
    h.injector.catalog.filter((t) => t.source === "harness").map((t) => t.name)
  );

  /** Route a model tool call to the component that actually owns it. */
  async function dispatchTool(name, args) {
    if (harnessToolNames.has(name)) return h.dispatch(name, args);
    return tools.dispatch(name, args);
  }

  function expertBlock() {
    const cfg = getConfig?.() || {};
    const expert = EXPERTS[cfg.expert] || EXPERTS.writer;
    return `# 专家：${expert.name}\n${expert.system}`;
  }

  function modelConfig() {
    const cfg = getConfig?.() || {};
    const p = resolveProvider({
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
    });
    return {
      provider: p.provider,
      label: p.label,
      baseUrl: p.baseUrl,
      apiKey: cfg.apiKey || process.env.WCC_MODEL_API_KEY || "",
      model: p.model,
      configured: p.configured,
    };
  }

  function offlinePlan(userText) {
    const t = String(userText || "").toLowerCase();
    const steps = [];
    steps.push("（离线模式：未配置 WCC_MODEL_BASE_URL / WCC_MODEL_API_KEY）");
    steps.push(`已收到：${userText}`);
    steps.push("建议步骤：");
    if (/检查|check|扫/.test(t)) {
      steps.push("1. lua_check src");
    } else if (/单位|放人|地形|物编|地图|forge|改图|装备|批量/.test(t)) {
      steps.push("1. codegen_run unit_registry 或 skill_load object-batch.md");
      steps.push("2. write_file 注册与刷单位（需审批）");
      steps.push("3. lua_check；若改图实体再 forge_status");
    } else if (/对话|dialogue/.test(t)) {
      steps.push("1. skill_load dialogue.md 或 codegen_run dialogue_table");
      steps.push("2. write_file src/map/chapter_01.lua（需审批）");
      steps.push("3. lua_check src");
    } else if (/刷怪|spawner|波/.test(t)) {
      steps.push("1. codegen_run unit_wave");
      steps.push("2. write_file 使用 wcc-spawner（需审批）");
      steps.push("3. lua_check src");
    } else if (/表格|excel|数据驱动/.test(t)) {
      steps.push("1. skill_load data-codegen.md");
      steps.push("2. codegen_list + codegen_run");
    } else {
      steps.push("1. list_dir .");
      steps.push("2. skill_load skill.md");
      steps.push("3. 根据需求 write_file / codegen_run / lua_check");
    }
    steps.push("配置模型后可自动执行工具调用（流式）。");
    return steps.join("\n");
  }

  /**
   * Parse OpenAI SSE stream into { contentChunks, toolCallDeltas }
   */
  async function streamChatCompletions(body, onEvent) {
    const { baseUrl, apiKey, model } = modelConfig();
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...body, model, stream: true }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`model HTTP ${res.status} ${text.slice(0, 200)}`);
    }

    const decoder = new TextDecoder();
    const toolAcc = new Map(); // index -> {id,name,arguments}
    let content = "";
    let sseBuf = "";

    for await (const chunk of res.body) {
      sseBuf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = sseBuf.indexOf("\n")) >= 0) {
        let line = sseBuf.slice(0, nl).trim();
        sseBuf = sseBuf.slice(nl + 1);
        if (!line || !line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          return finalize(content, toolAcc, onEvent);
        }
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
          onEvent?.({ type: "delta", text: delta.content });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAcc.has(idx)) {
              toolAcc.set(idx, { id: tc.id || `call_${idx}`, name: "", arguments: "" });
            }
            const acc = toolAcc.get(idx);
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
      }
    }
    return finalize(content, toolAcc, onEvent);
  }

  function finalize(content, toolAcc, onEvent) {
    const toolCalls = [...toolAcc.values()].map((t, i) => ({
      id: t.id || `call_${i}`,
      type: "function",
      function: { name: t.name, arguments: t.arguments || "{}" },
    }));
    if (toolCalls.length) {
      onEvent?.({ type: "tool_calls", toolCalls });
      return { role: "assistant", content: content || null, tool_calls: toolCalls };
    }
    return { role: "assistant", content: content || "" };
  }

  async function callModel(messages, onEvent, prepared) {
    const cfg = modelConfig();
    if (!cfg.configured) {
      const text = offlinePlan(messages.filter((m) => m.role === "user").at(-1)?.content || "");
      onEvent?.({ type: "delta", text });
      return { role: "assistant", content: text };
    }
    return streamChatCompletions(
      { messages, tools: prepared?.tools || [], tool_choice: "auto" },
      onEvent
    );
  }

  /**
   * @param {string} userText
   * @param {(evt:object)=>void} [onEvent] stream events
   */
  async function runTurnStream(userText, onEvent) {
    sessionStore?.append({ type: "user", text: userText });
    history.push({ role: "user", content: userText });

    const files = [...String(userText).matchAll(/@([\w./-]+\.lua)/g)].map((m) => m[1]);
    // The product owns ONE conversation history. On every model call we hand
    // these messages to the harness pipeline with recordHistory:false, so no
    // second copy accumulates inside harness.history.
    const messages = history.slice(-20);
    let full = "";
    let feedbackInjected = false;

    // Fresh per-turn budget. pipeline's withBudget consumes THIS instance via
    // ctx.budgetOverride, so a long session cannot drain a cumulative budget.
    const budget = createBudget({ maxTurns: 8, maxTokens: 60000 });
    h.lastBudget = budget;
    let stopReason = null;
    let step = 0;

    while (step < 8) {
      step += 1;
      const cfg = getConfig?.() || {};
      const prep = await h.prepareTurn({
        userText,
        files,
        system: [SYSTEM_ROLE, expertBlock()].filter(Boolean).join("\n\n"),
        messages,
        recordHistory: false,
        budgetOverride: budget,
        expert: cfg.expert,
        needForge: Boolean(cfg.needForge),
        dynamicForgeTools: [],
        pendingToolCalls: [],
        steeringBudget,
        maxTools,
      });

      // Record the REAL pipeline output for /harness/state and the renderer.
      h.lastSteering = prep.steering || null;
      h.lastToolPlan = prep.toolPlan?.plan || null;
      h.lastPipeline = {
        turn: prep.turn,
        journal: (h.pipeline?.journal?.() || []).slice(-7),
        specStage: prep.spec?.stage || "none",
        compaction: prep.compaction || null,
        patchedToolCalls: prep.patchedToolCalls || 0,
        approval: prep.approval?.status || null,
      };
      if (prep.patchedToolCalls) {
        onEvent?.({ type: "harness", kind: "tool-calls-repaired", count: prep.patchedToolCalls });
      }

      if (prep.budget?.exceeded || prep.approval?.status === "denied" || prep.approval?.status === "blocked") {
        stopReason = prep.budget?.stopReason || prep.approval?.status || STOP_REASONS.MAX_TURNS;
        break;
      }

      const callMessages = [{ role: "system", content: prep.system }, ...prep.messages];
      const msg = await callModel(callMessages, onEvent, prep);
      budget.consume(typeof msg.content === "string" ? msg.content : "", { label: "assistant" });

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name;
          let args = {};
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch {
            /* keep {} */
          }
          onEvent?.({ type: "tool_start", name, args });
          sessionStore?.append({ type: "tool_start", name, args });
          logger?.info?.(`tool ${name}`);
          const result = await dispatchTool(name, args);

          // Offload through the harness's SINGLE scratch implementation — the
          // same one withScratch uses inside the 7-layer pipeline.
          const raw = String(result.output ?? "");
          const [entry] = h.offloadToolResults
            ? h.offloadToolResults([{ name, output: raw }], { turn: step })
            : [{ wrapped: raw.slice(0, 50_000) }];
          const wrapped = entry.wrapped ?? raw.slice(0, 50_000);
          const offloaded = wrapped !== raw;
          budget.consume(wrapped, { label: `tool:${name}` });

          onEvent?.({
            type: "tool_end",
            name,
            ok: result.ok,
            denied: Boolean(result.denied),
            output: wrapped,
            offloaded,
          });
          sessionStore?.append({
            type: "tool_end",
            name,
            ok: result.ok,
            denied: Boolean(result.denied),
            output: wrapped.slice(0, 4000),
          });
          messages.push({ role: "tool", tool_call_id: tc.id, content: wrapped });
          history.push({ role: "tool", content: `[${name}] ${wrapped}` });

          // Quality gate on Lua writes (P0-5 hooks now really run).
          if (name === "write_file" && result.ok && typeof args.path === "string" && args.path.endsWith(".lua")) {
            const gate = await h.emit("file.write", { path: args.path });
            const blocking = Boolean(gate?.blocking);
            onEvent?.({ type: "harness", kind: "file-write-gate", path: args.path, blocking });
            if (blocking) {
              messages.push({
                role: "user",
                content: `[WCC 质量门禁] 刚写入的 ${args.path} 未通过 lua_check，请按报告修正后重新生成。`,
              });
              feedbackInjected = true;
            }
          }

          // P1-6: feed a failed lua_check back once so the model can self-correct.
          if (!feedbackInjected && /lua_check|wcc_check/.test(name) && /\bERROR\b|errors, [1-9]|\[no-/.test(wrapped)) {
            messages.push({
              role: "user",
              content: `[WCC 质量门禁] lua_check 发现 error：\n${wrapped.slice(0, 2000)}\n请修正源码后再次检查，再给出最终答复。`,
            });
            feedbackInjected = true;
          }
        }
        continue;
      }

      full = msg.content || full;
      history.push({ role: "assistant", content: full });
      sessionStore?.append({ type: "assistant", text: full });
      onEvent?.({ type: "done", text: full });
      return full;
    }

    // Budget / step exhaustion: repair any dangling tool_calls before returning.
    const patched = patchToolCalls(messages);
    onEvent?.({
      type: "error",
      message: `agent loop stopped: ${stopReason || STOP_REASONS.MAX_TURNS}`,
      repaired: patched.patched,
    });
    const err = `agent loop stopped: ${stopReason || STOP_REASONS.MAX_TURNS}`;
    history.push({ role: "assistant", content: err });
    return err;
  }

  function resumeFromHistory(prior) {
    if (!Array.isArray(prior)) return 0;
    for (const m of prior) {
      if (m.role === "user" || m.role === "assistant" || m.role === "tool") {
        history.push(m);
      }
    }
    return prior.length;
  }

  async function runTurn(userText) {
    let last = "";
    await runTurnStream(userText, (e) => {
      if (e.type === "done" || e.type === "delta") last += e.type === "delta" ? e.text : "";
      if (e.type === "done") last = e.text || last;
    });
    return last;
  }

  /** Single source of truth for /harness/* endpoints (P1-4). */
  function harnessState() {
    return {
      wired: harnessUsable(h),
      layers: h.layers(),
      pipeline: h.lastPipeline || { turn: 0, journal: [], specStage: "none" },
      pipelineWired: Boolean(h.lastPipeline && h.lastPipeline.journal.length >= 7),
      steering: h.lastSteering
        ? {
            selectedIds: h.lastSteering.selectedIds,
            usedChars: h.lastSteering.usedChars,
            savedChars: h.lastSteering.savedChars,
          }
        : null,
      tools: h.lastToolPlan || null,
      budget: (h.lastBudget || h.budget)?.snapshot?.() || null,
      spec: h.spec?.summary?.() || null,
      provider: { ...modelConfig(), apiKey: undefined },
      scratchCount: h.scratch?.list?.().length ?? 0,
      hooks: h.hooks?.list?.() || {},
      agentsFile: h.steering?.docs?.find((d) => d.rel === "AGENTS.md")?.rel || null,
    };
  }

  return {
    runTurn,
    runTurnStream,
    resumeFromHistory,
    getHistory: () => history.slice(),
    modelConfig,
    harness,
    harnessState,
    dispatchTool,
    get harnessInstance() { return h; },
  };
}

// Keep the legacy export name available for callers that imported SYSTEM_CORE.
export const SYSTEM_CORE = SYSTEM_ROLE;
