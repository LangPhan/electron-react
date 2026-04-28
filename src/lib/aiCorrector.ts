/**
 * AI Text Correction module.
 * Supports Google Gemini, OpenAI ChatGPT, and Alibaba Qwen for OCR text correction.
 * Sends the original image + raw OCR text to the AI for verification.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// --- Types ---
export type AIProvider =
  | "gemini"
  | "openai"
  | "qwen";

export interface AIConfig {
  provider: AIProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  qwenApiKey: string;
}

// --- State ---
let geminiClient: GoogleGenerativeAI | null =
  null;
let openaiClient: OpenAI | null = null;
let qwenClient: OpenAI | null = null;
let currentConfig: AIConfig = {
  provider: "gemini",
  geminiApiKey: "",
  openaiApiKey: "",
  qwenApiKey: "",
};

// Retry config
const MAX_RETRIES = 1;
const BASE_DELAY_MS = 5000;

// DashScope (Qwen) OpenAI-compatible endpoint
const DASHSCOPE_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

// --- Configuration ---

export function configure(
  config: Partial<AIConfig>,
) {
  if (config.provider !== undefined) {
    currentConfig.provider =
      config.provider;
  }

  if (
    config.geminiApiKey !== undefined
  ) {
    currentConfig.geminiApiKey =
      config.geminiApiKey;
    geminiClient = config.geminiApiKey
      ? new GoogleGenerativeAI(
          config.geminiApiKey,
        )
      : null;
  }

  if (
    config.openaiApiKey !== undefined
  ) {
    currentConfig.openaiApiKey =
      config.openaiApiKey;
    openaiClient = config.openaiApiKey
      ? new OpenAI({
          apiKey: config.openaiApiKey,
          dangerouslyAllowBrowser: true,
        })
      : null;
  }

  if (config.qwenApiKey !== undefined) {
    currentConfig.qwenApiKey =
      config.qwenApiKey;
    qwenClient = config.qwenApiKey
      ? new OpenAI({
          apiKey: config.qwenApiKey,
          baseURL: DASHSCOPE_BASE_URL,
          dangerouslyAllowBrowser: true,
        })
      : null;
  }

  console.log(
    `[AI Corrector] Configured: provider=${currentConfig.provider}`,
  );
}

export function getConfig(): AIConfig {
  return { ...currentConfig };
}

export function isConfigured(): boolean {
  switch (currentConfig.provider) {
    case "gemini":
      return (
        !!currentConfig.geminiApiKey &&
        !!geminiClient
      );
    case "openai":
      return (
        !!currentConfig.openaiApiKey &&
        !!openaiClient
      );
    case "qwen":
      return (
        !!currentConfig.qwenApiKey &&
        !!qwenClient
      );
    default:
      return false;
  }
}

// --- Helpers ---

function sleep(
  ms: number,
): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

function parseRetryDelay(
  error: unknown,
): number | null {
  const msg = String(error);
  const match = msg.match(
    /retry in (\d+(?:\.\d+)?)s/i,
  );
  if (match)
    return Math.ceil(
      parseFloat(match[1]) * 1000,
    );
  return null;
}

async function blobToBase64(
  blob: Blob,
): Promise<string> {
  const buffer =
    await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {
    binary += String.fromCharCode(
      bytes[i],
    );
  }
  return btoa(binary);
}

const SYSTEM_PROMPT = `You are an expert OCR text corrector for Vietnamese documents.
Your task is to compare the OCR text against the actual text visible in the image and correct any errors.

Rules:
1. Fix Vietnamese diacritics/accents that were incorrectly recognized.
2. Fix any misrecognized characters, missing words, or garbled text.
3. Preserve the original formatting and structure (paragraphs, line breaks).
4. Do NOT add any commentary, explanation, or markdown formatting.
5. Do NOT translate the text — keep it in its original language.
6. Output ONLY the corrected text, nothing else.`;

const USER_PROMPT_TEMPLATE = (
  rawText: string,
) =>
  `Here is the raw OCR text extracted by Tesseract. Please correct it based on the image:

${rawText}`;

// --- Gemini Implementation ---

const GEMINI_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

async function correctWithGemini(
  imageBlob: Blob,
  rawOcrText: string,
): Promise<string> {
  if (!geminiClient)
    throw new Error(
      "Gemini API key not configured.",
    );

  const base64 =
    await blobToBase64(imageBlob);
  const imagePart = {
    inlineData: {
      data: base64,
      mimeType:
        imageBlob.type || "image/png",
    },
  };

  const prompt = `${SYSTEM_PROMPT}\n\n${USER_PROMPT_TEMPLATE(rawOcrText)}`;

  for (const modelName of GEMINI_MODELS) {
    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        const model =
          geminiClient.getGenerativeModel(
            { model: modelName },
          );
        const result =
          await model.generateContent([
            prompt,
            imagePart,
          ]);
        console.log(
          `[Gemini] OK (model=${modelName}, attempt=${attempt + 1})`,
        );
        return result.response
          .text()
          .trim();
      } catch (err: unknown) {
        const is429 =
          String(err).includes("429") ||
          String(err).includes("quota");
        if (
          is429 &&
          attempt < MAX_RETRIES
        ) {
          const delay =
            parseRetryDelay(err) ||
            BASE_DELAY_MS *
              (attempt + 1);
          console.warn(
            `[Gemini] Rate limited, retry in ${Math.round(delay / 1000)}s...`,
          );
          await sleep(delay);
          continue;
        }
        if (is429) break;
        throw err;
      }
    }
  }

  console.warn(
    "[Gemini] All models rate limited, returning original text",
  );
  return rawOcrText;
}

// --- OpenAI-compatible implementation (shared by OpenAI + Qwen) ---

async function correctWithOpenAICompat(
  client: OpenAI,
  modelName: string,
  providerLabel: string,
  imageBlob: Blob,
  rawOcrText: string,
): Promise<string> {
  const base64 =
    await blobToBase64(imageBlob);
  const mimeType =
    imageBlob.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await client.chat.completions.create(
          {
            model: modelName,
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: dataUrl,
                      detail: "high",
                    },
                  },
                  {
                    type: "text",
                    text: USER_PROMPT_TEMPLATE(
                      rawOcrText,
                    ),
                  },
                ],
              },
            ],
            max_tokens: 4096,
            temperature: 0.1,
          },
        );

      const text =
        response.choices[0]?.message
          ?.content;
      console.log(
        `[${providerLabel}] OK (model=${modelName}, attempt=${attempt + 1})`,
      );
      return (
        text || rawOcrText
      ).trim();
    } catch (err: unknown) {
      const is429 =
        String(err).includes("429") ||
        String(err).includes("rate");
      if (
        is429 &&
        attempt < MAX_RETRIES
      ) {
        const delay =
          parseRetryDelay(err) ||
          BASE_DELAY_MS * (attempt + 1);
        console.warn(
          `[${providerLabel}] Rate limited, retry in ${Math.round(delay / 1000)}s...`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  return rawOcrText;
}

// --- Public API ---

/**
 * Correct OCR text using the configured AI provider.
 * Sends original image + raw OCR text for verification and correction.
 */
export async function correctText(
  imageBlob: Blob,
  rawOcrText: string,
): Promise<string> {
  switch (currentConfig.provider) {
    case "openai":
      if (!openaiClient)
        throw new Error(
          "OpenAI API key not configured.",
        );
      return correctWithOpenAICompat(
        openaiClient,
        "gpt-4o-mini",
        "OpenAI",
        imageBlob,
        rawOcrText,
      );

    case "qwen":
      if (!qwenClient)
        throw new Error(
          "Qwen API key not configured.",
        );
      return correctWithOpenAICompat(
        qwenClient,
        "qwen-plus",
        "Qwen",
        imageBlob,
        rawOcrText,
      );

    case "gemini":
    default:
      return correctWithGemini(
        imageBlob,
        rawOcrText,
      );
  }
}
