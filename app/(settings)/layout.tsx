import { cookies } from "next/headers";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}

async function SettingsShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
