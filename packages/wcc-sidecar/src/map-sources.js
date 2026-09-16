/**
 * Map sites / platforms catalog + local library scan.
 * Policy: link out + scan user-owned files only; no site scraping.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const MAP_SOURCES = [
  {
    id: "hive",
    name: "Hive Workshop",
    kind: "community",
    url: "https://www.hiveworkshop.com/",
    note: "国际社区：地图/模型/教程；下载需自行遵守作者许可",
    lang: "en",
  },
  {
    id: "epicwar",
    name: "Epic War",
    kind: "download-site",
    url: "https://www.epicwar.com/",
    note: "老牌地图档案站；无公开 Agent API，仅外链",
    lang: "en",
  },
  {
    id: "netease-platform",
    name: "网易官方对战平台",
    kind: "platform-client",
    url: "https://wc.163.com/",
    note: "客户端图库/联机；无 MCP；可用户导出图到本地后扫描",
    lang: "zh",
  },
  {
    id: "11-platform",
    name: "11对战平台",
    kind: "platform-client",
    url: "https://www.11platform.com/",
    note: "客户端；支持本地建图玩法；WCC 不驱动客户端",
    lang: "zh",
  },
  {
    id: "kk-platform",
    name: "KK对战平台",
    kind: "platform-client",
    url: "https://www.kkduizhan.com/",
    note: "国服平台之一；无公开 API",
    lang: "zh",
  },
  {
    id: "platform-80",
    name: "80对战平台",
    kind: "platform-client",
    url: "https://www.80platform.com/",
    note: "常见怀旧图库宣传源；无公开 API",
    lang: "zh",
  },
  {
    id: "wc3-forge",
    name: "wc3-forge",
    kind: "editor-mcp",
    url: "https://github.com/StephenSHorton/wc3-forge",
    note: "唯一建议程序化对接的改图工具（MCP）；协议需真机验证",
    lang: "en",
  },
  {
    id: "ydwe",
    name: "YDWE",
    kind: "editor",
    url: "https://github.com/actboy168/YDWE",
    note: "国服增强 WE；本机打开，无标准 MCP",
    lang: "zh",
  },
  {
    id: "official-we",
    name: "World Editor",
    kind: "editor",
    url: "https://us.shop.battle.net/",
    note: "随游戏附带；WCC 逻辑层最终进图仍推荐 WE/wc3-forge",
    lang: "zh",
  },
];

/**
 * 按 B 站用户痛点（老图哪里下 / 图库大）做「主题推荐」：
 * 只给搜索入口链接，不镜像、不保证某张图一定存在。
 */
export const MAP_RECOMMENDATIONS = [
  {
    id: "retro",
    title: "怀旧老图 / 经典 RPG",
    hint: "早期守图、剧情 RPG；优先国际档案站与平台客户端图库",
    links: [
      {
        label: "Epic War 搜 RPG",
        url: "https://www.epicwar.com/maps/?search=rpg",
        sourceId: "epicwar",
      },
      {
        label: "Epic War 搜 classic",
        url: "https://www.epicwar.com/maps/?search=classic",
        sourceId: "epicwar",
      },
      {
        label: "Hive 搜 campaign",
        url: "https://www.hiveworkshop.com/search/?q=campaign",
        sourceId: "hive",
      },
      {
        label: "打开网易平台",
        url: "https://wc.163.com/",
        sourceId: "netease-platform",
      },
    ],
  },
  {
    id: "defense",
    title: "防守 / 守图",
    hint: "TD/守家类在国服平台与档案站均有大量条目",
    links: [
      {
        label: "Epic War 搜 defense",
        url: "https://www.epicwar.com/maps/?search=defense",
        sourceId: "epicwar",
      },
      {
        label: "Hive 搜 tower defense",
        url: "https://www.hiveworkshop.com/search/?q=tower%20defense",
        sourceId: "hive",
      },
      {
        label: "打开 11 平台",
        url: "https://www.11platform.com/",
        sourceId: "11-platform",
      },
    ],
  },
  {
    id: "story",
    title: "剧情 / 战役向",
    hint: "适合参考 WCC 战役逻辑；下载后可用本地库索引再开 forge/WCC",
    links: [
      {
        label: "Hive 搜 story map",
        url: "https://www.hiveworkshop.com/search/?q=story%20map",
        sourceId: "hive",
      },
      {
        label: "Epic War 搜 campaign",
        url: "https://www.epicwar.com/maps/?search=campaign",
        sourceId: "epicwar",
      },
    ],
  },
  {
    id: "large-library",
    title: "图库大的平台（客户端）",
    hint: "B 站常说「图多」；请用官方客户端下载到本机后再扫描",
    links: [
      {
        label: "网易官方对战平台",
        url: "https://wc.163.com/",
        sourceId: "netease-platform",
      },
      {
        label: "KK 对战平台",
        url: "https://www.kkduizhan.com/",
        sourceId: "kk-platform",
      },
      {
        label: "80 对战平台",
        url: "https://www.80platform.com/",
        sourceId: "platform-80",
      },
    ],
  },
];

