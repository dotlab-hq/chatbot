import { auth } from "@/app/(auth)/auth";
import {
  deleteSkillFromProviders,
  uploadSkillToProviders,
} from "@/lib/ai/skill-upload";
import {
  deleteSkillById,
  getSkillById,
  toggleUserSkill,
  updateSkill,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skillId } = await params;
  const skill = await getSkillById({ id: skillId });

  if (!skill) {
    return new ChatbotError("not_found:api", "Skill not found").toResponse();
  }

  return Response.json({ skill });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skillId } = await params;
  const body = await request.json();
  const { name, description, content, isEnabled, isSystem } = body as {
    name?: string;
    description?: string;
    content?: string;
    isEnabled?: boolean;
    isSystem?: boolean;
  };

  const existingSkill = await getSkillById({ id: skillId });
  if (!existingSkill) {
    return new ChatbotError("not_found:api", "Skill not found").toResponse();
  }

  // Only owner can edit their own skills; admins can edit any
  const isAdmin = (session.user as Record<string, unknown>).role === "admin";
  if (existingSkill.ownerId !== session.user.id && !isAdmin) {
    return new ChatbotError("forbidden:auth", "Not authorized").toResponse();
  }

  // Only admins can change isSystem flag
  if (isSystem !== undefined && !isAdmin) {
    return new ChatbotError(
      "forbidden:auth",
      "Only admins can change system skill status"
    ).toResponse();
  }

  // Update skill fields
  const updates: Record<string, string> = {};
  if (name !== undefined) {
    updates.name = name;
  }
  if (description !== undefined) {
    updates.description = description;
  }
  if (content !== undefined) {
    updates.content = content;
  }

  if (Object.keys(updates).length > 0) {
    await updateSkill({ id: skillId, ...updates });
  }
  if (isSystem !== undefined) {
    await updateSkill({ id: skillId, isSystem });
  }

  // If skill content changed, re-upload to providers
  if (content !== undefined) {
    const skillName = updates.name ?? existingSkill.name;
    const skillContent = updates.content ?? content;
    const uploadResult = await uploadSkillToProviders(skillName, skillContent);
    await updateSkill({
      id: skillId,
      providerReference: uploadResult.providerReference,
      uploadStatus: uploadResult.status,
      uploadError: uploadResult.error,
    });
  }

  // Toggle user skill
  if (isEnabled !== undefined) {
    await toggleUserSkill({
      userId: session.user.id,
      skillId,
      isEnabled,
    });
  }

  const updatedSkill = await getSkillById({ id: skillId });
  return Response.json({ skill: updatedSkill });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { skillId } = await params;
  const existingSkill = await getSkillById({ id: skillId });

  if (!existingSkill) {
    return new ChatbotError("not_found:api", "Skill not found").toResponse();
  }

  // Only owner or admin can delete
  const isAdmin = (session.user as Record<string, unknown>).role === "admin";
  if (existingSkill.ownerId !== session.user.id && !isAdmin) {
    return new ChatbotError("forbidden:auth", "Not authorized").toResponse();
  }

  // Best-effort cleanup of provider-side file uploads
  if (existingSkill.providerReference) {
    await deleteSkillFromProviders(existingSkill.providerReference);
  }

  await deleteSkillById({ id: skillId });
  return Response.json({ success: true });
}
