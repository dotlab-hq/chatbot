import { tool } from "ai";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI();

// ─── Vector Store Operations ────────────────────────────────────────────────

export async function createVectorStore(name: string): Promise<string> {
  const vectorStore = await openai.vectorStores.create({ name });
  return vectorStore.id;
}

export async function deleteVectorStore(vectorStoreId: string): Promise<void> {
  await openai.vectorStores.delete(vectorStoreId);
}

// ─── File Operations ────────────────────────────────────────────────────────

export async function uploadFileToVectorStore({
  vectorStoreId,
  file,
}: {
  vectorStoreId: string;
  file: File;
  fileName: string;
}): Promise<{ fileId: string; vectorStoreFileId: string }> {
  // Step 1: Upload file to OpenAI Files API
  const uploadedFile = await openai.files.create({
    file,
    purpose: "assistants",
  });

  // Step 2: Add file to vector store
  const vectorStoreFile = await openai.vectorStores.files.create(
    vectorStoreId,
    { file_id: uploadedFile.id }
  );

  return { fileId: uploadedFile.id, vectorStoreFileId: vectorStoreFile.id };
}

export async function removeFileFromVectorStore({
  vectorStoreId,
  vectorStoreFileId,
}: {
  vectorStoreId: string;
  vectorStoreFileId: string;
}): Promise<void> {
  await openai.vectorStores.files.delete(vectorStoreFileId, {
    vector_store_id: vectorStoreId,
  });
}

export async function listVectorStoreFiles({
  vectorStoreId,
  limit = 100,
  after,
}: {
  vectorStoreId: string;
  limit?: number;
  after?: string;
}): Promise<{ id: string; object: string; created_at: number }[]> {
  const response = await openai.vectorStores.files.list(vectorStoreId, {
    limit,
    ...(after ? { after } : {}),
  });
  return response.data as { id: string; object: string; created_at: number }[];
}

// ─── Status-Aware List Operations ──────────────────────────────────────────

export interface VectorStoreFileWithStatus {
  /** OpenAI vector store file ID (same as openaiFileId for vector store files) */
  vectorStoreFileId: string;
  /** Processing status from OpenAI: in_progress | completed | cancelled | failed */
  status: "in_progress" | "completed" | "cancelled" | "failed";
  /** Size in bytes after vectorization */
  usageBytes: number;
  /** Last error from OpenAI, if any */
  lastError: { code: string; message: string } | null;
  /** Unix timestamp (seconds) */
  createdAt: number;
}

/**
 * Query OpenAI directly for the real-time processing status of all files
 * in a vector store. This is the source of truth for whether a file has
 * been fully processed — the DB status is stale once set.
 */
export async function listVectorStoreFilesWithStatus({
  vectorStoreId,
  limit = 100,
}: {
  vectorStoreId: string;
  limit?: number;
}): Promise<VectorStoreFileWithStatus[]> {
  const response = await openai.vectorStores.files.list(vectorStoreId, {
    limit,
  });

  return response.data.map((file) => ({
    vectorStoreFileId: file.id,
    status: file.status,
    usageBytes: file.usage_bytes,
    lastError: file.last_error,
    createdAt: file.created_at,
  }));
}

// ─── Search Operations ──────────────────────────────────────────────────────

export interface VectorSearchResult {
  fileId: string;
  filename: string;
  score: number;
  content: string;
}

export async function searchVectorStore({
  vectorStoreId,
  query,
  maxResults = 5,
}: {
  vectorStoreId: string;
  query: string;
  maxResults?: number;
}): Promise<VectorSearchResult[]> {
  const response = await openai.vectorStores.search(vectorStoreId, {
    query,
    max_num_results: maxResults,
    rewrite_query: true,
  });

  let results = response.data.map((result) => ({
    fileId: result.file_id,
    filename: result.filename ?? "",
    score: result.score ?? 0,
    content: (result.content ?? [])
      .filter(
        (c): c is { type: "text"; text: string } =>
          c.type === "text" && "text" in c
      )
      .map((c) => c.text)
      .join("\n"),
  }));

  // Try to rerank results if Cohere reranking is available
  try {
    const rerankResults = await rerankVectorStoreResults({
      query,
      results,
      maxResults,
    });
    if (rerankResults.length > 0) {
      results = rerankResults;
    }
  } catch (error) {
    // If reranking fails, fall back to the original results
    console.warn("Reranking failed, using original scores:", error);
  }

  return results;
}

// ─── Cohere Reranking ──────────────────────────────────────────────────────

/**
 * Rerank vector store results using Cohere's reranking model.
 * Falls back to original results if Cohere API is unavailable.
 */
