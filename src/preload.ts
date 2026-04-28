// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("open-file-dialog"),

  getFileData: (filePath: string) =>
    ipcRenderer.invoke("get-file-data", filePath),

  readFileBuffer: (filePath: string) =>
    ipcRenderer.invoke("read-file-buffer", filePath),

  getFileInfo: (filePath: string) =>
    ipcRenderer.invoke("get-file-info", filePath),

  exportText: (text: string, defaultName: string) =>
    ipcRenderer.invoke("export-text", text, defaultName),
});
