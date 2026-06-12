"use client";

import { HistoryIcon, MessageSquarePlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

function PureMobileBottomNav() {
  const { toggleSidebar } = useSidebar();
  const router = useRouter();

  const handleNewChat = useCallback(() => {
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border/40 bg-background/80 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <Button
        aria-label="Open sidebar"
        className="h-12 w-12 flex-col gap-0.5 rounded-xl text-muted-foreground"
        onClick={toggleSidebar}
        size="icon"
        variant="ghost"
      >
        <HistoryIcon className="size-[18px]" />
        <span className="text-[10px] leading-none font-medium">History</span>
      </Button>

      <Button
        aria-label="New chat"
        asChild
        className="h-12 w-12 flex-col gap-0.5 rounded-xl text-muted-foreground"
        onClick={handleNewChat}
        size="icon"
        variant="ghost"
      >
        <Link href="/">
          <MessageSquarePlusIcon className="size-[18px]" />
          <span className="text-[10px] leading-none font-medium">New</span>
        </Link>
      </Button>

      <Button
        aria-label="Settings"
        asChild
        className="h-12 w-12 flex-col gap-0.5 rounded-xl text-muted-foreground"
        size="icon"
        variant="ghost"
      >
        <Link href="/settings">
          <SettingsIcon className="size-[18px]" />
          <span className="text-[10px] leading-none font-medium">Settings</span>
        </Link>
      </Button>
    </nav>
  );
}

export const MobileBottomNav = memo(PureMobileBottomNav);
