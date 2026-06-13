import { auth } from "@/app/(auth)/auth";
import { toggleChatPin } from "@/lib/db/queries/chats";
import { ChatbotError } from "@/lib/errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const isPinned = await toggleChatPin({
    chatId: id,
    userId: session.user.id,
  });

  return Response.json({ isPinned });
}
