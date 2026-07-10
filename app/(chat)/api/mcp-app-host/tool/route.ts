import { NextResponse } from "next/server";
import { callAppTool, getAppToolMeta } from "@/lib/mcp/apps";

export async function POST(req: Request) {
  try {
    const { name, arguments: toolArguments, serverId } = await req.json();

    if (!name || !serverId) {
      return NextResponse.json(
        { error: "name, arguments, and serverId are required" },
        { status: 400 }
      );
    }

    // Validate that the tool is app-visible
    const appToolMeta = getAppToolMeta(name);
    if (!appToolMeta) {
      return NextResponse.json(
        { error: `App tool '${name}' not found` },
        { status: 404 }
      );
    }

    if (!appToolMeta.serverId || appToolMeta.serverId !== serverId) {
      return NextResponse.json(
        { error: `Tool '${name}' not found in server ${serverId}` },
        { status: 404 }
      );
    }

    if (!appToolMeta.visibility?.includes("app")) {
      return NextResponse.json(
        { error: `Tool '${name}' is not app-visible` },
        { status: 403 }
      );
    }

    const result = await callAppTool(name, toolArguments || {}, serverId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MCP Apps] Failed to call tool:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to call app tool",
      },
      { status: 500 }
    );
  }
}
