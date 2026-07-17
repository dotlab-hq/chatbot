import {
  createMCPClient,
  type MCPClient,
  mcpAppClientCapabilities,
  type OAuthClientProvider,
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
  let authorizationUrl: string | undefined;
  try {
    // Replace a stale connection before reconnecting. Streamable HTTP servers
    // commonly expire sessions while the process remains alive.
    if (clients.has(server.id)) {
      await disconnectFromMcpServer(server.id);
    }
    const transport = buildTransport(server, (url) => {
      authorizationUrl = url.toString();
    });

    // Extract headers from server configuration and apply them to the MCP client
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
      authorizationUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function completeMcpOAuth(
  server: McpServer,
  authorizationCode: string,
  callbackState?: string
) {
  const { auth } = await import("@ai-sdk/mcp");
  let authorizationUrl: string | undefined;
  const provider = createOAuthProvider(server, (url) => {
    authorizationUrl = url.toString();
  });
  const result = await auth(provider, {
    serverUrl: server.url ?? "",
    authorizationCode,
    callbackState,
  });
  return { result, authorizationUrl };
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

function buildTransport(
  server: McpServer,
  onAuthorizationUrl: (url: URL) => void
) {
  const authProvider: OAuthClientProvider | undefined = server.oauthEnabled
    ? createOAuthProvider(server, onAuthorizationUrl)
    : undefined;
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
        authProvider,
        redirect: "follow" as const,
      };
    case "streamable-http":
      if (!server.url) {
        throw new Error("Streamable HTTP transport requires a URL");
      }
      return {
        type: "http" as const,
        url: server.url,
        headers: server.headers === null ? undefined : server.headers,
        authProvider,
        redirect: "follow" as const,
      };
    default:
      throw new Error(`Unsupported transport: ${server.transport}`);
  }
}

function createOAuthProvider(
  server: McpServer,
  onAuthorizationUrl: (url: URL) => void
): OAuthClientProvider {
  const tokens = server.oauthTokens as
    | Parameters<OAuthClientProvider["saveTokens"]>[0]
    | undefined;
  const clientInformation = server.oauthClientInformation as Awaited<
    ReturnType<NonNullable<OAuthClientProvider["clientInformation"]>>
  >;
  let codeVerifier = server.oauthCodeVerifier ?? "";
  return {
    tokens: () => tokens,
    saveTokens: async (next) => {
      await persistOAuth(server.id, { oauthTokens: next });
    },
    redirectToAuthorization: (url) => {
      onAuthorizationUrl(url);
    },
    saveCodeVerifier: async (value) => {
      codeVerifier = value;
      await persistOAuth(server.id, { oauthCodeVerifier: value });
    },
    codeVerifier: () => codeVerifier,
    get redirectUrl() {
      return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp-servers/oauth/callback?serverId=${encodeURIComponent(server.id)}`;
    },
    get clientMetadata() {
      return {
        client_name: "Watt AI",
        redirect_uris: [this.redirectUrl.toString()],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
    },
    clientInformation: () => clientInformation,
    saveClientInformation: async (value) => {
      await persistOAuth(server.id, { oauthClientInformation: value });
    },
    validateAuthorizationServerURL: (serverUrl, authorizationServerUrl) => {
      const requested = new URL(authorizationServerUrl).origin;
      const serverOrigin = new URL(serverUrl).origin;
      if (requested !== serverOrigin && !requested.endsWith(".notion.so")) {
        throw new Error("OAuth authorization server is not trusted");
      }
    },
  };
}

async function persistOAuth(id: string, values: Record<string, unknown>) {
  const { db } = await import("@/lib/db");
  const { mcpServer } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .update(mcpServer)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(mcpServer.id, id));
}
