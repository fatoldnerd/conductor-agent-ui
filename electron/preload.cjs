const { contextBridge, ipcRenderer } = require('electron');

const conductorApi = {
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    checkPrerequisites: () => ipcRenderer.invoke('system:checkPrerequisites'),
    collectInventory: () => ipcRenderer.invoke('system:collectInventory'),
  },
  integrations: {
    listRecipes: () => ipcRenderer.invoke('integrations:listRecipes'),
    planInstall: (recipeId) => ipcRenderer.invoke('integrations:planInstall', recipeId),
    createInstallRun: (recipeId) => ipcRenderer.invoke('integrations:createInstallRun', recipeId),
    getInstallRun: (runId) => ipcRenderer.invoke('integrations:getInstallRun', runId),
    runInstallStep: (runId, stepId) => ipcRenderer.invoke('integrations:runInstallStep', runId, stepId),
    runInstallSequence: (runId) => ipcRenderer.invoke('integrations:runInstallSequence', runId),
    listAuditEvents: (runId) => ipcRenderer.invoke('integrations:listAuditEvents', runId),
    onInstallOutput: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('integrations:installOutput', listener);
      return () => ipcRenderer.removeListener('integrations:installOutput', listener);
    },
  },
  agents: {
    listRuntimes: () => ipcRenderer.invoke('agents:listRuntimes'),
    validateProject: (projectPath) => ipcRenderer.invoke('agents:validateProject', projectPath),
    startRun: (payload) => ipcRenderer.invoke('agents:startRun', payload),
    stopRun: (runId) => ipcRenderer.invoke('agents:stopRun', runId),
    getRun: (runId) => ipcRenderer.invoke('agents:getRun', runId),
    onRunEvent: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('agents:runEvent', listener);
      return () => ipcRenderer.removeListener('agents:runEvent', listener);
    },
  },
  runtimeActions: {
    getAuditHistory: () => ipcRenderer.invoke('runtimeActions:getAuditHistory'),
    getApprovalQueue: () => ipcRenderer.invoke('runtimeActions:getApprovalQueue'),
    getApprovalDecisions: () => ipcRenderer.invoke('runtimeActions:getApprovalDecisions'),
  },
};

contextBridge.exposeInMainWorld('conductor', conductorApi);
