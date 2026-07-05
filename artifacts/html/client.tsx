import { Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CodeDiffView } from "@/components/chat/code-diffview";
import { Artifact } from "@/components/chat/create-artifact";
import { HtmlEditor } from "@/components/chat/html-editor";
import { CopyIcon, RedoIcon, UndoIcon } from "@/components/chat/icons";

export const htmlArtifact = new Artifact({
  kind: "html",
  description:
    "Useful for generating HTML pages, web components, landing pages, forms, and any visual UI using Tailwind CSS",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-htmlDelta") {
      setArtifact((draftArtifact) => ({
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
  content: ({
    mode,
    getDocumentContentById,
    currentVersionIndex,
    ...props
  }) => {
    if (mode === "diff") {
      const selectedContent = getDocumentContentById(currentVersionIndex);
      const prevContent =
        currentVersionIndex > 0
          ? getDocumentContentById(currentVersionIndex - 1)
          : selectedContent;

      return (
        <CodeDiffView newContent={selectedContent} oldContent={prevContent} />
      );
    }

    return <HtmlEditor {...props} currentVersionIndex={currentVersionIndex} />;
  },
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
      description: "Copy HTML to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied HTML to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <Sparkles size={18} />,
      description: "Add details",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add more details and polish this HTML page",
            },
          ],
        });
      },
    },
    {
      icon: <Palette size={18} />,
      description: "Change styles",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Refine the styling and color scheme of this page while keeping Tailwind CSS",
            },
          ],
        });
      },
    },
  ],
});
