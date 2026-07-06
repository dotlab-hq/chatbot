import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { calculator } from "@/lib/ai/tools/calculator";
import type { createDocument } from "@/lib/ai/tools/create-document";
import type { currencyConverter } from "@/lib/ai/tools/currency-converter";
import type { getWeather } from "@/lib/ai/tools/get-weather";
import type { localTime } from "@/lib/ai/tools/local-time";
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

export type ChatTools = {
  getWeather: weatherTool;
  calculator: calculatorTool;
  timer: timerTool;
  currencyConverter: currencyConverterTool;
  unitConverter: unitConverterTool;
  localTime: localTimeTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  renderCards: typeof import("@/lib/ai/tools/render-cards").renderCards;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  svgDelta: string;
  htmlDelta: string;
  diagramDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
