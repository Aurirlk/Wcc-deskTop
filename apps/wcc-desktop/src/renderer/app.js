/* WCC Desktop 2.0 renderer */
const $ = (sel) => document.querySelector(sel);

let streamEl = null;
let streamUnsub = null;

function addMsg(role, content) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = content;
  $("#timeline").appendChild(el);
  el.scrollIntoView({ block: "end" });
  return el;
}
function addMeta(content) {
  const el = document.createElement("div");
  el.className = "msg meta";
  el.textContent = content;
  $("#timeline").appendChild(el);
  el.scrollIntoView({ block: "end" });
  return el;
}

function ensureStreamEl() {
  if (!streamEl) {
    streamEl = addMsg("assistant", "");
  }
  return streamEl;
}
function endStreamEl(text) {
  if (streamEl) {
    if (text != null) streamEl.textContent = text;
    streamEl = null;
  }
}

function bindChatEvents() {
  if (streamUnsub) streamUnsub();
  streamUnsub = window.wcc.onChatEvent((evt) => {
    if (evt.type === "delta") {
      const el = ensureStreamEl();
      el.textContent += evt.text;
      el.scrollIntoView({ block: "end" });
    } else if (evt.type === "tool_start") {
      endStreamEl();
      addMeta(`⚙ ${evt.name} ${JSON.stringify(evt.args || {}).slice(0, 140)}`);
    } else if (evt.type === "tool_end") {
      const tag = evt.denied ? "已拒绝" : evt.ok ? "完成" : "失败";
      addMeta(`${evt.name} · ${tag}`);
    } else if (evt.type === "done") {
      endStreamEl(evt.text || undefined);
    } else if (evt.type === "error") {
      endStreamEl();
      addMeta(`错误：${evt.message}`);
    }
  });
}

async function refreshStatus() {
  const st = await window.wcc.status();
  const pill = $("#status-pill");
  const home = $("#home-health");
  if (st?.ok) {
    const forge = st.forgeConnected ? "forge✓" : "forge✗";
    const model = st.modelConfigured ? "model✓" : "离线";
    pill.textContent = `OK · tools ${st.tools ?? "-"} · ${model} · ${forge}`;
    pill.className = "pill ok";
    $("#project-path").textContent = st.projectRoot || "—";
    if (home) home.textContent = JSON.stringify(st, null, 2);
    updateHomeSteps(st);
  } else {
    pill.textContent = "Sidecar 未连接";
    pill.className = "pill err";
  }
  await refreshForge();
}

function updateHomeSteps(st) {
  document.querySelectorAll("#home-steps li").forEach((li) => li.classList.remove("ok"));
  if (st.modelConfigured) document.querySelector('[data-step="model"]')?.classList.add("ok");
  if (st.forgeConnected) document.querySelector('[data-step="forge"]')?.classList.add("ok");
}

async function refreshForge() {
  const box = $("#forge-box");
  const detail = $("#forge-detail");
  try {
    const st = await window.wcc.forgeStatus();
    if (st.connected) {
      box.textContent = `forge✓ pid ${st.pid} · ${st.toolCount ?? "?"} tools`;
      box.className = "pill ok";
      if (detail) detail.textContent = `已连接 pid ${st.pid} port ${st.port} · ${st.toolCount ?? "?"} tools · ${st.label || ""}`;
    } else {
      const n = st.sessions?.length ?? 0;
      box.textContent = n ? `forge ${n} 会话可连` : "forge 未运行";
      box.className = "pill";
      if (detail) detail.textContent = st.hint || st.error || "未连接";
      if (n) {
        const sessions = await window.wcc.forgeSessions();
        box.style.cursor = "pointer";
        box.onclick = async () => {
          await window.wcc.forgeConnect(sessions[0].pid);
          refreshStatus();
        };
      }
    }
  } catch (e) {
    box.textContent = "forge 错误";
    box.className = "pill err";
    if (detail) detail.textContent = String(e);
  }
}

async function refreshTools() {
  const tools = await window.wcc.tools();
  const ul = $("#tool-list");
  if (!ul) return;
  ul.innerHTML = "";
  for (const t of tools) {
    const li = document.createElement("li");
    li.textContent = `${t.name} — ${t.description}${t.needsApproval ? "（需审批）" : ""}`;
    ul.appendChild(li);
  }
}

