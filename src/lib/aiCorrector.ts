/**
 * AI text correction module.
 * Uses Groq vision models to verify raw OCR text against the original image.
 */

export type GroqModel =
  | "meta-llama/llama-4-scout-17b-16e-instruct"
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant";

export interface GroqModelOption {
  id: GroqModel;
  label: string;
  description: string;
  supportsVision: boolean;
}

export interface AIConfig {
  groqApiKey: string;
  groqModel: GroqModel;
}

export const GROQ_MODEL_OPTIONS: GroqModelOption[] = [
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout",
    description: "OCR bằng ảnh",
    supportsVision: true,
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "Sửa văn bản",
    supportsVision: false,
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    description: "Sửa nhanh",
    supportsVision: false,
  },
];

export const DEFAULT_GROQ_MODEL: GroqModel =
  "meta-llama/llama-4-scout-17b-16e-instruct";

const currentConfig: AIConfig = {
  groqApiKey: "",
  groqModel: DEFAULT_GROQ_MODEL,
};

const MAX_RETRIES = 1;
const BASE_DELAY_MS = 5000;

export function isGroqModel(value: string): value is GroqModel {
  return GROQ_MODEL_OPTIONS.some((model) => model.id === value);
}

export function configure(config: Partial<AIConfig>) {
  if (config.groqApiKey !== undefined) {
    currentConfig.groqApiKey = config.groqApiKey;
  }

  if (config.groqModel !== undefined) {
    currentConfig.groqModel = config.groqModel;
  }

  console.log(
    `[AI Corrector] Configured: provider=groq, model=${currentConfig.groqModel}`,
  );
}

export function getConfig(): AIConfig {
  return { ...currentConfig };
}

export function isConfigured(): boolean {
  return !!currentConfig.groqApiKey && !!currentConfig.groqModel;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelay(error: unknown): number | null {
  const msg = String(error);
  const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  return null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function correctWithGroq(
  imageBlob: Blob,
  rawOcrText: string,
): Promise<string> {
  const base64 = await blobToBase64(imageBlob);
  const mimeType = imageBlob.type || "image/png";
  const imageDataUrl = `data:${mimeType};base64,${base64}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const corrected = await window.electronAPI.correctWithGroq(
        currentConfig.groqApiKey,
        currentConfig.groqModel,
        imageDataUrl,
        rawOcrText,
      );
      console.log(
        `[Groq] OK (model=${currentConfig.groqModel}, attempt=${attempt + 1})`,
      );
      return (corrected || rawOcrText).trim();
    } catch (err: unknown) {
      const is429 =
        String(err).includes("429") ||
        String(err).includes("rate");
      if (is429 && attempt < MAX_RETRIES) {
        const delay =
          parseRetryDelay(err) ||
          BASE_DELAY_MS * (attempt + 1);
        console.warn(
          `[Groq] Rate limited, retry in ${Math.round(delay / 1000)}s...`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  return rawOcrText;
}

/**
 * Correct OCR text with Groq.
 * Sends original image + raw OCR text for verification and correction.
 */
export async function correctText(
  imageBlob: Blob,
  rawOcrText: string,
): Promise<string> {
  if (!currentConfig.groqApiKey) {
    throw new Error("Groq API key not configured.");
  }

  return correctWithGroq(imageBlob, rawOcrText);
}
