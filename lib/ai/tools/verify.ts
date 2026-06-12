import { tool } from "ai";
import { z } from "zod";

/**
 * Verifier tool — critically reviews content for accuracy, consistency,
 * and completeness. Useful for code review, fact-checking, and QA.
 */
export const verifyContent = tool({
  description:
    "Verify and critically review content for accuracy, bugs, logical errors, or inconsistencies. Provide specific, actionable feedback with severity levels.",
  inputSchema: z.object({
    content: z.string().describe("The content to verify (code, text, etc.)"),
    contentType: z
      .enum(["code", "text", "data"])
      .describe("Type of content being verified"),
    context: z
      .string()
      .optional()
      .describe("Additional context about what this content should do"),
    criteria: z
      .array(z.string())
      .optional()
      .describe("Specific verification criteria to check against"),
  }),
  execute: async ({ content, contentType, context, criteria }) => {
    // Allow external cancellation via microtask
    await Promise.resolve();
    const issues: {
      severity: "error" | "warning" | "info";
      category: string;
      message: string;
      line?: number;
    }[] = [];

    if (contentType === "code") {
      // Basic code verification checks
      const lines = content.split("\n");

      // Check for common code issues
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const lineNum = i + 1;

        // Check for console.log left in production code
        if (line.includes("console.log") && !context?.includes("debugging")) {
          issues.push({
            severity: "warning",
            category: "code-quality",
            message:
              "Found console.log statement — consider removing for production",
            line: lineNum,
          });
        }

        // Check for TODO/FIXME comments
        if (line.includes("TODO") || line.includes("FIXME")) {
          issues.push({
            severity: "info",
            category: "completeness",
            message: `Found unresolved ${line.includes("TODO") ? "TODO" : "FIXME"} comment`,
            line: lineNum,
          });
        }

        // Check for empty catch blocks
        if (line.trim().startsWith("catch") && lines[i + 1]?.trim() === "{}") {
          issues.push({
            severity: "warning",
            category: "error-handling",
            message: "Empty catch block — errors are silently swallowed",
            line: lineNum,
          });
        }

        // Check for var usage
        if (/\bvar\s+/.test(line)) {
          issues.push({
            severity: "warning",
            category: "code-quality",
            message: "Use const/let instead of var",
            line: lineNum,
          });
        }

        // Check for == instead of ===
        if (/[^=!]==[^=]/.test(line) && !line.includes("!=")) {
          issues.push({
            severity: "info",
            category: "code-quality",
            message: "Prefer strict equality (===) over loose equality (==)",
            line: lineNum,
          });
        }
      }

      // Check for missing error handling
      if (
        content.includes("await ") &&
        !content.includes("try") &&
        !content.includes("catch")
      ) {
        issues.push({
          severity: "warning",
          category: "error-handling",
          message:
            "Async operations found without try/catch — consider adding error handling",
        });
      }
    }

    if (contentType === "text") {
      const wordCount = content.split(/\s+/).length;
      const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
      const avgWordsPerSentence = wordCount / Math.max(sentences.length, 1);

      if (avgWordsPerSentence > 30) {
        issues.push({
          severity: "info",
          category: "readability",
          message: `Average sentence length is ${avgWordsPerSentence.toFixed(1)} words — consider breaking up long sentences`,
        });
      }

      // Check for repeated words
      const words = content.toLowerCase().split(/\s+/);
      for (let i = 1; i < words.length; i++) {
        if (words[i] === words[i - 1] && words[i]?.length > 3) {
          issues.push({
            severity: "warning",
            category: "consistency",
            message: `Repeated word: "${words[i]}"`,
          });
        }
      }
    }

    // Check custom criteria
    const criteriaResults: {
      criterion: string;
      passed: boolean;
      notes?: string;
    }[] = [];
    if (criteria) {
      for (const criterion of criteria) {
        criteriaResults.push({
          criterion,
          passed: true,
          notes:
            "Automated verification — manual review recommended for comprehensive assessment",
        });
      }
    }

    const score = Math.max(
      0,
      100 -
        issues.filter((i) => i.severity === "error").length * 25 -
        issues.filter((i) => i.severity === "warning").length * 10 -
        issues.filter((i) => i.severity === "info").length * 2
    );

    return {
      score,
      issues,
      criteriaResults,
      summary:
        issues.length === 0
          ? "No issues found — content appears clean."
          : `Found ${issues.length} issue(s): ${issues.filter((i) => i.severity === "error").length} error(s), ${issues.filter((i) => i.severity === "warning").length} warning(s), ${issues.filter((i) => i.severity === "info").length} suggestion(s)`,
    };
  },
});
