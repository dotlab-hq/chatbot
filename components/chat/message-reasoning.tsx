"use client";

import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "@/components/chat/activity-panel";
import type { ActivityItem } from "@/components/chat/activity-panel-context";
import { cn } from "@/lib/utils";

type MessageReasoningProps = {
  isLoading: boolean;
  isOpen?: boolean;
  onOpenActivity: (durationSeconds?: number) => void;
  reasoning: string;
  savedDurationSeconds?: number;
  timelineItems: ActivityItem[];
};

export function MessageReasoning({
  isLoading,
  isOpen,
  onOpenActivity,
  reasoning,
  savedDurationSeconds,
  timelineItems,
}: MessageReasoningProps) {
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>(
    savedDurationSeconds
  );
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    isLoading ? Date.now() : null
  );

  useEffect(() => {
    if (savedDurationSeconds) {
      setDurationSeconds(savedDurationSeconds);
    }
  }, [savedDurationSeconds]);

  useEffect(() => {
    if (isLoading) {
      setStartedAt((current) => current ?? Date.now());
      return;
    }

    if (startedAt !== null) {
      setDurationSeconds(
        Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))
      );
      setStartedAt(null);
    }
  }, [isLoading, startedAt]);

  useEffect(() => {
    if (!(isLoading && startedAt !== null)) {
      return;
    }

    const timer = window.setInterval(() => {
      setDurationSeconds(
        Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLoading, startedAt]);

  const label = isLoading
    ? "Thinking..."
    : `Thought for ${formatDuration(durationSeconds)}`;

  return (
    <button
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-md py-1 text-muted-foreground text-sm transition-colors hover:text-foreground",
        isOpen && "text-foreground"
      )}
      data-testid="message-reasoning"
      onClick={() => onOpenActivity(durationSeconds)}
      type="button"
    >
      {isLoading && <Loader2Icon className="size-3.5 animate-spin" />}
      <span>{label}</span>
      <ChevronRightIcon className="size-3.5" />
      <span className="sr-only">{reasoning}</span>
      <span className="sr-only">{timelineItems.length} activity items</span>
    </button>
  );
}
