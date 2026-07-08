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
const singleRequestSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
    .describe("HTTP method for the request"),

  url: z.string().url().describe("The URL to request"),

  headers: z.record(z.string()).optional().describe("Optional request headers"),

  body: z
    .string()
    .optional()
    .describe(
      "Raw request body. Must match the supplied Content-Type (e.g. JSON string, URL-encoded string, XML, etc.)"
    ),

  timeout: z
    .number()
    .min(1000)
    .max(30_000)
    .default(10_000)
    .describe("Request timeout in milliseconds"),

  referrerPolicy: z
    .enum([
      "no-referrer",
      "no-referrer-when-downgrade",
      "origin",
      "origin-when-cross-origin",
      "same-origin",
      "strict-origin",
      "strict-origin-when-cross-origin",
      "unsafe-url",
    ])
    .default("strict-origin-when-cross-origin")
    .describe("Browser referrer policy for the request"),
});

const singleResultSchema = z.object({
  request: z.object({
    method: z.string(),
    url: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.string().nullable(),
    referrerPolicy: z.string(),
  }),
  response: z
    .object({
      status: z.number(),
      statusText: z.string(),
      headers: z.record(z.string()),
      body: z.unknown(),
    })
    .optional(),
  error: z.string().optional(),
  ok: z.boolean().optional(),
});

export type ClientHttpRequestInput = z.infer<typeof singleRequestSchema>;
export type ClientHttpRequestOutput = z.infer<typeof singleResultSchema>;

export const clientHttpRequest = tool({
  description: `Execute one or more HTTP requests from the CLIENT/BROWSER (no proxy, user's IP).
Use this for ANY HTTP request that should come from the user's IP address rather than the server.
This allows APIs to see the user's real IP and bypass server-side proxy restrictions.
Pass an array of requests — each returns status, headers, and parsed JSON body rendered as a separate card.`,
  inputSchema: z.object({
    requests: z
      .array(singleRequestSchema)
      .min(1)
      .max(10)
      .describe("Array of HTTP requests to execute (1-10)"),
  }),

  // No `execute` here — this is a CLIENT-side tool.
  // Actual execution happens in `onToolCall` in hooks/use-active-chat.tsx,
  // which runs in the browser where `fetch` originates from the user's IP.
  // Having an `execute` here would cause a SECOND (server-side) call.
  outputSchema: z.object({
    results: z.array(singleResultSchema),
  }),
});
