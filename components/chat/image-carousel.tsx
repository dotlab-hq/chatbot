"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  XIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ImageSearchResult } from "@/components/chat/search-sources-context";

// ─── Image lightbox (full-size overlay) ──────────────────────────────────────

function ImageLightbox({
  image,
  onClose,
}: {
  image: ImageSearchResult;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <button
        aria-label="Close image preview"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        type="button"
      >
        <XIcon className="size-5" />
      </button>

      <div
        className="relative max-h-[85vh] max-w-[90vw]"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      >
        <img
          alt={image.title}
          className="max-h-[80vh] rounded-lg object-contain shadow-2xl"
          src={image.imageUrl}
        />
        <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
          <img
            alt=""
            className="size-4 rounded-sm"
            src={`https://www.google.com/s2/favicons?domain=${image.domain}&sz=32`}
          />
          <span className="truncate">{image.title}</span>
          <span className="text-white/40">·</span>
          <a
            className="underline-offset-2 hover:underline"
            href={image.pageUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {image.domain}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Single image card ───────────────────────────────────────────────────────

function ImageCard({
  image,
  onClick,
}: {
  image: ImageSearchResult;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <button
      className="group/img relative flex-none overflow-hidden rounded-lg border border-border/30 bg-muted/20 transition-all hover:border-border/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      title={image.title}
      type="button"
    >
      <div className="relative aspect-4/3 w-48 overflow-hidden sm:w-56">
        {error ? (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <ImageIcon className="size-8" />
          </div>
        ) : (
          <img
            alt={image.title}
            className={`h-full w-full object-cover transition-all duration-300 group-hover/img:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
            loading="lazy"
            onError={() => {
              setError(true);
            }}
            onLoad={() => {
              setLoaded(true);
            }}
            src={image.thumbnail || image.imageUrl}
          />
        )}
        {!loaded && !error && (
          <div className="absolute inset-0 animate-pulse bg-muted/40" />
        )}
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <img
          alt=""
          className="size-3 shrink-0 rounded-sm"
          src={`https://www.google.com/s2/favicons?domain=${image.domain}&sz=32`}
        />
        <span className="truncate text-[10px] text-muted-foreground/70">
          {image.domain}
        </span>
      </div>
    </button>
  );
}

// ─── Main carousel ───────────────────────────────────────────────────────────

export const ImageCarousel = memo(function ImageCarousel({
  images,
}: {
  images: ImageSearchResult[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageSearchResult | null>(
    null
  );
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

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative group/carousel">
        {/* Scroll container */}
        <div
          className="flex gap-2.5 overflow-x-auto scroll-smooth pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          ref={scrollRef}
        >
          {images.map((img) => (
            <ImageCard
              image={img}
              key={img.id}
              onClick={() => {
                setLightboxImage(img);
              }}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        {canScrollLeft && (
          <button
            aria-label="Scroll images left"
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
            aria-label="Scroll images right"
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

      {/* Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          onClose={() => {
            setLightboxImage(null);
          }}
        />
      )}
    </>
  );
});
