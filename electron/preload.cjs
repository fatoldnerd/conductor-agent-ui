const { contextBridge, ipcRenderer } = require('electron');

const conductorApi = {
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    checkPrerequisites: () => ipcRenderer.invoke('system:checkPrerequisites'),
  },
  integrations: {
    listRecipes: () => ipcRenderer.invoke('integrations:listRecipes'),
    planInstall: (recipeId) => ipcRenderer.invoke('integrations:planInstall', recipeId),
  },
};

contextBridge.exposeInMainWorld('conductor', conductorApi);
