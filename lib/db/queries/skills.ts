import { and, desc, eq } from "drizzle-orm";
import { type Skill, skill, type UserSkill, userSkill } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { db } from "./db";

// ─── Skill Queries ──────────────────────────────────────────────────────────

export async function createSkill({
  name,
  slug,
  description,
  content,
  isSystem,
  ownerId,
  providerReference,
  uploadStatus,
  uploadError,
}: {
  name: string;
  slug: string;
  description?: string;
  content?: string;
  isSystem?: boolean;
  ownerId?: string;
  providerReference?: string | null;
  uploadStatus?: string;
  uploadError?: string | null;
}): Promise<Skill> {
  try {
    const [created] = await db
      .insert(skill)
      .values({
        name,
        slug,
        description,
        content,
        isSystem: isSystem ?? false,
        ownerId,
        providerReference: providerReference ?? null,
        uploadStatus: uploadStatus ?? "pending",
        uploadError: uploadError ?? null,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create skill");
  }
}

export async function getSkillById({
  id,
}: {
  id: string;
}): Promise<Skill | null> {
  try {
    const [found] = await db.select().from(skill).where(eq(skill.id, id));
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get skill by id");
  }
}

export async function getSkillBySlug({
  slug,
}: {
  slug: string;
}): Promise<Skill | null> {
  try {
    const [found] = await db.select().from(skill).where(eq(skill.slug, slug));
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get skill by slug"
    );
  }
}

export async function getAllSkills(): Promise<Skill[]> {
  try {
    return await db.select().from(skill).orderBy(desc(skill.createdAt));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get skills");
  }
}

export async function getSystemSkills(): Promise<Skill[]> {
  try {
    return await db
      .select()
      .from(skill)
      .where(eq(skill.isSystem, true))
      .orderBy(desc(skill.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get system skills"
    );
  }
}

export async function getSkillsByOwnerId({
  ownerId,
}: {
  ownerId: string;
}): Promise<Skill[]> {
  try {
    return await db
      .select()
      .from(skill)
      .where(eq(skill.ownerId, ownerId))
      .orderBy(desc(skill.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get skills by owner"
    );
  }
}

export async function updateSkill({
  id,
  name,
  description,
  content,
  isSystem,
  providerReference,
  uploadStatus,
  uploadError,
}: {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  isSystem?: boolean;
  providerReference?: string | null;
  uploadStatus?: string;
  uploadError?: string | null;
}): Promise<Skill | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) {
      updates.name = name;
    }
    if (description !== undefined) {
      updates.description = description;
    }
    if (content !== undefined) {
      updates.content = content;
    }
    if (isSystem !== undefined) {
      updates.isSystem = isSystem;
    }
    if (providerReference !== undefined) {
      updates.providerReference = providerReference;
    }
    if (uploadStatus !== undefined) {
      updates.uploadStatus = uploadStatus;
    }
    if (uploadError !== undefined) {
      updates.uploadError = uploadError;
    }

    const [updated] = await db
      .update(skill)
      .set(updates)
      .where(eq(skill.id, id))
      .returning();
    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update skill");
  }
}

export async function deleteSkillById({
  id,
}: {
  id: string;
}): Promise<boolean> {
  try {
    const result = await db.delete(skill).where(eq(skill.id, id)).returning();
    return result.length > 0;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to delete skill");
  }
}

// ─── UserSkill Queries ──────────────────────────────────────────────────────

export async function getUserSkills({
  userId,
}: {
  userId: string;
}): Promise<(UserSkill & { skill: Skill })[]> {
  try {
    const rows = await db
      .select()
      .from(userSkill)
      .innerJoin(skill, eq(userSkill.skillId, skill.id))
      .where(eq(userSkill.userId, userId))
      .orderBy(desc(userSkill.createdAt));
    return rows.map((row) => ({ ...row.UserSkill, skill: row.Skill }));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user skills");
  }
}

export async function getEnabledUserSkills({
  userId,
}: {
  userId: string;
}): Promise<Skill[]> {
  try {
    const rows = await db
      .select({ skill })
      .from(userSkill)
      .innerJoin(skill, eq(userSkill.skillId, skill.id))
      .where(and(eq(userSkill.userId, userId), eq(userSkill.isEnabled, true)))
      .orderBy(desc(skill.createdAt));
    return rows.map((r) => r.skill);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get enabled user skills"
    );
  }
}

export async function toggleUserSkill({
  userId,
  skillId,
  isEnabled,
}: {
  userId: string;
  skillId: string;
  isEnabled?: boolean;
}): Promise<UserSkill> {
  try {
    // Check if the user-skill record already exists
    const [existing] = await db
      .select()
      .from(userSkill)
      .where(and(eq(userSkill.userId, userId), eq(userSkill.skillId, skillId)));

    const newValue = isEnabled ?? !existing?.isEnabled;

    if (existing) {
      const [updated] = await db
        .update(userSkill)
        .set({ isEnabled: newValue, updatedAt: new Date() })
        .where(
          and(eq(userSkill.userId, userId), eq(userSkill.skillId, skillId))
        )
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userSkill)
      .values({ userId, skillId, isEnabled: newValue })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to toggle user skill"
    );
  }
}

export async function deleteUserSkill({
  userId,
  skillId,
}: {
  userId: string;
  skillId: string;
}): Promise<boolean> {
  try {
    const result = await db
      .delete(userSkill)
      .where(and(eq(userSkill.userId, userId), eq(userSkill.skillId, skillId)))
      .returning();
    return result.length > 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete user skill"
    );
  }
}

export async function initDefaultSystemSkillsForUser({
  userId,
}: {
  userId: string;
}): Promise<void> {
  try {
    // Get all system skills
    const systemSkills = await getSystemSkills();

    // Get existing user-skill records
    const existingUserSkills = await db
      .select()
      .from(userSkill)
      .where(eq(userSkill.userId, userId));

    const existingSkillIds = new Set(
      existingUserSkills.map((us) => us.skillId)
    );

    // Create UserSkill entries for system skills the user doesn't have yet
    // System skills are enabled by default
    for (const s of systemSkills) {
      if (!existingSkillIds.has(s.id)) {
        await db.insert(userSkill).values({
          userId,
          skillId: s.id,
          isEnabled: true,
        });
      }
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to init default system skills"
    );
  }
}
