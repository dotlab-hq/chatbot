"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CardData = {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  link: string | null;
  domain: string | null;
  badge: string | null;
};

type CardCarouselOutput = {
  heading: string | null;
  items: CardData[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ─── Favicon image (needs raw <img> for external domains) ────────────────────

function FaviconImg({ domain }: { domain: string }) {
  return (
    <img
      alt=""
      className="size-8 rounded-sm opacity-60"
      src={getFaviconUrl(domain)}
    />
  );
}

// ─── Single card ────────────────────────────────────────────────────────────

function Card({ card, inNewTab }: { card: CardData; inNewTab: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const displayDomain =
    card.domain ?? (card.link ? extractDomain(card.link) : null);

  const inner = (
    <>
      {/* Thumbnail area */}
      <div className="relative h-32 w-full overflow-hidden bg-muted/20">
        {error || !card.thumbnail ? (
          <div className="flex h-full w-full items-center justify-center">
            {card.thumbnail ? (
              <ImageIcon className="size-8 text-muted-foreground/30" />
            ) : displayDomain ? (
              <FaviconImg domain={displayDomain} />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground/30" />
            )}
          </div>
        ) : (
          <Image
            alt={card.title}
            className={`h-full w-full object-cover transition-all duration-300 group-hover/card:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
            fill
            loading="lazy"
            onError={() => {
              setError(true);
            }}
            onLoad={() => {
              setLoaded(true);
            }}
            sizes="224px"
            src={card.thumbnail}
            unoptimized
          />
        )}
        {!loaded && !error && card.thumbnail && (
          <div className="absolute inset-0 animate-pulse bg-muted/40" />
        )}
        {/* Badge */}
        {card.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm backdrop-blur-sm">
            {card.badge}
          </span>
        )}
      </div>

      {/* Text content */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <h4 className="text-sm font-medium leading-snug text-foreground line-clamp-1">
          {card.title}
        </h4>
        {card.description && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}
        {displayDomain && (
          <div className="mt-auto flex items-center gap-1.5 pt-1.5">
            <img
              alt=""
              className="size-3 shrink-0 rounded-sm"
              src={getFaviconUrl(displayDomain)}
            />
            <span className="truncate text-[10px] text-muted-foreground/70">
              {displayDomain}
            </span>
            {card.link && (
              <ExternalLinkIcon className="ml-auto size-2.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover/card:opacity-100" />
            )}
          </div>
        )}
      </div>
    </>
  );

  const baseClasses =
    "group/card flex w-52 flex-none flex-col overflow-hidden rounded-xl border border-border/30 bg-card transition-all duration-200 hover:border-border/60 hover:shadow-md sm:w-60";

  if (card.link) {
    return (
      <a
        className={baseClasses}
        href={card.link}
        rel="noopener noreferrer"
        target={inNewTab ? "_blank" : undefined}
      >
        {inner}
      </a>
    );
  }

  return <div className={`${baseClasses} cursor-default`}>{inner}</div>;
}

// ─── Main carousel ───────────────────────────────────────────────────────────

export const CardCarousel = memo(function CardCarousel({
  data,
}: {
  data: CardCarouselOutput;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) {
      return undefined;
    }
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll]);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }, []);

  // Deduplicate by title + link combo
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    return data.items.filter((item) => {
      const key = `${item.title}|${item.link ?? ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [data.items]);

  if (uniqueItems.length === 0) {
    return null;
  }

  // Determine if any cards have links that should open in new tab
  const inNewTab = uniqueItems.some((c) => c.link);

  return (
    <div className="flex flex-col gap-1.5">
      {data.heading && (
        <h3 className="text-sm font-medium text-foreground">{data.heading}</h3>
      )}
      <div className="relative group/carousel">
        {/* Scroll container */}
        <div
          className="flex gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          ref={scrollRef}
        >
          {uniqueItems.map((card) => (
            <Card card={card} inNewTab={inNewTab} key={card.id} />
          ))}
        </div>

        {/* Navigation arrows */}
        {canScrollLeft && (
          <button
            aria-label="Scroll cards left"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/40 bg-background/90 p-1.5 shadow-sm backdrop-blur-sm transition-all hover:bg-muted/80 group-hover/carousel:opacity-100 opacity-70"
            onClick={() => {
              scrollBy(-1);
            }}
            type="button"
          >
            <ChevronLeftIcon className="size-4 text-muted-foreground" />
          </button>
        )}
        {canScrollRight && (
          <button
            aria-label="Scroll cards right"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/40 bg-background/90 p-1.5 shadow-sm backdrop-blur-sm transition-all hover:bg-muted/80 group-hover/carousel:opacity-100 opacity-70"
            onClick={() => {
              scrollBy(1);
            }}
            type="button"
          >
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
});
