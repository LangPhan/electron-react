import { useState, useCallback, useEffect, DragEvent } from "react";
import Toolbar from "@/components/Toolbar";
import Sidebar from "@/components/Sidebar";
import SourceViewer from "@/components/SourceViewer";
import ResultPanel from "@/components/ResultPanel";
import StatusBar from "@/components/StatusBar";
import { FileInfo, OCRResult } from "@/types";
import * as ocrEngine from "@/lib/ocrEngine";
import * as pdfUtils from "@/lib/pdfUtils";
import * as aiCorrector from "@/lib/aiCorrector";
import type { AIProvider } from "@/lib/aiCorrector";

function App() {
  // File state
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // OCR state
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ page: number; total: number; step?: string } | null>(null);

  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sidebarTab, setSidebarTab] = useState<"recent" | "favorites" | "folder">("recent");
  const [engineStatus, setEngineStatus] = useState<"initializing" | "ready" | "error">("initializing");
  const [isDragOver, setIsDragOver] = useState(false);

  // AI state
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => {
    return (localStorage.getItem("ai_provider") as AIProvider) || "gemini";
  });
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() => {
    return localStorage.getItem("openai_api_key") || "";
  });
  const [qwenApiKey, setQwenApiKey] = useState<string>(() => {
    return localStorage.getItem("qwen_api_key") || "";
  });
  const [useAI, setUseAI] = useState<boolean>(() => {
    return localStorage.getItem("use_ai") === "true";
  });

  // Cache PDF buffer
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);

  // Initialize AI corrector
  useEffect(() => {
    aiCorrector.configure({
      provider: aiProvider,
      geminiApiKey,
      openaiApiKey,
      qwenApiKey,
    });
  }, [aiProvider, geminiApiKey, openaiApiKey, qwenApiKey]);

  // Initialize OCR engine
  useEffect(() => {
    const unsub = ocrEngine.onStatusChange((status) => {
      if (status === "ready") setEngineStatus("ready");
      else if (status === "error") setEngineStatus("error");
      else if (status === "initializing") setEngineStatus("initializing");
    });

    ocrEngine.initialize().catch((err) => {
      console.error("OCR engine init failed:", err);
    });

    return () => { unsub(); };
  }, []);

  // Cleanup OCR engine on unmount
  useEffect(() => {
    return () => { ocrEngine.dispose(); };
  }, []);

  // Load file data when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setFileData(null);
      setPdfBuffer(null);
      return;
    }

    const loadFile = async () => {
      setFileLoading(true);
      try {
        if (selectedFile.type === "pdf") {
          const buffer = await window.electronAPI.readFileBuffer(selectedFile.path);
          if (!buffer) throw new Error("Failed to read PDF file");
          setPdfBuffer(buffer);
          const count = await pdfUtils.getPdfPageCount(buffer);
          setTotalPages(count);
          const pageDataUrl = await pdfUtils.renderPdfPageToDataUrl(buffer, 0);
          setFileData(pageDataUrl);
        } else {
          const data = await window.electronAPI.getFileData(selectedFile.path);
          setFileData(data);
          setTotalPages(1);
          setPdfBuffer(null);
        }
      } catch (err) {
        console.error("Failed to load file:", err);
        setFileData(null);
      }
      setFileLoading(false);
    };

    loadFile();
    setCurrentPage(1);
    setOcrResult(null);
  }, [selectedFile?.path]);

  // Load PDF page when current page changes
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== "pdf" || !pdfBuffer) return;
    const loadPage = async () => {
      setFileLoading(true);
      try {
        const pageDataUrl = await pdfUtils.renderPdfPageToDataUrl(pdfBuffer, currentPage - 1);
        setFileData(pageDataUrl);
      } catch (err) {
        console.error("Failed to load PDF page:", err);
      }
      setFileLoading(false);
    };
    loadPage();
  }, [currentPage, selectedFile?.path, selectedFile?.type, pdfBuffer]);

  // File helpers
  const addFile = useCallback((file: FileInfo) => {
    setFiles((prev) => {
      const exists = prev.find((f) => f.path === file.path);
      if (exists) return prev;
      return [file, ...prev];
    });
    setSelectedFile(file);
    setOcrResult(null);
  }, []);

  const handleNewParsing = useCallback(async () => {
    try {
      const file = await window.electronAPI.openFile();
      if (file) addFile(file);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [addFile]);

  // Drag & Drop
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer?.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    for (let i = 0; i < droppedFiles.length; i++) {
      const filePath = (droppedFiles[i] as unknown as { path: string }).path;
      if (filePath) {
        try {
          const fileInfo = await window.electronAPI.getFileInfo(filePath);
          if (fileInfo) addFile(fileInfo);
        } catch (err) {
          console.error("Failed to process dropped file:", err);
        }
      }
    }
  }, [addFile]);

  // AI settings handlers
  const handleSetAIProvider = useCallback((provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem("ai_provider", provider);
  }, []);

  const handleSetGeminiKey = useCallback((key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  }, []);

  const handleSetOpenaiKey = useCallback((key: string) => {
    setOpenaiApiKey(key);
    localStorage.setItem("openai_api_key", key);
  }, []);

  const handleSetQwenKey = useCallback((key: string) => {
    setQwenApiKey(key);
    localStorage.setItem("qwen_api_key", key);
  }, []);

  const handleToggleAI = useCallback((enabled: boolean) => {
    setUseAI(enabled);
    localStorage.setItem("use_ai", String(enabled));
  }, []);

  // OCR processing — Tesseract.js + optional AI correction
  const handleStartOCR = useCallback(async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);
    setOcrProgress(null);
    setOcrResult(null);

    const shouldUseAI = useAI && aiCorrector.isConfigured();

    try {
      if (selectedFile.type === "pdf") {
        const buffer = pdfBuffer || await window.electronAPI.readFileBuffer(selectedFile.path);
        if (!buffer) throw new Error("Failed to read PDF file");

        const pageCount = await pdfUtils.getPdfPageCount(buffer);
        const pages = [];

        for (let i = 0; i < pageCount; i++) {
          setOcrProgress({ page: i + 1, total: pageCount, step: "OCR" });
          const pageBlob = await pdfUtils.renderPdfPageToBlob(buffer, i);
          const result = await ocrEngine.processImage(pageBlob);

          if (shouldUseAI && result.text.trim()) {
            setOcrProgress({ page: i + 1, total: pageCount, step: "AI Correction" });
            try {
              result.text = await aiCorrector.correctText(pageBlob, result.text);
            } catch (err) {
              console.warn(`[AI] Correction failed for page ${i + 1}:`, err);
            }
          }

          pages.push({ page: i + 1, ...result });
        }

        setOcrResult({ total_pages: pageCount, pages });
      } else {
        setOcrProgress({ page: 1, total: 1, step: "OCR" });
        const buffer = await window.electronAPI.readFileBuffer(selectedFile.path);
        if (!buffer) throw new Error("Failed to read file");

        const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "png";
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          bmp: "image/bmp", webp: "image/webp", tiff: "image/tiff", tif: "image/tiff",
        };
        const blob = new Blob([buffer], { type: mimeMap[ext] || "image/png" });
        const result = await ocrEngine.processImage(blob);

        if (shouldUseAI && result.text.trim()) {
          setOcrProgress({ page: 1, total: 1, step: "AI Correction" });
          try {
            result.text = await aiCorrector.correctText(blob, result.text);
          } catch (err) {
            console.warn("[AI] Correction failed:", err);
          }
        }

        setOcrResult({ total_pages: 1, pages: [{ page: 1, ...result }] });
      }
    } catch (err) {
      console.error("OCR failed:", err);
      setOcrResult(null);
    }

    setIsProcessing(false);
    setOcrProgress(null);
  }, [selectedFile, isProcessing, pdfBuffer, useAI]);

  // Export
  const handleExportText = useCallback(async () => {
    if (!ocrResult) return;
    const allText = ocrResult.pages.length === 1
      ? ocrResult.pages[0].text
      : ocrResult.pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join("\n\n");
    const baseName = selectedFile?.name?.replace(/\.[^.]+$/, "") || "ocr_result";
    await window.electronAPI.exportText(allText, `${baseName}.txt`);
  }, [ocrResult, selectedFile]);

  const handleSelectFile = useCallback((file: FileInfo) => { setSelectedFile(file); }, []);

  const handleRemoveFile = useCallback((file: FileInfo) => {
    setFiles((prev) => prev.filter((f) => f.path !== file.path));
    if (selectedFile?.path === file.path) { setSelectedFile(null); setOcrResult(null); }
  }, [selectedFile]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [totalPages]);

  return (
    <div
      className={`app-container ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>Drop files here to parse</p>
            <p className="text-hint">Supports PNG, JPG, BMP, TIFF, WebP, PDF</p>
          </div>
        </div>
      )}

      <Toolbar
        onNewParsing={handleNewParsing}
        onStartOCR={handleStartOCR}
        onExportText={handleExportText}
        isProcessing={isProcessing}
        hasFile={!!selectedFile}
        hasResult={!!ocrResult}
        aiProvider={aiProvider}
        geminiApiKey={geminiApiKey}
        openaiApiKey={openaiApiKey}
        qwenApiKey={qwenApiKey}
        useAI={useAI}
        onSetAIProvider={handleSetAIProvider}
        onSetGeminiKey={handleSetGeminiKey}
        onSetOpenaiKey={handleSetOpenaiKey}
        onSetQwenKey={handleSetQwenKey}
        onToggleAI={handleToggleAI}
      />

      <div className="app-body">
        <Sidebar
          files={files}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onRemoveFile={handleRemoveFile}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        />
        <div className="main-panels">
          <SourceViewer
            file={selectedFile}
            fileData={fileData}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isLoading={fileLoading}
          />
          <div className="panel-divider" />
          <ResultPanel
            result={ocrResult}
            isProcessing={isProcessing}
            currentPage={currentPage}
            progress={ocrProgress}
          />
        </div>
      </div>

      <StatusBar
        engineStatus={engineStatus}
        fileName={selectedFile?.name}
        fileSize={selectedFile?.size}
        pageInfo={
          selectedFile?.type === "pdf" && totalPages > 1
            ? `Page ${currentPage} / ${totalPages}`
            : undefined
        }
      />
    </div>
  );
}

export default App;
