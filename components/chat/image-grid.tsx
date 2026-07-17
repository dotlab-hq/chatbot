import type { GeneratedImage } from "@/lib/ai/tools/generate-image";
import { cn } from "@/lib/utils";

type ImageGridProps = {
  images: GeneratedImage[];
};

// Single image renders large + centered; multiple render as a responsive
// collage grid. Keys on url (stable per generation).
export function ImageGrid({ images }: ImageGridProps) {
  if (images.length === 1) {
    return (
      <div className="flex justify-center">
        <picture>
          <img
            alt="AI-generated artwork"
            className="h-auto max-h-[520px] w-auto max-w-full rounded-xl border border-border/50"
            src={images[0]?.url}
          />
        </picture>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        images.length === 2 && "grid-cols-2",
        images.length === 3 && "grid-cols-2",
        images.length === 4 && "grid-cols-2"
      )}
    >
      {images.map((img, i) => (
        <picture key={img.url}>
          <img
            alt={`artwork ${i + 1}`}
            className="h-auto max-h-[260px] w-full rounded-lg border border-border/50 object-cover"
            src={img.url}
          />
        </picture>
      ))}
    </div>
  );
}
