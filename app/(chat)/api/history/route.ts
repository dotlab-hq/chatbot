import { and, desc, eq, gt, isNull, lt, type SQL } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { deleteAllChatsByUserId } from "@/lib/db/queries";
import { chat, type Chat } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "@/lib/db/queries/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "10", 10), 1),
    50
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  const pinnedOnly = searchParams.get("pinned") === "true";

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // pinnedOnly → only pinned; otherwise → non-pinned, non-project chats
  const baseCondition = pinnedOnly
    ? and(
        eq(chat.userId, session.user.id),
        eq(chat.isPinned, true)
      )
    : and(
        eq(chat.userId, session.user.id),
        eq(chat.isPinned, false),
        isNull(chat.projectId)
      );

  const extendedLimit = limit + 1;

  const queryFn = (whereCondition?: SQL<unknown>) =>
    db
      .select()
      .from(chat)
      .where(
        whereCondition
          ? and(whereCondition, baseCondition)
          : baseCondition
      )
      .orderBy(desc(chat.createdAt))
      .limit(extendedLimit);

  let filteredChats: Chat[] = [];

  if (startingAfter) {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, startingAfter))
      .limit(1);
    if (!selectedChat) {
      return new ChatbotError(
        "not_found:api",
        "Chat not found"
      ).toResponse();
    }
    filteredChats = await queryFn(gt(chat.createdAt, selectedChat.createdAt));
  } else if (endingBefore) {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, endingBefore))
      .limit(1);
    if (!selectedChat) {
      return new ChatbotError(
        "not_found:api",
        "Chat not found"
      ).toResponse();
    }
    filteredChats = await queryFn(lt(chat.createdAt, selectedChat.createdAt));
  } else {
    filteredChats = await queryFn();
  }

  const hasMore = filteredChats.length > limit;
  return Response.json({
    chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
    hasMore,
  });
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId: session.user.id });

  return Response.json(result, { status: 200 });
}
