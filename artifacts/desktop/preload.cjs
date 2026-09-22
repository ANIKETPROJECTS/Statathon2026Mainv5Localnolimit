const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  chooseOutputFolder: () => ipcRenderer.invoke("choose-output-folder"),
  createOutputFile: (folder, name) => ipcRenderer.invoke("create-output-file", folder, name),
  writeOutputChunk: (id, chunk) => ipcRenderer.invoke("write-output-chunk", id, chunk),
  closeOutputFile: (id) => ipcRenderer.invoke("close-output-file", id),
  getColumnPreferences: () => ipcRenderer.invoke("get-column-preferences"),
  setColumnPreferences: (columns) => ipcRenderer.invoke("set-column-preferences", columns),
  getDecryptionColumnPreferences: () => ipcRenderer.invoke("get-decryption-column-preferences"),
  setDecryptionColumnPreferences: (columns) => ipcRenderer.invoke("set-decryption-column-preferences", columns),
  getDefaultOutputFolders: () => ipcRenderer.invoke("get-default-output-folders"),
  setDefaultOutputFolders: (folders) => ipcRenderer.invoke("set-default-output-folders", folders)
});