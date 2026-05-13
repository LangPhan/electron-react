import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import fs from "node:fs";
import OpenAI from "openai";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// --- Main Window ---
let mainWindow: BrowserWindow | null = null;

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_VISION_MODELS = new Set([
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);
const GROQ_MODEL_IDS = new Set([
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);

const AI_SYSTEM_PROMPT = `You are an expert OCR text corrector for Vietnamese documents.
Your task is to compare the OCR text against the actual text visible in the image and correct any errors.

Rules:
1. Fix Vietnamese diacritics/accents that were incorrectly recognized.
2. Fix any misrecognized characters, missing words, or garbled text.
3. Preserve the original formatting and structure (paragraphs, line breaks).
4. Do NOT add any commentary, explanation, or markdown formatting.
5. Do NOT translate the text - keep it in its original language.
6. Output ONLY the corrected text, nothing else.`;

const createOCRPrompt = (rawText: string) =>
  `Here is the raw OCR text extracted by Tesseract. Please correct it based on the image:

${rawText}`;

type FileInfoPayload = {
  name: string;
  path: string;
  type: "image" | "pdf";
  size: number;
  addedAt: number;
};

type StoredSessionPayload = {
  files: FileInfoPayload[];
  selectedFilePath: string | null;
  ocrResultsByPath: Record<string, unknown>;
  updatedAt?: number;
};

const VALID_SOURCE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".tiff",
  ".tif",
  ".webp",
  ".pdf",
];

const EMPTY_SESSION: StoredSessionPayload = {
  files: [],
  selectedFilePath: null,
  ocrResultsByPath: {},
};

function getSourceFileInfo(filePath: string, addedAt = Date.now()): FileInfoPayload | null {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";

  if (!VALID_SOURCE_EXTENSIONS.includes(ext)) return null;

  return {
    name: path.basename(filePath),
    path: filePath,
    type: isPdf ? "pdf" : "image",
    size: stat.size,
    addedAt,
  };
}

function getSessionStoragePath(): string {
  return path.join(app.getPath("userData"), "ocr-session.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStoredSession(value: unknown): StoredSessionPayload {
  if (!isRecord(value)) return EMPTY_SESSION;

  const storedFiles = Array.isArray(value.files) ? value.files : [];
  const files = storedFiles
    .map((file) => {
      if (!isRecord(file) || typeof file.path !== "string") return null;
      const addedAt = typeof file.addedAt === "number" ? file.addedAt : Date.now();
      try {
        return getSourceFileInfo(file.path, addedAt);
      } catch {
        return null;
      }
    })
    .filter((file): file is FileInfoPayload => !!file);

  const filePaths = new Set(files.map((file) => file.path));
  const rawResults = isRecord(value.ocrResultsByPath) ? value.ocrResultsByPath : {};
  const ocrResultsByPath = Object.fromEntries(
    Object.entries(rawResults).filter(([filePath]) => filePaths.has(filePath)),
  );

  const rawSelectedFilePath =
    typeof value.selectedFilePath === "string" ? value.selectedFilePath : null;
  const selectedFilePath =
    rawSelectedFilePath && filePaths.has(rawSelectedFilePath)
      ? rawSelectedFilePath
      : files[0]?.path ?? null;

  return {
    files,
    selectedFilePath,
    ocrResultsByPath,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : undefined,
  };
}

function loadStoredSession(): StoredSessionPayload {
  try {
    const storagePath = getSessionStoragePath();
    if (!fs.existsSync(storagePath)) return EMPTY_SESSION;

    const raw = fs.readFileSync(storagePath, "utf-8");
    return normalizeStoredSession(JSON.parse(raw));
  } catch (err) {
    console.error("Failed to load OCR session:", err);
    return EMPTY_SESSION;
  }
}

function saveStoredSession(payload: StoredSessionPayload): boolean {
  try {
    const normalized = normalizeStoredSession({
      ...payload,
      updatedAt: Date.now(),
    });
    const storagePath = getSessionStoragePath();
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(
      storagePath,
      JSON.stringify(
        {
          ...normalized,
          updatedAt: Date.now(),
        },
        null,
        2,
      ),
      "utf-8",
    );
    return true;
  } catch (err) {
    console.error("Failed to save OCR session:", err);
    return false;
  }
}

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

ipcMain.handle("load-stored-session", async () => {
  return loadStoredSession();
});

ipcMain.handle("save-stored-session", async (_event, payload: StoredSessionPayload) => {
  return saveStoredSession(payload);
});

// Open file dialog
ipcMain.handle("open-file-dialog", async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Hình ảnh & PDF",
        extensions: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp", "pdf"],
      },
      { name: "Hình ảnh", extensions: ["png", "jpg", "jpeg", "bmp", "tiff", "tif", "webp"] },
      { name: "PDF", extensions: ["pdf"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths
    .map((filePath) => getSourceFileInfo(filePath))
    .filter((file): file is FileInfoPayload => !!file);
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
    return getSourceFileInfo(filePath);
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
      { name: "Tệp văn bản", extensions: ["txt"] },
      { name: "Tất cả tệp", extensions: ["*"] },
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

// Correct OCR result with Groq from the main process to avoid renderer CORS issues.
ipcMain.handle(
  "groq-correct-text",
  async (
    _event,
    payload: {
      apiKey: string;
      model: string;
      imageDataUrl: string;
      rawOcrText: string;
    },
  ) => {
    const apiKey = payload.apiKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Groq API key not configured.");
    }

    const client = new OpenAI({
      apiKey,
      baseURL: GROQ_BASE_URL,
    });
    const model = GROQ_MODEL_IDS.has(payload.model)
      ? payload.model
      : DEFAULT_GROQ_VISION_MODEL;
    const supportsVision = GROQ_VISION_MODELS.has(model);
    const userContent = supportsVision
      ? [
          {
            type: "image_url" as const,
            image_url: {
              url: payload.imageDataUrl,
            },
          },
          {
            type: "text" as const,
            text: createOCRPrompt(payload.rawOcrText),
          },
        ]
      : createOCRPrompt(payload.rawOcrText);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: AI_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      max_completion_tokens: 4096,
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content?.trim() || payload.rawOcrText;
  },
);

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
