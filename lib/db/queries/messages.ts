import { and, asc, count, eq, gte, inArray, sql } from "drizzle-orm";
import {
  chat,
  type DBMessage,
  message,
  type TokenUsage,
  vote,
} from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "./db";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    console.error("[db] saveMessages failed:", error);
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (error) {
    console.error("[db] updateMessage failed:", error);
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error("[db] getMessagesByChatId failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error("[db] getMessageById failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (error) {
    console.error("[db] deleteMessagesByChatIdAfterTimestamp failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    console.error("[db] getMessageCountByUserId failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

// ─── Token Usage Queries ────────────────────────────────────────────────────

/**
 * Update the usage data for a single message.
 */
export async function updateMessageUsage({
  id,
  usage,
}: {
  id: string;
  usage: TokenUsage;
}) {
  try {
    return await db
      .update(message)
      .set({ usage: usage as any })
      .where(eq(message.id, id));
  } catch (error) {
    console.error("[db] updateMessageUsage failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update message usage"
    );
  }
}

/**
 * Increment token usage counters on a chat.
 */
export async function incrementChatTokenUsage({
  chatId,
  inputTokens,
  outputTokens,
}: {
  chatId: string;
  inputTokens: number;
  outputTokens: number;
}) {
  try {
    return await db
      .update(chat)
      .set({
        totalInputTokens: sql`${chat.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${chat.totalOutputTokens} + ${outputTokens}`,
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("[db] incrementChatTokenUsage failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to increment chat token usage"
    );
  }
}

/**
 * Get total token usage for a chat.
 */
export async function getChatTokenUsage({
  chatId,
}: {
  chatId: string;
}): Promise<{ totalInputTokens: number; totalOutputTokens: number }> {
  try {
    const [result] = await db
      .select({
        totalInputTokens: chat.totalInputTokens,
        totalOutputTokens: chat.totalOutputTokens,
      })
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);
    return result ?? { totalInputTokens: 0, totalOutputTokens: 0 };
  } catch (error) {
    console.error("[db] getChatTokenUsage failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chat token usage"
    );
  }
}

/**
 * Get total token usage for a user across all chats.
 */
export async function getUserTokenUsage({
  userId,
}: {
  userId: string;
}): Promise<{
  totalInputTokens: number;
  totalOutputTokens: number;
  chatCount: number;
}> {
  try {
    const [result] = await db
      .select({
        totalInputTokens: sql<number>`coalesce(sum(${chat.totalInputTokens}), 0)`,
        totalOutputTokens: sql<number>`coalesce(sum(${chat.totalOutputTokens}), 0)`,
        chatCount: count(chat.id),
      })
      .from(chat)
      .where(eq(chat.userId, userId));
    return (
      result ?? { totalInputTokens: 0, totalOutputTokens: 0, chatCount: 0 }
    );
  } catch (error) {
    console.error("[db] getUserTokenUsage failed:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user token usage"
    );
  }
}
