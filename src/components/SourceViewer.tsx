import { FileInfo } from "@/types";
import {
  useEffect,
  useRef,
  useState,
} from "react";

interface SourceViewerProps {
  file: FileInfo | null;
  fileData: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export default function SourceViewer({
  file,
  fileData,
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
}: SourceViewerProps) {
  const [zoom, setZoom] = useState(100);
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(100);
  }, [file?.path]);

  const handleZoomIn = () =>
    setZoom((z) =>
      Math.min(z + 25, 300),
    );
  const handleZoomOut = () =>
    setZoom((z) =>
      Math.max(z - 25, 25),
    );
  const handleZoomReset = () =>
    setZoom(100);

  if (!file) {
    return (
      <div className="source-viewer">
        <div className="source-header h-[48px]">
          <span className="source-title">
            Tệp nguồn
          </span>
        </div>
        <div className="source-content empty">
          <div className="empty-state">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
              />
              <line
                x1="16"
                y1="17"
                x2="8"
                y2="17"
              />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>
              Chọn hoặc thêm tệp để xem
              trước
            </p>
            <p className="text-hint">
              Hỗ trợ PNG, JPG, BMP,
              TIFF, WebP, PDF
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="source-viewer">
      <div className="source-header h-[48px]">
        <span className="source-title">
          Tệp nguồn
        </span>
        <div className="source-file-info">
          <span className="source-filename">
            {file.name}
          </span>
        </div>
      </div>

      <div className="source-toolbar">
        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={handleZoomOut}
            title="Thu nhỏ"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
              <line
                x1="8"
                y1="11"
                x2="14"
                y2="11"
              />
            </svg>
          </button>
          <span
            className="zoom-value"
            onClick={handleZoomReset}
            title="Đặt lại thu phóng"
          >
            {zoom}%
          </span>
          <button
            className="zoom-btn"
            onClick={handleZoomIn}
            title="Phóng to"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
              <line
                x1="11"
                y1="8"
                x2="11"
                y2="14"
              />
              <line
                x1="8"
                y1="11"
                x2="14"
                y2="11"
              />
            </svg>
          </button>
        </div>

        {file.type === "pdf" &&
          totalPages > 1 && (
            <div className="page-nav">
              <button
                className="page-btn"
                onClick={() =>
                  onPageChange(
                    currentPage - 1,
                  )
                }
                disabled={
                  currentPage <= 1
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="page-info">
                {currentPage} /{" "}
                {totalPages}
              </span>
              <button
                className="page-btn"
                onClick={() =>
                  onPageChange(
                    currentPage + 1,
                  )
                }
                disabled={
                  currentPage >=
                  totalPages
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
      </div>

      <div
        className="source-content"
        ref={containerRef}
      >
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Đang tải tệp...</p>
          </div>
        ) : fileData ? (
          <div
            className="image-container"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin:
                "top center",
            }}
          >
            {file.type === "image" ? (
              <img
                src={fileData}
                alt={file.name}
                className="source-image"
                draggable={false}
              />
            ) : (
              <img
                src={fileData}
                alt={`Trang ${currentPage}`}
                className="source-image"
                draggable={false}
              />
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>
              Không thể tải bản xem
              trước
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