async function refreshWorkbench() {
  try {
    const tree = await window.wcc.workbenchTree();
    const ul = $("#chapter-tree");
    if (ul) {
      ul.innerHTML = "";
      const push = (label) => {
        const li = document.createElement("li");
        li.textContent = label;
        ul.appendChild(li);
      };
      push(tree.mainExists ? "src/main.lua ✓" : "src/main.lua ✗（请创建入口）");
      tree.chapters?.forEach((c) => push(c));
      if (!tree.chapters?.length) push("（暂无章节 lua）");
      tree.lib?.forEach((c) => push(c));
    }
    const overview = await window.wcc.workbenchOverview();
    const ov = $("#wb-overview");
    if (ov) {
      ov.textContent = `对话 ${overview.dialogues?.length || 0} 段 / 台词 ${overview.dialogueLines || 0} · 任务 ${overview.quests?.length || 0} · 刷怪池 ${overview.spawners?.length || 0}`;
    }
    renderDialogues(overview.dialogues || []);
    renderQuests(overview.quests || []);
    renderSpawners(overview.spawners || []);
    const bible = await window.wcc.workbenchBible();
    if ($("#bible-title")) {
      $("#bible-title").value = bible.title || "";
      $("#bible-ver").value = bible.wc3Version || "";
      $("#bible-units").value = JSON.stringify(bible.units || [], null, 2);
      $("#bible-regions").value = JSON.stringify(bible.regions || [], null, 2);
    }
  } catch (e) {
    const ul = $("#chapter-tree");
    if (ul) ul.textContent = `工作台错误：${e}`;
  }
}

function renderDialogues(dialogues) {
  const root = $("#dialogue-timeline");
  if (!root) return;
  if (!dialogues.length) {
    root.textContent = "未解析到 Dialogue.Play（可在章节中添加后刷新）";
    return;
  }
  root.innerHTML = "";
  for (const d of dialogues) {
    const seq = document.createElement("div");
    seq.className = "dlg-seq";
    const h = document.createElement("div");
    h.className = "dlg-seq-h";
    h.textContent = `${d.file || ""} · ${d.id} · ${d.lineCount} 句`;
    seq.appendChild(h);
    for (const line of d.lines) {
      const row = document.createElement("div");
      row.className = "dlg-line";
      row.innerHTML = `<span class="idx">${String(line.index).padStart(2, "0")}</span><span class="who"></span><span class="say"></span>`;
      row.querySelector(".who").textContent = line.speaker || "旁白";
      row.querySelector(".say").textContent = line.text || "（无台词）";
      if (line.cameraX != null || line.duration != null) {
        const cam = document.createElement("div");
        cam.className = "dlg-cam";
        cam.textContent = `camera (${line.cameraX ?? "?"}, ${line.cameraY ?? "?"})${line.duration != null ? ` · ${line.duration}s` : ""}`;
        row.appendChild(cam);
      }
      seq.appendChild(row);
    }
    root.appendChild(seq);
  }
}

function renderQuests(quests) {
  const root = $("#quest-list");
  if (!root) return;
  if (!quests.length) {
    root.textContent = "未解析到 Quest.Create";
    return;
  }
  root.innerHTML = "";
  for (const q of quests) {
    const card = document.createElement("div");
    card.className = "quest-card";
    const h = document.createElement("h4");
    h.textContent = q.title || q.id;
    const meta = document.createElement("div");
    meta.className = "quest-meta";
    meta.innerHTML = `<span class="quest-badge ${q.type === "main" ? "main" : ""}">${q.type}</span> <code></code>`;
    meta.querySelector("code").textContent = q.file || q.id;
    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = q.description || "";
    const ul = document.createElement("ul");
    ul.className = "quest-obj";
    for (const o of q.objectives || []) {
      const li = document.createElement("li");
      li.textContent = o;
      ul.appendChild(li);
    }
    card.append(h, meta, desc);
    if (q.objectives?.length) card.appendChild(ul);
    if (q.rewards?.length) {
      const rew = document.createElement("div");
      rew.className = "quest-rew";
      rew.textContent = "奖励：" + q.rewards.join(" · ");
      card.appendChild(rew);
    }
    root.appendChild(card);
  }
}

