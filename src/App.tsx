import ResultPanel from "@/components/ResultPanel";
import Sidebar from "@/components/Sidebar";
import SourceViewer from "@/components/SourceViewer";
import StatusBar from "@/components/StatusBar";
import Toolbar from "@/components/Toolbar";
import * as aiCorrector from "@/lib/aiCorrector";
import {
  DEFAULT_GROQ_MODEL,
  isGroqModel,
  type GroqModel,
} from "@/lib/aiCorrector";
import * as ocrEngine from "@/lib/ocrEngine";
import * as pdfUtils from "@/lib/pdfUtils";
import {
  applyImageEdits,
  DEFAULT_IMAGE_EDITS,
  type ImageEditOptions,
} from "@/lib/imageEdit";
import {
  FileInfo,
  OCRResult,
} from "@/types";
import {
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function App() {
  // File state
  const [files, setFiles] = useState<
    FileInfo[]
  >([]);
  const [
    selectedFile,
    setSelectedFile,
  ] = useState<FileInfo | null>(null);
  const [fileData, setFileData] =
    useState<string | null>(null);
  const [fileLoading, setFileLoading] =
    useState(false);
  const [
    imageEditsByPath,
    setImageEditsByPath,
  ] = useState<
    Record<string, ImageEditOptions>
  >({});

  // OCR state
  const [ocrResult, setOcrResult] =
    useState<OCRResult | null>(null);
  const [
    ocrResultsByPath,
    setOcrResultsByPath,
  ] = useState<
    Record<string, OCRResult>
  >({});
  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);
  const [ocrProgress, setOcrProgress] =
    useState<{
      page: number;
      total: number;
      step?: string;
    } | null>(null);
  const selectedFilePathRef = useRef<
    string | null
  >(null);
  const [
    hasRestoredSession,
    setHasRestoredSession,
  ] = useState(false);

  // UI state
  const [currentPage, setCurrentPage] =
    useState(1);
  const [totalPages, setTotalPages] =
    useState(1);
  const [sidebarTab, setSidebarTab] =
    useState<
      "recent" | "favorites" | "folder"
    >("recent");
  const [
    engineStatus,
    setEngineStatus,
  ] = useState<
    "initializing" | "ready" | "error"
  >("initializing");
  const [isDragOver, setIsDragOver] =
    useState(false);

  // AI state
  const [groqApiKey, setGroqApiKey] =
    useState<string>(() => {
      return (
        localStorage.getItem(
          "groq_api_key",
        ) || ""
      );
    });
  const [groqModel, setGroqModel] =
    useState<GroqModel>(() => {
      const savedModel =
        localStorage.getItem(
          "groq_model",
        ) || "";
      return isGroqModel(savedModel)
        ? savedModel
        : DEFAULT_GROQ_MODEL;
    });
  const [useAI, setUseAI] =
    useState<boolean>(() => {
      return (
        localStorage.getItem(
          "use_ai",
        ) === "true"
      );
    });

  // Cache PDF buffer
  const [pdfBuffer, setPdfBuffer] =
    useState<ArrayBuffer | null>(null);

  useEffect(() => {
    selectedFilePathRef.current =
      selectedFile?.path ?? null;
  }, [selectedFile?.path]);

  useEffect(() => {
    let isMounted = true;

    window.electronAPI
      .loadStoredSession()
      .then((session) => {
        if (!isMounted) return;

        const selected =
          session.files.find(
            (file) =>
              file.path ===
              session.selectedFilePath,
          ) ??
          session.files[0] ??
          null;

        setFiles(session.files);
        setOcrResultsByPath(
          session.ocrResultsByPath,
        );
        setSelectedFile(selected);
        setOcrResult(
          selected
            ? (session.ocrResultsByPath[
                selected.path
              ] ?? null)
            : null,
        );
      })
      .catch((err) => {
        console.error(
          "Failed to restore OCR session:",
          err,
        );
      })
      .finally(() => {
        if (isMounted)
          setHasRestoredSession(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasRestoredSession) return;

    const saveTimer = window.setTimeout(
      () => {
        window.electronAPI
          .saveStoredSession({
            files,
            selectedFilePath:
              selectedFile?.path ??
              null,
            ocrResultsByPath,
          })
          .catch((err) => {
            console.error(
              "Failed to save OCR session:",
              err,
            );
          });
      },
      300,
    );

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [
    files,
    selectedFile?.path,
    ocrResultsByPath,
    hasRestoredSession,
  ]);

  // Initialize AI corrector
  useEffect(() => {
    aiCorrector.configure({
      groqApiKey,
      groqModel,
    });
  }, [groqApiKey, groqModel]);

  // Initialize OCR engine
  useEffect(() => {
    const unsub =
      ocrEngine.onStatusChange(
        (status) => {
          if (status === "ready")
            setEngineStatus("ready");
          else if (status === "error")
            setEngineStatus("error");
          else if (
            status === "initializing"
          )
            setEngineStatus(
              "initializing",
            );
        },
      );

    ocrEngine
      .initialize()
      .catch((err) => {
        console.error(
          "OCR engine init failed:",
          err,
        );
      });

    return () => {
      unsub();
    };
  }, []);

  // Cleanup OCR engine on unmount
  useEffect(() => {
    return () => {
      ocrEngine.dispose();
    };
  }, []);

  // Load file data when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setFileData(null);
      setPdfBuffer(null);
      setOcrResult(null);
      return;
    }

    const loadFile = async () => {
      setFileLoading(true);
      try {
        if (
          selectedFile.type === "pdf"
        ) {
          const buffer =
            await window.electronAPI.readFileBuffer(
              selectedFile.path,
            );
          if (!buffer)
            throw new Error(
              "Failed to read PDF file",
            );
          setPdfBuffer(buffer);
          const count =
            await pdfUtils.getPdfPageCount(
              buffer,
            );
          setTotalPages(count);
          const pageDataUrl =
            await pdfUtils.renderPdfPageToDataUrl(
              buffer,
              0,
            );
          setFileData(pageDataUrl);
        } else {
          const data =
            await window.electronAPI.getFileData(
              selectedFile.path,
            );
          setFileData(data);
          setTotalPages(1);
          setPdfBuffer(null);
        }
      } catch (err) {
        console.error(
          "Failed to load file:",
          err,
        );
        setFileData(null);
      }
      setFileLoading(false);
    };

    loadFile();
    setCurrentPage(1);
  }, [selectedFile?.path]);

  // Load PDF page when current page changes
  useEffect(() => {
    if (
      !selectedFile ||
      selectedFile.type !== "pdf" ||
      !pdfBuffer
    )
      return;
    const loadPage = async () => {
      setFileLoading(true);
      try {
        const pageDataUrl =
          await pdfUtils.renderPdfPageToDataUrl(
            pdfBuffer,
            currentPage - 1,
          );
        setFileData(pageDataUrl);
      } catch (err) {
        console.error(
          "Failed to load PDF page:",
          err,
        );
      }
      setFileLoading(false);
    };
    loadPage();
  }, [
    currentPage,
    selectedFile?.path,
    selectedFile?.type,
    pdfBuffer,
  ]);

  // File helpers
  const addFiles = useCallback(
    (incomingFiles: FileInfo[]) => {
      if (incomingFiles.length === 0)
        return;

      setFiles((prev) => {
        const existingPaths = new Set(
          prev.map((file) => file.path),
        );
        const newFiles =
          incomingFiles.filter(
            (file) =>
              !existingPaths.has(
                file.path,
              ),
          );
        return [...newFiles, ...prev];
      });

      const fileToSelect =
        incomingFiles[0];
      setSelectedFile(fileToSelect);
      setOcrResult(
        ocrResultsByPath[
          fileToSelect.path
        ] ?? null,
      );
    },
    [ocrResultsByPath],
  );

  const handleNewParsing =
    useCallback(async () => {
      try {
        const selectedFiles =
          await window.electronAPI.openFile();
        if (selectedFiles)
          addFiles(selectedFiles);
      } catch (err) {
        console.error(
          "Failed to open file:",
          err,
        );
      }
    }, [addFiles]);

  // Drag & Drop
  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFiles =
        e.dataTransfer?.files;
      if (
        !droppedFiles ||
        droppedFiles.length === 0
      )
        return;

      const fileInfos: FileInfo[] = [];
      for (
        let i = 0;
        i < droppedFiles.length;
        i++
      ) {
        const filePath = (
          droppedFiles[
            i
          ] as unknown as {
            path: string;
          }
        ).path;
        if (filePath) {
          try {
            const fileInfo =
              await window.electronAPI.getFileInfo(
                filePath,
              );
            if (fileInfo)
              fileInfos.push(fileInfo);
          } catch (err) {
            console.error(
              "Failed to process dropped file:",
              err,
            );
          }
        }
      }
      addFiles(fileInfos);
    },
    [addFiles],
  );

  // AI settings handlers
  const handleSetGroqKey = useCallback(
    (key: string) => {
      setGroqApiKey(key);
      localStorage.setItem(
        "groq_api_key",
        key,
      );
    },
    [],
  );

  const handleSetGroqModel =
    useCallback((model: GroqModel) => {
      setGroqModel(model);
      localStorage.setItem(
        "groq_model",
        model,
      );
    }, []);

  const handleToggleAI = useCallback(
    (enabled: boolean) => {
      setUseAI(enabled);
      localStorage.setItem(
        "use_ai",
        String(enabled),
      );
    },
    [],
  );

  // OCR processing — Tesseract.js + optional AI correction
  const handleStartOCR =
    useCallback(async () => {
      if (!selectedFile || isProcessing)
        return;

      const processingFile =
        selectedFile;

      const commitOcrResult = (
        filePath: string,
        result: OCRResult,
      ) => {
        setOcrResultsByPath((prev) => ({
          ...prev,
          [filePath]: result,
        }));

        if (
          selectedFilePathRef.current ===
          filePath
        ) {
          setOcrResult(result);
        }
      };

      setIsProcessing(true);
      setOcrProgress(null);
      setOcrResult(null);

      const shouldUseAI =
        useAI &&
        aiCorrector.isConfigured();

      try {
        if (
          processingFile.type === "pdf"
        ) {
          const buffer =
            pdfBuffer ||
            (await window.electronAPI.readFileBuffer(
              processingFile.path,
            ));
          if (!buffer)
            throw new Error(
              "Failed to read PDF file",
            );

          const pageCount =
            await pdfUtils.getPdfPageCount(
              buffer,
            );
          const pages = [];

          for (
            let i = 0;
            i < pageCount;
            i++
          ) {
            setOcrProgress({
              page: i + 1,
              total: pageCount,
              step: "OCR",
            });
            const pageBlob =
              await pdfUtils.renderPdfPageToBlob(
                buffer,
                i,
              );
            const editedPageBlob =
              await applyImageEdits(
                pageBlob,
                imageEditsByPath[
                  processingFile.path
                ] ?? DEFAULT_IMAGE_EDITS,
              );
            const result =
              await ocrEngine.processImage(
                editedPageBlob,
              );

            if (
              shouldUseAI &&
              result.text.trim()
            ) {
              setOcrProgress({
                page: i + 1,
                total: pageCount,
                step: "Sửa bằng AI",
              });
              try {
                result.text =
                  await aiCorrector.correctText(
                    editedPageBlob,
                    result.text,
                  );
              } catch (err) {
                console.warn(
                  `[AI] Correction failed for page ${i + 1}:`,
                  err,
                );
              }
            }

            pages.push({
              page: i + 1,
              ...result,
            });
          }

          commitOcrResult(
            processingFile.path,
            {
              total_pages: pageCount,
              pages,
            },
          );
        } else {
          setOcrProgress({
            page: 1,
            total: 1,
            step: "OCR",
          });
          const buffer =
            await window.electronAPI.readFileBuffer(
              processingFile.path,
            );
          if (!buffer)
            throw new Error(
              "Failed to read file",
            );

          const ext =
            processingFile.name
              .split(".")
              .pop()
              ?.toLowerCase() || "png";
          const mimeMap: Record<
            string,
            string
          > = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            bmp: "image/bmp",
            webp: "image/webp",
            tiff: "image/tiff",
            tif: "image/tiff",
          };
          const blob = new Blob(
            [buffer],
            {
              type:
                mimeMap[ext] ||
                "image/png",
            },
          );
          const editedBlob =
            await applyImageEdits(
              blob,
              imageEditsByPath[
                processingFile.path
              ] ?? DEFAULT_IMAGE_EDITS,
            );
          const result =
            await ocrEngine.processImage(
              editedBlob,
            );

          if (
            shouldUseAI &&
            result.text.trim()
          ) {
            setOcrProgress({
              page: 1,
              total: 1,
              step: "Sửa bằng AI",
            });
            try {
              result.text =
                await aiCorrector.correctText(
                  editedBlob,
                  result.text,
                );
            } catch (err) {
              console.warn(
                "[AI] Correction failed:",
                err,
              );
            }
          }

          commitOcrResult(
            processingFile.path,
            {
              total_pages: 1,
              pages: [
                { page: 1, ...result },
              ],
            },
          );
        }
      } catch (err) {
        console.error(
          "OCR failed:",
          err,
        );
        if (
          selectedFilePathRef.current ===
          processingFile.path
        ) {
          setOcrResult(
            ocrResultsByPath[
              processingFile.path
            ] ?? null,
          );
        }
      }

      setIsProcessing(false);
      setOcrProgress(null);
    }, [
      selectedFile,
      isProcessing,
      pdfBuffer,
      useAI,
      ocrResultsByPath,
      imageEditsByPath,
    ]);

  // Export
  const handleExportText =
    useCallback(async () => {
      if (!ocrResult) return;
      const allText =
        ocrResult.pages.length === 1
          ? ocrResult.pages[0].text
          : ocrResult.pages
              .map(
                (p) =>
                  `--- Trang ${p.page} ---\n${p.text}`,
              )
              .join("\n\n");
      const baseName =
        selectedFile?.name?.replace(
          /\.[^.]+$/,
          "",
        ) || "ket_qua_ocr";
      await window.electronAPI.exportText(
        allText,
        `${baseName}.txt`,
      );
    }, [ocrResult, selectedFile]);

  const handleSelectFile = useCallback(
    (file: FileInfo) => {
      setSelectedFile(file);
      setOcrResult(
        ocrResultsByPath[file.path] ??
          null,
      );
    },
    [ocrResultsByPath],
  );

  const handleRemoveFile = useCallback(
    (file: FileInfo) => {
      setFiles((prev) =>
        prev.filter(
          (f) => f.path !== file.path,
        ),
      );
      setOcrResultsByPath((prev) => {
        const next = { ...prev };
        delete next[file.path];
        return next;
      });
      if (
        selectedFile?.path === file.path
      ) {
        setSelectedFile(null);
        setOcrResult(null);
      }
    },
    [selectedFile],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (
        page >= 1 &&
        page <= totalPages
      )
        setCurrentPage(page);
    },
    [totalPages],
  );

  const handleImageEditsChange =
    useCallback(
      (edits: ImageEditOptions) => {
        if (!selectedFile) return;

        setImageEditsByPath((prev) => ({
          ...prev,
          [selectedFile.path]: edits,
        }));
        setOcrResultsByPath((prev) => {
          if (!prev[selectedFile.path])
            return prev;
          const next = { ...prev };
          delete next[selectedFile.path];
          return next;
        });
        setOcrResult(null);
      },
      [selectedFile],
    );

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
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="15"
              />
            </svg>
            <p>
              Thả tệp vào đây để trích
              xuất
            </p>
            <p className="text-hint">
              Hỗ trợ PNG, JPG, BMP,
              TIFF, WebP, PDF
            </p>
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
        groqApiKey={groqApiKey}
        groqModel={groqModel}
        useAI={useAI}
        onSetGroqKey={handleSetGroqKey}
        onSetGroqModel={
          handleSetGroqModel
        }
        onToggleAI={handleToggleAI}
      />

      <div className="app-body">
        <Sidebar
          files={files}
          selectedFile={selectedFile}
          onSelectFile={
            handleSelectFile
          }
          onRemoveFile={
            handleRemoveFile
          }
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
        />
        <div className="main-panels">
          <SourceViewer
            file={selectedFile}
            fileData={fileData}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={
              handlePageChange
            }
            isLoading={fileLoading}
            imageEdits={
              selectedFile
                ? (imageEditsByPath[
                    selectedFile.path
                  ] ??
                  DEFAULT_IMAGE_EDITS)
                : DEFAULT_IMAGE_EDITS
            }
            onImageEditsChange={
              handleImageEditsChange
            }
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
          selectedFile?.type ===
            "pdf" && totalPages > 1
            ? `Trang ${currentPage} / ${totalPages}`
            : undefined
        }
      />
    </div>
  );
}

export default App;
