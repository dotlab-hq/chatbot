import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { calculator } from "@/lib/ai/tools/calculator";
import type { clientHttpRequest } from "@/lib/ai/tools/client-http-request";
import type { createDocument } from "@/lib/ai/tools/create-document";
import type { currencyConverter } from "@/lib/ai/tools/currency-converter";
import type { getWeather } from "@/lib/ai/tools/get-weather";
import type { localTime } from "@/lib/ai/tools/local-time";
import type { playVideo } from "@/lib/ai/tools/play-video";
import type { renderCards } from "@/lib/ai/tools/render-cards";
import type { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import type { timer } from "@/lib/ai/tools/timer";
import type { unitConverter } from "@/lib/ai/tools/unit-converter";
import type { updateDocument } from "@/lib/ai/tools/update-document";
import type { Suggestion } from "@/lib/db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type calculatorTool = InferUITool<typeof calculator>;
type timerTool = InferUITool<typeof timer>;
type currencyConverterTool = InferUITool<typeof currencyConverter>;
type unitConverterTool = InferUITool<typeof unitConverter>;
type localTimeTool = InferUITool<typeof localTime>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type playVideoTool = InferUITool<typeof playVideo>;
type renderCardsTool = InferUITool<typeof renderCards>;
type clientHttpRequestTool = InferUITool<typeof clientHttpRequest>;

export type ChatTools = {
  getWeather: weatherTool;
  calculator: calculatorTool;
  timer: timerTool;
  currencyConverter: currencyConverterTool;
  unitConverter: unitConverterTool;
  localTime: localTimeTool;
  playVideo: playVideoTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  renderCards: renderCardsTool;
  clientHttpRequest: clientHttpRequestTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  svgDelta: string;
  htmlDelta: string;
  diagramDelta: string;
  videoDelta: string;
  videoMetadata: any;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "subagent-step": {
    tool: string;
    status: "running" | "streaming" | "complete" | "error";
    step?: number;
    message?: string;
    error?: string;
    task?: string;
  };
  "todo-update": {
    items: Array<{
      id: string;
      text: string;
      done: boolean;
      order: number;
    }>;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url?: string;
  contentType: string;
  providerReference?: Record<string, string>;
};
