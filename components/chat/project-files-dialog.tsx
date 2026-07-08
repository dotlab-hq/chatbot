"use client";

import { FileTextIcon, LoaderIcon } from "lucide-react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/utils";

type ProjectFileItem = {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  status: string;
  liveStatus: string;
};

const STATUS_COLORS: Record<string, string> = {
  uploading: "bg-yellow-500",
  processing: "bg-blue-500",
  ready: "bg-green-500",
  failed: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useSWR<{ files: ProjectFileItem[] }>(
    open
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects/${projectId}/files`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const files = data?.files ?? [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Files in {projectName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" />
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No files uploaded yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {files.map((file) => (
                <div
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent/50"
                  key={file.id}
                >
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {file.fileName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {file.fileSize && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        file.liveStatus === "ready"
                          ? "bg-green-500/10 text-green-600"
                          : file.liveStatus === "failed"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-yellow-500/10 text-yellow-600"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${STATUS_COLORS[file.liveStatus] ?? "bg-blue-500"}`}
                      />
                      {STATUS_LABELS[file.liveStatus] ?? file.liveStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
