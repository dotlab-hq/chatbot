"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MCPAppMetadata = {
  resourceUri: string;
  serverId: string;
  mimeType?: string;
};

type MCPAppResource = {
  uri: string;
  mimeType: string;
  html: string;
  meta?: {
    prefersBorder?: boolean;
    csp?: {
      connectDomains?: string[];
      resourceDomains?: string[];
      frameDomains?: string[];
    };
    permissions?: Record<string, unknown>;
  };
};

type MCPAppBridgeHandlers = {
  callTool?: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<unknown>;
  openLink?: (params: { url: string }) => Record<string, unknown>;
};

type MCPAppRendererProps = {
  toolCallId: string;
  metadata: MCPAppMetadata;
  input?: Record<string, unknown>;
  output?: unknown;
  sandbox?: {
    url: string;
    className?: string;
    style?: React.CSSProperties;
  };
  handlers?: MCPAppBridgeHandlers;
  fallback?: React.ReactNode;
};

// ─── Main Renderer ──────────────────────────────────────────────────────────

export function MCPAppRenderer({
  toolCallId,
  metadata,
  input,
  output,
  sandbox,
  handlers,
  fallback,
}: MCPAppRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resource, setResource] = useState<MCPAppResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the MCP App resource
  useEffect(() => {
    if (!metadata.resourceUri) {
      setError("No resource URI provided");
      setLoading(false);
      return;
    }

    const loadResource = async () => {
      try {
        const response = await fetch("/api/mcp-app-host/resource", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uri: metadata.resourceUri,
            serverId: metadata.serverId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to load resource");
        }

        const resourceData = await response.json();
        setResource(resourceData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load resource"
        );
      } finally {
        setLoading(false);
      }
    };

    loadResource();
  }, [metadata.resourceUri, metadata.serverId]);

  // Send tool input to iframe
  useEffect(() => {
    if (iframeRef.current && resource && input) {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "mcp:tool-input",
          toolCallId,
          input,
        },
        "*"
      );
    }
  }, [resource, input, toolCallId]);

  // Send tool output to iframe
  useEffect(() => {
    if (iframeRef.current && resource && output) {
      iframeRef.current.contentWindow?.postMessage(
        {
          type: "mcp:tool-output",
          toolCallId,
          output,
        },
        "*"
      );
    }
  }, [resource, output, toolCallId]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { data } = event;

      if (data?.type === "mcp:tool-call" && handlers?.callTool) {
        const { name, arguments: args, requestId } = data;
        try {
          const result = await handlers.callTool({ name, arguments: args });
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "mcp:tool-result",
              requestId,
              result,
            },
            "*"
          );
        } catch (err) {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "mcp:tool-error",
              requestId,
              error: err instanceof Error ? err.message : "Tool call failed",
            },
            "*"
          );
        }
      }

      if (data?.type === "mcp:open-link" && handlers?.openLink) {
        handlers.openLink({ url: data.url });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handlers]);

  if (loading) {
    return (
      fallback || (
        <div className="p-4 text-muted-foreground text-sm">
          Loading MCP App...
        </div>
      )
    );
  }

  if (error || !resource) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-red-600 text-sm">
        {error || "Failed to load MCP App"}
      </div>
    );
  }

  // Create srcdoc with injected HTML
  const srcdoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${
          resource.meta?.csp?.connectDomains?.length
            ? `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' ${resource.meta.csp.connectDomains.join(" ")}">`
            : ""
        }
        ${
          resource.meta?.csp?.resourceDomains?.length
            ? `<meta http-equiv="Content-Security-Policy" content="img-src 'self' ${resource.meta.csp.resourceDomains.join(" ")}">`
            : ""
        }
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; }
        </style>
      </head>
      <body>
        ${resource.html}
        <script>
          // Bridge for tool calls
          window.mcpBridge = {
            callTool: function(name, args) {
              return new Promise((resolve, reject) => {
                const requestId = Math.random().toString(36).slice(2);
                const handler = (event) => {
                  if (event.data?.type === 'mcp:tool-result' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handler);
                    resolve(event.data.result);
                  }
                  if (event.data?.type === 'mcp:tool-error' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handler);
                    reject(new Error(event.data.error));
                  }
                };
                window.addEventListener('message', handler);
                window.parent.postMessage({ type: 'mcp:tool-call', name, arguments: args, requestId }, '*');
              });
            },
            openLink: function(url) {
              window.parent.postMessage({ type: 'mcp:open-link', url }, '*');
            }
          };

          // Tool input/output notifications
          window.mcpToolInput = null;
          window.mcpToolOutput = null;
          window.addEventListener('message', (event) => {
            if (event.data?.type === 'mcp:tool-input') {
              window.mcpToolInput = event.data.input;
              window.dispatchEvent(new CustomEvent('mcp-tool-input', { detail: event.data }));
            }
            if (event.data?.type === 'mcp:tool-output') {
              window.mcpToolOutput = event.data.output;
              window.dispatchEvent(new CustomEvent('mcp-tool-output', { detail: event.data }));
            }
          });
        </script>
      </body>
    </html>
  `;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <iframe
        className={sandbox?.className || "w-full h-80"}
        ref={iframeRef}
        sandbox="allow-scripts allow-popups"
        srcDoc={srcdoc}
        style={sandbox?.style || { border: 0 }}
        title={`MCP App: ${metadata.resourceUri}`}
      />
    </div>
  );
}

// ─── Helper: Check if a tool part has MCP App metadata ──────────────────────

export function isMCPAppPart(part: {
  type: string;
  providerMetadata?: Record<string, unknown>;
}): boolean {
  const mcpMeta = part.providerMetadata?.mcp as
    | Record<string, unknown>
    | undefined;
  const appMeta = mcpMeta?.app as Record<string, unknown> | undefined;
  return Boolean(appMeta?.resourceUri);
}

export function getMCPAppMetadata(part: {
  type: string;
  providerMetadata?: Record<string, unknown>;
}): MCPAppMetadata | null {
  const mcpMeta = part.providerMetadata?.mcp as
    | Record<string, unknown>
    | undefined;
  const appMeta = mcpMeta?.app as Record<string, unknown> | undefined;

  if (!appMeta?.resourceUri) {
    return null;
  }

  return {
    resourceUri: appMeta.resourceUri as string,
    serverId: appMeta.serverId as string,
    mimeType: appMeta.mimeType as string | undefined,
    ...appMeta,
  } as MCPAppMetadata;
}
