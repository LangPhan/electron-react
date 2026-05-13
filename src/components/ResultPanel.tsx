import { OCRResult } from "@/types";
import {
  useEffect,
  useRef,
  useState,
} from "react";

interface ResultPanelProps {
  result: OCRResult | null;
  isProcessing: boolean;
  currentPage: number;
  progress: {
    page: number;
    total: number;
  } | null;
}

export default function ResultPanel({
  result,
  isProcessing,
  currentPage,
  progress,
}: ResultPanelProps) {
  const [displayMode, setDisplayMode] =
    useState<"formatted" | "raw">(
      "formatted",
    );
  const [copied, setCopied] =
    useState(false);
  const textRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCopied(false);
  }, [result]);

  const getCurrentPageText =
    (): string => {
      if (!result || !result.pages)
        return "";

      // Find page matching currentPage
      const pageResult =
        result.pages.find(
          (p) => p.page === currentPage,
        );
      if (pageResult)
        return pageResult.text;

      // If only one page result, show it
      if (result.pages.length === 1)
        return result.pages[0].text;

      // Show all pages
      return result.pages
        .map(
          (p) =>
            `--- Trang ${p.page} ---\n${p.text}`,
        )
        .join("\n\n");
    };

  const getAllText = (): string => {
    if (!result || !result.pages)
      return "";
    if (result.pages.length === 1)
      return result.pages[0].text;
    return result.pages
      .map(
        (p) =>
          `--- Trang ${p.page} ---\n${p.text}`,
      )
      .join("\n\n");
  };

  const handleCopy = async () => {
    const text = getAllText();
    if (text) {
      await navigator.clipboard.writeText(
        text,
      );
      setCopied(true);
      setTimeout(
        () => setCopied(false),
        2000,
      );
    }
  };

  const handleCopyCurrentPage =
    async () => {
      const text = getCurrentPageText();
      if (text) {
        await navigator.clipboard.writeText(
          text,
        );
        setCopied(true);
        setTimeout(
          () => setCopied(false),
          2000,
        );
      }
    };

  const pageText = getCurrentPageText();
  const totalBlocks =
    result?.pages?.reduce(
      (sum, p) => sum + p.block_count,
      0,
    ) ?? 0;

  return (
    <div className="result-panel">
      <div className="result-header">
        <div className="result-header-left">
          <span className="result-title">
            Kết quả trích xuất
          </span>
          {result && (
            <span className="result-badge badge-success">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              XONG
            </span>
          )}
          {isProcessing && (
            <span className="result-badge badge-processing">
              <div className="spinner-small" />
              ĐANG XỬ LÝ
            </span>
          )}
        </div>
        <div className="result-header-right">
          <div className="display-mode-toggle">
            <button
              className={`mode-btn ${displayMode === "formatted" ? "active" : ""}`}
              onClick={() =>
                setDisplayMode(
                  "formatted",
                )
              }
            >
              Định dạng
            </button>
            <button
              className={`mode-btn ${displayMode === "raw" ? "active" : ""}`}
              onClick={() =>
                setDisplayMode("raw")
              }
            >
              Thô
            </button>
          </div>
        </div>
      </div>

      <div className="result-toolbar">
        <div className="result-stats">
          {result && (
            <>
              <span className="stat-item">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {result.total_pages}{" "}
                trang
              </span>
              <span className="stat-item">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line
                    x1="9"
                    y1="20"
                    x2="15"
                    y2="20"
                  />
                  <line
                    x1="12"
                    y1="4"
                    x2="12"
                    y2="20"
                  />
                </svg>
                {totalBlocks} khối
              </span>
            </>
          )}
        </div>
        <div className="result-actions">
          {result &&
            result.total_pages > 1 && (
              <button
                className="action-btn"
                onClick={
                  handleCopyCurrentPage
                }
                title="Sao chép trang hiện tại"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"
                  />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Sao chép trang
              </button>
            )}
          <button
            className={`action-btn ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            disabled={!result}
            title="Sao chép toàn bộ văn bản"
          >
            {copied ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Đã chép!
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"
                  />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Sao chép tất cả
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="result-content"
        ref={textRef}
      >
        {isProcessing && (
          <div className="processing-state">
            <div className="processing-animation">
              <div className="spinner-large" />
              <p className="processing-text">
                Đang trích xuất văn bản
                bằng Tesseract...
              </p>
              {progress && (
                <p className="processing-progress">
                  Trang {progress.page}{" "}
                  / {progress.total}
                </p>
              )}
            </div>
          </div>
        )}

        {!isProcessing && !result && (
          <div className="empty-state">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.2"
            >
              <polyline points="4 7 4 4 20 4 20 7" />
              <line
                x1="9"
                y1="20"
                x2="15"
                y2="20"
              />
              <line
                x1="12"
                y1="4"
                x2="12"
                y2="20"
              />
            </svg>
            <p>
              Kết quả OCR sẽ hiển thị
              tại đây
            </p>
            <p className="text-hint">
              Bấm "Bắt đầu" để trích
              xuất văn bản từ tệp nguồn
            </p>
          </div>
        )}

        {!isProcessing && result && (
          <div
            className={`text-output ${displayMode}`}
          >
            {displayMode ===
            "formatted" ? (
              <div className="formatted-text">
                {pageText
                  .split("\n")
                  .map((line, i) => (
                    <p
                      key={i}
                      className={
                        line.trim() ===
                        ""
                          ? "empty-line"
                          : ""
                      }
                    >
                      {line || "\u00A0"}
                    </p>
                  ))}
              </div>
            ) : (
              <pre className="raw-text">
                {pageText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
