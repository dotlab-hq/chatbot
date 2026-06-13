import { type NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getProjectById } from "@/lib/db/queries/projects";
import { getChatsByProjectId } from "@/lib/db/queries/chats";
import { ChatbotError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { projectId } = await params;

  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatbotError("not_found:api", "Project not found").toResponse();
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "20", 10), 1),
    50
  );
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const chats = await getChatsByProjectId({
    projectId,
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}
