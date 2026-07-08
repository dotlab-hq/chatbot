"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  projectId: string | null;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);

  // Track tool call IDs that have already triggered an auto-send in
  // sendAutomaticallyWhen. This prevents infinite loops where the AI SDK
  // fires sendAutomaticallyWhen both when a tool call is added AND when the
  // stream finishes — without this, the tool-call part (still in
  // "output-available" state after the LLM responds) would trigger another
  // resubmission, creating a continuous loop.
  const autoSentToolCallIds = useRef(new Set<string>());

  const [projectId, setProjectId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("projectId");
    }
    return null;
  });
  const projectIdRef = useRef(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);
  useEffect(() => {
    if (isNewChat) {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get("projectId");
      if (pid) {
        setProjectId(pid);
      }
    }
  }, [isNewChat]);

  const messagesUrl = isNewChat
    ? null
    : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}${projectIdRef.current ? `&projectId=${encodeURIComponent(projectIdRef.current)}` : ""}`;
  const { data: chatData, isLoading } = useSWR(messagesUrl, fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!isNewChat && chatData?.projectId) {
      setProjectId(chatData.projectId);
    }
  }, [isNewChat, chatData?.projectId]);

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
    addToolOutput,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      // Auto-send when the user approved a tool (human-in-the-loop)
      const hasApproval =
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false;
      if (hasApproval) {
        return true;
      }

      // Auto-send when a client-side tool (like clientHttpRequest) has its
      // output available — the onToolCall handler called addToolOutput with
      // the result, and we need to send it back to the LLM for continuation.
      //
      // IMPORTANT: Only match known CLIENT-SIDE tools (those handled in
      // onToolCall). Server-side tools (getWeather, calculator, etc.) already
      // return their results from the server — matching them here would cause
      // an unwanted re-submission and a second LLM call.
      //
      // Also track which toolCallIds have already triggered an auto-send to
      // prevent infinite loops. The AI SDK fires this callback BOTH when a
      // tool call is added AND when the stream finishes.
      for (const part of lastMessage?.parts ?? []) {
        if (
          part.type === "tool-clientHttpRequest" &&
          "state" in part &&
          part.state === "output-available" &&
          "output" in part &&
          "toolCallId" in part
        ) {
          const toolCallId = (part as { toolCallId: string }).toolCallId;
          if (!autoSentToolCallIds.current.has(toolCallId)) {
            autoSentToolCallIds.current.add(toolCallId);
            return true;
          }
        }
      }
      return false;
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic) {
        return;
      }
      if (toolCall.toolName === "clientHttpRequest") {
        const { requests } = toolCall.input as {
          requests: Array<{
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            url: string;
            headers?: Record<string, string>;
            body?: string;
            timeout?: number;
            referrerPolicy?:
              | "no-referrer"
              | "no-referrer-when-downgrade"
              | "origin"
              | "origin-when-cross-origin"
              | "same-origin"
              | "strict-origin"
              | "strict-origin-when-cross-origin"
              | "unsafe-url";
          }>;
        };

        const executeSingleRequest = async (
          req: (typeof requests)[number]
        ): Promise<{
          request: {
            method: string;
            url: string;
            headers?: Record<string, string>;
            body: string | null;
            referrerPolicy: string;
          };
          response?: {
            status: number;
            statusText: string;
            headers: Record<string, string>;
            body: unknown;
          };
          error?: string;
          ok?: boolean;
        }> => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            req.timeout ?? 10_000
          );
          try {
            const response = await fetch(req.url, {
              method: req.method,
              headers: req.headers ?? { "Content-Type": "application/json" },
              body:
                req.body && ["POST", "PUT", "PATCH"].includes(req.method)
                  ? req.body
                  : undefined,
              signal: controller.signal,
              referrerPolicy: (req.referrerPolicy ??
                "unsafe-url") as ReferrerPolicy,
            });
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              responseHeaders[key] = value;
            });
            const contentType = response.headers.get("content-type") || "";
            let responseBody: unknown;
            try {
              const text = await response.text();
              if (contentType.includes("application/json")) {
                responseBody = JSON.parse(text);
              } else {
                responseBody = text;
              }
            } catch {
              responseBody = "(binary or unreadable response)";
            }
            return {
              request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body ?? null,
                referrerPolicy: (req.referrerPolicy ?? "no-referrer") as
                  | "no-referrer"
                  | "no-referrer-when-downgrade"
                  | "origin"
                  | "origin-when-cross-origin"
                  | "same-origin"
                  | "strict-origin"
                  | "strict-origin-when-cross-origin"
                  | "unsafe-url",
              },
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseBody,
              },
              ok: response.ok,
            };
          } catch (err) {
            return {
              request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body ?? null,
                referrerPolicy: (req.referrerPolicy ?? "no-referrer") as
                  | "no-referrer"
                  | "no-referrer-when-downgrade"
                  | "origin"
                  | "origin-when-cross-origin"
                  | "same-origin"
                  | "strict-origin"
                  | "strict-origin-when-cross-origin"
                  | "unsafe-url",
              },
              error: err instanceof Error ? err.message : String(err),
            };
          } finally {
            clearTimeout(timeoutId);
          }
        };

        const results = await Promise.all(requests.map(executeSingleRequest));

        addToolOutput({
          tool: "clientHttpRequest",
          toolCallId: toolCall.toolCallId,
          output: { results },
        });
      }
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" ||
                state === "output-denied" ||
                state === "output-available"
              );
            })
          );

        return {
          body: {
            ...request.body,
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            ...(projectIdRef.current
              ? { projectId: projectIdRef.current }
              : {}),
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setShowCreditCardAlert(true);
      } else if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else {
        toast({
          type: "error",
          description: error.message || "Oops, an error occurred!",
        });
      }
    },
  });

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  useEffect(() => {
    if (chatData && !isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [chatData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [sendMessage, chatId]);

  useAutoResume({
    autoResume: !isNewChat && !!chatData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  // Track chat title for document.title
  const [chatTitle, setChatTitle] = useState<string | null>(() => {
    if (!isNewChat) {
      return null;
    }
    return "New Chat";
  });

  useEffect(() => {
    if (chatData?.title) {
      setChatTitle(chatData.title);
    }
  }, [chatData?.title]);

  useEffect(() => {
    if (chatTitle) {
      document.title = chatTitle;
    }
  }, [chatTitle]);

  const { data: votes } = useSWR<Vote[]>(
    !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      setInput,
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      setCurrentModelId,
      projectId,
      showCreditCardAlert,
      setShowCreditCardAlert,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      projectId,
      showCreditCardAlert,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
