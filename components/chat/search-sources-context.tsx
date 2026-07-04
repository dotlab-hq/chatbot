"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type SearchResult = {
  rank: number;
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
};

type SearchSourcesContextValue = {
  results: SearchResult[];
  open: boolean;
  messageId: string | null;
  openPanel: (results: SearchResult[], messageId: string) => void;
  closePanel: () => void;
};

const SearchSourcesContext = createContext<SearchSourcesContextValue | null>(
  null,
);

export function SearchSourcesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);

  const openPanel = useCallback((r: SearchResult[], id: string) => {
    setResults(r);
    setMessageId(id);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    setMessageId(null);
  }, []);

  return (
    <SearchSourcesContext.Provider value={{ results, open, messageId, openPanel, closePanel }}>
      {children}
    </SearchSourcesContext.Provider>
  );
}

export function useSearchSourcesPanel() {
  const ctx = useContext(SearchSourcesContext);
  if (!ctx) throw new Error("useSearchSourcesPanel must be inside SearchSourcesProvider");
  return ctx;
}

const SEARCH_TOOL_TYPES = new Set(["tool-webSearch", "tool-webSearchExtract"]);

export function extractSearchResults(
  message: { parts?: { type: string; output?: unknown }[] },
): SearchResult[] {
  if (!message.parts) return [];
  const results: SearchResult[] = [];
  for (const part of message.parts) {
    if (SEARCH_TOOL_TYPES.has(part.type) && part.output && Array.isArray(part.output)) {
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
