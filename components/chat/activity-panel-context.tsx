"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type ActivityItem = {
  id: string;
  title: string;
  body?: string;
  domains?: string[];
  status?: "running" | "complete";
};

type ActivityPanelContextValue = {
  items: ActivityItem[];
  durationSeconds?: number;
  open: boolean;
  messageId: string | null;
  openPanel: (
    items: ActivityItem[],
    messageId: string,
    durationSeconds?: number
  ) => void;
  closePanel: () => void;
};

const ActivityPanelContext = createContext<ActivityPanelContextValue | null>(
  null
);

export function ActivityPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>();
  const [messageId, setMessageId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openPanel = useCallback(
    (
      nextItems: ActivityItem[],
      nextMessageId: string,
      nextDuration?: number
    ) => {
      setItems(nextItems);
      setDurationSeconds(nextDuration);
      setMessageId(nextMessageId);
      setOpen(true);
    },
    []
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    setMessageId(null);
  }, []);

  return (
    <ActivityPanelContext.Provider
      value={{ closePanel, durationSeconds, items, messageId, open, openPanel }}
    >
      {children}
    </ActivityPanelContext.Provider>
  );
}

export function useActivityPanel() {
  const ctx = useContext(ActivityPanelContext);
  if (!ctx) {
    throw new Error("useActivityPanel must be inside ActivityPanelProvider");
  }
  return ctx;
}