function renderSpawners(spawners) {
  const root = $("#spawner-list");
  if (!root) return;
  if (!spawners.length) {
    root.textContent = "未解析到 Spawner.Create";
    return;
  }
  root.innerHTML = "";
  const maxWaves = Math.max(1, ...spawners.map((s) => s.waves || 0));
  for (const s of spawners) {
    const card = document.createElement("div");
    card.className = "spawn-card";
    const title = document.createElement("div");
    title.innerHTML = `<strong></strong> · <code></code>`;
    title.querySelector("strong").textContent = s.id || "spawner";
    title.querySelector("code").textContent = s.file || s.unitId || "";
    const body = document.createElement("div");
    body.textContent = `单位 ${s.unitId || "?"} · 每波 ${s.count ?? "?"} · 间隔 ${s.interval ?? "?"}s · 波次 ${s.waves ?? "∞"} · (${s.x ?? "?"},${s.y ?? "?"}) → (${s.targetX ?? "?"},${s.targetY ?? "?"})`;
    const bar = document.createElement("div");
    bar.className = "spawn-bar";
    const fill = document.createElement("i");
    const pct = s.waves ? Math.round(((s.waves || 0) / maxWaves) * 100) : 100;
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    card.append(title, body, bar);
    root.appendChild(card);
  }
}

function bindWbTabs() {
  document.querySelectorAll(".wb-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".wb-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".wb-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`#wb-${tab.dataset.wb}`)?.classList.add("active");
    });
  });
}

