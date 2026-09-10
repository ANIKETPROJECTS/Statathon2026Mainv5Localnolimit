const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  chooseOutputFolder: () => ipcRenderer.invoke("choose-output-folder"),
  createOutputFile: (folder, name) => ipcRenderer.invoke("create-output-file", folder, name),
  writeOutputChunk: (id, chunk) => ipcRenderer.invoke("write-output-chunk", id, chunk),
  closeOutputFile: (id) => ipcRenderer.invoke("close-output-file", id)
});