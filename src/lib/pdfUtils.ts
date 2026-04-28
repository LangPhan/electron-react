/**
 * PDF rendering utilities using pdf.js in the browser context.
 * Handles page counting, page rendering to canvas/blob.
 */

import * as pdfjsLib from "pdfjs-dist";

// Disable the pdf.js worker (run everything on the main thread for simplicity in Electron)
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

/**
 * Get the total number of pages in a PDF.
 */
export async function getPdfPageCount(pdfData: ArrayBuffer): Promise<number> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise;
  const count = doc.numPages;
  doc.destroy();
  return count;
}

/**
 * Render a specific PDF page to a base64 data URL (PNG).
 * @param pdfData - Raw PDF file bytes
 * @param pageIndex - 0-indexed page number
 * @param scale - Render scale (default 2.0 for good quality)
 */
export async function renderPdfPageToDataUrl(
  pdfData: ArrayBuffer,
  pageIndex: number,
  scale = 2.0,
): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise;
  const page = await doc.getPage(pageIndex + 1); // pdf.js is 1-indexed
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvas,
    canvasContext: canvas.getContext("2d")!,
    viewport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise;

  const dataUrl = canvas.toDataURL("image/png");
  doc.destroy();
  return dataUrl;
}

/**
 * Render a specific PDF page to a Blob (for OCR processing).
 * @param pdfData - Raw PDF file bytes
 * @param pageIndex - 0-indexed page number
 * @param scale - Render scale (default 2.0 for good OCR quality)
 */
export async function renderPdfPageToBlob(
  pdfData: ArrayBuffer,
  pageIndex: number,
  scale = 2.0,
): Promise<Blob> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvas,
    canvasContext: canvas.getContext("2d")!,
    viewport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise;

  doc.destroy();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to convert canvas to blob"));
    }, "image/png");
  });
}
