import { auth } from "@/app/(auth)/auth";
import { getMcpServerById } from "@/lib/db/queries";
import { completeMcpOAuth, connectToMcpServer } from "@/lib/mcp/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("serverId");
  const code = url.searchParams.get("code");
  if (!id || !code) {
    return Response.json(
      { error: "Missing OAuth callback parameters" },
      { status: 400 }
    );
  }
  const server = await getMcpServerById({ id });
  if (!server || server.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await completeMcpOAuth(
    server,
    code,
    url.searchParams.get("state") ?? undefined
  );
  const refreshed = await getMcpServerById({ id });
  if (refreshed) {
    await connectToMcpServer(refreshed);
  }
  return new Response(
    "MCP authorization complete. You can close this window.",
    { headers: { "content-type": "text/html" } }
  );
}
