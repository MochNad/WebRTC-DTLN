"use client";

interface StatusIndicatorProps {
  status: string;
  label?: string;
}

const getStatusDotColor = (status: string): string => {
  const statusMap: Record<string, string> = {
    Tersedia: "bg-green-500",
    Ready: "bg-green-500",
    Completed: "bg-green-500",
    "Terhubung": "bg-green-500",
    "Memuat...": "bg-yellow-500",
    Initializing: "bg-yellow-500",
    Processing: "bg-yellow-500",
    "Menunggu...": "bg-yellow-500",
    Error: "bg-red-500",
    Terputus: "bg-red-500",
  };
  return statusMap[status] || "bg-gray-400";
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
}) => (
  <div className="flex items-center gap-2">
    <div className={`h-2 w-2 rounded-full ${getStatusDotColor(status)}`} />
    <span className="text-sm text-muted-foreground">{label || status}</span>
  </div>
);