export function listRecommendations() {
  return MAP_RECOMMENDATIONS;
}

function defaultScanRoots(projectRoot) {
  const home = os.homedir();
  const roots = [];
  if (projectRoot) roots.push(path.join(projectRoot, "maps"), path.join(projectRoot, "Maps"));
  roots.push(
    path.join(home, "Documents", "Warcraft III", "Maps"),
    path.join(home, "Documents", "Warcraft III", "Maps", "Download")
  );
  return roots.filter((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}

function walkMaps(dir, acc, depth = 0) {
  if (depth > 6) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkMaps(abs, acc, depth + 1);
    else if (/\.(w3x|w3m)$/i.test(e.name)) {
      try {
        const st = fs.statSync(abs);
        acc.push({
          path: abs,
          name: e.name,
          bytes: st.size,
          mtime: st.mtimeMs,
        });
      } catch {
        /* skip */
      }
    }
  }
  return acc;
}

export function createMapSources({ projectRoot, openExternal }) {
  function customFile() {
    return path.join(projectRoot || process.cwd(), ".wcc", "map-recommendations.json");
  }

  function loadCustom() {
    try {
      const data = JSON.parse(fs.readFileSync(customFile(), "utf8"));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveCustom(list) {
    const file = customFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf8");
    return list;
  }

  function listSources(filterKind) {
    let list = MAP_SOURCES;
    if (filterKind) list = list.filter((s) => s.kind === filterKind);
    return list;
  }

  function listThemeRecommendations() {
    const custom = loadCustom().map((c) => ({
      id: c.id,
      title: c.title,
      hint: c.hint || "自定义",
      custom: true,
      links: Array.isArray(c.links) ? c.links : [],
    }));
    return [...MAP_RECOMMENDATIONS, ...custom];
  }

  function addCustomRecommendation({ title, hint, links }) {
    if (!title || !Array.isArray(links) || !links.length) {
      throw new Error("title and links[] required");
    }
    const norm = links.map((l) => {
      if (!l?.url || !/^https?:\/\//i.test(l.url)) {
        throw new Error("each link needs http(s) url");
      }
      return { label: l.label || l.url, url: l.url, sourceId: l.sourceId || "custom" };
    });
    const list = loadCustom();
    const id = `custom_${Date.now().toString(36)}`;
    const item = {
      id,
      title: String(title),
      hint: String(hint || ""),
      links: norm,
      createdAt: Date.now(),
    };
    list.unshift(item);
    saveCustom(list);
    return item;
  }

  function removeCustomRecommendation(id) {
    const list = loadCustom();
    const next = list.filter((x) => x.id !== id);
    if (next.length === list.length) return false;
    saveCustom(next);
    return true;
  }

  function listCustomRecommendations() {
    return loadCustom();
  }

  async function openSite(id) {
    const s = MAP_SOURCES.find((x) => x.id === id);
    if (!s) throw new Error(`unknown source: ${id}`);
    if (openExternal) await openExternal(s.url);
    return { ok: true, url: s.url };
  }

  function scanLocal(extraRoots = []) {
    const roots = [...defaultScanRoots(projectRoot), ...extraRoots.map((p) => path.resolve(p))];
    const unique = [...new Set(roots)];
    const files = [];
    const scanned = [];
    for (const root of unique) {
      scanned.push(root);
      walkMaps(root, files);
    }
    files.sort((a, b) => b.mtime - a.mtime);
    return { scannedRoots: scanned, count: files.length, maps: files.slice(0, 200) };
  }

  return {
    listSources,
    listThemeRecommendations,
    addCustomRecommendation,
    removeCustomRecommendation,
    listCustomRecommendations,
    openSite,
    scanLocal,
    MAP_SOURCES,
    MAP_RECOMMENDATIONS,
  };
}
