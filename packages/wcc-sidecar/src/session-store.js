/**
 * Session transcript: JSONL append + resume + simple compaction.
 * Layout: <projectRoot>/.wcc/sessions/<sessionId>.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function sessionsDir(projectRoot) {
  return path.join(projectRoot, ".wcc", "sessions");
}

export function createSessionStore({ projectRoot }) {
  let sessionId = null;
  let file = null;

  function ensureDir() {
    fs.mkdirSync(sessionsDir(projectRoot), { recursive: true });
  }

  function newSession(id) {
    sessionId = id || crypto.randomBytes(8).toString("hex");
    file = path.join(sessionsDir(projectRoot), `${sessionId}.jsonl`);
    ensureDir();
    fs.appendFileSync(file, JSON.stringify({ type: "session_start", sessionId, at: Date.now() }) + "\n");
    return sessionId;
  }

  function currentId() {
    return sessionId;
  }

  function append(event) {
    if (!file) newSession();
    const row = { ...event, at: Date.now(), sessionId };
    fs.appendFileSync(file, JSON.stringify(row) + "\n");
    return row;
  }

  function listSessions() {
    ensureDir();
    const dir = sessionsDir(projectRoot);
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".jsonl"))
      .map((n) => {
        const p = path.join(dir, n);
        const st = fs.statSync(p);
        return { id: n.replace(/\.jsonl$/, ""), path: p, bytes: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  function loadSession(id) {
    const p = path.join(sessionsDir(projectRoot), `${id}.jsonl`);
    if (!fs.existsSync(p)) return [];
    return fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /** Rebuild chat history from JSONL for agent resume */
  function resume(id, { max = 40 } = {}) {
    const events = loadSession(id);
    sessionId = id;
    file = path.join(sessionsDir(projectRoot), `${id}.jsonl`);
    const history = [];
    for (const e of events) {
      if (e.type === "user" && e.text) history.push({ role: "user", content: e.text });
      if (e.type === "assistant" && e.text) history.push({ role: "assistant", content: e.text });
      if (e.type === "tool_end") {
        history.push({ role: "tool", content: `[${e.name}] ${(e.output || "").slice(0, 2000)}` });
      }
    }
    return history.slice(-max);
  }

  function compactSummary({ limit = 12 } = {}) {
    if (!file) return "";
    const events = loadSession(sessionId);
    const users = events.filter((e) => e.type === "user").slice(-limit).map((e) => e.text);
    return `# 会话摘要（自动）\n最近用户输入：\n- ${users.join("\n- ")}`;
  }

  return {
    newSession,
    currentId,
    append,
    listSessions,
    loadSession,
    resume,
    compactSummary,
  };
}
