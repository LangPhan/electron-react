// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("open-file-dialog"),

  loadStoredSession: () =>
    ipcRenderer.invoke("load-stored-session"),

  saveStoredSession: (session: unknown) =>
    ipcRenderer.invoke("save-stored-session", session),

  getFileData: (filePath: string) =>
    ipcRenderer.invoke("get-file-data", filePath),

  readFileBuffer: (filePath: string) =>
    ipcRenderer.invoke("read-file-buffer", filePath),

  getFileInfo: (filePath: string) =>
    ipcRenderer.invoke("get-file-info", filePath),

  exportText: (text: string, defaultName: string) =>
    ipcRenderer.invoke("export-text", text, defaultName),

  correctWithGroq: (
    apiKey: string,
    model: string,
    imageDataUrl: string,
    rawOcrText: string,
  ) =>
    ipcRenderer.invoke("groq-correct-text", {
      apiKey,
      model,
      imageDataUrl,
      rawOcrText,
    }),
});
