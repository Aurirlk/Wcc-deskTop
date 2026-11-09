/**
 * Provider presets: model portability without a framework (Strands idea).
 * All endpoints are OpenAI-compatible /chat/completions, so agent.js needs no
 * per-vendor adapter. URLs checked 2026-11-09; model names are examples and
 * should be verified against each vendor console.
 */

export const PROVIDERS = {
  deepseek: {
    id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat", requiresKey: true, local: false,
    note: "项目当前默认；国产、免翻墙",
  },
  qwen: {
    id: "qwen", label: "通义千问 / 百炼", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus", requiresKey: true, local: false,
    note: "兼容模式端点，注意路径里的 compatible-mode",
  },
  zhipu: {
    id: "zhipu", label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash", requiresKey: true, local: false,
    note: "v4 端点；flash 模型成本低，适合长任务",
  },
  moonshot: {
    id: "moonshot", label: "月之暗面 Kimi", baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k", requiresKey: true, local: false,
    note: "长上下文可换 128k 型号，注意计费",
  },
  doubao: {
    id: "doubao", label: "豆包 / 火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-pro-32k", requiresKey: true, local: false,
    note: "模型名常为接入点 ID，以控制台为准",
  },
  ollama: {
    id: "ollama", label: "Ollama（本机离线）", baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen2.5-coder", requiresKey: false, local: true,
    note: "完全离线；需本机已 ollama serve 且拉过模型",
  },
  custom: {
    id: "custom", label: "自定义 OpenAI 兼容端点", baseUrl: "",
    model: "", requiresKey: true, local: false,
    note: "vLLM / LM Studio / 内网网关等",
  },
};

/** Resolve a preset + user overrides into what agent.js actually needs. */
export function resolveProvider(config = {}) {
  const id = config.provider || "deepseek";
  const preset = PROVIDERS[id] || PROVIDERS.custom;
  const env = process.env || {};
  const baseUrl = config.baseUrl || env.WCC_MODEL_BASE_URL || preset.baseUrl;
  const apiKey = config.apiKey || env.WCC_MODEL_API_KEY || "";
  const model = config.model || env.WCC_MODEL_NAME || preset.model;
  const configured = Boolean(baseUrl) && (preset.requiresKey ? Boolean(apiKey) : true);
  return {
    provider: id,
    label: preset.label,
    baseUrl,
    model,
    configured,
    requiresKey: preset.requiresKey,
    local: preset.local,
    note: preset.note,
    apiKeySet: Boolean(apiKey),
  };
}

export function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({ ...p }));
}

/** Config patch for config-store.save() — UI only needs a dropdown + optional key. */
export function providerPatch(id, apiKey = "") {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`unknown provider: ${id}`);
  const patch = { provider: id };
  if (p.baseUrl) patch.baseUrl = p.baseUrl;
  if (p.model) patch.model = p.model;
  if (apiKey) patch.apiKey = apiKey;
  return patch;
}
