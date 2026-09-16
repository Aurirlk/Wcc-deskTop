/** Main ↔ Sidecar ↔ Renderer protocol (v1) */

export type Role = "user" | "assistant" | "tool" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  toolName?: string;
  toolStatus?: "pending" | "ok" | "error" | "denied";
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  ok: boolean;
  output: string;
  requiresApproval?: boolean;
}

export type ApprovalDecision = "allow" | "deny";

export interface SidecarStatus {
  running: boolean;
  projectId: string | null;
  modelConfigured: boolean;
  forgeConnected: boolean;
  luaCheckAvailable: boolean;
}

/** IPC channel names */
export const IPC = {
  sidecarStatus: "wcc:sidecar:status",
  sendUserMessage: "wcc:chat:send",
  streamAssistant: "wcc:chat:stream",
  chatHistory: "wcc:chat:history",
  toolApproval: "wcc:tool:approval",
  toolApprovalRequest: "wcc:tool:approval-request",
  listProjects: "wcc:project:list",
  openProject: "wcc:project:open",
  runLuaCheck: "wcc:check:run",
  runBuild: "wcc:build:run",
} as const;

export interface CheckIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: "error" | "warning";
}

export interface CheckReport {
  files: number;
  issues: CheckIssue[];
  ok: boolean;
}
