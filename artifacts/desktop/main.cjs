const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

let mainWindow;

function logRendererDiagnostics() {
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.error(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Electron failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });
  mainWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    console.error(`Electron resource failed: ${details.error} ${details.url}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Electron renderer exited: ${details.reason} (exit code ${details.exitCode})`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1024,
    minHeight: 700,
    title: "AIRAVATA DEA — CSV Data Profiler",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.DESKTOP_DEV_URL || "http://127.0.0.1:5000";
  logRendererDiagnostics();
  mainWindow.on("ready-to-show", () => mainWindow.show());
  if (!app.isPackaged) {
    mainWindow.loadURL(devUrl).catch((error) => {
      console.error("Electron could not load the development frontend:", error);
    });
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, "csv-profiler", "index.html")).catch((error) => {
      console.error("Electron could not load the packaged frontend:", error);
    });
  }
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