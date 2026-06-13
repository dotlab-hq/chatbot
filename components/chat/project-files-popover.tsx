"use client";

import { FileIcon, FileTextIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesPopover({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useSWR<{ files: ProjectFileItem[] }>(
    open
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/projects/${projectId}/files`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const files = data?.files ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        side="right"
        sideOffset={8}
        className="w-64 p-0"
      >
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project Files
        </div>
        <div className="border-t" />
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
            <div className="animate-spin">
              <LoaderIcon />
            </div>
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="px-3 py-3 text-[11px] text-muted-foreground">
            No files uploaded yet
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-accent/50"
              >
                <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                <div className="flex items-center gap-1.5">
                  {file.fileSize && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </span>
                  )}
                  <div
                    className={`size-1.5 rounded-full ${STATUS_COLORS[file.liveStatus] ?? STATUS_COLORS.processing}`}
                    title={file.liveStatus}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