async function runBuild() {
  const entry = $("#build-entry")?.value?.trim() || "src.main";
  const btn = $("#btn-build");
  if (btn) btn.disabled = true;
  if ($("#build-msg")) $("#build-msg").textContent = "构建中…";
  try {
    const stats = await window.wcc.buildMap(entry);
    if (stats.error) {
      if ($("#build-msg")) $("#build-msg").textContent = stats.error;
      if ($("#build-out")) $("#build-out").textContent = stats.error;
      return;
    }
    if ($("#build-msg")) $("#build-msg").textContent = `完成 · ${stats.bytes} bytes`;
    if ($("#build-out")) $("#build-out").textContent = JSON.stringify(stats, null, 2);
    addMeta(`构建完成：${stats.war3map}`);
  } catch (e) {
    if ($("#build-msg")) $("#build-msg").textContent = String(e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function maybeShowOnboarding() {
  const box = $("#onboarding");
  if (!box) return;
  try {
    const list = await window.wcc.onboardingChecklist();
    if (list.done) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    const ol = $("#onb-steps");
    ol.innerHTML = "";
    for (const s of list.steps || []) {
      const li = document.createElement("li");
      li.className = s.ok ? "ok" : "";
      li.innerHTML = `<strong></strong><span class="onb-hint"></span>`;
      li.querySelector("strong").textContent = (s.ok ? "✓ " : "○ ") + s.title;
      li.querySelector(".onb-hint").textContent = s.hint;
      li.addEventListener("click", () => {
        box.classList.add("hidden");
        gotoView(s.goto || "home");
      });
      ol.appendChild(li);
    }
  } catch {
    box.classList.add("hidden");
  }
}

$("#btn-onb-skip")?.addEventListener("click", async () => {
  await window.wcc.onboardingDone();
  $("#onboarding")?.classList.add("hidden");
});
$("#btn-onb-start")?.addEventListener("click", async () => {
  await window.wcc.onboardingDone();
  $("#onboarding")?.classList.add("hidden");
  gotoView("settings");
});
$("#btn-build")?.addEventListener("click", runBuild);

async function loadConfigAndExperts() {
  const [cfg, experts] = await Promise.all([window.wcc.configGet(), window.wcc.experts()]);
  const fill = (sel, list, selected) => {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = "";
    for (const e of list) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      if (e.id === selected) opt.selected = true;
      el.appendChild(opt);
    }
  };
  fill("#expert-select", experts, cfg.expert);
  fill("#cfg-expert", experts, cfg.expert);
  if ($("#cfg-base")) $("#cfg-base").value = cfg.baseUrl || "";
  if ($("#cfg-model")) $("#cfg-model").value = cfg.model || "";
  if ($("#cfg-auto")) $("#cfg-auto").checked = Boolean(cfg.autoApprove);
  if ($("#cfg-key") && cfg.apiKeySet) $("#cfg-key").placeholder = "已保存（留空则不变）";
  return cfg;
}

async function sendChat(text) {
  // expand @file mentions
  let message = text;
  const refs = [...text.matchAll(/@([^\s]+)/g)];
  for (const m of refs) {
    try {
      const tools = await window.wcc.tools();
      // use read via sidecar chat? simpler: leave as-is for model to call read_file
      message = message.replace(m[0], `请读取文件 ${m[1]}`);
    } catch {
      /* ignore */
    }
  }
  // skill slash
  if (message.startsWith("/")) {
    const name = message.slice(1).trim().split(/\s+/)[0];
    message = `先 skill_load ${name}，然后：${message}`;
  }
  addMsg("user", text);
  ensureStreamEl();
  try {
    const res = await window.wcc.chat(message);
    if (streamEl && res.reply) endStreamEl(res.reply);
    else endStreamEl();
    if (res.error) addMeta(`错误：${res.error}`);
  } catch (err) {
    endStreamEl();
    addMeta(`错误：${err}`);
  }
  refreshStatus();
}

function gotoView(name) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelector(`.nav-item[data-view="${name}"]`)?.classList.add("active");
  $(`#view-${name}`)?.classList.add("active");
  if (name === "workbench") refreshWorkbench();
  if (name === "extensions") {
    refreshTools();
    refreshForge();
  }
  if (name === "maps") refreshMapsPage();
  if (name === "settings") loadConfigAndExperts();
  if (name === "home") refreshStatus();
}

async function refreshMapsPage() {
  await refreshMapRecommendations();
  const root = $("#maps-sources");
  if (!root) return;
  root.textContent = "加载中…";
  try {
    const sources = await window.wcc.mapsSources();
    root.innerHTML = "";
    const kindLabel = {
      community: "社区",
      "download-site": "下载站",
      "platform-client": "对战平台",
      editor: "编辑器",
      "editor-mcp": "编辑器 + MCP",
    };
    for (const s of sources) {
      const card = document.createElement("div");
      card.className = "map-card";
      const h = document.createElement("h4");
      h.textContent = s.name;
      const kind = document.createElement("div");
      kind.className = "map-kind";
      kind.textContent = kindLabel[s.kind] || s.kind;
      const note = document.createElement("p");
      note.className = "map-note";
      note.textContent = s.note || "";
      const url = document.createElement("div");
      url.className = "map-url";
      url.textContent = s.url;
      const btn = document.createElement("button");
      btn.className = "btn ghost";
      btn.textContent = "打开链接";
      btn.addEventListener("click", async () => {
        const r = await window.wcc.mapsOpen(s.id);
        if (r?.error) addMeta(`打开失败：${r.error}`);
        else addMeta(`已请求打开 ${r?.name || s.id}`);
      });
      card.append(h, kind, note, url, btn);
      root.appendChild(card);
    }
  } catch (e) {
    root.textContent = `加载失败：${e}`;
  }
}

async function refreshMapRecommendations() {
  const root = $("#maps-recs");
  if (!root) return;
  root.textContent = "加载中…";
  try {
    const recs = await window.wcc.mapsRecommendations();
    root.innerHTML = "";
    for (const theme of recs) {
      const card = document.createElement("div");
      card.className = "map-card";
      const h = document.createElement("h4");
      h.textContent = theme.title;
      const hint = document.createElement("p");
      hint.className = "map-note";
      hint.textContent = theme.hint || "";
      const row = document.createElement("div");
      row.className = "row";
      for (const link of theme.links || []) {
        const b = document.createElement("button");
        b.className = "btn ghost";
        b.textContent = link.label;
        b.addEventListener("click", async () => {
          const r = await window.wcc.mapsOpenUrl(link.url);
          if (r?.error) addMeta(`打开失败：${r.error}`);
          else addMeta(`已打开：${link.label}`);
        });
        row.appendChild(b);
      }
      card.append(h, hint, row);
      if (theme.custom) {
        const del = document.createElement("button");
        del.className = "btn ghost";
        del.textContent = "删除";
        del.addEventListener("click", async () => {
          const r = await window.wcc.mapsRecRemove(theme.id);
          if (r?.error) addMeta(r.error);
          else refreshMapRecommendations();
        });
        card.appendChild(del);
      }
      root.appendChild(card);
    }
  } catch (e) {
    root.textContent = `推荐加载失败：${e}`;
  }
}

$("#btn-rec-add")?.addEventListener("click", async () => {
  const title = $("#rec-title")?.value?.trim();
  const hint = $("#rec-hint")?.value?.trim();
  const l1 = $("#rec-l1-label")?.value?.trim();
  const u1 = $("#rec-l1-url")?.value?.trim();
  const u2 = $("#rec-l2-url")?.value?.trim();
  const links = [];
  if (u1) links.push({ label: l1 || u1, url: u1 });
  if (u2) links.push({ label: "链接2", url: u2 });
  const msg = $("#rec-add-msg");
  try {
    if (!title || !links.length) throw new Error("需要标题和至少一条 http(s) 链接");
    await window.wcc.mapsRecAdd({ title, hint, links });
    if (msg) msg.textContent = "已保存";
    $("#rec-title").value = "";
    $("#rec-hint").value = "";
    $("#rec-l1-label").value = "";
    $("#rec-l1-url").value = "";
    $("#rec-l2-url").value = "";
    refreshMapRecommendations();
  } catch (e) {
    if (msg) msg.textContent = String(e.message || e);
  }
});

async function scanLocalMaps() {
  const msg = $("#maps-scan-msg");
  const list = $("#maps-local-list");
  if (msg) msg.textContent = "扫描中…";
  try {
    const r = await window.wcc.mapsScan();
    if (msg) msg.textContent = `${r.count} 张 · 根目录 ${(r.scannedRoots || []).length}`;
    if (!list) return;
    list.innerHTML = "";
    if (!r.maps?.length) {
      list.textContent = "未发现 .w3x/.w3m（可把地图放进项目 maps/ 或文档 Maps）";
      return;
    }
    for (const m of r.maps) {
      const li = document.createElement("li");
      const kb = Math.round(m.bytes / 1024);
      li.textContent = `${m.name} · ${kb} KB · ${m.path}`;
      list.appendChild(li);
    }
  } catch (e) {
    if (msg) msg.textContent = String(e);
  }
}

$("#btn-maps-scan")?.addEventListener("click", scanLocalMaps);

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => gotoView(btn.dataset.view));
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => gotoView(btn.dataset.goto));
});

