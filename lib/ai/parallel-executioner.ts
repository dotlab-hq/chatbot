import { tool } from "ai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnyToolDef = {
  execute?: (
    input: unknown,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  description?: string;
  [key: string]: unknown;
};

type BatchCall = {
  toolName: string;
  args: Record<string, unknown>;
};

type BatchResult = {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
};

type BatchOutput = {
  summary: string;
  results: BatchResult[];
  totalExecutionTimeMs: number;
};

// ---------------------------------------------------------------------------
// ParallelExecutioner
// ---------------------------------------------------------------------------

/**
 * Executes multiple independent tool calls concurrently.
 *
 * - Each call is **error-isolated**: one failure never blocks other calls.
 * - Execution uses `Promise.all` so all calls run in parallel.
 * - The constructor accepts the full tools dictionary plus an optional
 *   skip-list of tool names that must never be dispatched (e.g. `runParallel`
 *   itself, or document tools with data-stream side effects).
 */
export class ParallelExecutioner {
  private readonly tools: Record<string, AnyToolDef>;
  private readonly skipTools: Set<string>;

  constructor(
    tools: Record<string, AnyToolDef>,
    skipTools: string[] = ["runParallel"]
  ) {
    this.tools = tools;
    this.skipTools = new Set(skipTools);
  }

  /**
   * Execute all supplied calls in parallel.
   * Returns a summary plus per-call results with timing.
   */
  async executeAll(calls: BatchCall[]): Promise<BatchOutput> {
    const startTotal = performance.now();

    const results: BatchResult[] = await Promise.all(
      calls.map(async (call) => {
        const start = performance.now();

        // Tool not registered
        const toolDef = this.tools[call.toolName];
        if (!toolDef) {
          return {
            toolName: call.toolName,
            success: false,
            error: `Tool '${call.toolName}' is not available in this session`,
            executionTimeMs: 0,
          };
        }

        // Tool has no server-side execute (e.g. clientHttpRequest)
        if (!toolDef.execute) {
          return {
            toolName: call.toolName,
            success: false,
            error: `Tool '${call.toolName}' has no server-side execute function`,
            executionTimeMs: 0,
          };
        }

        // Tool is in the skip-list
        if (this.skipTools.has(call.toolName)) {
          return {
            toolName: call.toolName,
            success: false,
            error: `Tool '${call.toolName}' cannot be called inside a parallel batch`,
            executionTimeMs: 0,
          };
        }

        try {
          const result = await toolDef.execute(call.args);
          return {
            toolName: call.toolName,
            success: true,
            result,
            executionTimeMs: Math.round(performance.now() - start),
          };
        } catch (error) {
          return {
            toolName: call.toolName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTimeMs: Math.round(performance.now() - start),
          };
        }
      })
    );

    const totalExecutionTimeMs = Math.round(performance.now() - startTotal);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      summary: `Ran ${results.length} tool calls in parallel: ${succeeded} ok, ${failed} failed — ${totalExecutionTimeMs}ms total`,
      results,
      totalExecutionTimeMs,
    };
  }
}

// ---------------------------------------------------------------------------
// createParallelTool
// ---------------------------------------------------------------------------

/**
 * Factory: creates the `runParallel` meta-tool.
 *
 * The LLM calls `runParallel({ calls: [...] })` to batch independent tool
 * calls.  ALL calls execute concurrently via `Promise.all`.
 *
 * @param tools        Full tool registry (tool name → AI SDK tool object).
 * @param excludeTools Tool names that MUST NOT be dispatched inside a batch
 *                     (e.g. `runParallel`, document/artifact tools, subagent
 *                     tools that need dedicated data-stream events).
 */
export function createParallelTool(
  tools: Record<string, AnyToolDef>,
  excludeTools: string[] = [
    "runParallel",
    "createDocument",
    "editDocument",
    "updateDocument",
    "requestSuggestions",
    "researchTool",
    "randomApiTool",
  ]
) {
  const executioner = new ParallelExecutioner(tools, excludeTools);

  const availableToolNames = Object.keys(tools)
    .filter((name) => {
      if (excludeTools.includes(name)) {
        return false;
      }
      return typeof tools[name]?.execute === "function";
    })
    .sort();

  return tool({
    description: [
      "Execute MULTIPLE independent tool calls IN PARALLEL to save time.",
      "Use this when you need several unrelated operations simultaneously.",
      "",
      "Available tools you can batch:",
      ...availableToolNames.map((n) => `  - ${n}`),
      "",
      "Best for: weather + local time + currency rates in one call,",
      "multiple web searches, or any independent data gathering.",
    ].join("\n"),
    inputSchema: z.object({
      description: z
        .string()
        .optional()
        .describe(
          "Brief explanation of what these parallel calls accomplish together"
        ),
      calls: z
        .array(
          z.object({
            toolName: z
              .string()
              .describe(
                "Name of the tool to call (must be in the available list)"
              ),
            args: z
              .record(z.unknown())
              .describe(
                "Arguments matching the tool's own input schema — required fields must be present"
              ),
          })
        )
        .min(2)
        .max(20)
        .describe("2–20 independent tool calls to execute simultaneously"),
    }),
    execute: ({ calls }) => executioner.executeAll(calls),
  });
}

// ---------------------------------------------------------------------------
// Parallel prompt section
// ---------------------------------------------------------------------------

/**
 * System-prompt section that tells the LLM *when* and *how* to use parallel
 * execution.  Append to the prompt where tool rules are listed.
 */
export const parallelPromptSection = `
## ⚡ Parallel Execution

You have a \`runParallel\` tool that executes MULTIPLE independent tool calls
SIMULTANEOUSLY.  This is faster than calling tools one at a time.

**When to use \`runParallel\`:**
- Gathering independent data: weather + local time + exchange rates + unit conversions, etc.
- Running several web searches at once
- Any set of tools whose inputs do NOT depend on each other's outputs
- Up to 20 calls per batch

**When NOT to use \`runParallel\` — call these tools directly, in order:**
- \`createDocument\`, \`editDocument\`, \`updateDocument\`, \`requestSuggestions\` — these write to the real-time data stream and need exclusive access
- \`researchTool\`, \`randomApiTool\` — subagent tools that stream progress events and need dedicated data-stream slots
- \`runParallel\` itself — no nesting

**Example:**
\`\`\`
runParallel({
  description: "Gather Tokyo weather, local time, and JPY→USD rate",
  calls: [
    { toolName: "getWeather", args: { city: "Tokyo" } },
    { toolName: "localTime", args: { city: "Tokyo" } },
    { toolName: "currencyConverter", args: { amount: 10000, from: "JPY", to: "USD" } }
  ]
})
\`\`\`

**Error handling:** Each call is isolated. If one fails, the others still
complete. Check the \`results\` array for individual \`success\` / \`error\`.
`;

// ---------------------------------------------------------------------------
// Helper: tool names that must ALWAYS run sequentially
// ---------------------------------------------------------------------------

/** Tools that have side effects on the shared data-stream and MUST NOT be
 *  parallelised.  Used by `createParallelTool` by default. */
export const SEQUENTIAL_TOOLS = new Set([
  "createDocument",
  "editDocument",
  "updateDocument",
  "requestSuggestions",
  "researchTool",
  "randomApiTool",
  "runParallel",
]);
