import {
  createMCPClient,
  type MCPClient,
  mcpAppClientCapabilities,
} from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { ToolSet } from "ai";
import type { McpServer } from "@/lib/db/schema";

// ─── Active Connections ─────────────────────────────────────────────────────────

const clients = new Map<string, MCPClient>();
const toolSets = new Map<string, ToolSet>();

export function getConnection(serverId: string) {
  return clients.has(serverId);
}

export function getAllConnections() {
  return Array.from(clients.keys());
}

// ─── Connect / Disconnect ───────────────────────────────────────────────────────

export async function connectToMcpServer(server: McpServer) {
  try {
    const transport = buildTransport(server);

    // Extract headers from server configuration and apply them to the MCP client
    const _mcpHeaders = server.headers ?? undefined;

    const client = await createMCPClient({
      transport,
      maxRetries: 2,
      clientName: "chatbot",
      version: "1.0.0",
      capabilities: mcpAppClientCapabilities,
    });

    const tools = await client.tools();
    clients.set(server.id, client);
    toolSets.set(server.id, tools);

    return { serverId: server.id, toolCount: Object.keys(tools).length };
  } catch (error) {
    return {
      serverId: server.id,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function disconnectFromMcpServer(serverId: string) {
  const client = clients.get(serverId);
  if (client) {
    await client.close();
    clients.delete(serverId);
    toolSets.delete(serverId);
  }
}

export async function disconnectAll() {
  await Promise.all(Array.from(clients.keys()).map(disconnectFromMcpServer));
}

export function getToolSets(): ToolSet {
  const merged: ToolSet = {};
  for (const [, tools] of toolSets) {
    Object.assign(merged, tools);
  }
  return merged;
}

export function getClient(serverId: string): MCPClient | undefined {
  return clients.get(serverId);
}

export function getAllClients(): Map<string, MCPClient> {
  return clients;
}

// ─── Transport Builder ──────────────────────────────────────────────────────────

function buildTransport(server: McpServer) {
  switch (server.transport) {
    case "stdio": {
      if (!server.command) {
        throw new Error("stdio transport requires a command");
      }
      return new Experimental_StdioMCPTransport({
        command: server.command,
        args: server.args ?? [],
        env: server.env ?? undefined,
      });
    }
    case "sse":
      if (!server.url) {
        throw new Error("SSE transport requires a URL");
      }
      return {
        type: "sse" as const,
        url: server.url,
        headers: server.headers === null ? undefined : server.headers,
      };
    case "streamable-http":
      if (!server.url) {
        throw new Error("Streamable HTTP transport requires a URL");
      }
      return {
        type: "http" as const,
        url: server.url,
        headers: server.headers === null ? undefined : server.headers,
      };
    default:
      throw new Error(`Unsupported transport: ${server.transport}`);
  }
}
