export interface OCRBlock {
  box: number[][];
  text: string;
  confidence: number;
}

export interface PageResult {
  page: number;
  text: string;
  blocks: OCRBlock[];
  block_count: number;
}

export interface OCRResult {
  total_pages: number;
  pages: PageResult[];
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'image' | 'pdf';
  size: number;
  addedAt: number;
}

export interface StoredSession {
  files: FileInfo[];
  selectedFilePath: string | null;
  ocrResultsByPath: Record<string, OCRResult>;
  updatedAt?: number;
}

export interface ElectronAPI {
  openFile: () => Promise<FileInfo[] | null>;
  loadStoredSession: () => Promise<StoredSession>;
  saveStoredSession: (session: StoredSession) => Promise<boolean>;
  getFileData: (filePath: string) => Promise<string>;
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer | null>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  exportText: (text: string, defaultName: string) => Promise<boolean>;
  correctWithGroq: (
    apiKey: string,
    model: string,
    imageDataUrl: string,
    rawOcrText: string,
  ) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
