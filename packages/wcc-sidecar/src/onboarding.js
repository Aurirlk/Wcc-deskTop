/**
 * Onboarding helpers: first-run detection + step checklist data.
 */
import fs from "node:fs";
import path from "node:path";

export function createOnboarding({ projectRoot, configStore, forgeManager }) {
  const flagPath = () => path.join(projectRoot, ".wcc", "onboarding-done.json");

  function isDone() {
    return fs.existsSync(flagPath());
  }

  function markDone() {
    fs.mkdirSync(path.join(projectRoot, ".wcc"), { recursive: true });
    fs.writeFileSync(flagPath(), JSON.stringify({ at: Date.now() }, null, 2), "utf8");
    return true;
  }

  async function checklist() {
    const cfg = configStore.get();
    let forge = { connected: false, sessions: [] };
    try {
      forge = await forgeManager.status();
    } catch {
      /* ignore */
    }
    const mainOk = fs.existsSync(path.join(projectRoot, "src", "main.lua"));
    return {
      done: isDone(),
      steps: [
        {
          id: "model",
          title: "配置模型",
          ok: Boolean(cfg.apiKeySet && cfg.baseUrl),
          hint: "设置页填入 DeepSeek / OpenAI 兼容 Base URL 与 API Key",
          goto: "settings",
        },
        {
          id: "project",
          title: "战役入口",
          ok: mainOk,
          hint: mainOk ? "已存在 src/main.lua" : "创建 src/main.lua 并 require lib",
          goto: "workbench",
        },
        {
          id: "forge",
          title: "（可选）连接 wc3-forge",
          ok: Boolean(forge.connected),
          hint: forge.connected
            ? "已连接"
            : (forge.sessions?.length ? "发现会话，可点连接" : "打开 wc3-forge 并加载地图"),
          goto: "extensions",
        },
        {
          id: "chat",
          title: "生成第一章并检查",
          ok: false,
          hint: "在会话中描述需求，AI 会 write_file + lua_check",
          goto: "chat",
        },
      ],
      cfg,
      forgeConnected: Boolean(forge.connected),
    };
  }

  return { isDone, markDone, checklist };
}
