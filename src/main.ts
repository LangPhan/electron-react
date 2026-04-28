import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import fs from "node:fs";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// --- Main Window ---
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    titleBarStyle: "hiddenInset",
    frame: process.platform === "darwin" ? false : true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
      ),
    );
  }

  // Open DevTools in dev mode
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// --- IPC Handlers ---

// Open file dialog
ipcMain.handle("open-file-dialog", async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Images & PDF",
        extensions: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp", "pdf"],
      },
      { name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"] },
      { name: "PDF", extensions: ["pdf"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";

  return {
    name: path.basename(filePath),
    path: filePath,
    type: isPdf ? "pdf" : "image",
    size: stat.size,
    addedAt: Date.now(),
  };
});

// Get file as base64 data URL for preview
ipcMain.handle("get-file-data", async (_event, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mime = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
    else if (ext === ".bmp") mime = "image/bmp";
    else if (ext === ".webp") mime = "image/webp";
    else if (ext === ".tiff" || ext === ".tif") mime = "image/tiff";
    else if (ext === ".pdf") mime = "application/pdf";

    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("Error reading file:", err);
    return null;
  }
});

// Read file as raw ArrayBuffer for OCR processing and PDF rendering in renderer
ipcMain.handle("read-file-buffer", async (_event, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  } catch (err) {
    console.error("Error reading file buffer:", err);
    return null;
  }
});

// Get file info for drag & drop
ipcMain.handle("get-file-info", async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isPdf = ext === ".pdf";
    const validExts = [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp", ".pdf"];

    if (!validExts.includes(ext)) return null;

    return {
      name: path.basename(filePath),
      path: filePath,
      type: isPdf ? "pdf" : "image",
      size: stat.size,
      addedAt: Date.now(),
    };
  } catch {
    return null;
  }
});

// Export OCR result to text file
ipcMain.handle("export-text", async (_event, text: string, defaultName: string) => {
  if (!mainWindow) return false;

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: "Text File", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return false;

  try {
    fs.writeFileSync(result.filePath, text, "utf-8");
    return true;
  } catch (err) {
    console.error("Export error:", err);
    return false;
  }
});

// --- App Lifecycle ---
app.on("ready", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
