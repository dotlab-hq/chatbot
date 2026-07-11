import type { LanguageModelUsage } from "ai";
import { eq } from "drizzle-orm";
import { getLanguageModel } from "@/lib/ai/providers";
import { retryableGenerateText } from "@/lib/ai/retry";
import { db } from "@/lib/db";
import {
  chat,
  type DBMessage,
  message,
  type TokenUsage,
} from "@/lib/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CompactResult = {
  summary: string;
  messageCount: number;
  tokensSaved: number;
};

// ─── Token Counting ─────────────────────────────────────────────────────────

/**
 * Extract a TokenUsage object from the AI SDK's LanguageModelUsage.
 */
export function extractTokenUsage(
  usage: LanguageModelUsage | null | undefined
): TokenUsage | null {
  if (!usage) {
    return null;
  }
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
  };
}

/**
 * Sum up token usage across all messages in a chat.
 */
export function sumTokenUsage(messages: DBMessage[]): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
} {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  for (const msg of messages) {
    if (msg.usage && typeof msg.usage === "object") {
      const u = msg.usage as TokenUsage;
      totalInputTokens += u.inputTokens ?? 0;
      totalOutputTokens += u.outputTokens ?? 0;
      totalTokens += u.totalTokens ?? 0;
    }
  }

  return { totalInputTokens, totalOutputTokens, totalTokens };
}

// ─── Model Context Window Config ────────────────────────────────────────────

/**
 * Context window sizes per model. Used to decide when to compact.
 * These are conservative estimates.
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-edge": 64_000,
  "claude-3-5-sonnet": 200_000,
  "claude-3-opus": 200_000,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4.1-mini": 1_000_000,
  "gpt-4.1-nano": 1_000_000,
  "moonshotai/kimi-k2.5": 128_000,
};

const DEFAULT_CONTEXT_WINDOW = 64_000;

/**
 * Threshold (fraction of context window) at which compaction triggers.
 */
const COMPACTION_THRESHOLD = 0.45;

/**
 * Get the context window size for a model.
 */
export function getContextWindow(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}

/**
 * Get the token count at which compaction should trigger.
 */
export function getCompactionThreshold(modelId: string): number {
  return Math.floor(getContextWindow(modelId) * COMPACTION_THRESHOLD);
}

// ─── Compaction Logic ───────────────────────────────────────────────────────

/**
 * Check whether a conversation needs compaction.
 */
export function needsCompaction(
  messages: DBMessage[],
  modelId: string
): boolean {
  const { totalTokens } = sumTokenUsage(messages);
  const threshold = getCompactionThreshold(modelId);
  // If we don't have usage data yet, estimate ~4 chars per token
  const effectiveTokens =
    totalTokens > 0
      ? totalTokens
      : messages.reduce((acc, m) => {
          const text = JSON.stringify(m.parts);
          return acc + Math.ceil(text.length / 4);
        }, 0);
  return effectiveTokens > threshold;
}

/**
 * Compact a conversation by summarizing older messages and replacing them
 * with a single summary message. Returns the updated messages array and
 * the summary text.
 */
