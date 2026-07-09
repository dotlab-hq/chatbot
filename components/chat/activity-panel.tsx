"use client";

import { CheckCircle2Icon, Globe2Icon, Loader2Icon, XIcon } from "lucide-react";
import { memo } from "react";
import type { ActivityItem } from "@/components/chat/activity-panel-context";
import { faviconUrl } from "@/components/chat/search-sources-context";
import { cn } from "@/lib/utils";

function formatDuration(seconds?: number) {
  if (!seconds) {
    return "a few seconds";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

const ActivityPanel = memo(function ActivityPanel({
  items,
  durationSeconds,
  onClose,
}: {
  items: ActivityItem[];
  durationSeconds?: number;
  onClose: () => void;
}) {
  return (
    <div className="h-full w-80 shrink-0 overflow-y-auto border-l border-border/40 bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground text-sm">Activity</p>
          <span className="text-muted-foreground/50">·</span>
          <p className="text-muted-foreground text-sm">
            {formatDuration(durationSeconds)}
          </p>
        </div>
        <button
          aria-label="Close activity panel"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="p-4">
        <p className="mb-4 font-semibold text-foreground text-sm">Thinking</p>
        <div className="relative space-y-5">
          <div className="absolute bottom-4 left-[7px] top-2 w-px bg-border" />
          {items.map((item) => (
            <div className="relative pl-7" key={item.id}>
              <div
                className={cn(
                  "absolute left-0 top-1 flex size-3.5 items-center justify-center rounded-full bg-background ring-2 ring-background",
                  item.status === "running"
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {item.status === "running" ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : item.domains?.length ? (
                  <Globe2Icon className="size-3" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-foreground text-sm leading-snug">
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {item.body}
                  </p>
                )}
                {item.domains && item.domains.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.domains.slice(0, 4).map((domain) => (
                      <span
                        className="inline-flex max-w-[130px] items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] text-foreground"
                        key={domain}
                      >
                        <img
                          alt=""
                          className="size-3 rounded-sm"
                          src={faviconUrl(domain)}
                        />
                        <span className="truncate">{domain}</span>
                      </span>
                    ))}
                    {item.domains.length > 4 && (
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {item.domains.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="relative pl-7">
            <CheckCircle2Icon className="absolute left-0 top-0.5 size-3.5 bg-background text-muted-foreground" />
            <p className="text-foreground text-sm">
              Thought for {formatDuration(durationSeconds)}
            </p>
            <p className="text-muted-foreground text-xs">Done</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export { ActivityPanel, formatDuration };
