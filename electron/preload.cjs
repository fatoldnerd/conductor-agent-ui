const { contextBridge, ipcRenderer } = require('electron');

const conductorApi = {
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    checkPrerequisites: () => ipcRenderer.invoke('system:checkPrerequisites'),
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
};

contextBridge.exposeInMainWorld('conductor', conductorApi);
