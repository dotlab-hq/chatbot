import {
  type MCPAppResource,
  readMCPAppResource,
  splitMCPAppTools,
} from "@ai-sdk/mcp";
import type { McpServer } from "@/lib/db/schema";
import { connectToMcpServer, getClient } from "./client";

// ─── App-visible tool tracking ──────────────────────────────────────────────

const appToolMeta = new Map<
  string,
  {
    serverId: string;
    toolName: string;
    resourceUri: string;
    visibility: string[];
  }
>();

export async function connectWithApps(server: McpServer) {
  const result = await connectToMcpServer(server);

  if (result.error) {
    return result;
  }

  const client = getClient(server.id);
  if (!client) {
    return { serverId: server.id, error: "Client not found" };
  }

  const definitions = await client.listTools();
  const { modelVisible, appVisible } = splitMCPAppTools(definitions);

  // Track app-visible tools
  for (const tool of appVisible.tools) {
    const meta = tool._meta as Record<string, unknown> | undefined;
    const uiMeta = meta?.ui as Record<string, unknown> | undefined;
    const resourceUri = uiMeta?.resourceUri as string | undefined;

    if (resourceUri) {
      appToolMeta.set(tool.name, {
        serverId: server.id,
        toolName: tool.name,
        resourceUri,
        visibility: (uiMeta?.visibility as string[]) ?? ["app"],
      });
    }
  }

  // Create model-visible tools from the definitions
  const modelTools = client.toolsFromDefinitions(modelVisible);

  return {
    serverId: server.id,
    modelVisibleTools: modelTools,
    appVisibleDefinitions: appVisible,
    toolCount: Object.keys(modelTools).length,
  };
}

export function getAppToolMeta(toolName: string) {
  return appToolMeta.get(toolName);
}

export function getAllAppToolMetas() {
  return Array.from(appToolMeta.values());
}

export function clearAppToolMeta() {
  appToolMeta.clear();
}

export function readAppResource(
  uri: string,
  serverId: string
): Promise<MCPAppResource> {
  const client = getClient(serverId);
  if (!client) {
    throw new Error(`MCP client not found for server ${serverId}`);
  }
  return readMCPAppResource({ client, uri });
}

export function callAppTool(
  name: string,
  args: Record<string, unknown>,
  serverId: string
) {
  const meta = appToolMeta.get(name);
  if (!meta) {
    throw new Error(`App tool "${name}" not found`);
  }

  if (!meta.visibility.includes("app")) {
    throw new Error(`Tool "${name}" is not app-visible`);
  }

  const client = getClient(serverId);
  if (!client) {
    throw new Error(`MCP client not found for server ${serverId}`);
  }

  return client.callTool({ name, arguments: args });
}
