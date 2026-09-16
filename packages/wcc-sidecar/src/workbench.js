/**
 * Campaign workbench helpers: chapter tree + bible.
 */
import fs from "node:fs";
import path from "node:path";
import { extractChapterSummary, extractDialogues, extractQuests, extractSpawners } from "./lua-extract.js";

function listLuaFiles(dir, acc = [], prefix = "") {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) listLuaFiles(abs, acc, rel);
    else if (name.endsWith(".lua")) acc.push(rel);
  }
  return acc;
}

export function createWorkbench({ projectRoot }) {
  function biblePath() {
    return path.join(projectRoot, ".wcc", "bible.json");
  }

  function readBible() {
    try {
      return JSON.parse(fs.readFileSync(biblePath(), "utf8"));
    } catch {
      return {
        title: path.basename(projectRoot),
        wc3Version: "1.31+",
        units: [],
        regions: [],
        chapters: [],
        rules: ["no-wait", "safe-handle"],
      };
    }
  }

  function writeBible(bible) {
    const dir = path.join(projectRoot, ".wcc");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(biblePath(), JSON.stringify(bible, null, 2), "utf8");
    return bible;
  }

  function chapterTree() {
    const mapDir = path.join(projectRoot, "src", "map");
    const srcDir = path.join(projectRoot, "src");
    const main = path.join(projectRoot, "src", "main.lua");
    const srcRootLua = fs.existsSync(srcDir)
      ? fs
          .readdirSync(srcDir)
          .filter((n) => n.endsWith(".lua"))
          .map((n) => `src/${n}`)
      : [];
    return {
      mainExists: fs.existsSync(main),
      chapters: [
        ...listLuaFiles(mapDir, [], "src/map"),
        ...srcRootLua.filter((n) => n !== "src/main.lua"),
      ],
      lib: listLuaFiles(path.join(projectRoot, "src", "lib"), [], "src/lib"),
      rootLib: listLuaFiles(path.join(projectRoot, "wcc-lib"), [], "wcc-lib"),
    };
  }

  /** Lightweight scan of Dialogue.Play / Quest.Create markers */
  function scanHints(rel) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) return null;
    const src = fs.readFileSync(abs, "utf8");
    return extractChapterSummary(src);
  }

  /** Aggregate dialogues/quests/spawners across chapters */
  function campaignOverview() {
    const tree = chapterTree();
    const chapters = tree.chapters;
    const dialogues = [];
    const quests = [];
    const spawners = [];
    for (const rel of chapters) {
      const abs = path.join(projectRoot, rel);
      if (!fs.existsSync(abs)) continue;
      const src = fs.readFileSync(abs, "utf8");
      const sum = extractChapterSummary(src);
      sum.dialogues.forEach((d) => dialogues.push({ ...d, file: rel }));
      sum.quests.forEach((q) => quests.push({ ...q, file: rel }));
      sum.spawners.forEach((s) => spawners.push({ ...s, file: rel }));
    }
    return {
      chapters,
      dialogues,
      quests,
      spawners,
      dialogueLines: dialogues.reduce((n, d) => n + d.lineCount, 0),
    };
  }

  function readChapter(rel) {
    const abs = path.join(projectRoot, rel);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, "utf8");
  }

  return {
    chapterTree,
    readBible,
    writeBible,
    scanHints,
    biblePath,
    campaignOverview,
    readChapter,
    extractDialogues: (src) => extractDialogues(src),
    extractQuests: (src) => extractQuests(src),
    extractSpawners: (src) => extractSpawners(src),
  };
}
