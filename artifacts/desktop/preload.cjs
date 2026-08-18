const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  chooseOutputFolder: () => ipcRenderer.invoke("choose-output-folder")
});