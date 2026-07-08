import { tool } from "ai";
import { z } from "zod";

export const calculator = tool({
  description:
    "Evaluate a mathematical expression. Supports +, -, *, /, **, %, parentheses, and common math functions (sqrt, abs, sin, cos, tan, log, PI, E).",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "Mathematical expression to evaluate (e.g., '24*(18+3)', 'sqrt(144)', 'sin(PI/2)')"
      ),
  }),
  execute: (input) => {
    const { expression } = input;

    // ponytail: safe math eval — sanitizes to math-only chars + known functions
    const safe = expression.replace(
      /\b(sqrt|abs|sin|cos|tan|log|log2|log10|pow|PI|E|ceil|floor|round|min|max)\b/g,
      "Math.$1"
    );

    if (/[a-zA-Z]/.test(safe.replace(/Math\.\w+/g, ""))) {
      return { error: "Invalid expression: contains unsupported characters." };
    }

    try {
      const result = new Function(`"use strict"; return (${safe})`)();
      if (typeof result !== "number" || !Number.isFinite(result)) {
        return { error: "Expression did not evaluate to a finite number." };
      }
      return { expression, result };
    } catch {
      return { error: `Could not evaluate: ${expression}` };
    }
  },
});
