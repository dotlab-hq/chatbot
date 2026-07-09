"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import type { ActivityItem } from "@/components/chat/activity-panel-context";
import { useActivityPanel } from "@/components/chat/activity-panel-context";
import { AgentContextPanel } from "@/components/chat/agent-context-panel";
import { Calculator } from "@/components/chat/calculator";
import { CardCarousel } from "@/components/chat/card-carousel";
import { CurrencyConverter } from "@/components/chat/currency-converter";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { DocumentToolResult } from "@/components/chat/document";
import { DocumentPreview } from "@/components/chat/document-preview";
import { SparklesIcon } from "@/components/chat/icons";
import { ImageCarousel } from "@/components/chat/image-carousel";
import { LocalTime } from "@/components/chat/local-time";
import { MessageActions } from "@/components/chat/message-actions";
import { MessageReasoning } from "@/components/chat/message-reasoning";
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
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";

function formatToolName(type: string) {
  return type
    .replace(/^tool-/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function getOutputDomains(output: unknown) {
  if (!Array.isArray(output)) {
    return [];
  }

  return [
    ...new Set(
      output
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const value =
            "domain" in item
              ? item.domain
              : "url" in item
                ? getDomain(String(item.url))
                : "pageUrl" in item
                  ? getDomain(String(item.pageUrl))
                  : null;
          return typeof value === "string" ? value : null;
        })
        .filter((domain): domain is string => Boolean(domain))
    ),
  ];
}

