"use client";

import {
  CodeIcon,
  FileIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlayIcon,
} from "lucide-react";
import { useState } from "react";
import { CodeBlockContent } from "@/components/ai-elements/code-block";
import { LoaderIcon } from "@/components/chat/icons";
import { cn } from "@/lib/utils";

type SvgEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
};

export function SvgEditor({
  title: _title,
  content,
  status,
  isInline: _isInline,
}: SvgEditorProps) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (status === "streaming" && !content) {
    return (
      <div className="flex h-[calc(100dvh-60px)] items-center justify-center gap-4 text-muted-foreground">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <div>Generating SVG...</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileIcon size={14} />
          <span className="font-medium">SVG</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "code"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView(view === "code" ? "preview" : "code")}
            title="Toggle code view"
            type="button"
          >
            <CodeIcon size={14} />
          </button>
          <button
            className={cn(
              "rounded-md p-1.5 transition-colors",
              view === "preview"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setView("preview")}
            title="Preview"
            type="button"
          >
            <PlayIcon size={14} />
          </button>
          <button
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            type="button"
          >
            {isFullscreen ? (
              <MinimizeIcon size={14} />
            ) : (
              <MaximizeIcon size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "code" ? (
        <div className="flex-1 overflow-auto">
          <CodeBlockContent code={content} language="xml" showLineNumbers />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          {content ? (
            <div
              className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG content is trusted (LLM-generated)
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No SVG content</div>
          )}
        </div>
      )}
    </div>
  );
}
