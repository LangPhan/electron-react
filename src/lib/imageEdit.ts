import { preprocessImage } from "@/lib/imagePreprocess";

export type ImageRotation = 0 | 90 | 180 | 270;

export interface ImageCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ImageEditOptions {
  rotation: ImageRotation;
  crop: ImageCrop;
  enhance: boolean;
}

export const DEFAULT_IMAGE_EDITS: ImageEditOptions = {
  rotation: 0,
  enhance: false,
  crop: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

export function hasImageEdits(
  edits: ImageEditOptions,
): boolean {
  return (
    edits.rotation !== 0 ||
    edits.enhance ||
    edits.crop.top > 0 ||
    edits.crop.right > 0 ||
    edits.crop.bottom > 0 ||
    edits.crop.left > 0
  );
}

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
            "Failed to load image for editing",
          ),
        );
      };
      img.src =
        URL.createObjectURL(blob);
    },
  );
}

function normalizeCrop(
  crop: ImageCrop,
): ImageCrop {
  const clamp = (value: number) =>
    Math.max(0, Math.min(95, value));
  const normalized = {
    top: clamp(crop.top),
    right: clamp(crop.right),
    bottom: clamp(crop.bottom),
    left: clamp(crop.left),
  };

  if (
    normalized.left + normalized.right >=
    95
  ) {
    const overflow =
      normalized.left +
      normalized.right -
      95;
    normalized.right = Math.max(
      0,
      normalized.right - overflow,
    );
  }

  if (
    normalized.top + normalized.bottom >=
    95
  ) {
    const overflow =
      normalized.top +
      normalized.bottom -
      95;
    normalized.bottom = Math.max(
      0,
      normalized.bottom - overflow,
    );
  }

  return normalized;
}

export async function applyImageEdits(
  imageBlob: Blob,
  edits: ImageEditOptions,
): Promise<Blob> {
  if (!hasImageEdits(edits)) {
    return imageBlob;
  }

  const img =
    await loadImage(imageBlob);
  const isQuarterTurn =
    edits.rotation === 90 ||
    edits.rotation === 270;
  const rotatedCanvas =
    document.createElement("canvas");
  rotatedCanvas.width = isQuarterTurn
    ? img.height
    : img.width;
  rotatedCanvas.height = isQuarterTurn
    ? img.width
    : img.height;

  const rotatedCtx =
    rotatedCanvas.getContext("2d");
  if (!rotatedCtx) {
    throw new Error(
      "Failed to prepare image editor canvas",
    );
  }

  rotatedCtx.save();
  if (edits.rotation === 90) {
    rotatedCtx.translate(
      rotatedCanvas.width,
      0,
    );
    rotatedCtx.rotate(Math.PI / 2);
  } else if (edits.rotation === 180) {
    rotatedCtx.translate(
      rotatedCanvas.width,
      rotatedCanvas.height,
    );
    rotatedCtx.rotate(Math.PI);
  } else if (edits.rotation === 270) {
    rotatedCtx.translate(
      0,
      rotatedCanvas.height,
    );
    rotatedCtx.rotate(-Math.PI / 2);
  }

  rotatedCtx.drawImage(
    img,
    0,
    0,
    img.width,
    img.height,
  );
  rotatedCtx.restore();

  const crop =
    normalizeCrop(edits.crop);
  const cropX = Math.round(
    (rotatedCanvas.width * crop.left) /
      100,
  );
  const cropY = Math.round(
    (rotatedCanvas.height * crop.top) /
      100,
  );
  const cropWidth = Math.max(
    1,
    Math.round(
      (rotatedCanvas.width *
        (100 -
          crop.left -
          crop.right)) /
        100,
    ),
  );
  const cropHeight = Math.max(
    1,
    Math.round(
      (rotatedCanvas.height *
        (100 -
          crop.top -
          crop.bottom)) /
        100,
    ),
  );

  const canvas =
    document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(
      "Failed to prepare image crop canvas",
    );
  }

  ctx.drawImage(
    rotatedCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            if (edits.enhance) {
              try {
                resolve(
                  await preprocessImage(blob, {
                    contrastFactor: 1.8,
                    upscale: false,
                  }),
                );
              } catch (err) {
                reject(err);
              }
            } else {
              resolve(blob);
            }
          } else {
            reject(
              new Error(
                "Failed to create edited image",
              ),
            );
          }
        },
        "image/png",
        1,
      );
    },
  );
}
