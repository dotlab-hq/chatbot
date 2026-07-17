import { auth } from "@/app/(auth)/auth";
import { getMcpServerById } from "@/lib/db/queries";
import { connectToMcpServer, disconnectFromMcpServer } from "@/lib/mcp/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Server ID is required" }, { status: 400 });
  }
  const server = await getMcpServerById({ id });
  if (!server || server.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const result = await connectToMcpServer(server);
  await disconnectFromMcpServer(server.id).catch(() => undefined);
  if (result.authorizationUrl) {
    return Response.redirect(result.authorizationUrl);
  }
  return Response.json({ ok: !result.error, error: result.error });
}
