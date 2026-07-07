import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
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
import {
  compactConversation,
  extractTokenUsage,
  needsCompaction,
} from "@/lib/ai/compaction";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import {
  type PersonalizationHints,
  type RequestHints,
  systemPrompt,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { retryableStreamText } from "@/lib/ai/retry";
import { calculator } from "@/lib/ai/tools/calculator";
import { createDocument } from "@/lib/ai/tools/create-document";
import { currencyConverter } from "@/lib/ai/tools/currency-converter";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { localTime } from "@/lib/ai/tools/local-time";
import { createMemoryTools } from "@/lib/ai/tools/memory";
import { readArtifact } from "@/lib/ai/tools/read-artifact";
import { renderCards } from "@/lib/ai/tools/render-cards";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { timer } from "@/lib/ai/tools/timer";
import { unitConverter } from "@/lib/ai/tools/unit-converter";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { verifyContent } from "@/lib/ai/tools/verify";
import {
  rankTracker,
  webExtract,
  webImageSearch,
  webSearch,
  webSearchExtract,
} from "@/lib/ai/tools/web-search";
import {
  createGetFileContentTool,
  createListProjectFilesTool,
  createSearchProjectFilesTool,
} from "@/lib/ai/vector-store";
import { isProductionEnvironment } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getEnabledUserSkills,
  getMcpServersByUserId,
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
import {
  connectToMcpServer,
  disconnectAll,
  getToolSets,
} from "@/lib/mcp/client";
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
                  p.state === "output-denied"
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

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const hasProject = Boolean(projectVectorStoreId);

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

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const tools: Record<string, any> = {
          getWeather,
          calculator,
          timer,
          currencyConverter,
          unitConverter,
          localTime,
          createDocument: createDocument({
            session,
            dataStream,
            modelId: chatModel,
          }),
          editDocument: editDocument({ dataStream, session }),
          updateDocument: updateDocument({
            session,
            dataStream,
            modelId: chatModel,
          }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
            modelId: chatModel,
          }),
          verifyContent,
          readArtifact: readArtifact(),
          renderCards,
          ...(process.env.OPENSERP_API_KEY || process.env.OPENSERP_BASE_URL
            ? {
                webSearch,
                webSearchExtract,
                webImageSearch,
                webExtract,
                rankTracker,
              }
            : {}),
        };

        const activeTools: string[] = [
          "getWeather",
          "calculator",
          "timer",
          "currencyConverter",
          "unitConverter",
          "localTime",
          "createDocument",
          "editDocument",
          "updateDocument",
          "requestSuggestions",
          "verifyContent",
          "readArtifact",
          "renderCards",
          ...(process.env.OPENSERP_API_KEY || process.env.OPENSERP_BASE_URL
            ? [
                "webSearch",
                "webSearchExtract",
                "webImageSearch",
                "webExtract",
                "rankTracker",
              ]
            : []),
        ];

        if (projectVectorStoreId) {
          tools.searchProjectFiles =
            createSearchProjectFilesTool(projectVectorStoreId);
          tools.listProjectFiles =
            createListProjectFilesTool(projectVectorStoreId);
          tools.getFileContent = createGetFileContentTool(projectVectorStoreId);
          activeTools.push(
            "searchProjectFiles",
            "listProjectFiles",
            "getFileContent"
          );
        }

        // Load MongoDB memory tools when configured
        if (process.env.MONGODB_URI) {
          const effectiveProjectId = chat?.projectId || projectId || undefined;
          const memoryTools = createMemoryTools({
            userId: session.user.id,
            chatId: id,
            projectId: effectiveProjectId,
          });
          Object.assign(tools, memoryTools);
          activeTools.push(
            "saveMemory",
            "recallMemory",
            "listMemories",
            "deleteMemory",
            "clearMemories"
          );
        }

        // Load tools from enabled MCP servers
        const mcpServers = await getMcpServersByUserId({
          userId: session.user.id,
        });
        const enabledServers = mcpServers.filter((s) => s.enabled);

        await Promise.all(enabledServers.map((s) => connectToMcpServer(s)));
        const mcpTools = getToolSets();
        for (const [toolName, toolDef] of Object.entries(mcpTools)) {
          tools[toolName] = toolDef;
          activeTools.push(toolName);
        }

        // Build providerOptions for skill references
        // providerReference is stored as a JSON string in the DB — parse it
        // into the Record<providerName, skillId> object that the providers expect.
        const isAnthropicModel = chatModel.startsWith("claude-");
        const providerSkillRefs = enabledSkillsForInference
          .map((s) => {
            const ref = s.providerReference;
            if (!ref) {
              return null;
            }
            try {
              return JSON.parse(ref) as Record<string, string>;
            } catch {
              return null;
            }
          })
          .filter((ref): ref is Record<string, string> => ref !== null);

        let providerOptions: Record<string, any> = {};
        if (providerSkillRefs.length > 0) {
          if (isAnthropicModel) {
            providerOptions = {
              anthropic: {
                container: {
                  skills: providerSkillRefs.map((ref) => ({
                    type: "custom" as const,
                    providerReference: ref,
                  })),
                },
              },
            };
          } else {
            // OpenAI: skills are passed via shell tool environment
            providerOptions = {
              openai: {
                shell: {
                  environment: {
                    type: "containerAuto",
                    skills: providerSkillRefs.map((ref) => ({
                      type: "skillReference" as const,
                      providerReference: ref,
                    })),
                  },
                },
              },
            };
          }
        }

        const { stream, usage } = retryableStreamText({
          maxOutputTokens: 128_000,
          model: getLanguageModel(chatModel),
          instructions: systemPrompt({
            requestHints,
            supportsTools,
            hasProject,
            hasMemory: Boolean(process.env.MONGODB_URI),
            hasSearchTools: Boolean(
              process.env.OPENSERP_API_KEY || process.env.OPENSERP_BASE_URL
            ),
            personalization: personalizationData,
          }),
          messages: modelMessages,
          ...(providerSkillRefs.length > 0 ? { providerOptions } : {}),
          reasoning: modelConfig?.reasoningEffort,
          stopWhen: isStepCount(5),
          activeTools: isReasoningModel && !supportsTools ? [] : activeTools,
          tools,
          telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        // Capture token usage from the stream
        capturedUsagePromise = Promise.resolve(usage)
          .then((result) => extractTokenUsage(result))
          .catch(() => null);

        dataStream.merge(toUIMessageStream({ stream, sendReasoning: true }));

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
        await disconnectAll();
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
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
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
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
