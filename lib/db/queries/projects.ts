import { desc, eq } from "drizzle-orm";
import { type Project, project, projectFile } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "./db";

export async function createProject({
  name,
  description,
  userId,
  vectorStoreId,
}: {
  name: string;
  description?: string;
  userId: string;
  vectorStoreId?: string;
}): Promise<Project> {
  try {
    const [created] = await db
      .insert(project)
      .values({ name, description, userId, vectorStoreId })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create project");
  }
}

export async function getProjectsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get projects by user id"
    );
  }
}

export async function getProjectById({
  id,
}: {
  id: string;
}): Promise<Project | null> {
  try {
    const [found] = await db.select().from(project).where(eq(project.id, id));
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get project by id"
    );
  }
}

export async function updateProject({
  id,
  name,
  description,
  vectorStoreId,
  fileCount,
}: {
  id: string;
  name?: string;
  description?: string;
  vectorStoreId?: string;
  fileCount?: number;
}): Promise<Project | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (vectorStoreId !== undefined) updates.vectorStoreId = vectorStoreId;
    if (fileCount !== undefined) updates.fileCount = fileCount;

    const [updated] = await db
      .update(project)
      .set(updates)
      .where(eq(project.id, id))
      .returning();
    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update project");
  }
}

export async function deleteProjectById({ id }: { id: string }): Promise<void> {
  try {
    await db.delete(projectFile).where(eq(projectFile.projectId, id));
    await db.delete(project).where(eq(project.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete project");
  }
}
