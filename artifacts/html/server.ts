import { streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

function stripFences(html: string): string {
  return html
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

const HTML_CREATE_INSTRUCTIONS = `You are an HTML page generator. Output a COMPLETE HTML document using Tailwind CSS for ALL styling.

CRITICAL RULES — Tailwind CSS ONLY:
1. You MUST use Tailwind CSS utility classes for ALL styling. This is non-negotiable.
2. NEVER write custom CSS in <style> tags. Use Tailwind classes instead.
3. NEVER use inline style attributes. Use Tailwind classes instead.
4. The Tailwind CDN is already included. Just use the classes directly.
5. Output ONLY the raw HTML markup. No explanations, no markdown fences, no wrapping.

STRUCTURE:
- Start with <!DOCTYPE html> and output a complete HTML document
- Include <meta name="viewport" content="width=device-width, initial-scale=1.0"> in <head>
- Use semantic HTML elements (header, main, section, footer, etc.)
- Apply Tailwind classes directly to elements for all visual styling
- Use responsive design with Tailwind breakpoints (sm:, md:, lg:)

EXAMPLE PATTERN:
<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <h1 class="text-4xl font-bold text-gray-900">Title</h1>
</div>`;

export const htmlDocumentHandler = createDocumentHandler<"html">({
  kind: "html",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    let draftContent = "";

    const { stream } = streamText({
      model: getLanguageModel(modelId),
      instructions: HTML_CREATE_INSTRUCTIONS,
      prompt: title,
    });

    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-htmlDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    modelId,
  }) => {
    let draftContent = "";

    const { stream } = streamText({
      model: getLanguageModel(modelId),
      instructions: `${updateDocumentPrompt(document.content, "html")}\n\nCRITICAL: You MUST use Tailwind CSS utility classes for ALL styling. NEVER write custom CSS in <style> tags or use inline style attributes. Output ONLY the complete updated HTML document. No explanations, no markdown fences.`,
      prompt: description,
    });

    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-htmlDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
});
