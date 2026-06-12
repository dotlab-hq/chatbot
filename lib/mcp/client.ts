/**
 * MCP (Model Context Protocol) client for connecting to configured MCP servers.
 * Supports stdio, SSE, and streamable-http transports.
 */

import type { McpServer } from "@/lib/db/schema";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpConnection {
  serverId: string;
  tools: McpTool[];
  resources: McpResource[];
  connected: boolean;
  error?: string;
}

// ─── Active Connections Store ────────────────────────────────────────────────

const connections = new Map<string, McpConnection>();

export function getConnection(serverId: string): McpConnection | undefined {
  return connections.get(serverId);
}

export function getAllConnections(): McpConnection[] {
  return Array.from(connections.values());
}

// ─── MCP Server Connection ──────────────────────────────────────────────────

/**
 * Connect to an MCP server and retrieve its tools and resources.
 * This is a high-level connection manager — actual protocol implementation
 * depends on the transport type.
 */
export async function connectToMcpServer(
  server: McpServer
): Promise<McpConnection> {
  const connection: McpConnection = {
    serverId: server.id,
    tools: [],
    resources: [],
    connected: false,
  };

  try {
    switch (server.transport) {
      case "stdio": {
        const result = await connectStdio(server);
        connection.tools = result.tools;
        connection.resources = result.resources;
        break;
      }
      case "sse": {
        const result = await connectSse(server);
        connection.tools = result.tools;
        connection.resources = result.resources;
        break;
      }
      case "streamable-http": {
        const result = await connectStreamableHttp(server);
        connection.tools = result.tools;
        connection.resources = result.resources;
        break;
      }
      default:
        throw new Error(`Unsupported transport: ${server.transport}`);
    }

    connection.connected = true;
    connection.error = undefined;
  } catch (error) {
    connection.connected = false;
    connection.error =
      error instanceof Error ? error.message : "Unknown connection error";
  }

  connections.set(server.id, connection);
  return connection;
}

/**
 * Disconnect from an MCP server.
 */
export function disconnectFromMcpServer(serverId: string): void {
  connections.delete(serverId);
}

// ─── Transport Implementations ──────────────────────────────────────────────

interface TransportResult {
  tools: McpTool[];
  resources: McpResource[];
}

/**
 * Connect via stdio transport — spawns a child process.
 * In production, this would use a child process manager.
 * For now, we provide the interface and basic HTTP-based discovery.
 */
async function connectStdio(server: McpServer): Promise<TransportResult> {
  // stdio transport requires spawning a process
  // This is typically handled by a worker/subprocess
  // For now, we validate the config and return empty
  if (!server.command) {
    throw new Error("stdio transport requires a command");
  }

  // TODO: Implement actual stdio transport using child_process
  // const child = spawn(server.command, server.args ?? [], {
  //   env: { ...process.env, ...server.env },
  //   stdio: ['pipe', 'pipe', 'pipe'],
  // });

  await Promise.resolve();
  return { tools: [], resources: [] };
}

/**
 * Connect via SSE transport — uses Server-Sent Events endpoint.
 */
async function connectSse(server: McpServer): Promise<TransportResult> {
  if (!server.url) {
    throw new Error("SSE transport requires a URL");
  }

  // Connect to the SSE endpoint
  const response = await fetch(server.url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`SSE connection failed: ${response.status}`);
  }

  // For a real implementation, we'd parse the SSE stream
  // and send JSON-RPC messages. For now, attempt to list tools
  // via the message endpoint (typically {baseUrl}/message)
  const messageUrl = new URL(server.url);
  messageUrl.pathname = messageUrl.pathname.replace(/\/sse$/, "/message");

  return fetchToolsAndResources(messageUrl.toString(), server);
}

/**
 * Connect via streamable-http transport.
 */
async function connectStreamableHttp(
  server: McpServer
): Promise<TransportResult> {
  if (!server.url) {
    throw new Error("Streamable HTTP transport requires a URL");
  }

  return await fetchToolsAndResources(server.url, server);
}

/**
 * Send JSON-RPC requests to discover tools and resources.
 */
async function fetchToolsAndResources(
  endpoint: string,
  _server: McpServer
): Promise<TransportResult> {
  // Send initialize request
  const initResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "chatbot", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!initResponse.ok) {
    throw new Error(`MCP initialize failed: ${initResponse.status}`);
  }

  // Send initialized notification
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  // List tools
  const toolsResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const toolsData = (await toolsResponse.json()) as {
    result?: { tools?: McpTool[] };
  };
  const tools = toolsData.result?.tools ?? [];

  // List resources
  const resourcesResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/list",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const resourcesData = (await resourcesResponse.json()) as {
    result?: { resources?: McpResource[] };
  };
  const resources = resourcesData.result?.resources ?? [];

  return { tools, resources };
}

/**
 * Call a tool on an MCP server.
 */
export async function callMcpTool({
  serverId,
  toolName,
  _args,
}: {
  serverId: string;
  toolName: string;
  _args: Record<string, unknown>;
}): Promise<unknown> {
  const connection = connections.get(serverId);
  if (!connection?.connected) {
    throw new Error(`MCP server ${serverId} is not connected`);
  }

  const tool = connection.tools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found on server ${serverId}`);
  }

  // TODO: Implement actual tool calling via the transport
  // This would send a JSON-RPC tools/call request with args
  await Promise.resolve();
  throw new Error(
    "MCP tool calling not yet implemented — requires transport integration"
  );
}
