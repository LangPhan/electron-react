import {
  GROQ_MODEL_OPTIONS,
  type GroqModel,
} from "@/lib/aiCorrector";
import { useState } from "react";

interface ToolbarProps {
  onNewParsing: () => void;
  onStartOCR: () => void;
  onExportText: () => void;
  isProcessing: boolean;
  hasFile: boolean;
  hasResult: boolean;
  groqApiKey: string;
  groqModel: GroqModel;
  useAI: boolean;
  onSetGroqKey: (key: string) => void;
  onSetGroqModel: (
    model: GroqModel,
  ) => void;
  onToggleAI: (
    enabled: boolean,
  ) => void;
}

const getModelLabel = (
  modelId: GroqModel,
) =>
  GROQ_MODEL_OPTIONS.find(
    (model) => model.id === modelId,
  )?.label ?? "Groq";

export default function Toolbar({
  onNewParsing,
  onStartOCR,
  onExportText,
  isProcessing,
  hasFile,
  hasResult,
  groqApiKey,
  groqModel,
  useAI,
  onSetGroqKey,
  onSetGroqModel,
  onToggleAI,
}: ToolbarProps) {
  const [
    showSettings,
    setShowSettings,
  ] = useState(false);
  const [groqInput, setGroqInput] =
    useState(groqApiKey);
  const [
    selectedModel,
    setSelectedModel,
  ] = useState<GroqModel>(groqModel);

  const handleSaveSettings = () => {
    onSetGroqKey(groqInput.trim());
    onSetGroqModel(selectedModel);
    setShowSettings(false);
  };

  const hasActiveKey = !!groqApiKey;
  const activeModelLabel =
    getModelLabel(groqModel);

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="app-logo">
          <div className="logo-icon">
            OCR
          </div>
          <span className="app-name">
            ĐẠT AN OCR
          </span>
        </div>

        <button
          className="toolbar-btn primary"
          onClick={onNewParsing}
          disabled={isProcessing}
        >
          <span className="btn-icon">
            +
          </span>
          Thêm tài liệu
        </button>

        <button
          className="toolbar-btn accent"
          onClick={onStartOCR}
          disabled={
            isProcessing || !hasFile
          }
        >
          {isProcessing ? (
            <>
              <div className="spinner-small" />{" "}
              Đang xử lý...
            </>
          ) : (
            <>
              <span className="btn-icon">
                OCR
              </span>{" "}
              Bắt đầu
            </>
          )}
        </button>

        {hasResult && (
          <button
            className="toolbar-btn secondary"
            onClick={onExportText}
          >
            <span className="btn-icon">
              TXT
            </span>
            Xuất .txt
          </button>
        )}
      </div>

      <div className="toolbar-right">
        <label
          className="ai-toggle"
          title={
            useAI
              ? `Sửa lỗi bằng AI: ${activeModelLabel}`
              : "Đã tắt sửa lỗi bằng AI"
          }
        >
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) =>
              onToggleAI(
                e.target.checked,
              )
            }
            disabled={!hasActiveKey}
          />
          <span className="toggle-slider" />
          <span className="toggle-label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            AI
          </span>
        </label>

        <button
          className="toolbar-btn icon-btn"
          onClick={() =>
            setShowSettings(
              !showSettings,
            )
          }
          title="Cài đặt"
        >
          Cài đặt
        </button>

        <div className="engine-badge">
          <span>
            Tesseract
            {useAI
              ? ` + ${activeModelLabel}`
              : ""}
          </span>
        </div>

        {hasResult && (
          <span className="status-indicator done">
            <span className="status-dot" />
            Hoàn tất
          </span>
        )}
      </div>

      {showSettings && (
        <div className="settings-dropdown">
          <div
            className="settings-overlay"
            onClick={() =>
              setShowSettings(false)
            }
          />
          <div className="settings-panel">
            <h3>Cài đặt AI</h3>

            <div className="setting-group">
              <label className="setting-label">
                Khóa API Groq
                <span className="active-badge">
                  Đang dùng
                </span>
              </label>
              <p className="setting-hint">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  console.groq.com
                </a>
              </p>
              <input
                type="password"
                className="setting-input"
                value={groqInput}
                onChange={(e) =>
                  setGroqInput(
                    e.target.value,
                  )
                }
                placeholder="gsk_..."
              />
            </div>

            <div className="setting-group">
              <label className="setting-label">
                Model Groq
              </label>
              <div className="model-tabs">
                {GROQ_MODEL_OPTIONS.map(
                  (model) => (
                    <button
                      key={model.id}
                      className={`model-tab ${selectedModel === model.id ? "active" : ""}`}
                      onClick={() =>
                        setSelectedModel(
                          model.id,
                        )
                      }
                    >
                      <span className="model-icon">
                        G
                      </span>
                      <span>
                        <span>
                          {model.label}
                        </span>
                        <span className="model-tab-description">
                          {
                            model.description
                          }
                        </span>
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>

            <button
              className="toolbar-btn accent save-btn"
              onClick={
                handleSaveSettings
              }
            >
              Lưu cài đặt
            </button>

            <div
              className="setting-group"
              style={{ marginTop: 12 }}
            >
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) =>
                    onToggleAI(
                      e.target.checked,
                    )
                  }
                  disabled={
                    !hasActiveKey
                  }
                />{" "}
                Bật sửa lỗi văn bản bằng
                AI
              </label>
              <p className="setting-hint">
                Sau khi OCR bằng
                Tesseract, gửi ảnh và
                văn bản sang Groq để sửa
                dấu tiếng Việt và lỗi
                nhận dạng.
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
