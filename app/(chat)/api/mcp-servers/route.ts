import { auth } from "@/app/(auth)/auth";
import {
  createMcpServer,
  deleteMcpServerById,
  getMcpServerById,
  getMcpServersByUserId,
  updateMcpServer,
} from "@/lib/db/queries";
import type { McpServer } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { connectToMcpServer, disconnectFromMcpServer } from "@/lib/mcp/client";

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

  // ── Test connection (no persistence) ──────────────────────────────────
  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") === "test") {
    const body = await request.json().catch(() => ({}));

    let config: McpServer | null = null;
    if (body.id) {
      config = await getMcpServerById({ id: String(body.id) });
    } else {
      const {
        name,
        transport,
        url,
        command,
        args,
        env,
        headers,
        oauthEnabled,
      } = body;
      if (!transport) {
        return new ChatbotError(
          "bad_request:api",
          "transport is required"
        ).toResponse();
      }
      config = {
        id: "test",
        name: name ?? "test",
        description: null,
        transport,
        url: url ?? null,
        command: command ?? null,
        args: args ?? null,
        env: env ?? null,
        headers: headers ?? null,
        oauthEnabled: oauthEnabled ?? false,
        userId: session.user.id,
        enabled: true,
        lastConnectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as McpServer;
    }

    if (!config) {
      return new ChatbotError("not_found:api", "Server not found").toResponse();
    }

    const result = await connectToMcpServer(config);
    // Best-effort cleanup of the throwaway test client; ignore if already gone.
    await disconnectFromMcpServer("test").catch(() => undefined);
    if (result.error) {
      return Response.json({
        ok: false,
        error: result.error,
        authorizationUrl: result.authorizationUrl,
      });
    }
    return Response.json({ ok: true, toolCount: result.toolCount ?? 0 });
  }

  const body = await request.json();
  const {
    name,
    description,
    transport,
    url,
    command,
    args,
    headers,
    oauthEnabled,
  } = body as {
    name: string;
    description?: string;
    transport: "stdio" | "sse" | "streamable-http";
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
    oauthEnabled?: boolean;
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
    oauthEnabled,
  });

  return Response.json({ server }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const {
    id,
    enabled,
    name,
    transport,
    url,
    command,
    args,
    headers,
    oauthEnabled,
  } = body as {
    id?: string;
    enabled?: boolean;
    name?: string;
    transport?: "stdio" | "sse" | "streamable-http";
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
    oauthEnabled?: boolean;
  };

  // Support id from query params as well
  const { searchParams } = new URL(request.url);
  const serverId = id || searchParams.get("id");

  if (!serverId) {
    return new ChatbotError(
      "bad_request:api",
      "Server ID is required"
    ).toResponse();
  }

  const updated = await updateMcpServer({
    id: serverId,
    enabled,
    name,
    transport,
    url,
    command,
    args,
    headers,
    oauthEnabled,
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
