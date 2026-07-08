import { desc, eq } from "drizzle-orm";
import { type McpServer, mcpServer } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "./db";

export async function createMcpServer({
  name,
  description,
  transport,
  url,
  command,
  args,
  env,
  userId,
}: {
  name: string;
  description?: string;
  transport: "stdio" | "sse" | "streamable-http";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  userId: string;
}): Promise<McpServer> {
  try {
    const [created] = await db
      .insert(mcpServer)
      .values({ name, description, transport, url, command, args, env, userId })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create MCP server"
    );
  }
}

export async function getMcpServersByUserId({
  userId,
}: {
  userId: string;
}): Promise<McpServer[]> {
  try {
    return await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.userId, userId))
      .orderBy(desc(mcpServer.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get MCP servers");
  }
}

export async function getMcpServerById({
  id,
}: {
  id: string;
}): Promise<McpServer | null> {
  try {
    const [found] = await db
      .select()
      .from(mcpServer)
      .where(eq(mcpServer.id, id));
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get MCP server by id"
    );
  }
}

export async function updateMcpServer({
  id,
  name,
  description,
  transport,
  url,
  command,
  args,
  env,
  enabled,
}: {
  id: string;
  name?: string;
  description?: string;
  transport?: "stdio" | "sse" | "streamable-http";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}): Promise<McpServer | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) {
      updates.name = name;
    }
    if (description !== undefined) {
      updates.description = description;
    }
    if (transport !== undefined) {
      updates.transport = transport;
    }
    if (url !== undefined) {
      updates.url = url;
    }
    if (command !== undefined) {
      updates.command = command;
    }
    if (args !== undefined) {
      updates.args = args;
    }
    if (env !== undefined) {
      updates.env = env;
    }
    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    const [updated] = await db
      .update(mcpServer)
      .set(updates)
      .where(eq(mcpServer.id, id))
      .returning();
    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update MCP server"
    );
  }
}

export async function deleteMcpServerById({
  id,
}: {
  id: string;
}): Promise<void> {
  try {
    await db.delete(mcpServer).where(eq(mcpServer.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete MCP server"
    );
  }
}
