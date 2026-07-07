import { auth } from "@/app/(auth)/auth";
import { uploadSkillToProviders } from "@/lib/ai/skill-upload";
import {
  createSkill,
  getAllSkills,
  getUserSkills,
  initDefaultSystemSkillsForUser,
  toggleUserSkill,
  updateSkill,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const isAdmin = (session.user as Record<string, unknown>).role === "admin";

  // Get all skills
  const allSkills = await getAllSkills();

  // Get user's skill toggles
  const userSkills = await getUserSkills({ userId: session.user.id });

  // Build a map of user's skill toggles
  const userSkillMap = new Map<string, boolean>();
  for (const us of userSkills) {
    userSkillMap.set(us.skillId, us.isEnabled);
  }

  // Ensure all system skills have user-skill entries (enabled by default)
  await initDefaultSystemSkillsForUser({ userId: session.user.id });

  // If admin, return all skills; otherwise return system + own personal skills
  const visibleSkills = isAdmin
    ? allSkills
    : allSkills.filter((s) => s.isSystem || s.ownerId === session.user.id);

  // Re-fetch user skills after init
  const updatedUserSkills = await getUserSkills({ userId: session.user.id });
  const updatedMap = new Map<string, boolean>();
  for (const us of updatedUserSkills) {
    updatedMap.set(us.skillId, us.isEnabled);
  }

  return Response.json({
    skills: visibleSkills.map((s) => ({
      ...s,
      isEnabled: updatedMap.get(s.id) ?? true,
    })),
    isAdmin,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const isAdmin = (session.user as Record<string, unknown>).role === "admin";

  const body = await request.json();
  const { name, description, content, isSystem } = body as {
    name: string;
    description?: string;
    content: string;
    isSystem?: boolean;
  };

  if (!name?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "Skill name is required"
    ).toResponse();
  }

  if (!content?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "Skill content is required"
    ).toResponse();
  }

  // Only admins can create system skills
  if (isSystem && !isAdmin) {
    return new ChatbotError(
      "forbidden:auth",
      "Only admins can create system skills"
    ).toResponse();
  }

  // Generate slug
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const slug = isSystem
    ? `system/${baseSlug}`
    : `user/${session.user.id}/${baseSlug}`;

  const skill = await createSkill({
    name: name.trim(),
    slug,
    description: description?.trim() || undefined,
    content: content.trim(),
    isSystem: isSystem ?? false,
    ownerId: session.user.id,
  });

  // Upload skill content to providers and store the reference + status
  const uploadResult = await uploadSkillToProviders(
    name.trim(),
    content.trim()
  );
  await updateSkill({
    id: skill.id,
    providerReference: uploadResult.providerReference,
    uploadStatus: uploadResult.status,
    uploadError: uploadResult.error,
  });

  // Auto-enable for the creator
  await toggleUserSkill({
    userId: session.user.id,
    skillId: skill.id,
    isEnabled: true,
  });

  return Response.json({ skill }, { status: 201 });
}
