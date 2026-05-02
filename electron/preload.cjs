const { contextBridge, ipcRenderer } = require('electron');

const conductorApi = {
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    checkPrerequisites: () => ipcRenderer.invoke('system:checkPrerequisites'),
  },
};

contextBridge.exposeInMainWorld('conductor', conductorApi);
