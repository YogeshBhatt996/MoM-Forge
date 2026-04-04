import type { JobStatus } from "@/types";
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  UploadCloud,
  AlertTriangle,
} from "lucide-react";

interface Props {
  status: JobStatus;
  showIcon?: boolean;
}

const config: Record<
  JobStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  uploaded: {
    label: "Uploaded",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    Icon: UploadCloud,
  },
  queued: {
    label: "Queued",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Icon: Clock,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Icon: Loader2,
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Icon: XCircle,
  },
  requires_review: {
    label: "Needs Review",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    Icon: AlertTriangle,
  },
};

export function StatusBadge({ status, showIcon = true }: Props) {
  const { label, className, Icon } = config[status];
  return (
    <span className={`badge gap-1 ${className}`}>
      {showIcon && (
        <Icon
          className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`}
        />
      )}
      {label}
    </span>
  );
}
