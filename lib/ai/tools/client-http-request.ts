import { tool } from "ai";
import { z } from "zod";

/**
 * Client-side HTTP request tool.
 * Executes in the browser using regular `fetch` — NO proxy.
 * Use this for API calls that should come from the user's IP, not the server.
 *
 * @see httpRequest in lib/ai/tools/random-api.ts for the server-side version
 *     that routes through HTTP_PROXY.
 */
export const clientHttpRequest = tool({
  description: `Execute an HTTP request from your browser (no proxy).
Use this to call public APIs when you need the request to originate from the user's IP address.
Returns status, headers, and parsed JSON body.
For proxied requests, use the server-side httpRequest tool instead.`,
  inputSchema: z.object({
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .describe("HTTP method for the request"),
    url: z.string().url().describe("The URL to request"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Optional request headers"),
    body: z
      .string()
      .optional()
      .describe("JSON body for POST/PUT/PATCH requests"),
    timeout: z
      .number()
      .min(1000)
      .max(3e4)
      .default(1e4)
      .describe("Request timeout in milliseconds"),
  }),
  execute: async ({ method, url, headers, body, timeout }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body:
          body && ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = response.headers.get("content-type") || "";
      let responseBody: unknown;
      try {
        const text = await response.text();
        if (contentType.includes("application/json")) {
          responseBody = JSON.parse(text);
        } else if (contentType.includes("text/")) {
          responseBody = text;
        } else {
          responseBody = text;
        }
      } catch {
        responseBody = "(binary or unreadable response)";
      }

      return {
        request: { method, url, headers, body: body ?? null },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
        ok: response.ok,
      };
    } catch (err) {
      return {
        request: { method, url, headers, body: body ?? null },
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },
});
