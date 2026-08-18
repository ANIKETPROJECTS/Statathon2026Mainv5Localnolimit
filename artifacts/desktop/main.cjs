const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1024,
    minHeight: 700,
    title: "AIRAVATA DEA — CSV Data Profiler",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.DESKTOP_DEV_URL || "http://127.0.0.1:5000";
  if (!app.isPackaged) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(process.resourcesPath, "csv-profiler", "index.html"));
}

ipcMain.handle("choose-output-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});