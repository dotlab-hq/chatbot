"use client";

import { useEffect, useState } from "react";

type ExcalidrawViewerProps = {
  content: string;
  height?: string;
};

export function ExcalidrawViewer({
  content,
  height = "100%",
}: ExcalidrawViewerProps) {
  const [Excalidraw, setExcalidraw] = useState<any>(null);

  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidraw(() => mod.Excalidraw);
    });
  }, []);

  if (!Excalidraw) {
    return (
      <div
        className="flex items-center justify-center bg-muted"
        style={{ height }}
      >
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading diagram...
        </div>
      </div>
    );
  }

  let excalidrawData;
  try {
    excalidrawData = JSON.parse(content);
  } catch {
    return (
      <div className="flex items-center justify-center bg-muted" style={{ height }}>
        <div className="text-sm text-destructive">Invalid diagram data</div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Excalidraw
        initialData={{
          elements: excalidrawData.elements ?? [],
          appState: {
            ...(excalidrawData.appState ?? {}),
            viewModeEnabled: true,
            zoom: { value: 1, serialization: { value: 1 } },
          },
        }}
        uiOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: false,
          },
        }}
      />
    </div>
  );
}
