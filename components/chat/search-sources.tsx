"use client";

import { ExternalLinkIcon } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";

const SEARCH_TOOL_TYPES = new Set(["tool-webSearch", "tool-webSearchExtract"]);

export function extractSearchResults(message: ChatMessage) {
  if (!message.parts) {
    return [];
  }
  const results: {
    rank: number;
    title: string;
    url: string;
    domain?: string;
    snippet?: string;
  }[] = [];
  for (const part of message.parts) {
    if (SEARCH_TOOL_TYPES.has(part.type) && "output" in part) {
      const output = part.output;
      if (Array.isArray(output)) {
        for (const item of output) {
          if (
            item &&
            typeof item === "object" &&
            "url" in item &&
            "title" in item
          ) {
            results.push(
              item as {
                rank: number;
                title: string;
                url: string;
                domain?: string;
                snippet?: string;
              }
            );
          }
        }
      }
    }
  }
  return results;
}

const IMAGE_SEARCH_TOOL_TYPES = new Set(["tool-webImageSearch"]);

export function extractImageSearchResults(message: ChatMessage) {
  if (!message.parts) {
    return [];
  }
  const results: {
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
  }[] = [];
  for (const part of message.parts) {
    if (IMAGE_SEARCH_TOOL_TYPES.has(part.type) && "output" in part) {
      const output = part.output;
      if (Array.isArray(output)) {
        for (const item of output) {
          if (
            item &&
            typeof item === "object" &&
            "imageUrl" in item &&
            "title" in item
          ) {
            results.push(
              item as {
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
              }
            );
          }
        }
      }
    }
  }
  return results;
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// ─── Inline trigger bar ────────────────────────────────────────────────────────

export const SearchSourcesBar = memo(function SearchSourcesBar({
  active,
  onToggle,
  domains,
  count,
}: {
  active: boolean;
  onToggle: () => void;
  domains: string[];
  count: number;
}) {
  return (
    <button
      className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      onClick={onToggle}
      type="button"
    >
      <div className="flex -space-x-1.5">
        {domains.slice(0, 4).map((domain) => (
          <img
            alt={domain}
            className="size-4 rounded-sm ring-1 ring-background"
            key={domain}
            src={faviconUrl(domain)}
          />
        ))}
        {/* Note: using <img> for external favicons; Next.js Image requires remotePatterns config */}
      </div>
      {domains.length > 4 && (
        <span className="text-[10px] text-muted-foreground/70">
          +{domains.length - 4}
        </span>
      )}
      <span className="text-xs font-medium">
        {count} Source{count === 1 ? "" : "s"}
      </span>
      <ExternalLinkIcon
        className={`size-3 transition-transform ${active ? "rotate-[-45deg]" : ""}`}
      />
    </button>
  );
});
