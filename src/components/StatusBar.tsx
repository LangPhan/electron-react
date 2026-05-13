interface StatusBarProps {
  engineStatus: "initializing" | "ready" | "error";
  fileName?: string;
  fileSize?: number;
  pageInfo?: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StatusBar({ engineStatus, fileName, fileSize, pageInfo }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span className={`server-status ${engineStatus}`}>
          <span className="status-dot-sm" />
          {engineStatus === "initializing" && "Đang khởi tạo OCR..."}
          {engineStatus === "ready" && "OCR đã sẵn sàng"}
          {engineStatus === "error" && "Lỗi OCR"}
        </span>
      </div>
      <div className="status-bar-right">
        {fileName && <span className="status-info">{fileName}</span>}
        {fileSize ? <span className="status-info">{formatSize(fileSize)}</span> : null}
        {pageInfo && <span className="status-info">{pageInfo}</span>}
      </div>
    </footer>
  );
}
