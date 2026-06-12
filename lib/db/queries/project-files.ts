import { desc, eq } from "drizzle-orm";
import { type ProjectFile, projectFile } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "./db";

export async function addProjectFile({
  projectId,
  openaiFileId,
  fileName,
  fileSize,
  mimeType,
}: {
  projectId: string;
  openaiFileId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}): Promise<ProjectFile> {
  try {
    const [created] = await db
      .insert(projectFile)
      .values({ projectId, openaiFileId, fileName, fileSize, mimeType })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to add project file"
    );
  }
}

export async function updateProjectFileStatus({
  id,
  status,
}: {
  id: string;
  status: "uploading" | "processing" | "ready" | "failed";
}): Promise<void> {
  try {
    await db.update(projectFile).set({ status }).where(eq(projectFile.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update project file status"
    );
  }
}

export async function updateProjectFile({
  id,
  openaiFileId,
  vectorStoreFileId,
  status,
}: {
  id: string;
  openaiFileId?: string;
  vectorStoreFileId?: string;
  status?: "uploading" | "processing" | "ready" | "failed";
}): Promise<void> {
  try {
    const updates: Record<string, unknown> = {};
    if (openaiFileId !== undefined) updates.openaiFileId = openaiFileId;
    if (vectorStoreFileId !== undefined) updates.vectorStoreFileId = vectorStoreFileId;
    if (status !== undefined) updates.status = status;
    await db.update(projectFile).set(updates).where(eq(projectFile.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update project file"
    );
  }
}

export async function getProjectFiles({
  projectId,
}: {
  projectId: string;
}): Promise<ProjectFile[]> {
  try {
    return await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.projectId, projectId))
      .orderBy(desc(projectFile.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get project files"
    );
  }
}

export async function deleteProjectFileById({
  id,
}: {
  id: string;
}): Promise<void> {
  try {
    await db.delete(projectFile).where(eq(projectFile.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete project file"
    );
  }
}