$("#composer").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $("#input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await sendChat(text);
});

$("#btn-allow").addEventListener("click", async () => {
  await window.wcc.approvalResolve(true);
  pollApproval();
});
$("#btn-deny").addEventListener("click", async () => {
  await window.wcc.approvalResolve(false);
  pollApproval();
});
$("#btn-pick").addEventListener("click", async () => {
  const p = await window.wcc.pickProject();
  if (p) {
    $("#project-path").textContent = p;
    addMeta(`已切换项目：${p}`);
    refreshStatus();
    loadConfigAndExperts();
  }
});
$("#btn-forge-refresh")?.addEventListener("click", () => refreshForge());
$("#btn-tree-refresh")?.addEventListener("click", () => refreshWorkbench());
$("#btn-check").addEventListener("click", async () => {
  $("#btn-check").disabled = true;
  try {
    gotoView("chat");
    await sendChat("请对 src 运行 lua_check 并总结问题");
  } finally {
    $("#btn-check").disabled = false;
  }
});
$("#btn-bible-save")?.addEventListener("click", async () => {
  try {
    const patch = {
      title: $("#bible-title").value,
      wc3Version: $("#bible-ver").value,
      units: JSON.parse($("#bible-units").value || "[]"),
      regions: JSON.parse($("#bible-regions").value || "[]"),
    };
    await window.wcc.workbenchBibleSet(patch);
    $("#bible-msg").textContent = "已保存";
  } catch (e) {
    $("#bible-msg").textContent = `保存失败：${e.message || e}`;
  }
});
$("#btn-cfg-save")?.addEventListener("click", async () => {
  const patch = {
    baseUrl: $("#cfg-base").value.trim(),
    model: $("#cfg-model").value.trim() || "deepseek-chat",
    autoApprove: $("#cfg-auto").checked,
    expert: $("#cfg-expert").value,
  };
  const key = $("#cfg-key").value.trim();
  if (key) patch.apiKey = key;
  try {
    await window.wcc.configSet(patch);
    $("#cfg-msg").textContent = "已保存到 .wcc/config.json";
    await loadConfigAndExperts();
    await refreshStatus();
  } catch (e) {
    $("#cfg-msg").textContent = `失败：${e}`;
  }
});
$("#expert-select")?.addEventListener("change", async (e) => {
  await window.wcc.configSet({ expert: e.target.value });
  addMeta(`专家已切换：${e.target.selectedOptions[0]?.text || e.target.value}`);
});

async function pollApproval() {
  try {
    const p = await window.wcc.approvalPending();
    const box = $("#approval");
    if (!box) return;
    if (p) {
      box.classList.remove("hidden");
      $("#approval-detail").textContent = `${p.name}\n${JSON.stringify(p.args, null, 2)}`;
    } else {
      box.classList.add("hidden");
    }
  } catch {
    /* ignore */
  }
}

bindChatEvents();
bindWbTabs();
addMeta("WCC 2.0 · 工作台可视化 · build_map · 首启向导");
loadConfigAndExperts();
refreshStatus();
refreshTools();
maybeShowOnboarding();
setInterval(pollApproval, 1500);
