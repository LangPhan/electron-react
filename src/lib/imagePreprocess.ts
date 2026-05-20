/**
 * Image preprocessing for improving Tesseract OCR quality.
 * Uses Canvas API to apply filters before OCR inference.
 *
 * Techniques applied:
 * 1. Grayscale conversion — removes color noise
 * 2. Contrast enhancement — makes text stand out
 * 3. Adaptive thresholding (binarization) — sharp black text on white background
 * 4. Noise reduction — removes small artifacts
 */

/**
 * Load a Blob image into an HTMLImageElement.
 */
function loadImage(
  blob: Blob,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(
          new Error(
            "Failed to load image for preprocessing",
          ),
        );
      };
      img.src =
        URL.createObjectURL(blob);
    },
  );
}

/**
 * Convert image data to grayscale using luminance formula.
 * ITU-R BT.601: L = 0.299*R + 0.587*G + 0.114*B
 */
function toGrayscale(
  data: Uint8ClampedArray,
): void {
  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const gray =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

/**
 * Enhance contrast using histogram stretching.
 * Maps the pixel range [min, max] → [0, 255] for better separation.
 */
function enhanceContrast(
  data: Uint8ClampedArray,
  factor = 1.5,
): void {
  // Find min and max luminance
  let min = 255;
  let max = 0;
  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const v = data[i]; // Already grayscale
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  if (range === 0) return;

  // Apply contrast stretching with factor
  const mid = 128;
  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    // Normalize to [0, 1], then apply contrast factor around midpoint
    const normalized =
      (data[i] - min) / range;
    const contrasted =
      mid +
      (normalized - 0.5) * 255 * factor;
    const clamped = Math.max(
      0,
      Math.min(255, contrasted),
    );
    data[i] = clamped;
    data[i + 1] = clamped;
    data[i + 2] = clamped;
  }
}

/**
 * Apply adaptive thresholding (binarization).
 * Uses a local window to compute threshold per region,
 * making it work well with uneven lighting.
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize = 15,
  C = 10,
): void {
  // Create integral image for fast local mean computation
  const integral = new Float64Array(
    width * height,
  );

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      rowSum += data[idx * 4];
      integral[idx] =
        rowSum +
        (y > 0
          ? integral[
              (y - 1) * width + x
            ]
          : 0);
    }
  }

  const half = Math.floor(
    blockSize / 2,
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Compute local mean using integral image
      const y1 = Math.max(
        0,
        y - half - 1,
      );
      const y2 = Math.min(
        height - 1,
        y + half,
      );
      const x1 = Math.max(
        0,
        x - half - 1,
      );
      const x2 = Math.min(
        width - 1,
        x + half,
      );

      const area =
        (y2 - y1) * (x2 - x1);
      let sum =
        integral[y2 * width + x2];
      if (x1 > 0)
        sum -=
          integral[
            y2 * width + (x1 - 1)
          ];
      if (y1 > 0)
        sum -=
          integral[
            (y1 - 1) * width + x2
          ];
      if (x1 > 0 && y1 > 0)
        sum +=
          integral[
            (y1 - 1) * width + (x1 - 1)
          ];

      const mean = sum / area;
      const pixIdx =
        (y * width + x) * 4;
      const value =
        data[pixIdx] > mean - C
          ? 255
          : 0;

      data[pixIdx] = value;
      data[pixIdx + 1] = value;
      data[pixIdx + 2] = value;
    }
  }
}

/**
 * Simple 3x3 median filter for noise reduction.
 * Removes salt-and-pepper noise while preserving edges.
 */
function medianFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(
    data,
  );
  const neighbors: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (
      let x = 1;
      x < width - 1;
      x++
    ) {
      neighbors.length = 0;

      // Collect 3x3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (
          let dx = -1;
          dx <= 1;
          dx++
        ) {
          neighbors.push(
            data[
              ((y + dy) * width +
                (x + dx)) *
                4
            ],
          );
        }
      }

      // Sort and take median
      neighbors.sort((a, b) => a - b);
      const median = neighbors[4]; // Middle of 9

      const idx = (y * width + x) * 4;
      output[idx] = median;
      output[idx + 1] = median;
      output[idx + 2] = median;
    }
  }

  return output;
}

/**
 * Scale up image if too small (improves OCR for low-res images).
 * Tesseract works best with images at ~300 DPI or higher.
 */
function shouldUpscale(
  width: number,
  height: number,
): number {
  const minDimension = Math.min(
    width,
    height,
  );
  if (minDimension < 500) return 3;
  if (minDimension < 1000) return 2;
  return 1;
}

export interface PreprocessOptions {
  /** Enable grayscale conversion (default: true) */
  grayscale?: boolean;
  /** Enable contrast enhancement (default: true) */
  contrast?: boolean;
  /** Contrast factor 1.0-3.0 (default: 1.5) */
  contrastFactor?: number;
  /** Enable adaptive thresholding/binarization (default: true) */
  binarize?: boolean;
  /** Enable noise reduction (default: true) */
  denoise?: boolean;
  /** Enable upscaling for small images (default: true) */
  upscale?: boolean;
}

const DEFAULT_OPTIONS: Required<PreprocessOptions> =
  {
    grayscale: true,
    contrast: true,
    contrastFactor: 1.5,
    binarize: true,
    denoise: true,
    upscale: true,
  };

/**
 * Preprocess an image blob to improve OCR quality.
 * Returns a new Blob with the preprocessed image.
 */
export async function preprocessImage(
  imageBlob: Blob,
  options?: PreprocessOptions,
): Promise<Blob> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const img =
    await loadImage(imageBlob);

  // Determine scaling
  const scale = opts.upscale
    ? shouldUpscale(
        img.width,
        img.height,
      )
    : 1;
  const width = img.width * scale;
  const height = img.height * scale;

  // Create canvas
  const canvas =
    document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!ctx) {
    throw new Error(
      "Failed to prepare preprocessing canvas",
    );
  }

  // Use better interpolation for upscaling
  if (scale > 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  // Draw image
  ctx.drawImage(
    img,
    0,
    0,
    width,
    height,
  );
  const imageData = ctx.getImageData(
    0,
    0,
    width,
    height,
  );

  // Step 1: Grayscale
  if (opts.grayscale) {
    toGrayscale(imageData.data);
    console.log(
      "[Preprocess] Grayscale applied",
    );
  }

  // Step 2: Contrast enhancement
  if (opts.contrast) {
    enhanceContrast(
      imageData.data,
      opts.contrastFactor,
    );
    console.log(
      "[Preprocess] Contrast enhanced",
    );
  }

  // Step 3: Noise reduction (before binarization for better results)
  if (opts.denoise) {
    const filteredData = medianFilter(
      imageData.data,
      width,
      height,
    );
    // Copy filtered data back into imageData
    imageData.data.set(filteredData);
    console.log(
      "[Preprocess] Noise reduction applied",
    );
  }

  // Step 4: Adaptive thresholding
  if (opts.binarize) {
    adaptiveThreshold(
      imageData.data,
      width,
      height,
    );
    console.log(
      "[Preprocess] Binarization applied",
    );
  }

  // Write back to canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert to Blob
  return new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(
              `[Preprocess] Done: ${img.width}x${img.height} → ${width}x${height} (scale=${scale})`,
            );
            resolve(blob);
          } else {
            reject(
              new Error(
                "Failed to create preprocessed image blob",
              ),
            );
          }
        },
        "image/png",
        1.0,
      );
    },
  );
}
