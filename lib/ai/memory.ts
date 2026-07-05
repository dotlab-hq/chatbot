/**
 * MongoDB Atlas-backed persistent memory for the chatbot.
 *
 * Five structured tiers:
 *   - session:    Current conversation working memory (chatId scoped)
 *   - semantic:   Long-term facts about the user (userId scoped)
 *   - procedural: Learned patterns & how-to knowledge (userId scoped)
 *   - episodic:   Past experiences and events (userId scoped)
 *   - scratchpad: Temporary working memory, auto-pruned (chatId scoped)
 *
 * All queries are scoped by userId + chatId where appropriate.
 * Retrieval uses Atlas Vector Search when an embedding provider is available,
 * falling back to text search otherwise.
 */

import { type Collection, type Db, type Document, MongoClient } from "mongodb";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MemoryTier =
  | "session"
  | "semantic"
  | "procedural"
  | "episodic"
  | "scratchpad";

export interface MemoryEntry {
  _id?: import("mongodb").ObjectId;
  /** The user who owns this memory */
  userId: string;
  /** The chat/conversation this memory belongs to (for session/scratchpad) */
  chatId: string;
  /** Memory tier */
  tier: MemoryTier;
  /** The actual content stored */
  content: string;
  /** Optional label / short summary */
  label?: string;
  /** Embedding vector for semantic search (populated asynchronously) */
  embedding?: number[];
  /** When the memory was created */
  createdAt: Date;
  /** When the memory was last accessed / updated */
  updatedAt: Date;
  /** Optional: arbitrary metadata (e.g. source message id) */
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  /** Cosine similarity score (0-1), higher = more relevant */
  score: number;
}

// ─── Connection ──────────────────────────────────────────────────────────────

let _client: MongoClient | null = null;
let _db: Db | null = null;

function getCollectionName(tier: MemoryTier): string {
  return `memory_${tier}`;
}

export function getDb(): Db {
  if (_db) {
    return _db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your environment variables."
    );
  }

  _client = new MongoClient(uri);
  _db = _client.db(process.env.MONGODB_DB_NAME || "chatbot_memory");
  return _db;
}

function getCollection(tier: MemoryTier): Collection<MemoryEntry> {
  return getDb().collection<MemoryEntry>(getCollectionName(tier));
}

/**
 * Ensure indexes exist. Called once at startup or lazily on first use.
 */
let _indexesEnsured = false;

export async function ensureIndexes(): Promise<void> {
  if (_indexesEnsured) {
    return;
  }

  const db = getDb();

  for (const tier of [
    "session",
    "semantic",
    "procedural",
    "episodic",
    "scratchpad",
  ] as MemoryTier[]) {
    const coll = db.collection<MemoryEntry>(getCollectionName(tier));

    // Compound index for scoped lookups
    await coll.createIndex({ userId: 1, chatId: 1, updatedAt: -1 });

    // Tier-specific index for listing
    await coll.createIndex({ userId: 1, tier: 1, updatedAt: -1 });

    // TTL index for scratchpad: auto-delete after 24 hours
    if (tier === "scratchpad") {
      await coll.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 24 * 60 * 60 }
      );
    }

    // Session memories expire after 7 days
    if (tier === "session") {
      await coll.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 7 * 24 * 60 * 60 }
      );
    }
  }

  _indexesEnsured = true;
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Save a new memory entry.
 */
export async function saveMemory(
  params: Pick<
    MemoryEntry,
    "userId" | "chatId" | "tier" | "content" | "label" | "metadata"
  > & {
    embedding?: number[];
  }
): Promise<MemoryEntry> {
  await ensureIndexes();

  const now = new Date();
  const entry: MemoryEntry = {
    userId: params.userId,
    chatId: params.chatId,
    tier: params.tier,
    content: params.content,
    label: params.label,
    embedding: params.embedding,
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata,
  };

  const coll = getCollection(params.tier);
  const result = await coll.insertOne(entry);
  entry._id = result.insertedId;
  return entry;
}

/**
 * Search memories within a tier using cosine similarity on embeddings,
 * or fall back to text search.
 */
