import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { uploadSkill } from "ai";
import { isTestEnvironment } from "@/lib/constants";

export type SkillUploadResult = {
  providerReference: string | null;
  status: "uploaded" | "failed" | "skipped";
  error: string | null;
};

/**
 * Upload skill content to available providers and return a merged
 * ProviderReference (Record<providerName, skillId>) as a JSON string
 * that can be stored in the DB and later passed via providerOptions
 * during inference.
 *
 * Uses `uploadSkill()` from the AI SDK v7 which uploads skill files
 * through each provider's `.skills()` factory, producing proper
 * provider-specific skill references.
 *
 * In test environments, returns skipped status (no upload needed for mocks).
 */
export async function uploadSkillToProviders(
  skillName: string,
  content: string
): Promise<SkillUploadResult> {
  if (isTestEnvironment) {
    return { providerReference: null, status: "skipped", error: null };
  }

  const displayTitle = skillName.trim();
  const data = new TextEncoder().encode(content);
  const mergedRef: Record<string, string> = {};
  const errors: string[] = [];

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  if (!hasAnthropicKey && !hasOpenAIKey) {
    return {
      providerReference: null,
      status: "failed",
      error:
        "No provider API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    };
  }

  // Upload to Anthropic if configured
  if (hasAnthropicKey) {
    try {
      const result = await uploadSkill({
        api: anthropic,
        files: [{ path: "SKILL.md", data }],
        displayTitle,
      });
      if (result.providerReference) {
        Object.assign(mergedRef, result.providerReference);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Anthropic: ${msg}`);
    }
  }

  // Upload to OpenAI if configured
  if (hasOpenAIKey) {
    try {
      const result = await uploadSkill({
        api: openai,
        files: [{ path: "SKILL.md", data }],
        displayTitle,
        providerOptions: {
          openai: { purpose: "assistants" },
        },
      });
      if (result.providerReference) {
        Object.assign(mergedRef, result.providerReference);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`OpenAI: ${msg}`);
    }
  }

  if (Object.keys(mergedRef).length === 0) {
    return {
      providerReference: null,
      status: "failed",
      error:
        errors.length > 0
          ? errors.join("; ")
          : "Upload produced no provider references",
    };
  }

  return {
    providerReference: JSON.stringify(mergedRef),
    status: "uploaded",
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

/**
 * Delete skill content from providers using the stored provider
 * reference. Best-effort — failures are silently ignored.
 *
 * The AI SDK v7 does not expose a dedicated `deleteSkill` API.
 * As a best-effort fallback we attempt file deletion through the
 * provider's files API (the underlying storage may still be reachable
 * via its file ID).
 */
export async function deleteSkillFromProviders(
  providerReference: string
): Promise<void> {
  if (isTestEnvironment) {
    return;
  }

  let ref: Record<string, string>;
  try {
    ref = JSON.parse(providerReference) as Record<string, string>;
  } catch {
    return;
  }

  // Best-effort: try to delete via the underlying files API
  // for each provider that has a stored reference.
  const providerEntries: Array<{
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
  }> = [];

  if (ref.anthropic && process.env.ANTHROPIC_API_KEY) {
    providerEntries.push({ key: "anthropic", api: anthropic });
  }
  if (ref.openai && process.env.OPENAI_API_KEY) {
    providerEntries.push({ key: "openai", api: openai });
  }

  await Promise.allSettled(
    providerEntries.map(async ({ key, api }) => {
      const fileId = ref[key];
      if (!fileId) {
        return;
      }
      try {
        // The skills API does not expose a delete method.
        // Attempt cleanup through the files API which may still
        // recognise the underlying file reference.
        const filesApi = api.files?.();
        if (filesApi && typeof filesApi.deleteFile === "function") {
          await filesApi.deleteFile(fileId);
        }
        // If deleteFile doesn't exist, we silently skip —
        // provider-side cleanup will handle orphaned references.
      } catch {
        // non-critical
      }
    })
  );
}
