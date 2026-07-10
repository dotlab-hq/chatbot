import { auth } from "@/app/(auth)/auth";
import {
  createMcpServer,
  deleteMcpServerById,
  getMcpServersByUserId,
  updateMcpServer,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const servers = await getMcpServersByUserId({ userId: session.user.id });
  return Response.json({ servers });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { name, description, transport, url, command, args, headers } =
    body as {
      name: string;
      description?: string;
      transport: "stdio" | "sse" | "streamable-http";
      url?: string;
      command?: string;
      args?: string[];
      headers?: Record<string, string>;
    };

  if (!name?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "Server name is required"
    ).toResponse();
  }

  if (transport === "stdio" && !command?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "Command is required for stdio transport"
    ).toResponse();
  }

  if (transport !== "stdio" && !url?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "URL is required for HTTP/SSE transport"
    ).toResponse();
  }

  const server = await createMcpServer({
    name: name.trim(),
    description: description?.trim() || undefined,
    userId: session.user.id,
    transport,
    url: url?.trim(),
    command: command?.trim(),
    args,
    headers,
  });

  return Response.json({ server }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { id, enabled, name, transport, url, command, args, headers } = body as {
    id: string;
    enabled?: boolean;
    name?: string;
    transport?: "stdio" | "sse" | "streamable-http";
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
  };

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
      "Server ID is required"
    ).toResponse();
  }

  const updated = await updateMcpServer({
    id,
    enabled,
    name,
    transport,
    url,
    command,
    args,
    headers,
  });

  return Response.json({ server: updated });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError(
      "bad_request:api",
      "Server ID is required"
    ).toResponse();
  }

  await deleteMcpServerById({ id });
  return Response.json({ success: true });
}
