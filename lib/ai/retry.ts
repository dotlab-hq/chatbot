/**
 * Server-side retry mechanism for AI SDK streamText and generateText calls.
 *
 * The AI gateway / provider API can drop mid-stream, especially during long
 * reasoning phases with reasoning models. This module provides transparent
 * retry wrappers that:
 *
 * 1. Forward reasoning (and other non-content) chunks immediately so the
 *    user sees real-time thinking even across retried attempts.
 * 2. If the stream fails BEFORE producing substantive content (text-delta
 *    or tool-call), automatically retry with exponential backoff. The SSE
 *    connection stays alive and new chunks from the retry flow through.
 * 3. Forward text-delta / tool-call chunks immediately too — once those
 *    start flowing the stream is committed and no retry is attempted.
 * 4. Also validate the finish chunk at stream end to catch silent
 *    truncation (HTTP 200 with partial data).
 * 5. Track usage from the successful attempt.
 *
 * For generateText (non-streaming), a simpler retry wrapper is provided.
 */

import { generateText, MissingToolResultsError, streamText } from "ai";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2, meaning 2 retries = 3 total attempts) */
  maxRetries?: number;
  /** Maximum backoff delay in milliseconds (default: 10_000) */
  maxBackoffMs?: number;
}

// ─── Retry for streamText ───────────────────────────────────────────────────

const CONTENT_EVENT_TYPES = new Set([
  "text-delta",
  "tool-call-begin",
  "tool-call",
]);

/**
 * Wrap streamText with automatic mid-stream retry.
 *
 * Unlike a buffer-then-forward approach, this forwards **all** chunks
 * immediately — reasoning, text-delta, tool-calls — so the client gets
 * real-time streaming. Retry is only attempted when the stream drops
 * BEFORE any substantive content (text-delta / tool-call) has been
 * forwarded. During a retry the SSE connection stays alive; new chunks
 * from the retried attempt simply continue flowing.
 *
 * Once content starts flowing the stream is committed and errors
 * propagate directly — no retry.
 *
 * @example
 * ```ts
 * const { stream, usage } = await retryableStreamText({
 *   model: getLanguageModel(chatModel),
 *   messages: modelMessages,
 *   // ... other streamText options
 * });
 * ```
 */
export function retryableStreamText(
  params: Parameters<typeof streamText>[0],
  options: RetryOptions = {}
): {
  stream: ReadableStream<any>;
  usage: Promise<any>;
} {
  const { maxRetries = 2, maxBackoffMs = 10_000 } = options;

  // We'll resolve usage from the last (successful) attempt
  let usageResolve: (usage: any) => void;
  const usagePromise = new Promise<any>((resolve) => {
    usageResolve = resolve;
  });

  const stream = new ReadableStream<any>({
    async start(controller) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s, ...
          const backoff = Math.min(1000 * 2 ** (attempt - 1), maxBackoffMs);
          console.warn(
            `[retry:streamText] Backing off ${backoff}ms before attempt ${attempt + 1}/${maxRetries + 1}`
          );
          await new Promise((r) => setTimeout(r, backoff));
        }

        const result = streamText({ ...params, maxRetries: 1 });
        let hasProducedContent = false;

        try {
          // Read the stream chunk-by-chunk, forwarding immediately
          for await (const chunk of result.stream) {
            // Track whether substantive content has been forwarded
            if (CONTENT_EVENT_TYPES.has(chunk.type)) {
              hasProducedContent = true;
            }

            if (chunk.type === "finish") {
              // ── Validate finish chunk ───────────────────────────────
              // Catch silent truncation: Gateway sometimes returns HTTP
              // 200 with partial data when the provider drops mid-stream.
              if (chunk.finishReason === "error") {
                throw new Error("Stream finished with error reason");
              }

              if (chunk.finishReason !== "stop") {
                console.warn(
                  `[retry:streamText] Finish reason "${chunk.finishReason}" on attempt ${attempt + 1}/${maxRetries + 1}`
                );
              }

              // Forward finish chunk, close stream, resolve usage
              controller.enqueue(chunk);
              controller.close();
              result.usage.then(usageResolve, () => usageResolve(null));
              return;
            }

            // Forward everything else immediately — reasoning, text, etc.
            controller.enqueue(chunk);
          }

          // Stream exhausted without a finish chunk = truncated
          throw new Error(
            "Stream ended without a finish chunk — likely truncated mid-stream"
          );
        } catch (error) {
          lastError =
            error instanceof Error
              ? error
              : new Error(`Stream error: ${String(error)}`);

          if (hasProducedContent) {
            // Content already forwarded — can't retry without duplication
            console.error(
              `[retry:streamText] Failed AFTER content on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}`
            );
            usageResolve(null);
            controller.error(lastError);
            return;
          }

          if (lastError instanceof MissingToolResultsError) {
            // Deterministic error: same input will always produce the same
            // result, so retrying is futile. Propagate immediately.
            console.error(
              `[retry:streamText] MissingToolResultsError (deterministic) on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}`
            );
            usageResolve(null);
            controller.error(lastError);
            return;
          }

          console.warn(
            `[retry:streamText] Failed BEFORE content on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}`
          );

          if (attempt >= maxRetries) {
            usageResolve(null);
            controller.error(lastError);
            return;
          }

          // Retry the loop — SSE connection stays alive
        }
      }

      const exhausted = lastError ?? new Error("All retry attempts exhausted");
      usageResolve(null);
      controller.error(exhausted);
    },
  });

  return { stream, usage: usagePromise };
}

// ─── Retry for generateText ─────────────────────────────────────────────────

/**
 * Wrap generateText with automatic retry on failure.
 *
 * Uses exponential backoff. All errors trigger retry (unlike the stream
 * variant, since generateText has no partial-failure concept).
 *
 * @example
 * ```ts
 * const result = await retryableGenerateText({
 *   model: getLanguageModel(modelId),
 *   prompt: "...",
 * });
 * ```
 */
export async function retryableGenerateText(
  params: Parameters<typeof generateText>[0],
  options: RetryOptions = {}
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const { maxRetries = 2, maxBackoffMs = 10_000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** (attempt - 1), maxBackoffMs);
      await new Promise((r) => setTimeout(r, backoff));
    }

    try {
      const result = await generateText({ ...params, maxRetries: 1 });
      return result;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`GenerateText error: ${String(error)}`);

      console.warn(
        `[retry:generateText] Failed on attempt ${attempt + 1}/${maxRetries + 1}: ${lastError.message}`
      );

      if (attempt >= maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("All retry attempts exhausted");
}
