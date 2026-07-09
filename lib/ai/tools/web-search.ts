import type { ImageEnvelope } from "@openserp/sdk";
import { OpenSERP } from "@openserp/sdk";
import { tool } from "ai";
import { z } from "zod";

function getClient() {
  return new OpenSERP({
    baseUrl: process.env.OPENSERP_BASE_URL || undefined,
    apiKey: process.env.OPENSERP_API_KEY || undefined,
  });
}

const ENGINE = z
  .enum(["google", "bing", "duckduckgo", "ecosia", "yandex", "baidu", "duck"])
  .describe("Search engine to use");

const REGION = z
  .string()
  .optional()
  .describe("Region code, e.g. US, GB, DE (optional)");

const LANG = z
  .string()
  .optional()
  .describe("Language code, e.g. en, es (optional)");

// ── 1. webSearch — Grounded search with citable snippets ──────────────────────

export const webSearch = tool({
  description:
    "Search the web and return results with titles, URLs, and snippets. Use this when the user asks a factual question, current events, or any question that benefits from up-to-date information. Supported engines: google, bing, duckduckgo, ecosia, yandex, baidu. Default is google, use bing as a fallback or when the user asks for it.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    engine: ENGINE.default("google"),
    limit: z.number().min(1).max(20).default(10).describe("Number of results"),
    region: REGION,
    lang: LANG,
  }),
  execute: async ({ query, engine, limit, region, lang }) => {
    const client = getClient();
    const now = new Date();
    const monthYear = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const searchQuery = `${query} latest ${monthYear}`;
    const { results } = await client.search({
      engine,
      text: searchQuery,
      limit,
      region,
      lang,
    });
    return results.map((r) => ({
      rank: r.rank,
      title: r.title,
      url: r.url,
      domain: r.domain,
      snippet: r.snippet,
    }));
  },
});

// ── 2. webSearchExtract — Search + cleaned page content for top N results ─────

export const webSearchExtract = tool({
  description:
    "Search the web and extract cleaned page content from the top results. Use this when the user needs in-depth information from actual pages, not just snippets. extract is capped at 5.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    engine: ENGINE.default("google"),
    extract: z
      .number()
      .min(1)
      .max(5)
      .default(3)
      .describe("Number of top results to extract full content from"),
    region: REGION,
    lang: LANG,
  }),
  execute: async ({ query, engine, extract, region, lang }) => {
    const client = getClient();
    const now = new Date();
    const monthYear = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const searchQuery = `${query} latest ${monthYear}`;
    const { results } = await client.search({
      engine,
      text: searchQuery,
      extract,
      extractMode: "auto",
      region,
      lang,
    });
    return results.map((r) => ({
      rank: r.rank,
      title: r.title,
      url: r.url,
      domain: r.domain,
      snippet: r.snippet,
      content: r.extracted?.content?.slice(0, 4000) ?? null,
    }));
  },
});

// ── 3. webImageSearch — Search for images ────────────────────────────────────

type WebImageResult = {
  id: string;
  rank: number;
  title: string;
  imageUrl: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  pageUrl: string;
  domain: string;
  engine: string;
};

export const webImageSearch = tool({
  description:
    "Search for images related to a query. Returns image URLs, thumbnails, dimensions, and source pages. Use this when the user wants to find images, pictures, photos, or visual content related to a topic. Works best when run alongside webSearch to complement text results with visual results.",
  inputSchema: z.object({
    query: z.string().describe("The image search query"),
    engine: ENGINE.default("google"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of image results"),
    region: REGION,
    lang: LANG,
  }),
  execute: async ({ query, engine, limit, region, lang }) => {
    const client = getClient();
    const now = new Date();
    const monthYear = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const searchQuery = `${query} ${monthYear}`;
    const envelope: ImageEnvelope = await client.image({
      engine,
      text: searchQuery,
      limit,
      region,
      lang,
    });
    return envelope.results.map(
      (r): WebImageResult => ({
        id: r.id,
        rank: r.rank,
        title: r.title,
        imageUrl: r.image.url,
        thumbnail: r.image.thumbnail,
        width: r.image.width,
        height: r.image.height,
        pageUrl: r.source.page_url,
        domain: r.source.domain,
        engine: r.engine,
      })
    );
  },
});

// ── 4. webExtract — Pull clean markdown from a single URL ─────────────────────

export const webExtract = tool({
  description:
    "Extract cleaned page content from a single URL as markdown. Use this when the user gives you a specific link and wants to read or summarize it.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to extract content from"),
    mode: z
      .enum(["auto", "fast", "rendered"])
      .default("auto")
      .describe("Extraction algorithm"),
    format: z
      .enum(["markdown", "json", "text"])
      .default("json")
      .describe("Output format"),
    clean: z.boolean().default(true).describe("Remove boilerplate"),
  }),
  execute: async ({ url, mode, clean, format }) => {
    const client = getClient();
    const result = await client.extract({ url, mode, clean, format });

    // extract returns a string for "markdown"/"text" format and an object for "json" format
    if (typeof result === "string") {
      return {
        url,
        title: null,
        markdown: result.slice(0, 8000),
        headings: null,
        links: null,
      };
    }

    return {
      url,
      title: result.title ?? null,
      markdown: result.markdown?.slice(0, 8000) ?? null,
      headings: result.headings?.slice(0, 20) ?? null,
      links: result.links?.slice(0, 30) ?? null,
    };
  },
});

// ── 5. rankTracker — Check a domain's rank for a keyword set ──────────────────

export const rankTracker = tool({
  description:
    "Check where a domain ranks in search results for a set of keywords. Use this for SEO rank tracking or competitive analysis.",
  inputSchema: z.object({
    domain: z.string().describe("Target domain to track, e.g. example.com"),
    keywords: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe("Keywords to check ranking for"),
    engine: ENGINE.default("google"),
    region: REGION.default("US"),
    depth: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("How many results to scan"),
  }),
  execute: async ({ domain, keywords, engine, region, depth }) => {
    const client = getClient();
    const target = domain.toLowerCase().replace(/^www\./, "");

    const matches = (d: string) => {
      if (!d) {
        return false;
      }
      const norm = d.toLowerCase().replace(/^www\./, "");
      return norm === target || norm.endsWith(`.${target}`);
    };

    const results = await Promise.all(
      keywords.map(async (keyword) => {
        const { results: searchResults } = await client.search({
          engine,
          text: keyword,
          region,
          limit: depth,
        });
        const hit = searchResults.find((r) => matches(r.domain ?? ""));
        return {
          keyword,
          rank: hit?.rank ?? null,
          url: hit?.url ?? null,
          title: hit?.title ?? null,
        };
      })
    );

    return { domain, results };
  },
});
