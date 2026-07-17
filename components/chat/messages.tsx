import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { Greeting } from "@/components/chat/greeting";
import { PreviewMessage, ThinkingMessage } from "@/components/chat/message";
import {
  SearchSourcesProvider,
  useSearchSourcesPanel,
} from "@/components/chat/search-sources-context";
import { SearchSourcesPanel } from "@/components/chat/search-sources-panel";
import { TodoList } from "@/components/chat/todo-list";
import { MessageScroller } from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    hasSentMessage,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Messages scroll area */}
      <MessageScroller.Provider>
        <div className="relative min-w-0 flex-1 bg-background">
          {messages.length === 0 && !isLoading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <Greeting />
            </div>
          )}
          <MessageScroller.Viewport
            className={cn(
              "absolute inset-0 touch-pan-y overflow-y-auto",
              messages.length > 0 ? "bg-background" : "bg-transparent"
            )}
            ref={messagesContainerRef}
            style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
          >
            <MessageScroller.Content className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-5 px-2 py-6 md:gap-7 md:px-4">
              <TodoList />

              {isLoading ? (
                <MessageSkeletons />
              ) : (
                messages.map((message, index) => (
                  <MessageScroller.Item
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={index === messages.length - 1}
                  >
                    <PreviewMessage
                      addToolApprovalResponse={addToolApprovalResponse}
                      chatId={chatId}
                      isLoading={
                        status === "streaming" && messages.length - 1 === index
                      }
                      isReadonly={isReadonly}
                      message={message}
                      onEdit={onEditMessage}
                      regenerate={regenerate}
                      requiresScrollPadding={
                        hasSentMessage && index === messages.length - 1
                      }
                      setMessages={setMessages}
                      vote={
                        votes
                          ? votes.find((vote) => vote.messageId === message.id)
                          : undefined
                      }
                    />
                  </MessageScroller.Item>
                ))
              )}

              {status === "submitted" &&
                !isLoading &&
                messages.at(-1)?.role !== "assistant" && <ThinkingMessage />}

              <div className="min-h-6 min-w-6 shrink-0" ref={messagesEndRef} />
            </MessageScroller.Content>
          </MessageScroller.Viewport>

          <MessageScroller.Button
            aria-label="Scroll to bottom"
            className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-(--shadow-float) backdrop-blur-lg transition-all duration-200 h-7 text-[10px] ${
              isAtBottom
                ? "pointer-events-none scale-90 opacity-0"
                : "pointer-events-auto scale-100 opacity-100"
            }`}
            direction="end"
            type="button"
          >
            <ArrowDownIcon className="size-3 text-muted-foreground" />
          </MessageScroller.Button>
        </div>
      </MessageScroller.Provider>

      {/* Sources side panel */}
      <SourcesPanelSlot />
    </div>
  );
}

function MessageSkeletons() {
  // Alternating user/assistant placeholders that mimic real message widths.
  const rows = [
    { align: "items-end", width: "w-2/5", extra: false },
    { align: "items-start", width: "w-3/4", extra: true },
    { align: "items-end", width: "w-1/3", extra: false },
    { align: "items-start", width: "w-2/3", extra: true },
  ];
  return (
    <div aria-busy="true" className="flex flex-col gap-5 md:gap-7">
      {rows.map((row) => (
        <div className={cn("flex flex-col gap-2", row.align)} key={row.width}>
          <Skeleton className={cn("h-4 rounded-md", row.width)} />
          <Skeleton className="h-4 w-4/5 rounded-md" />
          {row.extra && <Skeleton className="h-4 w-2/5 rounded-md" />}
        </div>
      ))}
    </div>
  );
}

function SourcesPanelSlot() {
  const { open, results, imageResults, closePanel } = useSearchSourcesPanel();
  if (!open || (results.length === 0 && imageResults.length === 0)) {
    return null;
  }
  return (
    <SearchSourcesPanel
      imageResults={imageResults}
      onClose={closePanel}
      results={results}
    />
  );
}

function WrappedMessages(props: MessagesProps) {
  return (
    <SearchSourcesProvider>
      <PureMessages {...props} />
    </SearchSourcesProvider>
  );
}

export const Messages = WrappedMessages;
