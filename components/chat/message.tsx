"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { DynamicToolUIPart } from "ai";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import {
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
} from "@/components/ai-elements/tool";

import { Calculator } from "@/components/chat/calculator";
import { CardCarousel } from "@/components/chat/card-carousel";
import { CurrencyConverter } from "@/components/chat/currency-converter";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { DocumentToolResult } from "@/components/chat/document";
import { DocumentPreview } from "@/components/chat/document-preview";
import { SparklesIcon } from "@/components/chat/icons";
import { ImageCarousel } from "@/components/chat/image-carousel";
import { ImageGrid } from "@/components/chat/image-grid";
import { LocalTime } from "@/components/chat/local-time";
import {
  getMCPAppMetadata,
  isMCPAppPart,
  MCPAppRenderer,
} from "@/components/chat/mcp-app-renderer";
import { MessageActions } from "@/components/chat/message-actions";
import { PreviewAttachment } from "@/components/chat/preview-attachment";
import {
  extractImageSearchResults,
  extractSearchResults,
  SearchSourcesBar,
} from "@/components/chat/search-sources";
import {
  getDomain,
  useSearchSourcesPanel,
} from "@/components/chat/search-sources-context";
import { Timer } from "@/components/chat/timer";
import { UnitConverter } from "@/components/chat/unit-converter";
import { VideoInline } from "@/components/chat/video-inline";
import { Weather } from "@/components/chat/weather";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import type { GeneratedImage } from "@/lib/ai/tools/generate-image";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";

function CollapsibleUserMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 420 || text.split("\n").length > 8;

  return (
    <MessageContent
      className={cn(
        "w-fit max-w-[min(80%,56ch)] overflow-hidden wrap-break-word rounded-2xl rounded-br-lg border border-border/30 bg-linear-to-br from-secondary to-muted px-3.5 py-2 shadow-(--shadow-card) text-sm leading-[1.65]",
        !expanded && isLong && "max-h-72"
      )}
      data-testid="message-content"
    >
      <div className="relative">
        <MessageResponse>{sanitizeText(text)}</MessageResponse>
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-muted to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          className="mt-2 flex items-center gap-1 text-muted-foreground text-xs font-medium transition-colors hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </MessageContent>
  );
}

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" &&
        "text" in part &&
        part.text?.trim().length > 0) ||
      part.type.startsWith("tool-")
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;

  const {
    messageId: activeMessageId,
    openPanel,
    closePanel,
  } = useSearchSourcesPanel();
  const isActive = activeMessageId === message.id;
  const searchResults = extractSearchResults(message);
  const imageResults = extractImageSearchResults(message);
  const hasSources = searchResults.length > 0;
  const hasImages = imageResults.length > 0;
  const searchDomains = [
    ...new Set(searchResults.map((r) => r.domain ?? getDomain(r.url))),
  ];

  const hasImageGenTool = message.parts?.some(
    (part) => part.type === "tool-generateImageTool"
  );

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => {
        // Skip image attachments when the message already renders a
        // generateImage tool output (collage) — avoids duplicate images.
        if (
          hasImageGenTool &&
          attachment.mediaType?.startsWith("image/")
        ) {
          return null;
        }

        const name =
          "name" in attachment && typeof attachment.name === "string"
            ? attachment.name
            : "filename" in attachment &&
                typeof attachment.filename === "string"
              ? attachment.filename
              : "file";

        return (
          <PreviewAttachment
            attachment={{
              name,
              contentType: attachment.mediaType,
              url: attachment.url,
              providerReference: attachment.providerReference,
            }}
            key={attachment.url ?? `${name}-${attachment.mediaType}`}
          />
        );
      })}
    </div>
  );

  const lastCreateDocIndex =
    message.parts?.reduce<number>((acc, part, i) => {
      return part.type === "tool-createDocument" ? i : acc;
    }, -1) ?? -1;

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      const mergedReasoning = message.parts!.reduce(
        (acc, p) => {
          if (p.type === "reasoning" && p.text?.trim().length > 0) {
            const providerMetadata = (
              p as {
                providerMetadata?: {
                  chatbot?: { thinkingDurationSeconds?: number };
                };
              }
            ).providerMetadata;
            return {
              text: acc.text
                ? `${acc.text}\n\n${p.text}`
                : p.text,
              isStreaming:
                "state" in p ? p.state === "streaming" : false,
              durationSeconds:
                providerMetadata?.chatbot?.thinkingDurationSeconds ??
                acc.durationSeconds,
            };
          }
          return acc;
        },
        {
          text: "",
          isStreaming: false,
          durationSeconds: undefined as number | undefined,
        }
      );

      // Only render the merged reasoning block once — on the first
      // reasoning part. Subsequent reasoning parts return null so we
      // don't duplicate the block.
      if (index !==
        message.parts!.findIndex((p) => p.type === "reasoning")
      ) {
        return null;
      }

      if (mergedReasoning.text) {
        return (
          <Reasoning
            className="w-full max-w-[min(95%,80ch)]"
            defaultOpen={mergedReasoning.isStreaming || isLoading}
            duration={mergedReasoning.durationSeconds}
            isStreaming={mergedReasoning.isStreaming || isLoading}
            key={key}
          >
            <ReasoningTrigger />
            <ReasoningContent>{mergedReasoning.text}</ReasoningContent>
          </Reasoning>
        );
      }
      return null;
    }

    if (type === "text") {
      if (isUser) {
        return <CollapsibleUserMessage key={key} text={part.text} />;
      }

      return (
        <MessageContent
          className={cn("text-sm leading-[1.65]", {
            "w-fit max-w-[min(80%,56ch)] overflow-hidden wrap-break-word rounded-2xl rounded-br-lg border border-border/30 bg-linear-to-br from-secondary to-muted px-3.5 py-2 shadow-(--shadow-card)":
              message.role === "user",
          })}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
      );
    }

    if (
      type === "tool-getWeather" ||
      type === "tool-calculator" ||
      type === "tool-timer" ||
      type === "tool-currencyConverter" ||
      type === "tool-unitConverter" ||
      type === "tool-localTime" ||
      type === "tool-playVideo"
    ) {
      const { state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved ===
            false);
      const widthClass = "w-[min(100%,450px)]";
      const toolName = type.replace("tool-", "");

      if (state === "output-available") {
        const output = part.output;
        let content: import("react").ReactNode;
        switch (toolName) {
          case "getWeather":
            content = <Weather weatherAtLocation={output} />;
            break;
          case "calculator":
            content = <Calculator result={output} />;
            break;
          case "timer":
            content = <Timer data={output} />;
            break;
          case "currencyConverter":
            content = <CurrencyConverter result={output} />;
            break;
          case "unitConverter":
            content = <UnitConverter result={output} />;
            break;
          case "localTime":
            content = <LocalTime result={output} />;
            break;
          case "playVideo":
            content = (
              <VideoInline
                title={
                  (output as { videoUrl: string; videoTitle?: string })
                    .videoTitle
                }
                videoUrl={(output as { videoUrl: string }).videoUrl}
              />
            );
            break;
          default:
            content = null;
        }
        return (
          <div className={widthClass} key={key}>
            {content}
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={key}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state="output-denied" type={type} />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  {toolName} was denied.
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={key}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state={state} type={type} />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={key}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type={type} />
            <ToolContent>
              {(state === "input-available" ||
                state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
              {state === "approval-requested" && approvalId && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  <button
                    className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: `User denied ${toolName}`,
                      });
                    }}
                    type="button"
                  >
                    Deny
                  </button>
                  <button
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                    type="button"
                  >
                    Allow
                  </button>
                </div>
              )}
            </ToolContent>
          </Tool>
        </div>
      );
    }

    if (type === "tool-createDocument") {
      // Skip duplicate createDocument calls — only render the last one
      if (index !== lastCreateDocIndex) {
        return null;
      }
      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={key}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={key}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={key}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={key}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { state } = part;

      return (
        <Tool className="w-[min(100%,450px)]" defaultOpen={true} key={key}>
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" &&
              ("error" in part.output ? (
                <div className="rounded border p-2 text-red-500">
                  Error: {String(part.output.error)}
                </div>
              ) : (
                <DocumentToolResult
                  isReadonly={isReadonly}
                  result={part.output}
                  type="request-suggestions"
                />
              ))}
          </ToolContent>
        </Tool>
      );
    }

    if ((type as string) === "tool-generateImageTool") {
      const { state } = part as { state?: string };
      const input = (part as { input?: { display?: string } }).input;
      const shouldShow = input?.display === "on";

      if (
        shouldShow &&
        state === "output-available" &&
        (part as { output?: unknown }).output
      ) {
        const images = (part as { output?: { images?: GeneratedImage[] } })
          .output?.images;
        if (images?.length) {
          return <ImageGrid images={images} key={key} />;
        }
      }

      return null;
    }

    if (type === "tool-renderCards") {
      const { state } = part;

      if (state === "output-available" && part.output) {
        return <CardCarousel data={part.output} key={key} />;
      }

      return null;
    }

    if (type === "tool-clientHttpRequest") {
      return null;
    }

    // Check for MCP App tools and render them in iframe
    if (isMCPAppPart(part)) {
      const appMeta = getMCPAppMetadata(part);
      if (appMeta) {
        const state = (part as { state?: string }).state ?? "input-available";
        const widthClass = "w-[min(100%,650px)]";
        const partType = (part as { type?: string }).type || "dynamic-tool";
        const toolName = (part as { toolName?: string }).toolName ?? "mcp-app";
        const toolInput =
          (part as { input?: Record<string, unknown> }).input ?? {};
        const toolOutput = (part as { output?: unknown }).output;
        const toolCallId = (part as { toolCallId?: string }).toolCallId ?? "";

        if (state === "output-available") {
          return (
            <div className={widthClass} key={key}>
              <Tool className="w-full" defaultOpen={true}>
                <ToolHeader
                  state={state}
                  toolName={toolName}
                  type={partType as "dynamic-tool"}
                />
                <ToolContent>
                  <ToolInput input={toolInput} />
                  <MCPAppRenderer
                    handlers={{
                      callTool: async (params) => {
                        const response = await fetch("/api/mcp-app-host/tool", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: params.name,
                            arguments: params.arguments,
                            serverId: appMeta.serverId,
                          }),
                        });
                        if (!response.ok) {
                          throw new Error("Tool call failed");
                        }
                        return response.json();
                      },
                    }}
                    input={toolInput}
                    metadata={appMeta}
                    output={toolOutput}
                    toolCallId={toolCallId}
                  />
                </ToolContent>
              </Tool>
            </div>
          );
        }

        // Show loading state for MCP App tools
        return (
          <div className={widthClass} key={key}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader
                state={state as DynamicToolUIPart["state"]}
                toolName={toolName}
                type="dynamic-tool"
              />
              <ToolContent>
                <ToolInput input={toolInput} />
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  Loading MCP App...
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }
    }

    // Hide tools that don't have a custom UI component — only tools
    // with dedicated renderers above (weather, calculator, etc.) are shown.
    return null;
  });

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      vote={vote}
    />
  );

  const content = isThinking ? (
    <div className="flex h-[calc(13px*1.65)] items-center text-sm leading-[1.65]">
      <ShimmeringText className="font-medium" duration={2} text="Thinking..." />
    </div>
  ) : (
    <>
      {attachments}
      {isAssistant && hasImages && <ImageCarousel images={imageResults} />}
      {parts}
      {isAssistant && hasSources && (
        <SearchSourcesBar
          active={isActive}
          count={searchResults.length}
          domains={searchDomains}
          onToggle={() =>
            isActive
              ? closePanel()
              : openPanel(searchResults, imageResults, message.id)
          }
        />
      )}
      {actions}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-2" : "flex items-start gap-3"
        )}
      >
        {isAssistant && (
          <div
            className="flex h-[calc(13px*1.65)] shrink-0 items-center"
            data-personalize-avatar
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border/50">
              <SparklesIcon size={13} />
            </div>
          </div>
        )}
        {isAssistant ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">{content}</div>
        ) : (
          content
        )}
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-[calc(13px*1.65)] shrink-0 items-center"
          data-personalize-avatar
        >
          <div className="flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <SparklesIcon size={13} />
          </div>
        </div>

        <div className="flex h-[calc(13px*1.65)] items-center text-sm leading-[1.65]">
          <ShimmeringText
            className="font-medium"
            duration={2}
            text="Thinking..."
          />
        </div>
      </div>
    </div>
  );
};
