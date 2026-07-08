"use client";

import { ExternalLinkIcon, ImageIcon, XIcon } from "lucide-react";
import { memo } from "react";
import {
  faviconUrl,
  getDomain,
  type ImageSearchResult,
  type SearchResult,
} from "@/components/chat/search-sources-context";

const SearchSourcesPanel = memo(function SearchSourcesPanel({
  results,
  imageResults,
  onClose,
}: {
  results: SearchResult[];
  imageResults: ImageSearchResult[];
  onClose: () => void;
}) {
  const unique = results.filter(
    (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i
  );

  const uniqueImages = imageResults.filter(
    (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
  );

  return (
    <div className="h-full w-80 shrink-0 border-l border-border/40 bg-background overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-semibold text-foreground">Sources</p>
        <button
          aria-label="Close sources panel"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Images section */}
      {uniqueImages.length > 0 && (
        <div className="border-b border-border/40 px-3 py-3">
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Images
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {uniqueImages.map((img) => (
              <a
                className="group/img overflow-hidden rounded-md border border-border/30 transition-colors hover:border-border/60"
                href={img.pageUrl}
                key={img.id}
                rel="noopener noreferrer"
                target="_blank"
              >
                <div className="aspect-4/3 overflow-hidden bg-muted/20">
                  <img
                    alt={img.title}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                    loading="lazy"
                    src={img.thumbnail || img.imageUrl}
                  />
                </div>
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <img
                    alt=""
                    className="size-2.5 shrink-0 rounded-sm"
                    src={faviconUrl(img.domain)}
                  />
                  <span className="truncate text-[9px] text-muted-foreground/70">
                    {img.domain}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Text sources section */}
      <div className="flex flex-col gap-2 p-3">
        {unique.map((result) => {
          const domain = result.domain ?? getDomain(result.url);
          return (
            <a
              className="group/source flex flex-col gap-1 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5 transition-colors hover:border-border/60 hover:bg-muted/30"
              href={result.url}
              key={result.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="flex items-center gap-1.5">
                <img
                  alt=""
                  className="size-3.5 shrink-0 rounded-sm"
                  src={faviconUrl(domain)}
                />
                <span className="truncate text-[10px] text-muted-foreground">
                  {domain}
                </span>
                <ExternalLinkIcon className="ml-auto size-2.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover/source:opacity-100" />
              </div>
              <p className="line-clamp-1 text-sm font-medium leading-snug text-foreground/90">
                {result.title}
              </p>
              {result.snippet && (
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/70">
                  {result.snippet}
                </p>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
});

export { SearchSourcesPanel };
