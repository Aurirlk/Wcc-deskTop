/**
 * Table import: War3ExcelTool-style JSON / simple CSV → codegen args.
 * Accepts either:
 *  - { "units": [...], "waves": [...], "dialogue": [...], "quests": [...] }
 *  - CSV with header row (first col `kind` optional)
 */
import fs from "node:fs";
import path from "node:path";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      if (raw === "") return;
      const num = Number(raw);
      row[h] = raw !== "" && !Number.isNaN(num) && String(num) === raw ? num : raw;
    });
    return row;
  });
}

export function parseTableFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const data = JSON.parse(raw);
    return normalizeTables(data);
  }
  if (filePath.endsWith(".csv")) {
    return normalizeTables({ rows: parseCsv(raw) });
  }
  throw new Error("unsupported table format: use .json or .csv");
}

/** Map flexible shapes onto WCC codegen groups */
function normalizeTables(data) {
  const out = { units: [], waves: [], dialogue: [], quests: [] };
  if (Array.isArray(data)) {
    // array of mixed rows with `kind`
    for (const row of data) pushByKind(out, row);
    return out;
  }
  if (data.units) out.units = arr(data.units);
  if (data.waves) out.waves = arr(data.waves);
  if (data.dialogue || data.lines) out.dialogue = arr(data.dialogue || data.lines);
  if (data.quests) out.quests = arr(data.quests);
  if (data.rows) {
    for (const row of arr(data.rows)) pushByKind(out, row);
  }
  return out;
}

function arr(x) {
  return Array.isArray(x) ? x : [];
}

function pushByKind(out, row) {
  const kind = (row.kind || row.type || "").toLowerCase();
  if (kind === "unit" || kind === "unit_registry") out.units.push(row);
  else if (kind === "wave" || kind === "spawner") out.waves.push(row);
  else if (kind === "dialogue" || kind === "line") out.dialogue.push(row);
  else if (kind === "quest") out.quests.push(row);
  else {
    // heuristic
    if (row.unitId || row.rawcode) {
      if (row.count || row.interval) out.waves.push(row);
      else out.units.push(row);
    } else if (row.speaker || row.text) out.dialogue.push(row);
    else if (row.objectives || row.title) out.quests.push(row);
  }
}

export function tablesToCodegenJobs(tables) {
  const jobs = [];
  for (const u of tables.units) {
    jobs.push({
      template: "unit_registry",
      args: {
        rawcode: u.rawcode || u.unitId || u.id,
        hp: u.hp,
        mana: u.mana,
        name: u.name,
      },
    });
  }
  for (const w of tables.waves) {
    jobs.push({
      template: "unit_wave",
      args: {
        moduleId: w.id || w.moduleId || `wave_${jobs.length + 1}`,
        unitId: w.unitId || w.unit || w.rawcode,
        count: w.count,
        interval: w.interval,
        waves: w.waves,
        x: w.x,
        y: w.y,
        targetX: w.targetX,
        targetY: w.targetY,
      },
    });
  }
  if (tables.dialogue.length) {
    jobs.push({
      template: "dialogue_table",
      args: {
        lines: tables.dialogue.map((d) => ({
          speaker: d.speaker,
          text: d.text,
          x: d.x,
          y: d.y,
        })),
      },
    });
  }
  for (const q of tables.quests) {
    const objectives = Array.isArray(q.objectives)
      ? q.objectives
      : String(q.objectives || "")
          .split(/[;；|]/)
          .map((s) => s.trim())
          .filter(Boolean);
    jobs.push({
      template: "quest_table",
      args: {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.questType || q.side === "main" || q.type === "main" ? "main" : "side",
        objectives,
        rewards: Array.isArray(q.rewards)
          ? q.rewards
          : String(q.rewards || "")
              .split(/[;；|]/)
              .map((s) => s.trim())
              .filter(Boolean),
      },
    });
  }
  return jobs;
}

export function importTableToJobs(filePath) {
  const tables = parseTableFile(filePath);
  return { tables, jobs: tablesToCodegenJobs(tables) };
}

export function defaultTableSamplePath(projectRoot) {
  return path.join(projectRoot, ".wcc", "tables-sample.json");
}