export async function compactConversation({
  messages,
  modelId,
  chatId,
}: {
  messages: DBMessage[];
  modelId: string;
  chatId: string;
}): Promise<CompactResult> {
  // Keep the last N messages intact (recent context), summarize the rest
  const KEEP_RECENT = 6;
  if (messages.length <= KEEP_RECENT + 1) {
    return { summary: "", messageCount: 0, tokensSaved: 0 };
  }

  const toSummarize = messages.slice(0, -KEEP_RECENT);
  const toKeep = messages.slice(-KEEP_RECENT);

  // Build the conversation text to summarize
  const conversationText = toSummarize
    .map((msg) => {
      const partsText = (msg.parts as any[])
        ?.map((p: any) => {
          if (p.type === "text") {
            return `[${msg.role}]: ${p.text}`;
          }
          if (p.type === "tool-invocation") {
            return `[${msg.role} tool: ${p.toolInvocation?.toolName}]: ${JSON.stringify(p.toolInvocation?.result ?? "")}`;
          }
          if (p.type === "tool-result") {
            return `[${msg.role} tool-result]: ${JSON.stringify(p.result ?? "")}`;
          }
          return `[${msg.role} ${p.type}]: ...`;
        })
        .join("\n");
      return partsText || "";
    })
    .filter(Boolean)
    .join("\n\n");

  if (!conversationText.trim()) {
    return { summary: "", messageCount: 0, tokensSaved: 0 };
  }

  // Use the LLM to generate a summary
  const { text: summary } = await retryableGenerateText({
    maxOutputTokens: 128_000,
    model: getLanguageModel(modelId),
    prompt: `You are a conversation summarizer. Summarize the following conversation between a user and an AI assistant.
Be concise but preserve all key information, decisions, code context, and important details that would be needed to continue the conversation.
Output ONLY the summary, no preamble.

CONVERSATION TO SUMMARIZE:
${conversationText}`,
  });

  // Calculate tokens saved
  const oldTokens = sumTokenUsage(toSummarize);
  const summaryTokens = Math.ceil(summary.length / 4); // rough estimate
  const tokensSaved = oldTokens.totalTokens - summaryTokens;

  // Create a summary message to replace the old messages
  const summaryMessage: DBMessage = {
    id: crypto.randomUUID(),
    chatId,
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `[Conversation Summary — ${toSummarize.length} messages compacted]\n\n${summary}`,
      },
    ],
    attachments: [],
    createdAt: new Date(),
    speechKey: "",
    usage: {
      inputTokens: 0,
      outputTokens: summaryTokens,
      totalTokens: summaryTokens,
    },
  };

  // Delete old messages and their votes from DB
  const oldMessageIds = toSummarize.map((m) => m.id);
  if (oldMessageIds.length > 0) {
    // Delete votes for old messages
    const { vote } = await import("@/lib/db/schema");
    await db.delete(vote).where(eq(vote.chatId, chatId));
    // Delete old messages
    await db.delete(message).where(eq(message.chatId, chatId));
  }

  // Insert the summary message
  await db.insert(message).values(summaryMessage);

  // Keep the recent messages (they need to be re-saved since we deleted all for this chat)
  for (const msg of toKeep) {
    await db.insert(message).values(msg);
  }

  // Update chat compaction summary and reset token counters
  await db
    .update(chat)
    .set({
      compactionSummary: summary,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    })
    .where(eq(chat.id, chatId));

  return {
    summary,
    messageCount: toSummarize.length,
    tokensSaved: Math.max(0, tokensSaved),
  };
}

/**
 * Get the compacted messages with the summary prepended.
 * Used when loading messages after compaction.
 */
export function buildMessagesWithCompaction(
  messages: DBMessage[],
  compactionSummary: string | null
): DBMessage[] {
  if (!compactionSummary || messages.length === 0) {
    return messages;
  }

  // Check if there's already a summary message in the conversation
  const hasSummary = messages.some(
    (m) =>
      m.role === "system" &&
      typeof m.parts === "object" &&
      Array.isArray(m.parts) &&
      (m.parts as any[]).some(
        (p: any) =>
          p.type === "text" && p.text?.startsWith("[Conversation Summary")
      )
  );

  if (hasSummary) {
    return messages;
  }

  // Prepend the summary as a system message
  const summaryMessage: DBMessage = {
    id: crypto.randomUUID(),
    chatId: messages[0]?.chatId ?? "",
    role: "system",
    parts: [
      {
        type: "text",
        text: `[Conversation Summary]\n\n${compactionSummary}`,
      },
    ],
    attachments: [],
    createdAt: new Date(0),
    speechKey: "",
    usage: null,
  };

  return [summaryMessage, ...messages];
}
