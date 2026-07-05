"use client";

import { useEffect, useRef } from "react";

type DiffLine = {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
};

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: "unchanged",
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: "added",
        content: newLines[j - 1],
        newLineNum: j,
      });
      j--;
    } else if (i > 0) {
      result.unshift({
        type: "removed",
        content: oldLines[i - 1],
        oldLineNum: i,
      });
      i--;
    }
  }

  return result;
}

export function CodeDiffView({
  oldContent,
  newContent,
}: {
  oldContent: string;
  newContent: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // Auto-scroll to first diff element
    requestAnimationFrame(() => {
      const firstDiff = containerRef.current?.querySelector(
        "[data-diff-line='added'], [data-diff-line='removed']"
      );
      if (firstDiff) {
        firstDiff.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, []);

  const diffLines = computeLineDiff(oldContent, newContent);

  return (
    <div
      className="flex h-full flex-col overflow-auto bg-background font-mono text-sm"
      ref={containerRef}
    >
      <div className="min-w-max">
        {diffLines.map((line, idx) => (
          <div
            className={`flex border-l-2 px-4 py-0.5 leading-6 ${
              line.type === "added"
                ? "border-l-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : line.type === "removed"
                  ? "border-l-red-500 bg-red-500/10 text-red-600 line-through opacity-70 dark:text-red-400"
                  : "border-l-transparent"
            }`}
            data-diff-line={line.type === "unchanged" ? undefined : line.type}
            key={`${line.type}-${line.content}-${idx}`}
          >
            <span className="w-10 shrink-0 select-none text-right text-xs text-muted-foreground/50">
              {line.oldLineNum ?? ""}
            </span>
            <span className="w-10 shrink-0 select-none text-right text-xs text-muted-foreground/50">
              {line.newLineNum ?? ""}
            </span>
            <span className="ml-4 flex-1 whitespace-pre">
              {line.type === "added" && (
                <span className="mr-1 text-emerald-500">+</span>
              )}
              {line.type === "removed" && (
                <span className="mr-1 text-red-500">-</span>
              )}
              {line.content || "\u00A0"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
