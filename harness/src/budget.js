/**
 * Budget: turn / token / cancellation / stop reasons (Strands lifecycle idea).
 * Token counting is a deliberate estimate (chars / 4), not a tokenizer — do not
 * present it as exact billing data.
 */
export const STOP_REASONS = {
  COMPLETED: "completed",
  MAX_TURNS: "max-turns",
  MAX_TOKENS: "max-tokens",
  CANCELLED: "cancelled",
  TOOL_DENIED: "tool-denied",
  ERROR: "error",
};

export function estimateTokens(text) {
  if (text == null) return 0;
  const s = typeof text === "string" ? text : JSON.stringify(text);
  // CJK chars are closer to 1 token/char than latin 4 chars/token.
  const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
  const rest = s.length - cjk;
  return Math.ceil(cjk + rest / 4);
}

export function createBudget({ maxTurns = 8, maxTokens = 60000, maxWallMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  let turns = 0;
  let tokens = 0;
  let stopReason = null;
  let cancelled = false;
  const startedAt = now();
  const events = [];

  function consume(text, { label = "" } = {}) {
    const n = estimateTokens(text);
    tokens += n;
    events.push({ type: "tokens", n, label, total: tokens });
    return n;
  }

  function beginTurn() {
    turns += 1;
    events.push({ type: "turn", turns });
    return turns;
  }

  function check() {
    if (stopReason) return { exceeded: true, stopReason };
    if (cancelled) return stop(STOP_REASONS.CANCELLED);
    if (turns > maxTurns) return stop(STOP_REASONS.MAX_TURNS);
    if (tokens > maxTokens) return stop(STOP_REASONS.MAX_TOKENS);
    if (now() - startedAt > maxWallMs) return stop(STOP_REASONS.MAX_TOKENS, "wall-clock");
    return { exceeded: false, stopReason: null };
  }

  function stop(reason, detail = "") {
    stopReason = reason;
    events.push({ type: "stop", reason, detail });
    return { exceeded: true, stopReason: reason, detail };
  }

  function cancel(reason = "user") {
    cancelled = true;
    return stop(STOP_REASONS.CANCELLED, reason);
  }

  function snapshot() {
    return { turns, tokens, maxTurns, maxTokens, maxWallMs, elapsedMs: now() - startedAt, stopReason, cancelled, events: events.slice() };
  }

  return { consume, beginTurn, check, stop, cancel, snapshot, estimateTokens };
}

/** Compact a long history while preserving the first user instruction. */
export function summarizeHistory(messages, { keepFirst = 1, keepLast = 6, maxTokens = 12000 } = {}) {
  if (!Array.isArray(messages)) return { messages: [], compacted: false, removed: 0 };
  const total = estimateTokens(messages.map((m) => m.content || "").join("\n"));
  if (total <= maxTokens) return { messages, compacted: false, removed: 0 };
  const head = messages.slice(0, keepFirst);
  const tail = messages.slice(-keepLast);
  const removed = messages.length - head.length - tail.length;
  const summary = {
    role: "system",
    content: `[history-compacted] ${removed} 条中间消息已折叠；保留首条用户指令与最近 ${tail.length} 条。原始记录见会话 jsonl。`,
  };
  return { messages: [...head, summary, ...tail], compacted: true, removed };
}

/** Repair message history after an approval was denied / a tool call was cancelled. */
export function patchToolCalls(messages) {
  if (!Array.isArray(messages)) return { messages: [], patched: 0 };
  const declared = new Set(
    messages.filter((m) => m.role === "assistant" && Array.isArray(m.tool_calls))
      .flatMap((m) => m.tool_calls.map((tc) => tc.id))
  );
  const answered = new Set(
    messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id)
  );
  const out = [];
  let patched = 0;
  for (const m of messages) {
    if (m.role === "tool" && !declared.has(m.tool_call_id)) {
      patched += 1; // orphan tool message: drop it
      continue;
    }
    out.push(m);
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (!answered.has(tc.id)) {
          out.push({
            role: "tool",
            tool_call_id: tc.id,
            content: "[cancelled] 工具调用已被用户取消或未执行；请勿假设其副作用已发生。",
          });
          patched += 1;
        }
      }
    }
  }
  return { messages: out, patched };
}
