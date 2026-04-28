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

export interface ElectronAPI {
  openFile: () => Promise<FileInfo | null>;
  getFileData: (filePath: string) => Promise<string>;
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer | null>;
  getFileInfo: (filePath: string) => Promise<FileInfo | null>;
  exportText: (text: string, defaultName: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
