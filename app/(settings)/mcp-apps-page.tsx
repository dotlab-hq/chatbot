"use client";

import {
  ClockIcon,
  GlobeIcon,
  LoaderIcon,
  Server,
  TerminalIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { McpServer } from "@/lib/db/schema";

type McpApp = {
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  url: string | null;
  command: string | null;
  enabled: boolean;
  appToolCount: number;
  lastConnectedAt: string | null;
};

export function McpAppsPage() {
  const [servers, setServers] = useState<McpApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("apps");

  useEffect(() => {
    const loadServers = async () => {
      try {
        const response = await fetch("/api/mcp-servers");
        if (response.ok) {
          const data = (await response.json()) as { servers: McpServer[] };

          const apps = data.servers.map(
            (server): McpApp => ({
              name: server.name,
              transport: server.transport,
              url: server.url,
              command: server.command,
              enabled: server.enabled,
              appToolCount: 0,
              lastConnectedAt: server.lastConnectedAt
                ? new Date(server.lastConnectedAt).toLocaleString()
                : null,
            })
          );

          setServers(apps);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">MCP Apps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage Model Context Protocol server apps that provide
          interactive UI components.
        </p>
      </div>

      <Tabs className="w-full" onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger value="apps">Apps List</TabsTrigger>
          <TabsTrigger value="info">About MCP Apps</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="apps">
          {servers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  No MCP apps configured
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Configure MCP servers to extend the chatbot with interactive
                  apps.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {servers.map((app) => (
                <Card
                  className="hover:bg-muted/50 transition-colors"
                  key={app.name}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium truncate max-w-[160px]">
                        {app.name}
                      </CardTitle>
                      <Badge className="text-[10px] h-5" variant="outline">
                        {app.transport.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {app.transport === "stdio" ? (
                        <div className="flex items-center gap-1">
                          <TerminalIcon className="size-3" />
                          <span className="font-mono truncate max-w-[180px]">
                            {app.command}
                          </span>
                        </div>
                      ) : (
                        app.url && (
                          <div className="flex items-center gap-1">
                            <GlobeIcon className="size-3" />
                            <span className="truncate max-w-[180px]">
                              {app.url}
                            </span>
                          </div>
                        )
                      )}

                      {app.lastConnectedAt && (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          <span>
                            Last connected{" "}
                            {new Date(app.lastConnectedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge
                        className="text-[10px] h-4"
                        variant={app.enabled ? "default" : "secondary"}
                      >
                        {app.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {app.appToolCount} app tools
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6" value="info">
          <Card>
            <CardHeader>
              <CardTitle>About MCP Apps</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm text-sm space-y-3">
              <p>
                MCP Apps extend Model Context Protocol tools with interactive UI
                resources. When a tool has <code>_meta.ui.resourceUri</code>,
                the model calls it and you can render its <code>ui://</code>{" "}
                HTML in a sandboxed iframe.
              </p>
              <h4>Key Features:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Split Tool Visibility:</strong> Tools marked with{" "}
                  <code>visibility: ["model", "app"]</code> can be shown to the
                  model while interactive UIs stay separate
                </li>
                <li>
                  <strong>Sandboxed Rendering:</strong> MCP App resources are
                  rendered in iframes with proper security policies
                </li>
                <li>
                  <strong>Host Bridge:</strong> Your app acts as a bridge
                  between the model and interactive UI components
                </li>
                <li>
                  <strong>Tool Bridging:</strong> Model-initiated tool calls to
                  app-visible tools are proxied back to the original MCP server
                </li>
              </ul>
              <p>
                This enables complex interactive interfaces (dashboards, forms,
                charts) while keeping the LLM focused on tool calls rather than
                UI rendering.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
