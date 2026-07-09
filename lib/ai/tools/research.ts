import { tool } from "ai";
import { z } from "zod";
import { webSearch } from "@/lib/ai/tools/web-search";

export const researchTool = tool({
  description:
    "Research a topic by searching the web and returning results. Use this for questions that require current information or multi-source research.",
  inputSchema: z.object({
    task: z
      .string()
      .describe("The research task, question, or topic to investigate"),
  }),
  execute: async ({ task }) => {
    return await webSearch({ query: task, engine: "bing", limit: 5 });
  },
});
