import { tool } from "ai";
import { z } from "zod";

export const timer = tool({
  description:
    "Set a countdown timer. The UI will render an interactive countdown.",
  inputSchema: z.object({
    duration: z.number().positive().describe("Duration of the timer"),
    unit: z
      .enum(["seconds", "minutes", "hours"])
      .describe("Time unit for the duration"),
    label: z
      .string()
      .optional()
      .describe(
        "Optional label for the timer (e.g., 'Pasta', 'Meeting break')"
      ),
  }),
  execute: (input) => {
    const ms =
      input.duration *
      (input.unit === "hours"
        ? 3_600_000
        : input.unit === "minutes"
          ? 60_000
          : 1000);

    return {
      durationMs: ms,
      duration: input.duration,
      unit: input.unit,
      label: input.label,
      startedAt: new Date().toISOString(),
    };
  },
});
