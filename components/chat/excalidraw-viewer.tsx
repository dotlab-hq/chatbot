"use client";

import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useRef, useState } from "react";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
  }
);

type ExcalidrawViewerProps = {
  content: string;
  onChange?: (updatedContent: string) => void;
};

const CANVAS_HEIGHT = "calc(100vh - 160px)";

function serializeScene(elements: readonly any[], appState: any, files: any) {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      viewBackgroundColor: appState?.viewBackgroundColor ?? "#ffffff",
      gridSize: appState?.gridSize ?? null,
    },
    files: files ?? {},
  });
}

export function ExcalidrawViewer({ content, onChange }: ExcalidrawViewerProps) {
  const [initialData, setInitialData] = useState<any>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!content) {
      return;
    }
    try {
      const data = JSON.parse(content);
      setInitialData({
        elements: data.elements ?? [],
        appState: {
          ...(data.appState ?? {}),
          showWelcomeScreen: false,
        },
        files: data.files ?? {},
      });
    } catch {
      // keep previous
    }
  }, [content]);

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      if (!onChange) {
        return;
      }
      const serialized = serializeScene(elements, appState, files);
      // Avoid triggering save if content hasn't actually changed
      if (serialized === contentRef.current) {
        return;
      }
      onChange(serialized);
    },
    [onChange]
  );

  if (!initialData) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: CANVAS_HEIGHT }}
      >
        <div className="animate-pulse text-sm text-muted-foreground">
          Loading Excalidraw...
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: CANVAS_HEIGHT, width: "100%", position: "relative" }}>
      <Excalidraw
        autoFocus={true}
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
            saveAsImage: false,
          },
          tools: {
            image: false,
          },
        }}
      />
      <style>{`
        .WelcomeScreen { display: none !important; }
      `}</style>
    </div>
  );
}
