"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type SearchResult = {
  rank: number;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
};

export type ImageSearchResult = {
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

type SearchSourcesContextValue = {
  results: SearchResult[];
  imageResults: ImageSearchResult[];
  open: boolean;
  messageId: string | null;
  openPanel: (
    results: SearchResult[],
    imageResults: ImageSearchResult[],
    messageId: string
  ) => void;
  closePanel: () => void;
};

const SearchSourcesContext = createContext<SearchSourcesContextValue | null>(
  null
);

export function SearchSourcesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);

  const openPanel = useCallback(
    (r: SearchResult[], imgs: ImageSearchResult[], id: string) => {
      setResults(r);
      setImageResults(imgs);
      setMessageId(id);
      setOpen(true);
    },
    []
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    setMessageId(null);
  }, []);

  return (
    <SearchSourcesContext.Provider
      value={{ results, imageResults, open, messageId, openPanel, closePanel }}
    >
      {children}
    </SearchSourcesContext.Provider>
  );
}

export function useSearchSourcesPanel() {
  const ctx = useContext(SearchSourcesContext);
  if (!ctx) {
    throw new Error(
      "useSearchSourcesPanel must be inside SearchSourcesProvider"
    );
  }
  return ctx;
}

const SEARCH_TOOL_TYPES = new Set(["tool-webSearch", "tool-webSearchExtract"]);
const IMAGE_SEARCH_TOOL_TYPES = new Set(["tool-webImageSearch"]);

export function extractSearchResults(message: {
  parts?: { type: string; output?: unknown }[];
}): SearchResult[] {
  if (!message.parts) {
    return [];
  }
  const results: SearchResult[] = [];
  for (const part of message.parts) {
    if (
      SEARCH_TOOL_TYPES.has(part.type) &&
      part.output &&
      Array.isArray(part.output)
    ) {
      for (const item of part.output) {
        if (
          item &&
          typeof item === "object" &&
          "url" in item &&
          "title" in item
        ) {
          results.push(item as SearchResult);
        }
      }
    }
  }
  return results;
}

export function extractImageResults(message: {
  parts?: { type: string; output?: unknown }[];
}): ImageSearchResult[] {
  if (!message.parts) {
    return [];
  }
  const results: ImageSearchResult[] = [];
  const seenUrls = new Set<string>();
  for (const part of message.parts) {
    if (
      IMAGE_SEARCH_TOOL_TYPES.has(part.type) &&
      part.output &&
      Array.isArray(part.output)
    ) {
      for (const item of part.output) {
        if (
          item &&
          typeof item === "object" &&
          "imageUrl" in item &&
          "title" in item
        ) {
          const candidate = item as ImageSearchResult;
          // Deduplicate by imageUrl — keep the first occurrence
          if (!seenUrls.has(candidate.imageUrl)) {
            seenUrls.add(candidate.imageUrl);
            results.push(candidate);
          }
        }
      }
    }
  }
  return results;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}
