import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-2 rounded-lg border border-border/50 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Go home
      </Link>
    </div>
  );
}
