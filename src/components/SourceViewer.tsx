import { FileInfo } from "@/types";
import {
  applyImageEdits,
  DEFAULT_IMAGE_EDITS,
  type ImageCrop,
  type ImageEditOptions,
  type ImageRotation,
} from "@/lib/imageEdit";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

interface SourceViewerProps {
  file: FileInfo | null;
  fileData: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  imageEdits?: ImageEditOptions;
  onImageEditsChange?: (
    edits: ImageEditOptions,
  ) => void;
}

export default function SourceViewer({
  file,
  fileData,
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
  imageEdits = DEFAULT_IMAGE_EDITS,
  onImageEditsChange,
}: SourceViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [
    cropMode,
    setCropMode,
  ] = useState(false);
  const [
    draftCrop,
    setDraftCrop,
  ] = useState<ImageCrop | null>(null);
  const [
    cropStart,
    setCropStart,
  ] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [
    rotatedPreviewData,
    setRotatedPreviewData,
  ] = useState<string | null>(null);
  const containerRef =
    useRef<HTMLDivElement>(null);
  const imageRef =
    useRef<HTMLImageElement>(null);

  useEffect(() => {
    setZoom(100);
    setCropMode(false);
    setDraftCrop(null);
    setCropStart(null);
  }, [file?.path, currentPage]);

  useEffect(() => {
    if (!fileData) {
      setRotatedPreviewData(null);
      return;
    }

    if (
      imageEdits.rotation === 0 &&
      !imageEdits.enhance
    ) {
      setRotatedPreviewData(fileData);
      return;
    }

    let isMounted = true;
    let previewUrl: string | null = null;

    const renderPreview = async () => {
      try {
        const response =
          await fetch(fileData);
        const blob =
          await response.blob();
        const previewBlob =
          await applyImageEdits(blob, {
            ...DEFAULT_IMAGE_EDITS,
            rotation: imageEdits.rotation,
            enhance: imageEdits.enhance,
          });

        if (!isMounted) return;
        previewUrl =
          URL.createObjectURL(
            previewBlob,
          );
        setRotatedPreviewData(
          previewUrl,
        );
      } catch (err) {
        console.warn(
          "Failed to render edited preview:",
          err,
        );
        setRotatedPreviewData(fileData);
      }
    };

    renderPreview();

    return () => {
      isMounted = false;
      if (previewUrl)
        URL.revokeObjectURL(
          previewUrl,
        );
    };
  }, [
    fileData,
    imageEdits.rotation,
    imageEdits.enhance,
  ]);

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
  const hasCrop =
    imageEdits.crop.top > 0 ||
    imageEdits.crop.right > 0 ||
    imageEdits.crop.bottom > 0 ||
    imageEdits.crop.left > 0;
  const hasEdits =
    imageEdits.rotation !== 0 ||
    imageEdits.enhance ||
    hasCrop;

  const updateImageEdits = (
    edits: ImageEditOptions,
  ) => {
    onImageEditsChange?.(edits);
  };

  const handleRotate = (
    delta: 90 | -90,
  ) => {
    const nextRotation = ((((imageEdits.rotation +
      delta) %
      360) +
      360) %
      360) as ImageRotation;
    updateImageEdits({
      ...imageEdits,
      rotation: nextRotation,
    });
  };

  const handleResetEdits = () => {
    setCropMode(false);
    setDraftCrop(null);
    setCropStart(null);
    updateImageEdits(
      DEFAULT_IMAGE_EDITS,
    );
  };

  const handleToggleEnhance = () => {
    updateImageEdits({
      ...imageEdits,
      enhance: !imageEdits.enhance,
    });
  };

  const toggleCropMode = () => {
    if (isLoading) return;
    setDraftCrop(null);
    setCropStart(null);
    setCropMode((enabled) => !enabled);
  };

  const getCropPoint = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    const rect =
      imageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clamp = (value: number) =>
      Math.max(0, Math.min(100, value));

    return {
      x: clamp(
        ((event.clientX - rect.left) /
          rect.width) *
          100,
      ),
      y: clamp(
        ((event.clientY - rect.top) /
          rect.height) *
          100,
      ),
    };
  };

  const createCropFromPoints = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): ImageCrop => {
    const left = Math.min(
      start.x,
      end.x,
    );
    const right =
      100 - Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom =
      100 - Math.max(start.y, end.y);

    return {
      top,
      right,
      bottom,
      left,
    };
  };

  const handleCropPointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!cropMode || isLoading) return;
    const point = getCropPoint(event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
    setCropStart(point);
    setDraftCrop(
      createCropFromPoints(point, point),
    );
  };

  const handleCropPointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!cropMode || !cropStart)
      return;
    const point = getCropPoint(event);
    if (!point) return;
    setDraftCrop(
      createCropFromPoints(
        cropStart,
        point,
      ),
    );
  };

  const finishCropSelection = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!cropMode || !cropStart)
      return;
    const point = getCropPoint(event);
    if (!point) return;

    const nextCrop =
      createCropFromPoints(
        cropStart,
        point,
      );
    const width =
      100 -
      nextCrop.left -
      nextCrop.right;
    const height =
      100 -
      nextCrop.top -
      nextCrop.bottom;

    if (width >= 2 && height >= 2) {
      updateImageEdits({
        ...imageEdits,
        crop: nextCrop,
      });
      setCropMode(false);
    }

    setCropStart(null);
    setDraftCrop(null);
  };

  const activeCrop =
    draftCrop ?? imageEdits.crop;
  const activeCropWidth =
    100 -
    activeCrop.left -
    activeCrop.right;
  const activeCropHeight =
    100 -
    activeCrop.top -
    activeCrop.bottom;
  const showCropBox =
    !!draftCrop ||
    hasCrop;
  const cropBoxStyle = {
    left: `${activeCrop.left}%`,
    top: `${activeCrop.top}%`,
    width: `${activeCropWidth}%`,
    height: `${activeCropHeight}%`,
  };
  const displayData =
    rotatedPreviewData ?? fileData;

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

        <div className="edit-controls">
          <button
            className="zoom-btn"
            onClick={() =>
              handleRotate(-90)
            }
            title="Xoay trái"
            disabled={isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
            </svg>
          </button>
          <span
            className="rotation-value"
            title="Góc xoay"
          >
            {imageEdits.rotation}°
          </span>
          <button
            className="zoom-btn"
            onClick={() =>
              handleRotate(90)
            }
            title="Xoay phải"
            disabled={isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
            </svg>
          </button>
          <button
            className={`zoom-btn ${cropMode ? "active" : ""}`}
            onClick={toggleCropMode}
            title="Chọn vùng crop"
            disabled={isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
            </svg>
          </button>
          <button
            className={`zoom-btn ${imageEdits.enhance ? "active" : ""}`}
            onClick={handleToggleEnhance}
            title="Tăng cường nền trắng chữ đen"
            disabled={isLoading}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 3v3" />
              <path d="M12 18v3" />
              <path d="M3 12h3" />
              <path d="M18 12h3" />
              <path d="M7.8 7.8 5.7 5.7" />
              <path d="m18.3 18.3-2.1-2.1" />
              <path d="m16.2 7.8 2.1-2.1" />
              <path d="m5.7 18.3 2.1-2.1" />
              <circle
                cx="12"
                cy="12"
                r="3"
              />
            </svg>
          </button>
          <button
            className="crop-reset-btn"
            onClick={handleResetEdits}
            disabled={
              isLoading || !hasEdits
            }
          >
            Reset
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
            <div
              className="image-edit-preview"
            >
              <img
                ref={imageRef}
                src={displayData || fileData}
                alt={
                  file.type === "image"
                    ? file.name
                    : `Trang ${currentPage}`
                }
                className="source-image"
                draggable={false}
              />
              <div
                className={`crop-overlay ${cropMode ? "active" : ""}`}
                onPointerDown={
                  handleCropPointerDown
                }
                onPointerMove={
                  handleCropPointerMove
                }
                onPointerUp={
                  finishCropSelection
                }
                onPointerCancel={
                  finishCropSelection
                }
              >
                {showCropBox && (
                  <div
                    className="crop-selection"
                    style={cropBoxStyle}
                  />
                )}
              </div>
            </div>
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
