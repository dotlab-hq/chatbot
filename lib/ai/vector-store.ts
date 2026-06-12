import OpenAI from "openai";

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
  fileName,
}: {
  vectorStoreId: string;
  file: File | Buffer;
  fileName: string;
}): Promise<{ fileId: string; vectorStoreFileId: string }> {
  // Step 1: Upload file to OpenAI Files API
  const uploadedFile = await openai.files.create({
    file:
      file instanceof File ? file : new File([new Uint8Array(file)], fileName),
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

  return response.data.map((result) => ({
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
}
