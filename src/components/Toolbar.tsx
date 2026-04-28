import { useState } from "react";
import type { AIProvider } from "@/lib/aiCorrector";

interface ToolbarProps {
  onNewParsing: () => void;
  onStartOCR: () => void;
  onExportText: () => void;
  isProcessing: boolean;
  hasFile: boolean;
  hasResult: boolean;
  aiProvider: AIProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  qwenApiKey: string;
  useAI: boolean;
  onSetAIProvider: (provider: AIProvider) => void;
  onSetGeminiKey: (key: string) => void;
  onSetOpenaiKey: (key: string) => void;
  onSetQwenKey: (key: string) => void;
  onToggleAI: (enabled: boolean) => void;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini",
  openai: "ChatGPT",
  qwen: "Qwen",
};

export default function Toolbar({
  onNewParsing,
  onStartOCR,
  onExportText,
  isProcessing,
  hasFile,
  hasResult,
  aiProvider,
  geminiApiKey,
  openaiApiKey,
  qwenApiKey,
  useAI,
  onSetAIProvider,
  onSetGeminiKey,
  onSetOpenaiKey,
  onSetQwenKey,
  onToggleAI,
}: ToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [geminiInput, setGeminiInput] = useState(geminiApiKey);
  const [openaiInput, setOpenaiInput] = useState(openaiApiKey);
  const [qwenInput, setQwenInput] = useState(qwenApiKey);

  const handleSaveKeys = () => {
    onSetGeminiKey(geminiInput.trim());
    onSetOpenaiKey(openaiInput.trim());
    onSetQwenKey(qwenInput.trim());
    setShowSettings(false);
  };

  const hasActiveKey =
    (aiProvider === "gemini" && !!geminiApiKey) ||
    (aiProvider === "openai" && !!openaiApiKey) ||
    (aiProvider === "qwen" && !!qwenApiKey);

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="app-logo">
          <div className="logo-icon">OCR</div>
          <span className="app-name">Document Parser</span>
        </div>

        <button className="toolbar-btn primary" onClick={onNewParsing} disabled={isProcessing}>
          <span className="btn-icon">+</span>
          New Parsing
        </button>

        <button className="toolbar-btn accent" onClick={onStartOCR} disabled={isProcessing || !hasFile}>
          {isProcessing ? (
            <><div className="spinner-small" /> Processing...</>
          ) : (
            <><span className="btn-icon">▶</span> Start Parsing</>
          )}
        </button>

        {hasResult && (
          <button className="toolbar-btn secondary" onClick={onExportText}>
            <span className="btn-icon">💾</span>
            Export .txt
          </button>
        )}
      </div>

      <div className="toolbar-right">
        {/* AI toggle */}
        <label className="gemini-toggle" title={useAI ? `AI correction: ${PROVIDER_LABELS[aiProvider]}` : "AI correction disabled"}>
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => onToggleAI(e.target.checked)}
            disabled={!hasActiveKey}
          />
          <span className="toggle-slider" />
          <span className="toggle-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            AI
          </span>
        </label>

        {/* Settings button */}
        <button
          className="toolbar-btn icon-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙️
        </button>

        <div className="engine-badge">
          <span>Tesseract{useAI ? ` + ${PROVIDER_LABELS[aiProvider]}` : ""}</span>
        </div>

        {hasResult && (
          <span className="status-indicator done">
            <span className="status-dot" />
            Complete
          </span>
        )}
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="settings-dropdown">
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
          <div className="settings-panel">
            <h3>⚙️ AI Settings</h3>

            {/* Provider selection */}
            <div className="setting-group">
              <label className="setting-label">AI Provider</label>
              <div className="provider-tabs">
                <button
                  className={`provider-tab ${aiProvider === "gemini" ? "active" : ""}`}
                  onClick={() => onSetAIProvider("gemini")}
                >
                  <span className="provider-icon">✨</span>
                  Gemini
                </button>
                <button
                  className={`provider-tab ${aiProvider === "openai" ? "active" : ""}`}
                  onClick={() => onSetAIProvider("openai")}
                >
                  <span className="provider-icon">🤖</span>
                  ChatGPT
                </button>
                <button
                  className={`provider-tab ${aiProvider === "qwen" ? "active" : ""}`}
                  onClick={() => onSetAIProvider("qwen")}
                >
                  <span className="provider-icon">🌐</span>
                  Qwen
                </button>
              </div>
            </div>

            {/* Gemini API Key */}
            <div className="setting-group">
              <label className="setting-label">
                Gemini API Key
                {aiProvider === "gemini" && <span className="active-badge">Active</span>}
              </label>
              <p className="setting-hint">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  aistudio.google.com
                </a>
              </p>
              <input
                type="password"
                className="setting-input"
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                placeholder="AIzaSy..."
              />
            </div>

            {/* OpenAI API Key */}
            <div className="setting-group">
              <label className="setting-label">
                OpenAI API Key
                {aiProvider === "openai" && <span className="active-badge">Active</span>}
              </label>
              <p className="setting-hint">
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  platform.openai.com
                </a>
              </p>
              <input
                type="password"
                className="setting-input"
                value={openaiInput}
                onChange={(e) => setOpenaiInput(e.target.value)}
                placeholder="sk-..."
              />
            </div>

            {/* Qwen API Key */}
            <div className="setting-group">
              <label className="setting-label">
                Qwen (DashScope) API Key
                {aiProvider === "qwen" && <span className="active-badge">Active</span>}
              </label>
              <p className="setting-hint">
                <a href="https://modelstudio.console.alibabacloud.com/" target="_blank" rel="noopener noreferrer">
                  Alibaba Model Studio
                </a>
              </p>
              <input
                type="password"
                className="setting-input"
                value={qwenInput}
                onChange={(e) => setQwenInput(e.target.value)}
                placeholder="sk-..."
              />
            </div>

            <button className="toolbar-btn accent save-btn" onClick={handleSaveKeys}>
              Save Settings
            </button>

            <div className="setting-group" style={{ marginTop: 12 }}>
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => onToggleAI(e.target.checked)}
                  disabled={!hasActiveKey}
                />
                {" "}Enable AI text correction
              </label>
              <p className="setting-hint">
                After Tesseract OCR, sends image + text to AI to fix Vietnamese diacritics and OCR errors.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
