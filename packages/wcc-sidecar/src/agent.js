/**
 * Agent loop with OpenAI-compatible streaming (SSE) + tool calling.
 * Offline mode still returns a structured plan when no API key is set.
 */
import fs from "node:fs";
import path from "node:path";
import { EXPERTS } from "./config-store.js";

const SYSTEM_CORE = `你是艾泽拉斯织码者，WCC 魔兽争霸3战役开发助手。
铁律：只用 Lua；禁止 Wait/TriggerSleepAction/PolledWait；
Handle 用完必须销毁；优先使用 wcc-lib（core/timer/gc/objects/dialogue/quest/spawner）；
批量物编/单位优先 codegen_run + wcc-objects，不要手写重复 CreateUnit；
写文件或改图前先说明意图；先 skill_load 再生成业务代码；生成后 lua_check。
地图数据改图用 forge_*；工作台用 bible_get / chapter_tree。`;

export function createAgent({ tools, projectRoot, skillRoot, logger, getConfig, sessionStore }) {
  const history = [];

  function assembleSystem() {
    let skillSnippet = "";
    try {
      skillSnippet = fs.readFileSync(path.join(skillRoot, "skill.md"), "utf8").slice(0, 2000);
    } catch {
      skillSnippet = "(skill not found)";
    }
    const cfg = getConfig?.() || {};
    const expert = EXPERTS[cfg.expert] || EXPERTS.writer;
    const expertBlock = `# 专家：${expert.name}\n${expert.system}`;
    return `${SYSTEM_CORE}\n\n${expertBlock}\n\n# Skill excerpt\n${skillSnippet}`;
  }

  function modelConfig() {
    const cfg = getConfig?.() || {};
    const baseUrl = cfg.baseUrl || process.env.WCC_MODEL_BASE_URL;
    const apiKey = cfg.apiKey || process.env.WCC_MODEL_API_KEY;
    const model = cfg.model || process.env.WCC_MODEL_NAME || "deepseek-chat";
    return { baseUrl, apiKey, model, configured: Boolean(baseUrl && apiKey) };
  }

  function toolDefs() {
    const cfg = getConfig?.() || {};
    const list = tools.list({ expert: cfg.expert });
    return list.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: `[${t.category || "tool"}] ${t.description}`,
        parameters:
          t.inputSchema && typeof t.inputSchema === "object"
            ? t.inputSchema
            : { type: "object", properties: {} },
      },
    }));
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

  async function callModel(messages, onEvent) {
    const cfg = modelConfig();
    if (!cfg.configured) {
      const text = offlinePlan(messages.filter((m) => m.role === "user").at(-1)?.content || "");
      onEvent?.({ type: "delta", text });
      return { role: "assistant", content: text };
    }
    return streamChatCompletions(
      { messages, tools: toolDefs(), tool_choice: "auto" },
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
    const messages = [{ role: "system", content: assembleSystem() }, ...history.slice(-20)];
    let full = "";

    let guard = 0;
    while (guard++ < 8) {
      const msg = await callModel(messages, onEvent);
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
          const result = await tools.dispatch(name, args);
          const truncated = String(result.output).slice(0, 50_000);
          onEvent?.({
            type: "tool_end",
            name,
            ok: result.ok,
            denied: Boolean(result.denied),
            output: truncated,
          });
          sessionStore?.append({
            type: "tool_end",
            name,
            ok: result.ok,
            denied: Boolean(result.denied),
            output: truncated.slice(0, 4000),
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: truncated,
          });
          history.push({ role: "tool", content: `[${name}] ${truncated}` });
        }
        continue;
      }
      full = msg.content || full;
      history.push({ role: "assistant", content: full });
      sessionStore?.append({ type: "assistant", text: full });
      onEvent?.({ type: "done", text: full });
      return full;
    }
    const err = "tool loop exceeded guard limit";
    onEvent?.({ type: "error", message: err });
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

  return {
    runTurn,
    runTurnStream,
    resumeFromHistory,
    getHistory: () => history.slice(),
    modelConfig,
  };
}
