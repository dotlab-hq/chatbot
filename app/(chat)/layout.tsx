import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { EmailVerificationGate } from "@/components/email-verification-gate";
import { ChatShell } from "@/components/chat/shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveChatProvider } from "@/hooks/use-active-chat";

function ShellSkeleton() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-border/50 bg-sidebar p-4 md:flex">
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <div className="mt-2 flex flex-col gap-2">
          {["n1", "n2", "n3", "n4", "n5", "n6"].map((id) => (
            <Skeleton className="h-7 w-full rounded-md" key={id} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
          {[
            "items-start w-3/4",
            "items-end w-2/5",
            "items-start w-2/3",
            "items-end w-1/2",
          ].map((cls) => (
            <div className={`flex flex-col gap-2 ${cls}`} key={cls}>
              <Skeleton className="h-4 rounded-md w-3/4" />
              <Skeleton className="h-4 w-4/5 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <Suspense fallback={<ShellSkeleton />}>
          <SidebarShell>{children}</SidebarShell>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar user={session?.user} />
      <SidebarInset>
        <EmailVerificationGate />
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        <Suspense fallback={<ShellSkeleton />}>
          <ActiveChatProvider>
            <ChatShell />
          </ActiveChatProvider>
        </Suspense>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