export async function rerankVectorStoreResults({
  query,
  results,
  maxResults = 5,
}: {
  query: string;
  results: VectorSearchResult[];
  maxResults?: number;
}): Promise<VectorSearchResult[]> {
  if (results.length === 0) {
    return [];
  }

  const cohereApiKey = process.env.COHERE_API_KEY;
  if (!cohereApiKey) {
    // No Cohere API key available, return original results
    return results.slice(0, maxResults);
  }

  // Prepare documents for reranking
  const documents = results.map((r) => r.content);

  try {
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "rerank-v3.5",
        query,
        documents,
        top_n: maxResults,
        max_tokens_per_doc: 4096,
      }),
    });

    if (!response.ok) {
      console.warn(`Cohere rerank API error: ${response.status}`);
      return results.slice(0, maxResults);
    }

    const data = await response.json();
    const rerankedResults: VectorSearchResult[] = [];

    // Map reranked results back to original structure
    for (const result of data.results) {
      const originalResult = results[result.index];
      if (originalResult) {
        rerankedResults.push({
          ...originalResult,
          score: result.relevance_score,
        });
      }
    }

    return rerankedResults;
  } catch (error) {
    console.warn("Cohere reranking failed:", error);
    return results.slice(0, maxResults);
  }
}

// ─── AI Tool Factories ──────────────────────────────────────────────────────
// These return AI SDK tools bound to a specific vector store.
// The LLM calls them autonomously — the system prompt instructs when to use each.

const fileStatusEnum = z.enum([
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Tool 1: Semantic search across all project files.
 * The LLM calls this with a natural language query to find relevant chunks.
 */
export function createSearchProjectFilesTool(vectorStoreId: string) {
  return tool({
    description:
      "Search the user's project files for relevant information using semantic search. Use this when the user asks about their project, uploaded files, or anything that might be contained in their documents. Pass a natural language query describing what information you need.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Natural language search query describing the information you need"
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of results to return (default 10)"),
    }),
    execute: async ({ query, maxResults }) => {
      const results = await searchVectorStore({
        vectorStoreId,
        query,
        maxResults,
      });
      if (results.length === 0) {
        return "No relevant content found in project files for this query.";
      }
      return results
        .map(
          (r, i) =>
            `[Result ${i + 1} | File: ${r.filename} | Score: ${r.score.toFixed(2)}]\n${r.content}`
        )
        .join("\n\n---\n\n");
    },
  });
}

/**
 * Tool 2: List all files in the vector store with their processing status.
 * The LLM calls this to discover what files are available before searching or reading.
 */
export function createListProjectFilesTool(vectorStoreId: string) {
  return tool({
    description:
      "List all files in the user's project vector store, including their processing status. Use this to discover what files are available, check if files are ready, or find a file's ID before retrieving its content.",
    inputSchema: z.object({
      statusFilter: fileStatusEnum
        .optional()
        .describe(
          "Optional: filter by file status (in_progress, completed, failed, cancelled)"
        ),
    }),
    execute: async ({ statusFilter }) => {
      const response = await openai.vectorStores.files.list(vectorStoreId, {
        filter: statusFilter,
        limit: 100,
      });

      if (response.data.length === 0) {
        return statusFilter
          ? `No files found with status "${statusFilter}".`
          : "This project has no files.";
      }

      const lines = response.data.map(
        (f) =>
          `- ID: ${f.id} | Status: ${f.status} | Size: ${f.usage_bytes} bytes | Created: ${new Date(f.created_at * 1000).toISOString()}${f.last_error ? ` | Error: ${f.last_error.message}` : ""}`
      );

      return `Found ${response.data.length} file(s):\n${lines.join("\n")}`;
    },
  });
}

/**
 * Tool 3: Retrieve the parsed text content of a specific file.
 * The LLM calls this after listing files to read the full content of a file by ID.
 */
export function createGetFileContentTool(vectorStoreId: string) {
  return tool({
    description:
      "Retrieve the full parsed text content of a specific file from the vector store. Use this after listProjectFiles to find a file's ID, then call this tool to read its entire content. Useful for reading a resume, document, or any uploaded file in full.",
    inputSchema: z.object({
      fileId: z
        .string()
        .describe(
          "The vector store file ID to retrieve (get this from listProjectFiles)"
        ),
    }),
    execute: async ({ fileId }) => {
      const pages: string[] = [];
      for await (const chunk of openai.vectorStores.files.content(fileId, {
        vector_store_id: vectorStoreId,
      })) {
        if (chunk.text) {
          pages.push(chunk.text);
        }
      }

      if (pages.length === 0) {
        return "No text content could be retrieved from this file. The file may still be processing or may not contain extractable text.";
      }

      const fullText = pages.join("\n");
      return fullText;
    },
  });
}
