/**
 * Approximate extractors for WCC Lua campaign sources (workbench visualization).
 */

function extractBraceBlock(src, openIdx) {
  if (src[openIdx] !== "{") return null;
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    const prev = i > 0 ? src[i - 1] : "";
    if (inStr) {
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "-" && src[i + 1] === "-") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

function findCallBlocks(src, callName) {
  const re = new RegExp(`${callName.replace(".", "\\.")}\\s*\\(`, "g");
  const blocks = [];
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf("{", m.index);
    if (open < 0 || open - m.index > 200) continue;
    const block = extractBraceBlock(src, open);
    if (block) blocks.push({ index: m.index, block });
  }
  return blocks;
}

function strField(block, key) {
  const m = block.match(new RegExp(`\\b${key}\\s*=\\s*(["'])([\\s\\S]*?)\\1`));
  return m ? m[2] : null;
}

function numField(block, key) {
  const m = block.match(new RegExp(`\\b${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) : null;
}

/** Extract `{ ... }` array that follows `key =` */
function tableAfter(block, key) {
  const re = new RegExp(`\\b${key}\\s*=\\s*\\{`, "m");
  const m = block.match(re);
  if (!m) return null;
  const open = block.indexOf("{", m.index + m[0].length - 1);
  return extractBraceBlock(block, open);
}

function arrayItems(blockOrTable) {
  if (!blockOrTable) return [];
  const inner = blockOrTable.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  const items = [];
  let depth = 0;
  let inStr = null;
  let start = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    const prev = i > 0 ? inner[i - 1] : "";
    if (inStr) {
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start != null) {
        items.push(inner.slice(start, i + 1));
        start = null;
      }
    }
  }
  if (items.length) return items;
  // string array form
  return [...inner.matchAll(/(["'])(.*?)\1/g)].map((m) => ({ __str: m[2] }));
}

function asText(item) {
  if (typeof item === "string") return item;
  if (item && item.__str) return item.__str;
  return String(item);
}

export function extractDialogues(src) {
  return findCallBlocks(src, "Dialogue.Play").map((b, bi) => {
    const items = arrayItems(b.block);
    return {
      id: `dialogue_${bi + 1}`,
      lineCount: items.length,
      lines: items.map((item, i) => {
        const s = typeof item === "string" ? item : item;
        if (s && s.__str) return { index: i + 1, speaker: null, text: s.__str };
        return {
          index: i + 1,
          speaker: strField(s, "speaker"),
          text: strField(s, "text"),
          cameraX: numField(s, "x"),
          cameraY: numField(s, "y"),
          duration: numField(s, "duration"),
        };
      }),
    };
  });
}

export function extractQuests(src) {
  return findCallBlocks(src, "Quest.Create").map((b, bi) => {
    const block = b.block;
    const id = strField(block, "id") || `quest_${bi + 1}`;
    const title = strField(block, "title") || id;
    const description = strField(block, "description") || "";
    const type = /Quest\.TYPE_MAIN|type\s*=\s*["']main["']/.test(block)
      ? "main"
      : /Quest\.TYPE_SIDE|type\s*=\s*["']side["']/.test(block)
        ? "side"
        : "unknown";
    const objectives = arrayItems(tableAfter(block, "objectives")).map((item) => {
      const t = strField(asText(item) === item ? item : item, "text");
      return t || asText(item).replace(/[{}"']/g, "").trim();
    });
    const rewards = arrayItems(tableAfter(block, "rewards"))
      .map((item) => asText(item).replace(/[{}"']/g, "").trim())
      .filter(Boolean);
    return { id, title, description, type, objectives, rewards };
  });
}

export function extractSpawners(src) {
  return findCallBlocks(src, "Spawner.Create").map((b, bi) => {
    const block = b.block;
    return {
      id: strField(block, "id") || `spawner_${bi + 1}`,
      unitId: strField(block, "unitId"),
      count: numField(block, "count"),
      interval: numField(block, "interval"),
      waves: numField(block, "waves"),
      x: numField(block, "x"),
      y: numField(block, "y"),
      targetX: numField(block, "targetX"),
      targetY: numField(block, "targetY"),
    };
  });
}

export function extractChapterSummary(src) {
  return {
    dialogues: extractDialogues(src),
    quests: extractQuests(src),
    spawners: extractSpawners(src),
    hasWait: /\bWait\s*\(/.test(src),
    lines: src.split(/\r?\n/).length,
  };
}
