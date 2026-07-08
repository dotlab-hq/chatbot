"use client";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-6xl font-bold text-muted-foreground/30">500</h1>
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <p className="max-w-md text-center text-xs text-muted-foreground/60">
        {error.message}
      </p>
      <button
        className="mt-2 cursor-pointer rounded-lg border border-border/50 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
