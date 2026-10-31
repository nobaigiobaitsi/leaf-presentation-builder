const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('leafDesktop', Object.freeze({
  saveProject: (json, name) => ipcRenderer.invoke('leaf:save', json, name),
  openProject: () => ipcRenderer.invoke('leaf:open'),
  exportPDF: name => ipcRenderer.invoke('leaf:pdf', name)
}));
