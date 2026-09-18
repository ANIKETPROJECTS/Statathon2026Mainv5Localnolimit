const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

let mainWindow;
const outputStreams = new Map();

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

ipcMain.handle("create-output-file", async (_event, folder, name) => {
  const safeName = path.basename(String(name));
  const filePath = path.join(String(folder), safeName);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  outputStreams.set(id, fs.createWriteStream(filePath));
  return id;
});

ipcMain.handle("write-output-chunk", async (_event, id, chunk) => {
  const stream = outputStreams.get(id);
  if (!stream) throw new Error("Output stream is not available.");
  const buffer = Buffer.from(chunk);
  if (stream.write(buffer)) return;
  await new Promise((resolve, reject) => {
    stream.once("drain", resolve);
    stream.once("error", reject);
  });
});

ipcMain.handle("close-output-file", async (_event, id) => {
  const stream = outputStreams.get(id);
  if (!stream) return;
  await new Promise((resolve, reject) => {
    stream.once("finish", resolve);
    stream.once("error", reject);
    stream.end();
  });
  outputStreams.delete(id);
});

function columnPreferencesPath() {
  return path.join(app.getPath("userData"), "column-preferences.json");
}

ipcMain.handle("get-column-preferences", async () => {
  try {
    const stored = JSON.parse(fs.readFileSync(columnPreferencesPath(), "utf8"));
    return Array.isArray(stored)
      ? stored.filter((value) => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    console.error("Could not read saved column preferences:", error);
    return null;
  }
});

ipcMain.handle("set-column-preferences", async (_event, columns) => {
  const safeColumns = Array.isArray(columns)
    ? [...new Set(columns.filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim()))]
    : [];
  const preferencesFile = columnPreferencesPath();
  fs.mkdirSync(path.dirname(preferencesFile), { recursive: true });
  fs.writeFileSync(preferencesFile, JSON.stringify(safeColumns, null, 2), "utf8");
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