function buildActivityItems(message: ChatMessage, reasoning: string) {
  const items: ActivityItem[] = [];

  if (reasoning.trim()) {
    const chunks = reasoning
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (const [index, chunk] of chunks.entries()) {
      const [firstLine, ...rest] = chunk.split("\n");
      items.push({
        id: `reasoning-${index}`,
        title: firstLine.slice(0, 90),
        body: rest.join("\n").trim() || undefined,
      });
    }
  }

  for (const [index, part] of message.parts.entries()) {
    if (!part.type.startsWith("tool-") || !("state" in part)) {
      continue;
    }

    const domains = getOutputDomains(
      "output" in part ? part.output : undefined
    );
    const state = String(part.state);
    const partType = String(part.type);
    const isSearch =
      partType === "tool-webSearch" ||
      partType === "tool-webSearchExtract" ||
      partType === "tool-webImageSearch";

    items.push({
      id: `tool-${index}`,
      title: isSearch
        ? state === "output-available"
          ? "Searched the web"
          : "Browsing sources"
        : formatToolName(partType),
      body:
        state === "output-available"
          ? undefined
          : "Waiting for this tool to finish.",
      domains,
      status: state === "output-available" ? "complete" : "running",
    });
  }

  return items.length > 0
    ? items
    : [
        {
          id: "thinking",
          title: "Constructing a concise answer",
          body: "No detailed thinking transcript was saved for this message.",
        },
      ];
}

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
  const { messageId: activeActivityMessageId, openPanel: openActivityPanel } =
    useActivityPanel();

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

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
            providerReference: attachment.providerReference,
          }}
          key={
            attachment.url ?? `${attachment.filename}-${attachment.mediaType}`
          }
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        const providerMetadata = (
          part as {
            providerMetadata?: { thinkingDurationSeconds?: number };
          }
        ).providerMetadata;
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          durationSeconds:
            providerMetadata?.thinkingDurationSeconds ?? acc.durationSeconds,
          rendered: false,
        };
      }
      return acc;
    },
    {
      text: "",
      isStreaming: false,
      durationSeconds: undefined as number | undefined,
      rendered: false,
    }
  ) ?? {
    text: "",
    isStreaming: false,
    durationSeconds: undefined,
    rendered: false,
  };
  const activityItems = useMemo(
    () => buildActivityItems(message, mergedReasoning.text),
    [message, mergedReasoning.text]
  );

  // Deduplicate: only show the last createDocument tool call
  const lastCreateDocIndex =
    message.parts?.reduce<number>((acc, part, i) => {
      return part.type === "tool-createDocument" ? i : acc;
    }, -1) ?? -1;

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            isOpen={activeActivityMessageId === message.id}
            key={key}
            onOpenActivity={(durationSeconds) =>
              openActivityPanel(
                activityItems,
                message.id,
                durationSeconds ?? mergedReasoning.durationSeconds
              )
            }
            reasoning={mergedReasoning.text}
            savedDurationSeconds={mergedReasoning.durationSeconds}
            timelineItems={activityItems}
          />
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
      const { toolCallId, state } = part;
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
          <div className={widthClass} key={toolCallId}>
            {content}
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
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
          <div className={widthClass} key={toolCallId}>
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
        <div className={widthClass} key={toolCallId}>
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
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    if (type === "tool-renderCards") {
      const { toolCallId, state } = part;

      if (state === "output-available" && part.output) {
        return <CardCarousel data={part.output} key={toolCallId} />;
      }

      return null;
    }

    if (type === "tool-clientHttpRequest") {
      const { toolCallId, state } = part;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = part as any;
      const inp = p.input as
        | {
            requests: Array<{
              method: string;
              url: string;
              headers?: Record<string, string>;
              body?: string;
              timeout?: number;
              referrerPolicy?: string;
            }>;
          }
        | undefined;
      const out = p.output as
        | {
            results: Array<{
              request: {
                method: string;
                url: string;
              };
              response?: {
                status?: number;
                statusText?: string;
                body?: unknown;
              };
              error?: string;
              ok?: boolean;
            }>;
          }
        | undefined;
      const errText = p.errorText as string | undefined;

      const methodColor = (method: string) => {
        switch (method) {
          case "GET":
            return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400";
          case "POST":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400";
          case "PUT":
            return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400";
          case "PATCH":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400";
          case "DELETE":
            return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
          default:
            return "";
        }
      };

      const statusBadge = (status?: number) => {
        if (status === undefined) {
          return "";
        }
        if (status < 300) {
          return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400";
        }
        if (status < 500) {
          return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400";
        }
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400";
      };

      return (
        <Tool
          className="w-[min(100%,650px)]"
          defaultOpen={false}
          key={toolCallId}
        >
          <ToolHeader
            state={state}
            title={
              inp?.requests && inp.requests.length > 1
                ? `HTTP Requests (${inp.requests.length})`
                : "HTTP Request"
            }
            type={type}
          />
          <ToolContent>
            {state === "output-error" && (
              <ToolOutput
                errorText={errText ?? "Request failed"}
                output={null}
              />
            )}
            {state === "output-available" && out?.results && (
              <div className="space-y-4">
                {out.results.map((result) => {
                  const sc = result.response?.status;
                  return (
                    <div
                      className="rounded-lg border p-3"
                      key={`${result.request.method}-${result.request.url}-${sc ?? "pending"}`}
                    >
                      {/* Request line */}
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold uppercase",
                            methodColor(result.request.method)
                          )}
                        >
                          {result.request.method}
                        </span>
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {result.request.url}
                        </span>
                      </div>
                      {/* Response info */}
                      {result.error ? (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Error: {result.error}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {sc !== undefined && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold tabular-nums",
                                  statusBadge(sc)
                                )}
                              >
                                {sc} {result.response?.statusText ?? ""}
                              </span>
                            )}
                            <span className="text-muted-foreground text-xs">
                              {result.ok === true
                                ? "Success"
                                : result.ok === false
                                  ? "Failed"
                                  : ""}
                            </span>
                          </div>
                          <ToolOutput
                            errorText={undefined}
                            output={
                              result.response?.body ? (
                                <CodeBlock
                                  code={JSON.stringify(
                                    result.response.body,
                                    null,
                                    2
                                  )}
                                  language="json"
                                />
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  No response body
                                </span>
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {state !== "output-available" &&
              state !== "output-error" &&
              inp?.requests && (
                <div className="space-y-3">
                  {inp.requests.map((req) => (
                    <div
                      className="flex items-center gap-2"
                      key={`${req.method}-${req.url}`}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold uppercase",
                          methodColor(req.method)
                        )}
                      >
                        {req.method}
                      </span>
                      <span className="truncate font-mono text-sm">
                        {req.url}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </ToolContent>
        </Tool>
      );
    }

    if (type.startsWith("tool-")) {
      const toolPart = part as {
        toolCallId?: string;
        state?: string;
        input?: unknown;
        output?: unknown;
        errorText?: string;
      };
      const toolName = type.replace("tool-", "");
      const state = (toolPart.state ?? "input-available") as ToolPart["state"];
      const toolType = type as ToolUIPart["type"];

      return (
        <Tool
          className="w-[min(100%,680px)] overflow-hidden border-border/60 bg-card/70 shadow-sm"
          defaultOpen={state !== "output-available"}
          key={toolPart.toolCallId ?? key}
        >
          <ToolHeader state={state} title={toolName} type={toolType} />
          <ToolContent>
            {(state === "input-streaming" ||
              state === "input-available" ||
              state === "approval-requested" ||
              state === "approval-responded") &&
              toolPart.input !== undefined && (
                <ToolInput input={toolPart.input as ToolPart["input"]} />
              )}
            {(state === "output-available" || state === "output-error") && (
              <ToolOutput
                errorText={toolPart.errorText}
                output={toolPart.output as ToolPart["output"]}
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

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
      {isAssistant && isLoading && (
        <AgentContextPanel chatId={chatId} className="mb-1" />
      )}
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
