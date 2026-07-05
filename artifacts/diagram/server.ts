import { streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

function stripFences(json: string): string {
  return json
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

const DIAGRAM_CREATE_INSTRUCTIONS = `You are a diagram generator for the Excalidraw whiteboard. Output a single valid JSON object — no markdown fences, no explanations, no trailing commas.

FORMAT:
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "type": "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line",
      "id": "unique-string-id",
      "x": number, "y": number, "width": number, "height": number,
      "angle": 0,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent",
      "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
      "roughness": 1, "opacity": 100,
      "groupIds": [], "frameId": null, "roundness": null,
      "seed": 1234, "version": 1, "versionNonce": 1234,
      "isDeleted": false, "boundElements": null,
      "updated": 1, "link": null, "locked": false
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}

For text elements also include: "text":"...", "fontSize":20, "fontFamily":1, "textAlign":"left", "verticalAlign":"top", "containerId":null, "originalText":"...", "autoResize":true, "lineHeight":1.25

For arrows/lines include: "points":[[0,0],[200,0]], "lastCommittedPoint":null, "startBinding":null, "endBinding":null, "startArrowhead":null, "endArrowhead":"arrow"

Color palette: Blue #4a9eed, Amber #f59e0b, Green #22c55e, Red #ef4444, Purple #8b5cf6, Pink #ec4899
Pastel fills: #dbeafe, #dcfce7, #ffedd5, #ede9fe, #fee2e2, #fef9c3

Layout elements with 50px+ gaps. Use flow: rectangles for steps, diamonds for decisions, arrows between. Add text labels.`;

export const diagramDocumentHandler = createDocumentHandler<"diagram">({
  kind: "diagram",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    let draftContent = "";

    try {
      const { stream } = streamText({
        maxOutputTokens: 32_000,
        model: getLanguageModel(modelId),
        instructions: DIAGRAM_CREATE_INSTRUCTIONS,
        prompt: title,
      });

      for await (const delta of stream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-diagramDelta",
            data: stripFences(draftContent),
            transient: true,
          });
        }
      }
    } catch {
      // ponytail: fallback to empty diagram on error
      const fallback = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: { viewBackgroundColor: "#ffffff", gridSize: null },
        files: {},
      });
      dataStream.write({
        type: "data-diagramDelta",
        data: fallback,
        transient: true,
      });
      return fallback;
    }

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    try {
      const { stream } = streamText({
        maxOutputTokens: 32_000,
        model: getLanguageModel(modelId),
        instructions: `${updateDocumentPrompt(document.content, "diagram")}\n\nYou MUST output a complete Excalidraw JSON file. Follow the same format as the current content. Output ONLY the JSON, no markdown fences, no explanations.`,
        prompt: description,
      });

      for await (const delta of stream) {
        if (delta.type === "text-delta") {
          draftContent += delta.text;
          dataStream.write({
            type: "data-diagramDelta",
            data: stripFences(draftContent),
            transient: true,
          });
        }
      }
    } catch {
      const fallback = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [],
        appState: { viewBackgroundColor: "#ffffff", gridSize: null },
        files: {},
      });
      dataStream.write({
        type: "data-diagramDelta",
        data: fallback,
        transient: true,
      });
      return fallback;
    }

    return stripFences(draftContent);
  },
});
