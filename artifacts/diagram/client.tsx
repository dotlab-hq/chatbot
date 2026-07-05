import { Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import { CopyIcon, RedoIcon, UndoIcon } from "@/components/chat/icons";
import { ExcalidrawViewer } from "@/components/chat/excalidraw-viewer";
import type { UIArtifact } from "@/components/chat/artifact";

type DiagramEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
  isLoading: boolean;
  metadata?: Record<string, unknown>;
  setMetadata?: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
};

function DiagramEditor(props: DiagramEditorProps) {
  if (props.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading diagram...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ExcalidrawViewer content={props.content} />
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
          draftArtifact.content.length > 100 &&
          draftArtifact.content.length < 110
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
