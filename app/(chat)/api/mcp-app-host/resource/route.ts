import { readAppResource } from "@/lib/mcp/apps";
import { ChatbotError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const { uri, serverId } = await request.json();

    if (!uri || !serverId) {
      return new ChatbotError(
        "bad_request:api",
        "uri and serverId are required"
      ).toResponse();
    }

    if (!uri.startsWith("ui://")) {
      return new ChatbotError(
        "bad_request:api",
        "Invalid resource URI: must start with ui://"
      ).toResponse();
    }

    const resource = await readAppResource(uri, serverId);

    return Response.json(resource);
  } catch (error) {
    console.error("[MCP Apps] Failed to read resource:", error);
    return new ChatbotError(
      "offline:chat",
      error instanceof Error ? error.message : "Failed to read resource"
    ).toResponse();
  }
}
