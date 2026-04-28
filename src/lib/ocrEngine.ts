/**
 * Tesseract.js OCR Engine wrapper.
 * Runs OCR entirely in the renderer process using Tesseract WASM.
 * Supports Vietnamese text recognition.
 */

import Tesseract from "tesseract.js";

export interface OcrEngineResult {
  text: string;
  blocks: Array<{
    box: number[][];
    text: string;
    confidence: number;
  }>;
  block_count: number;
}

type OcrEngineStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "error";

let worker: Tesseract.Worker | null =
  null;
let engineStatus: OcrEngineStatus =
  "idle";
let initPromise: Promise<void> | null =
  null;
let statusListeners: Array<
  (status: OcrEngineStatus) => void
> = [];

function setStatus(
  status: OcrEngineStatus,
) {
  engineStatus = status;
  statusListeners.forEach((cb) =>
    cb(status),
  );
}

/**
 * Subscribe to engine status changes.
 */
export function onStatusChange(
  cb: (status: OcrEngineStatus) => void,
): () => void {
  statusListeners.push(cb);
  return () => {
    statusListeners =
      statusListeners.filter(
        (l) => l !== cb,
      );
  };
}

/**
 * Get current engine status.
 */
export function getStatus(): OcrEngineStatus {
  return engineStatus;
}

/**
 * Initialize the OCR engine. Safe to call multiple times — deduplicates.
 */
export async function initialize(): Promise<void> {
  if (
    engineStatus === "ready" &&
    worker
  )
    return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    setStatus("initializing");
    try {
      // Create a Tesseract worker with Vietnamese language support
      worker =
        await Tesseract.createWorker(
          "vie",
          Tesseract.OEM.LSTM_ONLY,
          {
            logger: (m) => {
              if (
                m.status ===
                "recognizing text"
              ) {
                console.log(
                  `[OCR Engine] Progress: ${Math.round(m.progress * 100)}%`,
                );
              }
            },
          },
        );
      setStatus("ready");
      console.log(
        "[OCR Engine] Initialized successfully (tesseract.js, lang=vie)",
      );
    } catch (err) {
      console.error(
        "[OCR Engine] Initialization failed:",
        err,
      );
      setStatus("error");
      worker = null;
      throw err;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Run OCR on a Blob (image file).
 */
export async function processImage(
  imageBlob: Blob,
): Promise<OcrEngineResult> {
  if (!worker) {
    await initialize();
  }

  if (!worker) {
    throw new Error(
      "OCR engine not initialized",
    );
  }

  const result =
    await worker.recognize(imageBlob);

  // Map Tesseract.js results to our format
  const blocks: OcrEngineResult["blocks"] =
    [];
  const textLines: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;

  if (
    data.words &&
    Array.isArray(data.words)
  ) {
    for (const word of data.words) {
      const { x0, y0, x1, y1 } =
        word.bbox;
      const box = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];

      blocks.push({
        box,
        text: word.text,
        confidence:
          word.confidence / 100, // Normalize to 0-1
      });
    }
  }

  // Use line-level text for better readability
  if (
    data.lines &&
    Array.isArray(data.lines)
  ) {
    for (const line of data.lines) {
      textLines.push(line.text.trim());
    }
  } else {
    textLines.push(data.text || "");
  }

  return {
    text: textLines.join("\n"),
    blocks,
    block_count: blocks.length,
  };
}

/**
 * Dispose the OCR engine and free resources.
 */
export async function dispose(): Promise<void> {
  if (worker) {
    try {
      await worker.terminate();
    } catch (err) {
      console.warn(
        "[OCR Engine] Dispose error:",
        err,
      );
    }
    worker = null;
  }
  setStatus("idle");
}
