import { Download, MaximizeIcon, MinimizeIcon, Pencil } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { UIArtifact } from "@/components/chat/artifact";
import { Artifact } from "@/components/chat/create-artifact";
import { ExcalidrawViewer } from "@/components/chat/excalidraw-viewer";
import { CopyIcon, RedoIcon, UndoIcon } from "@/components/chat/icons";
import { cn } from "@/lib/utils";

type DiagramEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
  isLoading: boolean;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  metadata?: Record<string, unknown>;
  setMetadata?: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>
  ) => void;
};

function DiagramEditor({
  title: _title,
  content,
  status,
  isLoading,
  onSaveContent,
  metadata,
  setMetadata,
}: DiagramEditorProps) {
  const isFullscreen = metadata?.diagramFullscreen === true;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleFullscreen = useCallback(() => {
    if (!setMetadata) {
      return;
    }
    setMetadata((prev) => ({
      ...prev,
      diagramFullscreen: !prev?.diagramFullscreen,
    }));
  }, [setMetadata]);

  const handleChange = useCallback(
    (updatedContent: string) => {
      // Debounce saves: wait 1 second after last change
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        onSaveContent(updatedContent, false);
        saveTimerRef.current = null;
      }, 1000);
    },
    [onSaveContent]
  );

  if (isLoading || (status === "streaming" && !content)) {
    return (
      <div className="flex h-full items-center justify-center gap-4 text-muted-foreground">
        <div className="animate-pulse text-sm">Generating diagram...</div>
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
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg
            fill="none"
            height="14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <rect height="7" rx="1" width="7" x="3" y="3" />
            <rect height="7" rx="1" width="7" x="14" y="3" />
            <rect height="7" rx="1" width="7" x="3" y="14" />
            <path d="M14 17.5h7M17.5 14v7" />
          </svg>
          <span className="font-medium">Excalidraw</span>
        </div>
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
      <div className="flex-1">
        <ExcalidrawViewer content={content} onChange={handleChange} />
      </div>
    </div>
  );
}

export const diagramArtifact = new Artifact<"diagram">({
  kind: "diagram",
  description:
    "Useful for generating diagrams, flowcharts, architecture diagrams, wireframes, mind maps, and any visual diagrams using Excalidraw",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-diagramDelta") {
      setArtifact((draftArtifact: UIArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible:
          draftArtifact.status === "streaming" &&
          draftArtifact.content.length === 0 &&
          streamPart.data.length > 0
            ? true
            : draftArtifact.isVisible,
        status: "streaming",
      }));
    }
  },
  content: DiagramEditor,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy diagram JSON to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied diagram JSON to clipboard!");
      },
    },
    {
      icon: <Download size={18} />,
      description: "Download as .excalidraw file",
      onClick: ({ content }) => {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "diagram.excalidraw";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Downloaded diagram!");
      },
    },
  ],
  toolbar: [
    {
      icon: <Pencil size={18} />,
      description: "Modify diagram",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Modify this diagram — improve the layout, add more detail, or make it more visually appealing",
            },
          ],
        });
      },
    },
  ],
});
