import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { checkBotId } from "botid/server";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import { generateTitleFromUserMessage } from "@/app/(chat)/actions";
import {
  type PostRequestBody,
  postRequestBodySchema,
} from "@/app/(chat)/api/chat/schema";
import { createChatAgent } from "@/lib/ai/chat-agent";
import {
  compactConversation,
  extractTokenUsage,
  needsCompaction,
} from "@/lib/ai/compaction";
import {
  allowedModelIds,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import {
  type PersonalizationHints,
  type RequestHints,
  systemPrompt,
} from "@/lib/ai/prompts";
import {
  buildToolPlan,
  getLatestUserQuery,
  writeToolPlanEvent,
} from "@/lib/ai/tool-planner";
import { db } from "@/lib/db";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getEnabledUserSkills,
  getMessagesByChatId,
  getProjectById,
  incrementChatTokenUsage,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
  updateMessageUsage,
} from "@/lib/db/queries";
import { type DBMessage, personalization } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { disconnectAll } from "@/lib/mcp/client";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";

export const maxDuration = 300;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    console.log("[chat-debug] 1. Parsing body done");
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      projectId,
    } = requestBody;
    console.log(
      "[chat-debug] 2. Destructured, selectedChatModel:",
      selectedChatModel
    );

    const [, session] = await Promise.all([
      checkBotId().catch((e: any) => {
        console.log("[chat-debug] botId check failed:", e?.message);
        return null;
      }),
      auth(),
    ]);
    console.log(
      "[chat-debug] 3. Auth done, session user:",
      session?.user?.id ?? "none"
    );

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    // IMPORTANT: DO NOT DELETE THIS CODE — rate limit temporarily disabled, not removed.
    // const userType: UserType = session.user.type;
    // const messageCount = await getMessageCountByUserId({
    //   id: session.user.id,
    //   differenceInHours: 1,
    // });
    // if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
    //   return new ChatbotError("rate_limit:chat").toResponse();
    // }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;
    let projectVectorStoreId: string | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });

      // Check if conversation needs compaction
      if (needsCompaction(messagesFromDb, chatModel)) {
        try {
          const compactResult = await compactConversation({
            messages: messagesFromDb,
            modelId: chatModel,
            chatId: id,
          });
          if (compactResult.messageCount > 0) {
            console.log(
              `[compaction] Compacted ${compactResult.messageCount} messages, saved ~${compactResult.tokensSaved} tokens`
            );
            // Reload messages after compaction
            messagesFromDb = await getMessagesByChatId({ id });
          }
        } catch (err) {
          console.error("[compaction] Compaction failed (non-fatal):", err);
          // Continue without compaction
        }
      }

      if (chat.projectId) {
        const project = await getProjectById({ id: chat.projectId });
        projectVectorStoreId = project?.vectorStoreId ?? null;
      }
    } else if (message?.role === "user") {
      if (projectId) {
        const project = await getProjectById({ id: projectId });
        if (!project || project.userId !== session.user.id) {
          return new ChatbotError(
            "forbidden:chat",
            "You don't have access to this project"
          ).toResponse();
        }
        projectVectorStoreId = project.vectorStoreId ?? null;
      }

      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
        projectId,
      });
      titlePromise = generateTitleFromUserMessage({
        message: message as UIMessage,
      });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied" ||
                  p.state === "output-available"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    console.log(
      "[chat-debug] 4. uiMessages built:",
      uiMessages.length,
      "msgs, roles:",
      uiMessages.map((m) => m.role).join(", ")
    );

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
            speechKey: "",
            usage: null,
          },
        ],
      });
    }

    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const supportsTools = capabilities?.tools === true;

    // Prune reasoning and tool-call input parts before sending to LLM.
    // Tool results are kept as they contain meaningful output, but reasoning
    // chunks and tool call inputs are stripped to reduce context bloat.

    const modelMessages = await convertToModelMessages(uiMessages, {
      ignoreIncompleteToolCalls: true,
    });

    console.log(
      "[chat-debug] 5. modelMessages built:",
      modelMessages.length,
      "msgs, roles:",
      modelMessages.map((m) => m.role).join(", "),
      ", isToolApprovalFlow:",
      isToolApprovalFlow,
      ", messagesFromDb count:",
      messagesFromDb.length
    );

    const hasProject = Boolean(projectVectorStoreId);
    const latestUserQuery = getLatestUserQuery(uiMessages);

    // Fetch personalization for system prompt
    let personalizationData: PersonalizationHints | undefined;
    try {
      const pRow = await db
        .select()
        .from(personalization)
        .where(eq(personalization.userId, session.user.id))
        .limit(1);
      if (pRow.length > 0) {
        const p = pRow[0];
        personalizationData = {
          baseStyle: p.baseStyle,
          warm: p.warm,
          enthusiastic: p.enthusiastic,
          headersAndLists: p.headersAndLists,
          emoji: p.emoji,
          customInstructions: p.customInstructions ?? undefined,
          nickname: p.nickname ?? undefined,
          occupation: p.occupation ?? undefined,
          moreAboutYou: p.moreAboutYou ?? undefined,
        };
      }
    } catch {
      // non-critical, continue without personalization
    }

    // Fetch project instructions if in a project
    if (hasProject && chat?.projectId) {
      try {
        const project = await getProjectById({ id: chat.projectId });
        if (project?.description) {
          personalizationData = {
            ...personalizationData,
            projectInstructions: project.description,
          };
        }
      } catch {
        // non-critical
      }
    } else if (hasProject && projectId) {
      try {
        const project = await getProjectById({ id: projectId });
        if (project?.description) {
          personalizationData = {
            ...personalizationData,
            projectInstructions: project.description,
          };
        }
      } catch {
        // non-critical
      }
    }

    // Fetch enabled skills for the user (passed as provider skill references)
    let enabledSkillsForInference: Array<{ providerReference: string | null }> =
      [];
    try {
      const allEnabledSkills = await getEnabledUserSkills({
        userId: session.user.id,
      });
      enabledSkillsForInference = allEnabledSkills.filter(
        (s) => s.providerReference && s.providerReference.trim().length > 0
      );
    } catch {
      // non-critical, continue without skills
    }

    // Mutable reference shared between execute and onEnd for token usage capture
    let capturedUsagePromise: Promise<ReturnType<typeof extractTokenUsage>> =
      Promise.resolve(null);
    const responseStartedAt = Date.now();

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const toolPlan = buildToolPlan({
          query: latestUserQuery,
          supportsTools,
          hasProject,
          hasMemory: Boolean(process.env.MONGODB_URI),
          hasSearchTools: Boolean(
            process.env.OPENSERP_API_KEY || process.env.OPENSERP_BASE_URL
          ),
          mcpToolNames: [],
        });

        writeToolPlanEvent(dataStream, toolPlan);

        const instructions = systemPrompt({
          requestHints,
          supportsTools,
          hasProject,
          hasMemory: Boolean(process.env.MONGODB_URI),
          hasSearchTools: Boolean(
            process.env.OPENSERP_API_KEY || process.env.OPENSERP_BASE_URL
          ),
          personalization: personalizationData,
          toolPromptSections: toolPlan.promptSections,
          toolPlanSummary: {
            groups: toolPlan.groups,
            activeTools: toolPlan.activeTools,
            rationale: toolPlan.rationale,
            contextManagement: toolPlan.contextManagement,
          },
        });

        const { agent } = await createChatAgent({
          session,
          dataStream,
          chatModel,
          instructions,
          projectVectorStoreId,
          userId: session.user.id,
          chatId: id,
          projectId,
          chatProjectId: chat?.projectId,
          enabledSkillsForInference,
          toolPlan,
        });

        const result = await agent.stream({ messages: modelMessages });

        // Merge stream into UI message stream FIRST so it pipes immediately
        dataStream.merge(
          toUIMessageStream({ stream: result.stream, sendReasoning: true })
        );

        // Capture token usage (promise resolves when stream finishes)
        try {
          const streamUsage = await result.usage;
          capturedUsagePromise = Promise.resolve(
            extractTokenUsage(streamUsage)
          );
        } catch {
          capturedUsagePromise = Promise.resolve(null);
        }

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            updateChatTitleById({ chatId: id, title });
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onEnd: async ({ messages: finishedMessages }) => {
        console.log(
          "[chat-debug] 6. onEnd fired:",
          finishedMessages.length,
          "finished msgs, roles:",
          finishedMessages.map((m) => m.role).join(", ")
        );
        const thinkingDurationSeconds = Math.max(
          1,
          Math.ceil((Date.now() - responseStartedAt) / 1000)
        );
        const messagesWithTiming = finishedMessages.map((finishedMessage) =>
          finishedMessage.role === "assistant"
            ? {
                ...finishedMessage,
                parts: finishedMessage.parts.map((part) =>
                  part.type === "reasoning"
                    ? {
                        ...part,
                        providerMetadata: {
                          ...((
                            part as {
                              providerMetadata?: Record<string, unknown>;
                            }
                          ).providerMetadata ?? {}),
                          chatbot: {
                            thinkingDurationSeconds,
                          },
                        },
                      }
                    : part
                ),
              }
            : finishedMessage
        );

        await disconnectAll();
        if (isToolApprovalFlow) {
          for (const finishedMsg of messagesWithTiming) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                    speechKey: "",
                    usage: null,
                  },
                ],
              });
            }
          }
        } else if (messagesWithTiming.length > 0) {
          // Only save assistant messages here — user messages are already
          // persisted before the stream starts (see the saveMessages call
          // above the createUIMessageStream). Saving them again would cause
          // a unique-constraint violation that silently crashes onEnd and
          // prevents the assistant message from being persisted at all.
          const assistantMessages = messagesWithTiming.filter(
            (m) => m.role === "assistant"
          );
          if (assistantMessages.length > 0) {
            await saveMessages({
              messages: assistantMessages.map((currentMessage) => ({
                id: currentMessage.id,
                role: currentMessage.role,
                parts: currentMessage.parts,
                createdAt: new Date(),
                attachments: [],
                chatId: id,
                speechKey: "",
                usage: null,
              })),
            });
            console.log(
              "[chat-debug] 7. Assistant messages saved:",
              assistantMessages.length
            );
          }
        }

        // Persist token usage to messages and chat totals
        try {
          const usage = await capturedUsagePromise;
          if (usage) {
            // Save usage to assistant messages
            const assistantMessages = finishedMessages.filter(
              (m) => m.role === "assistant"
            );
            for (const msg of assistantMessages) {
              await updateMessageUsage({
                id: msg.id,
                usage,
              });
            }

            // Increment chat-level token counters
            await incrementChatTokenUsage({
              chatId: id,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
            });
          }
        } catch (err) {
          console.error("[usage] Failed to persist token usage:", err);
          // Non-fatal, don't break the response
        }
      },
      onError: (error) => {
        console.error(
          "Stream text error:",
          JSON.stringify(error, Object.getOwnPropertyNames(error))
        );
        if (error instanceof Error) {
          console.error("Error name:", error.name, "message:", error.message);
          if ("cause" in error) {
            console.error("Error cause:", error.cause);
          }
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    if (error instanceof Error) {
      console.error("  name:", error.name, "message:", error.message);
      console.error("  stack:", error.stack);
      if ("cause" in error) {
        console.error("  cause:", (error as any).cause);
      }
    } else {
      console.error("  raw:", JSON.stringify(error));
      console.error("  type:", typeof error, "str:", String(error));
    }
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
