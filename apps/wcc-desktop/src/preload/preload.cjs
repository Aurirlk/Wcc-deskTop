const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wcc", {
  status: () => ipcRenderer.invoke("wcc:status"),
  sessionList: () => ipcRenderer.invoke("wcc:session-list"),
  sessionResume: (id) => ipcRenderer.invoke("wcc:session-resume", id),
  sessionNew: () => ipcRenderer.invoke("wcc:session-new"),
  chat: (message) => ipcRenderer.invoke("wcc:chat", message),
  onChatEvent: (cb) => {
    const handler = (_e, evt) => cb(evt);
    ipcRenderer.on("wcc:chat-event", handler);
    return () => ipcRenderer.removeListener("wcc:chat-event", handler);
  },
  tools: () => ipcRenderer.invoke("wcc:tools"),
  approvalPending: () => ipcRenderer.invoke("wcc:approval-pending"),
  approvalResolve: (allow) => ipcRenderer.invoke("wcc:approval-resolve", allow),
  forgeStatus: () => ipcRenderer.invoke("wcc:forge-status"),
  forgeSessions: () => ipcRenderer.invoke("wcc:forge-sessions"),
  forgeConnect: (pid) => ipcRenderer.invoke("wcc:forge-connect", pid),
  mapsSources: (kind) => ipcRenderer.invoke("wcc:maps-sources", kind),
  mapsRecommendations: () => ipcRenderer.invoke("wcc:maps-recommendations"),
  mapsRecAdd: (payload) => ipcRenderer.invoke("wcc:maps-rec-add", payload),
  mapsRecRemove: (id) => ipcRenderer.invoke("wcc:maps-rec-remove", id),
  mapsOpenUrl: (url) => ipcRenderer.invoke("wcc:maps-open-url", url),
  mapsScan: () => ipcRenderer.invoke("wcc:maps-scan"),
  mapsOpen: (id) => ipcRenderer.invoke("wcc:maps-open", id),
  configGet: () => ipcRenderer.invoke("wcc:config-get"),
  configSet: (patch) => ipcRenderer.invoke("wcc:config-set", patch),
  experts: () => ipcRenderer.invoke("wcc:experts"),
  workbenchTree: () => ipcRenderer.invoke("wcc:workbench-tree"),
  workbenchBible: () => ipcRenderer.invoke("wcc:workbench-bible"),
  workbenchBibleSet: (patch) => ipcRenderer.invoke("wcc:workbench-bible-set", patch),
  workbenchOverview: () => ipcRenderer.invoke("wcc:workbench-overview"),
  workbenchDialogues: () => ipcRenderer.invoke("wcc:workbench-dialogues"),
  workbenchQuests: () => ipcRenderer.invoke("wcc:workbench-quests"),
  workbenchSpawners: () => ipcRenderer.invoke("wcc:workbench-spawners"),
  buildMap: (entry) => ipcRenderer.invoke("wcc:build", entry),
  onboardingChecklist: () => ipcRenderer.invoke("wcc:onboarding-checklist"),
  onboardingDone: () => ipcRenderer.invoke("wcc:onboarding-done"),
  onboardingReset: () => ipcRenderer.invoke("wcc:onboarding-reset"),
  pickProject: () => ipcRenderer.invoke("wcc:pick-project"),
});
