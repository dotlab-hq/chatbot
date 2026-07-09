import {
  isStepCount,
  type ModelMessage,
  pruneMessages,
  ToolLoopAgent,
  type UIMessageStreamWriter,
} from "ai";
import type { Session } from "@/app/(auth)/auth";
import { chatModels, getCapabilities } from "@/lib/ai/models";
import { createParallelTool } from "@/lib/ai/parallel-executioner";
import { getLanguageModel } from "@/lib/ai/providers";
import { calculator } from "@/lib/ai/tools/calculator";
import { clientHttpRequest } from "@/lib/ai/tools/client-http-request";
import { createDocument } from "@/lib/ai/tools/create-document";
import { currencyConverter } from "@/lib/ai/tools/currency-converter";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { localTime } from "@/lib/ai/tools/local-time";
import { createMemoryTools } from "@/lib/ai/tools/memory";
import { playVideo } from "@/lib/ai/tools/play-video";
import { randomApiTool } from "@/lib/ai/tools/random-api";
import { readArtifact } from "@/lib/ai/tools/read-artifact";
import { renderCards } from "@/lib/ai/tools/render-cards";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { researchTool } from "@/lib/ai/tools/research";
import { timer } from "@/lib/ai/tools/timer";
import { createTodoTool } from "@/lib/ai/tools/todo-list";
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
import { getMcpServersByUserId } from "@/lib/db/queries";
import { connectToMcpServer, getToolSets } from "@/lib/mcp/client";
import type { ChatMessage } from "@/lib/types";
import type { ToolPlan } from "./tool-planner";

/** Rough token estimate: ~4 chars per token */
const estimateTokens = (messages: ModelMessage[]) =>
  Math.round(JSON.stringify(messages).length / 4);

const COMPACTION_THRESHOLD = 100_000;

/**
 * Wraps a subagent tool to emit progress events via dataStream.
 * The `execute` wrap sends start/complete/error events so the UI
 * can display subagent activity.
 */
function wrapSubagentExecute(
  toolDef: Record<string, unknown>,
  toolName: string,
  ds: UIMessageStreamWriter<ChatMessage>
): Record<string, unknown> {
  const originalExecute = toolDef.execute as
    | ((input: unknown, options: unknown) => Promise<unknown>)
    | undefined;
  if (!originalExecute) {
    return toolDef;
  }
  return {
    ...toolDef,
    execute: async (input: unknown, options: unknown) => {
      ds.write({
        type: "data-subagent-step",
        data: { tool: toolName, status: "running", task: (input as any)?.task },
      });
      try {
        const result = await originalExecute(input, options);
        ds.write({
          type: "data-subagent-step",
          data: { tool: toolName, status: "complete" },
        });
        return result;
      } catch (e) {
        ds.write({
          type: "data-subagent-step",
          data: { tool: toolName, status: "error", error: String(e) },
        });
        throw e;
      }
    },
  };
}

export type CreateChatAgentParams = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatModel: string;
  instructions: string;
  projectVectorStoreId: string | null;
  userId: string;
  chatId: string;
  projectId?: string | null;
  chatProjectId?: string | null;
  enabledSkillsForInference: Array<{ providerReference: string | null }>;
  toolPlan?: ToolPlan;
};

/**
 * Builds the complete tool set for a chat session and creates a ToolLoopAgent.
 *
 * Must be called per-request (inside the execute callback) because artifact
 * tools need access to the `dataStream` (UIMessageStreamWriter) to write
 * custom data events.
 */
export async function createChatAgent(params: CreateChatAgentParams) {
  const {
    session,
    dataStream,
    chatModel,
    instructions,
    projectVectorStoreId,
    userId,
    chatId,
    projectId,
    chatProjectId,
    enabledSkillsForInference,
    toolPlan,
  } = params;

  const modelConfig = chatModels.find((m) => m.id === chatModel);
  const modelCapabilities = await getCapabilities();
  const capabilities = modelCapabilities[chatModel];
  const isReasoningModel = capabilities?.reasoning === true;
  const supportsTools = capabilities?.tools === true;

  // ── Build tools dictionary ────────────────────────────────────────────

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
    randomApiTool: wrapSubagentExecute(
      randomApiTool as Record<string, unknown>,
      "randomApiTool",
      dataStream
    ),
    researchTool: wrapSubagentExecute(
      researchTool as Record<string, unknown>,
      "researchTool",
      dataStream
    ),
    clientHttpRequest,
    playVideo,
    manageTodoList: createTodoTool(dataStream),
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
    "randomApiTool",
    "researchTool",
    "clientHttpRequest",
    "playVideo",
    "manageTodoList",
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

  // ── Project vector-store tools ────────────────────────────────────────

  if (projectVectorStoreId) {
    tools.searchProjectFiles =
      createSearchProjectFilesTool(projectVectorStoreId);
    tools.listProjectFiles = createListProjectFilesTool(projectVectorStoreId);
    tools.getFileContent = createGetFileContentTool(projectVectorStoreId);
    activeTools.push(
      "searchProjectFiles",
      "listProjectFiles",
      "getFileContent"
    );
  }

  // ── MongoDB memory tools ──────────────────────────────────────────────

  if (process.env.MONGODB_URI) {
    const effectiveProjectId = chatProjectId || projectId || undefined;
    const memoryTools = createMemoryTools({
      userId: session.user.id,
      chatId,
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

  // ── MCP server tools ──────────────────────────────────────────────────

  const mcpServers = await getMcpServersByUserId({ userId });
  const enabledServers = mcpServers.filter((s) => s.enabled);
  await Promise.all(enabledServers.map((s) => connectToMcpServer(s)));
  const mcpTools = getToolSets();
  const mcpToolNames: string[] = [];
  for (const [toolName, toolDef] of Object.entries(mcpTools)) {
    tools[toolName] = toolDef;
    activeTools.push(toolName);
    mcpToolNames.push(toolName);
  }

  // ── Provider skill references (providerOptions) ───────────────────────

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

  // ── Parallel execution meta-tool ──────────────────────────────────────
  //
  // Build after ALL other tools are registered so createParallelTool can
  // enumerate everything available.
  {
    const parallelTool = createParallelTool(tools);
    tools.runParallel = parallelTool;
    activeTools.push("runParallel");
  }

  const plannedActiveTools =
    toolPlan?.activeTools === "all" || !toolPlan
      ? activeTools
      : activeTools.filter((toolName) => toolPlan.activeTools.includes(toolName));

  // ── Reasoning effort ──────────────────────────────────────────────────

  const reasoning = modelConfig?.reasoningEffort;

  // ── Create agent ──────────────────────────────────────────────────────

  const agent = new ToolLoopAgent({
    model: getLanguageModel(chatModel),
    instructions,
    tools,
    activeTools: isReasoningModel && !supportsTools ? [] : plannedActiveTools,
    stopWhen: isStepCount(5),
    maxOutputTokens: 128_000,
    prepareStep: ({ messages: stepMessages }) => {
      if (estimateTokens(stepMessages) > COMPACTION_THRESHOLD) {
        return {
          messages: pruneMessages({
            messages: stepMessages,
            reasoning: "all",
            toolCalls: "before-last-3-messages",
            emptyMessages: "remove",
          }),
        };
      }
    },
    ...(providerSkillRefs.length > 0 ? { providerOptions } : {}),
    ...(reasoning ? { reasoning } : {}),
    telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "stream-text",
    },
  });

  return { agent, activeTools: plannedActiveTools, mcpToolNames };
}