export async function searchMemories(params: {
  userId: string;
  chatId: string;
  tier: MemoryTier;
  query?: string;
  embedding?: number[];
  maxResults?: number;
}): Promise<MemorySearchResult[]> {
  await ensureIndexes();

  const { userId, chatId, tier, query, embedding, maxResults = 10 } = params;
  const coll = getCollection(tier);

  // For session and scratchpad, scope to the current chat
  // For semantic, procedural, episodic, scope to the user (cross-chat)
  const isUserScoped = ["semantic", "procedural", "episodic"].includes(tier);

  const matchStage: Document = isUserScoped
    ? { userId, tier }
    : { userId, chatId, tier };

  // If we have embeddings, use vector search via $vectorSearch (Atlas)
  // For now, fall back to text search which works without Atlas vector index
  if (embedding && embedding.length > 0) {
    try {
      // Try Atlas Vector Search first
      const pipeline: Document[] = [
        {
          $vectorSearch: {
            index: "memory_vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: Math.min(maxResults * 10, 100),
            limit: maxResults,
            filter: matchStage,
          },
        },
        {
          $addFields: {
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const results = await coll.aggregate(pipeline).toArray();
      return results.map((doc) => ({
        entry: doc as unknown as MemoryEntry,
        score: doc.score as number,
      }));
    } catch {
      // Vector search index may not exist, fall through to text search
    }
  }

  // Text search fallback: use $text if available, otherwise regex
  if (query) {
    try {
      const textResults = await coll
        .find({ ...matchStage, $text: { $search: query } })
        .sort({ updatedAt: -1 })
        .limit(maxResults)
        .toArray();

      if (textResults.length > 0) {
        return textResults.map((doc) => ({
          entry: doc,
          score: 0.5, // Text search doesn't give scores
        }));
      }
    } catch {
      // $text index may not exist, fall through to regex
    }

    // Regex fallback
    const regexResults = await coll
      .find({
        ...matchStage,
        content: { $regex: escapeRegex(query), $options: "i" },
      })
      .sort({ updatedAt: -1 })
      .limit(maxResults)
      .toArray();

    return regexResults.map((doc) => ({
      entry: doc,
      score: 0.3,
    }));
  }

  // No query — just return recent memories
  const recentResults = await coll
    .find(matchStage)
    .sort({ updatedAt: -1 })
    .limit(maxResults)
    .toArray();

  return recentResults.map((doc) => ({
    entry: doc,
    score: 1.0,
  }));
}

/**
 * List all memories for a user/chat, optionally filtered by tier.
 */
export async function listMemories(params: {
  userId: string;
  chatId?: string;
  tier?: MemoryTier;
  limit?: number;
}): Promise<MemoryEntry[]> {
  await ensureIndexes();

  const { userId, chatId, tier, limit = 50 } = params;
  const coll = getCollection(tier || "semantic");

  const filter: Document = { userId };
  if (chatId) {
    filter.chatId = chatId;
  }
  if (tier) {
    filter.tier = tier;
  }

  return coll.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
}

/**
 * Delete a specific memory by ID.
 */
export async function deleteMemory(params: {
  userId: string;
  tier: MemoryTier;
  memoryId: string;
}): Promise<boolean> {
  await ensureIndexes();

  const { userId, tier, memoryId } = params;
  const coll = getCollection(tier);
  const { ObjectId } = await import("mongodb");

  const result = await coll.deleteOne({
    _id: new ObjectId(memoryId),
    userId,
  });

  return result.deletedCount > 0;
}

/**
 * Update an existing memory entry's content.
 */
export async function updateMemory(params: {
  userId: string;
  tier: MemoryTier;
  memoryId: string;
  content: string;
  label?: string;
}): Promise<boolean> {
  await ensureIndexes();

  const { userId, tier, memoryId, content, label } = params;
  const coll = getCollection(tier);
  const { ObjectId } = await import("mongodb");

  const update: Document = {
    $set: { content, updatedAt: new Date() },
  };
  if (label !== undefined) {
    update.$set.label = label;
  }

  const result = await coll.updateOne(
    { _id: new ObjectId(memoryId), userId },
    update
  );

  return result.modifiedCount > 0;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Clear all memories for a user/chat combination.
 */
export async function clearMemories(params: {
  userId: string;
  chatId?: string;
  tier?: MemoryTier;
}): Promise<number> {
  await ensureIndexes();

  const { userId, chatId, tier } = params;

  const tiers: MemoryTier[] = tier
    ? [tier]
    : ["session", "semantic", "procedural", "episodic", "scratchpad"];

  let totalDeleted = 0;
  for (const t of tiers) {
    const coll = getCollection(t);
    const filter: Document = { userId };
    if (chatId) {
      filter.chatId = chatId;
    }

    const result = await coll.deleteMany(filter);
    totalDeleted += result.deletedCount;
  }

  return totalDeleted;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gracefully close the MongoDB connection.
 */
export async function closeMemoryConnection(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
    _indexesEnsured = false;
  }
}
