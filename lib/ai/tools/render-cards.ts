import { tool } from "ai";
import { z } from "zod";

// ── renderCards — Dynamic horizontal card carousel ──────────────────────────
//
// Lets the AI render ANY list of link/info cards as a horizontal scrollable
// carousel. The component enforces a fixed layout (thumbnail + title + description)
// so the LLM can't submit arbitrary markup — only structured data fields.

const cardItemSchema = z.object({
  title: z.string().describe("Card title (max ~60 chars recommended)"),
  description: z
    .string()
    .optional()
    .describe("Short description, max 2 lines shown (truncated automatically)"),
  thumbnail: z
    .string()
    .optional()
    .describe(
      "Thumbnail image URL (absolute). If omitted, a favicon placeholder is used"
    ),
  link: z.string().url().optional().describe("Target URL the card links to"),
  domain: z
    .string()
    .optional()
    .describe(
      "Display domain name shown under the thumbnail (e.g. 'github.com')"
    ),
  badge: z
    .string()
    .optional()
    .describe(
      "Optional badge / tag text shown on the card (e.g. 'New', 'Popular')"
    ),
});

export type CardItem = z.infer<typeof cardItemSchema>;

export const renderCards = tool({
  description:
    "Render a horizontal scrollable card carousel in the chat. Use this to show links, search results, products, resources, articles, or any collection of items as visual cards. Each card shows a thumbnail, title, short description, and links to the target URL. Use this INSTEAD of listing links as plain text — it provides a much richer visual experience.",
  inputSchema: z.object({
    heading: z
      .string()
      .optional()
      .describe("Optional heading above the card carousel"),
    items: z
      .array(cardItemSchema)
      .min(1)
      .max(30)
      .describe("Array of card items to display"),
  }),
  execute: (input) => {
    // Return the structured data — the client component renders it
    return {
      heading: input.heading ?? null,
      items: input.items.map((item, i) => ({
        id: `card-${i}-${Date.now()}`,
        title: item.title,
        description: item.description ?? null,
        thumbnail: item.thumbnail ?? null,
        link: item.link ?? null,
        domain: item.domain ?? null,
        badge: item.badge ?? null,
      })),
    };
  },
});
