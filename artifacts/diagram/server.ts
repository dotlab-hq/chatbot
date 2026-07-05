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

const DIAGRAM_CREATE_INSTRUCTIONS = `You are a diagram generator that creates Excalidraw diagrams. Output a JSON object representing an Excalidraw file.

OUTPUT FORMAT — output ONLY the JSON, no markdown fences, no explanations:
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ ... ],
  "appState": { "viewBackgroundColor": "#ffffff", "gridSize": null },
  "files": {}
}

ELEMENT TYPES AND FIELDS:

Rectangle: { "type":"rectangle", "id":"...", "x":0, "y":0, "width":200, "height":100, "angle":0, "strokeColor":"#1e1e1e", "backgroundColor":"transparent", "fillStyle":"solid", "strokeWidth":2, "strokeStyle":"solid", "roughness":1, "opacity":100, "groupIds":[], "frameId":null, "roundness":{"type":3}, "seed":1234, "version":1, "versionNonce":1234, "isDeleted":false, "boundElements":null, "updated":1, "link":null, "locked":false }

Ellipse: same as rectangle but "type":"ellipse", "roundness":{"type":2}

Diamond: same as rectangle but "type":"diamond", "roundness":{"type":2}

Text: { "type":"text", "id":"...", "x":0, "y":0, "width":100, "height":25, "angle":0, "strokeColor":"#1e1e1e", "backgroundColor":"transparent", "fillStyle":"solid", "strokeWidth":2, "strokeStyle":"solid", "roughness":1, "opacity":100, "groupIds":[], "frameId":null, "roundness":null, "seed":1234, "version":1, "versionNonce":1234, "isDeleted":false, "boundElements":null, "updated":1, "link":null, "locked":false, "text":"Hello", "fontSize":20, "fontFamily":1, "textAlign":"left", "verticalAlign":"top", "containerId":null, "originalText":"Hello", "autoResize":true, "lineHeight":1.25 }

Arrow: { "type":"arrow", "id":"...", "x":0, "y":0, "width":200, "height":0, "angle":0, "strokeColor":"#1e1e1e", "backgroundColor":"transparent", "fillStyle":"solid", "strokeWidth":2, "strokeStyle":"solid", "roughness":1, "opacity":100, "groupIds":[], "frameId":null, "roundness":{"type":2}, "seed":1234, "version":1, "versionNonce":1234, "isDeleted":false, "boundElements":null, "updated":1, "link":null, "locked":false, "points":[[0,0],[200,0]], "lastCommittedPoint":null, "startBinding":null, "endBinding":null, "startArrowhead":null, "endArrowhead":"arrow" }

Line: same as arrow but "type":"line", "startArrowhead":null, "endArrowhead":null

ARROW BINDING (to connect shapes):
"startBinding": { "elementId": "target-id", "focus": 0, "gap": 5, "fixedPoint": null }
"endBinding": { "elementId": "target-id", "focus": 0, "gap": 5, "fixedPoint": null }
The bound shape must have a matching "boundElements": [{ "id": "arrow-id", "type": "arrow" }]

COLOR PALETTE:
Blue: #4a9eed, Amber: #f59e0b, Green: #22c55e, Red: #ef4444
Purple: #8b5cf6, Pink: #ec4899, Cyan: #06b6d4, Lime: #84cc16
Pastel fills: Light Blue: #dbeafe, Light Green: #dcfce7, Light Orange: #ffedd5
Light Purple: #ede9fe, Light Red: #fee2e2, Light Yellow: #fef9c3

RULES:
1. Use unique IDs for every element (random strings like "abc123")
2. For bound text inside a shape, set containerId on the text element and add boundElements on the shape
3. Layout elements with reasonable spacing (at least 50px gaps)
4. Use groupIds to group related elements
5. Keep it clean and readable — good spacing, logical layout
6. For flowcharts: boxes for steps, diamonds for decisions, arrows for flow
7. For architecture diagrams: labeled boxes with connecting arrows
8. Output valid JSON with no trailing commas or comments`;

export const diagramDocumentHandler = createDocumentHandler<"diagram">({
  kind: "diagram",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    let draftContent = "";

    const { stream } = streamText({
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

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    const { stream } = streamText({
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

    return stripFences(draftContent);
  },
});
