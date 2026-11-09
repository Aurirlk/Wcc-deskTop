/**
 * Scratch: offload large tool results to disk, keep only a summary + path in the
 * model context (Deep Agents "filesystem as working memory" idea, own code).
 */
import fs from "node:fs";
import path from "node:path";

export function createScratch({ projectRoot, threshold = 4000, keep = 200 }) {
  const dir = path.join(path.resolve(projectRoot), ".wcc", "scratch");
  const ensure = () => fs.mkdirSync(dir, { recursive: true });
  let seq = 0;

  function slug(name) {
    return String(name || "result").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
  }

  function offload(name, content, { meta = {}, force = false } = {}) {
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    if (!force && text.length <= threshold) {
      return { offloaded: false, reason: "below-threshold", chars: text.length, text };
    }
    ensure();
    seq += 1;
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const id = `${stamp}-${String(seq).padStart(3, "0")}-${slug(name)}`;
    const file = path.join(dir, `${id}.txt`);
    const header = [
      `# scratch ${id}`,
      `# name: ${name}`,
      `# created: ${new Date().toISOString()}`,
      ...Object.entries(meta).map(([k, v]) => `# ${k}: ${JSON.stringify(v)}`),
      "",
    ].join("\n");
    fs.writeFileSync(file, header + text, "utf8");
    const preview = text.slice(0, 400).replace(/\r?\n/g, " / ");
    return {
      offloaded: true,
      id,
      file,
      bytes: Buffer.byteLength(text, "utf8"),
      chars: text.length,
      preview,
      summary: `[offloaded] ${name}: ${text.length} chars -> ${file}\npreview: ${preview}`,
    };
  }

  /** Wrap a tool result: small results pass through, big ones become a pointer. */
  function wrapToolResult(toolName, output, meta = {}) {
    const result = offload(toolName, output, meta);
    return result.offloaded ? result.summary : String(output);
  }

  function list() {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { id: f.replace(/\.txt$/, ""), file: path.join(dir, f), bytes: st.size, mtime: st.mtime.toISOString() };
      });
  }

  function recall(idOrName) {
    const items = list();
    const hit = items.find((x) => x.id === idOrName) || items.filter((x) => x.id.includes(idOrName)).at(-1);
    if (!hit) return { ok: false, reason: "not-found", idOrName };
    return { ok: true, ...hit, text: fs.readFileSync(hit.file, "utf8") };
  }

  /** Line-based search across scratch files. Returns bounded hits. */
  function grep(pattern, { maxHits = 40, contextLines = 1 } = {}) {
    const re = new RegExp(pattern, "i");
    const hits = [];
    for (const item of list()) {
      const lines = fs.readFileSync(item.file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!re.test(line) || hits.length >= maxHits) return;
        hits.push({
          id: item.id,
          line: i + 1,
          text: line.slice(0, 300),
          context: lines.slice(Math.max(0, i - contextLines), i + contextLines + 1).map((s) => s.slice(0, 200)),
        });
      });
    }
    return { pattern, hits, count: hits.length, truncated: hits.length >= maxHits };
  }

  return { dir, offload, wrapToolResult, list, recall, grep, threshold, keep };
}
