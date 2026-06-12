import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  listVectorStoreFilesWithStatus,
  removeFileFromVectorStore,
  uploadFileToVectorStore,
} from "@/lib/ai/vector-store";
import {
  addProjectFile,
  deleteProjectFileById,
  getProjectById,
  getProjectFiles,
  updateProjectFileStatus,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * GET /api/projects/[projectId]/files
 *
 * Returns project files with **live** processing status from OpenAI Vector Store.
 * Instead of relying on the DB `status` column (which is stale), we cross-reference
 * the DB records against OpenAI's real-time file list to determine actual status.
 *
 * Status mapping:
 * - DB record exists + OpenAI status `completed`  → ready
 * - DB record exists + OpenAI status `in_progress` → processing
 * - DB record exists + OpenAI status `failed`      → failed
 * - DB record exists + OpenAI status `cancelled`   → failed
 * - DB record exists + not found in OpenAI          → uploading (still being added)
 * - DB record has no vector store                   → uploading
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { projectId } = await params;

  // Verify ownership
  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatbotError(
      "bad_request:api",
      "Project not found"
    ).toResponse();
  }

  // Get DB records
  const dbFiles = await getProjectFiles({ projectId });

  // If no vector store yet, all files are still uploading
  if (!project.vectorStoreId) {
    return Response.json({
      files: dbFiles.map((f) => ({ ...f, liveStatus: "uploading" })),
    });
  }

  // Query OpenAI for the real-time status of all files in the vector store
  const openaiFiles = await listVectorStoreFilesWithStatus({
    vectorStoreId: project.vectorStoreId,
  });

  // Build a lookup: vectorStoreFileId → OpenAI status
  // Note: vectorStoreFileId in our DB stores the vector store file ID,
  // which equals the file ID from the list endpoint
  const openaiStatusMap = new Map(
    openaiFiles.map((f) => [f.vectorStoreFileId, f])
  );

  // Cross-reference and sync status
  const enrichedFiles = await Promise.all(
    dbFiles.map(async (dbFile) => {
      const openaiFile = openaiStatusMap.get(dbFile.openaiFileId);

      if (!openaiFile) {
        // File not yet visible in the vector store — still uploading/processing
        return { ...dbFile, liveStatus: "uploading" as const };
      }

      // Map OpenAI status to our UI status
      let liveStatus: "uploading" | "processing" | "ready" | "failed";
      switch (openaiFile.status) {
        case "completed":
          liveStatus = "ready";
          break;
        case "in_progress":
          liveStatus = "processing";
          break;
        case "failed":
        case "cancelled":
          liveStatus = "failed";
          break;
        default:
          liveStatus = "processing";
      }

      // Sync back to DB if status changed
      if (liveStatus !== dbFile.status) {
        await updateProjectFileStatus({ id: dbFile.id, status: liveStatus });
      }

      return {
        ...dbFile,
        liveStatus,
        openaiError: openaiFile.lastError,
        usageBytes: openaiFile.usageBytes,
      };
    })
  );

  return Response.json({ files: enrichedFiles });
}

/**
 * POST /api/projects/[projectId]/files
 * Upload a file to a project's vector store.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { projectId } = await params;

  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatbotError(
      "bad_request:api",
      "Project not found"
    ).toResponse();
  }

  if (!project.vectorStoreId) {
    return new ChatbotError(
      "bad_request:api",
      "Project has no vector store"
    ).toResponse();
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new ChatbotError("bad_request:api", "No file provided").toResponse();
  }

  // Create a DB record first (status: uploading)
  const dbFile = await addProjectFile({
    projectId,
    openaiFileId: "pending", // Will be replaced after upload
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });

  try {
    // Upload to OpenAI and add to vector store
    const { vectorStoreFileId } = await uploadFileToVectorStore({
      vectorStoreId: project.vectorStoreId,
      file,
      fileName: file.name,
    });

    // Update the DB record with the real OpenAI file ID
    // The vectorStoreFileId == fileId for vector store files
    await updateProjectFileStatus({ id: dbFile.id, status: "processing" });

    return Response.json(
      {
        file: {
          ...dbFile,
          openaiFileId: vectorStoreFileId,
          status: "processing",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Mark as failed in DB
    await updateProjectFileStatus({ id: dbFile.id, status: "failed" });
    throw error;
  }
}

/**
 * DELETE /api/projects/[projectId]/files?fileId=xxx
 * Remove a file from the vector store and DB.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { projectId } = await params;
  const { searchParams } = request.nextUrl;
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return new ChatbotError(
      "bad_request:api",
      "File ID is required"
    ).toResponse();
  }

  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatbotError(
      "bad_request:api",
      "Project not found"
    ).toResponse();
  }

  // Remove from vector store if possible
  if (project.vectorStoreId) {
    try {
      await removeFileFromVectorStore({
        vectorStoreId: project.vectorStoreId,
        vectorStoreFileId: fileId,
      });
    } catch {
      // File may already be removed from OpenAI — continue with DB cleanup
    }
  }

  // Remove from DB
  await deleteProjectFileById({ id: fileId });

  return Response.json({ success: true });
}
