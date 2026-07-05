"use client";

import {
  CodeIcon,
  FileIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlayIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { CodeBlockContent } from "@/components/ai-elements/code-block";
import { LoaderIcon } from "@/components/chat/icons";
import { cn } from "@/lib/utils";

type HtmlEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
  metadata?: Record<string, unknown>;
  setMetadata?: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>
  ) => void;
};

const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const TAILWIND_SETUP = `<script src="${TAILWIND_CDN}"></script>`;

function buildPreviewHtml(raw: string): string {
  const hasDoctype = /^\s*<!doctype/i.test(raw);
  const hasHtmlTag = /<html[\s>]/i.test(raw);
  const hasHead = /<head[\s>]/i.test(raw);
  const hasTailwind = /cdn\.tailwindcss\.com/.test(raw);

  if (hasDoctype && hasHtmlTag) {
    if (hasTailwind) return raw;
    if (hasHead) {
      return raw.replace(/<head(\s[^>]*)?>/, `<head$1>${TAILWIND_SETUP}`);
    }
    return raw.replace(
      /<html(\s[^>]*)?>/,
      `<html$1><head>${TAILWIND_SETUP}</head>`
    );
  }

  if (hasHead) {
    const withTailwind = hasTailwind
      ? raw
      : raw.replace(/<head(\s[^>]*)?>/, `<head$1>${TAILWIND_SETUP}`);
    return `<!DOCTYPE html><html lang="en">${withTailwind}</html>`;
  }

  const tailwind = hasTailwind ? "" : TAILWIND_SETUP;
  return `<!DOCTYPE html><html lang="en"><head>${tailwind}<meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body class="min-h-screen p-4">${raw}</body></html>`;
}

export function HtmlEditor({
  title,
  content,
  status,
  metadata,
  setMetadata,
}: HtmlEditorProps) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const isFullscreen = metadata?.htmlFullscreen === true;

  const toggleFullscreen = useCallback(() => {
    if (!setMetadata) return;
    setMetadata((prev) => ({ ...prev, htmlFullscreen: !prev?.htmlFullscreen }));
  }, [setMetadata]);

  if (status === "streaming" && !content) {
    return (
      <div className="flex h-[calc(100dvh-60px)] items-center justify-center gap-4 text-muted-foreground">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <div>Generating HTML...</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        isFullscreen && "fixed inset-0 z-[100] bg-background"
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileIcon size={14} />
          <span className="font-medium">HTML</span>
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
            onClick={toggleFullscreen}
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
          <CodeBlockContent code={content} language="html" showLineNumbers />
        </div>
      ) : (
        <div className="flex h-full flex-1 items-center justify-center">
          {content ? (
            <iframe
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-popups allow-forms allow-modals allow-downloads"
              srcDoc={buildPreviewHtml(content)}
              title={title}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No HTML content</div>
          )}
        </div>
      )}
    </div>
  );
}
