import type { UIMessageStreamWriter } from "ai";
import { parallelPromptSection } from "@/lib/ai/parallel-executioner";
import {
  artifactsPrompt,
  httpToolsPrompt,
  projectFilesPrompt,
  searchToolsPrompt,
  todoPrompt,
} from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/types";

export type ToolPlanGroup =
  | "core"
  | "artifacts"
  | "projectFiles"
  | "memory"
  | "search"
  | "http"
  | "subagents"
  | "parallel"
  | "todo"
  | "mcp";

export type ToolPlan = {
  query: string;
  groups: ToolPlanGroup[];
  activeTools: string[] | "all";
  promptSections: string[];
  rationale: string[];
  contextManagement: string[];
};

type BuildToolPlanParams = {
  query: string;
  supportsTools: boolean;
  hasProject: boolean;
  hasMemory: boolean;
  hasSearchTools: boolean;
  mcpToolNames: string[];
};

const CORE_TOOLS = [
  "getWeather",
  "calculator",
  "timer",
  "currencyConverter",
  "unitConverter",
  "localTime",
  "renderCards",
  "playVideo",
];

const ARTIFACT_TOOLS = [
  "createDocument",
  "editDocument",
  "updateDocument",
  "requestSuggestions",
  "verifyContent",
  "readArtifact",
];

const PROJECT_TOOLS = [
  "searchProjectFiles",
  "listProjectFiles",
  "getFileContent",
];

const MEMORY_TOOLS = [
  "saveMemory",
  "recallMemory",
  "listMemories",
  "deleteMemory",
  "clearMemories",
];

const SEARCH_TOOLS = [
  "webSearch",
  "webSearchExtract",
  "webImageSearch",
  "webExtract",
  "rankTracker",
];

const HTTP_TOOLS = ["clientHttpRequest", "randomApiTool"];
const SUBAGENT_TOOLS = ["researchTool", "randomApiTool"];
const PARALLEL_TOOLS = ["runParallel"];
const TODO_TOOLS = ["manageTodoList"];

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function queryTextFromMessage(message?: ChatMessage) {
  return (
    message?.parts
      ?.filter((part): part is { type: "text"; text: string } => {
        return part.type === "text";
      })
      .map((part) => part.text)
      .join("\n")
      .trim() ?? ""
  );
}

export function getLatestUserQuery(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user") {
      const text = queryTextFromMessage(message);
      if (text) {
        return text;
      }
    }
  }
  return "";
}

export function buildToolPlan({
  query,
  supportsTools,
  hasProject,
  hasMemory,
  hasSearchTools,
  mcpToolNames,
}: BuildToolPlanParams): ToolPlan {
  const normalizedQuery = query.toLowerCase();
  const groups: ToolPlanGroup[] = ["core"];
  const promptSections: string[] = [];
  const rationale: string[] = [];

  const asksForArtifact = includesAny(normalizedQuery, [
    "artifact",
    "board",
    "canvas",
    "diagram",
    "draw",
    "excalidraw",
    "file",
    "fix",
    "implement",
    "write",
    "create",
    "build",
    "edit",
    "update",
    "document",
    "spreadsheet",
    "svg",
    "html",
    "code",
  ]);

  const asksForProjectFiles =
    hasProject &&
    includesAny(normalizedQuery, [
      "project file",
      "uploaded",
      "my files",
      "repo",
      "codebase",
      "context",
      "document",
      "resume",
      "pdf",
    ]);

  const asksForCurrentInfo = includesAny(normalizedQuery, [
    "latest",
    "current",
    "today",
    "news",
    "search",
    "web",
    "internet",
    "research",
    "lookup",
    "look up",
    "image",
    "photo",
    "rank",
    "seo",
    "url",
    "website",
  ]);

  const asksForHttp = includesAny(normalizedQuery, [
    "api",
    "http",
    "endpoint",
    "curl",
    "request",
    "post ",
    "get ",
    "delete ",
    "put ",
    "patch ",
    "my ip",
  ]);

  const asksForSubagent = includesAny(normalizedQuery, [
    "subagent",
    "agent",
    "research",
    "investigate",
    "deep dive",
    "multiple sources",
    "web search",
  ]);

  const asksForParallel = includesAny(normalizedQuery, [
    "compare",
    "several",
    "multiple",
    "parallel",
    "both",
    "all of",
    "batch",
  ]);

  const complexTask = includesAny(normalizedQuery, [
    "implement",
    "fix",
    "debug",
    "refactor",
    "build",
    "update",
    "add",
    "make sure",
    "best practices",
  ]);

  if (supportsTools && asksForArtifact) {
    groups.push("artifacts");
    promptSections.push(artifactsPrompt);
    rationale.push("Artifact tools are relevant to create, inspect, or update visible work.");
  }

  if (supportsTools && asksForProjectFiles) {
    groups.push("projectFiles");
    promptSections.push(projectFilesPrompt);
    rationale.push("Project file tools are relevant because the query asks about project context or uploaded files.");
  }

  if (supportsTools && hasMemory) {
    groups.push("memory");
    rationale.push("Memory tools remain available for user preferences and durable context.");
  }

  if (supportsTools && hasSearchTools && asksForCurrentInfo) {
    groups.push("search");
    promptSections.push(searchToolsPrompt);
    rationale.push("Search tools are relevant for current, external, or multi-source information.");
  }

  if (supportsTools && asksForHttp) {
    groups.push("http");
    promptSections.push(httpToolsPrompt);
    rationale.push("HTTP tools are relevant because the query mentions APIs or direct requests.");
  }

  if (supportsTools && asksForSubagent) {
    groups.push("subagents");
    rationale.push("Subagents are relevant for delegated research or API execution.");
  }

  if (supportsTools && asksForParallel) {
    groups.push("parallel");
    promptSections.push(parallelPromptSection);
    rationale.push("Parallel execution is relevant because independent tool calls may be batched.");
  }

  if (supportsTools && complexTask) {
    groups.push("todo");
    promptSections.push(todoPrompt);
    rationale.push("Todo tracking is relevant because the task has multiple implementation steps.");
  }

  if (supportsTools && mcpToolNames.length > 0) {
    groups.push("mcp");
    rationale.push("Configured MCP tools are available and may provide user-specific capabilities.");
  }

  if (supportsTools && !promptSections.includes(httpToolsPrompt)) {
    promptSections.push(httpToolsPrompt);
  }

  const activeTools =
    supportsTools === false
      ? []
      : unique([
          ...CORE_TOOLS,
          ...(groups.includes("artifacts") ? ARTIFACT_TOOLS : []),
          ...(groups.includes("projectFiles") ? PROJECT_TOOLS : []),
          ...(groups.includes("memory") ? MEMORY_TOOLS : []),
          ...(groups.includes("search") ? SEARCH_TOOLS : []),
          ...(groups.includes("http") ? HTTP_TOOLS : ["clientHttpRequest"]),
          ...(groups.includes("subagents") ? SUBAGENT_TOOLS : []),
          ...(groups.includes("parallel") ? PARALLEL_TOOLS : []),
          ...(groups.includes("todo") ? TODO_TOOLS : []),
          ...mcpToolNames,
        ]);

  return {
    query,
    groups: unique(groups),
    activeTools,
    promptSections: unique(promptSections),
    rationale:
      rationale.length > 0
        ? rationale
        : ["Only core tools are selected for this lightweight turn."],
    contextManagement: [
      "Use the selected tools only when they materially improve the answer.",
      "Before each step, reassess whether the next tool is still needed.",
      "Keep tool outputs summarized; do not copy large payloads back into context.",
      "Prefer project and artifact read tools over guessing from stale conversation context.",
    ],
  };
}

export function writeToolPlanEvent(
  dataStream: UIMessageStreamWriter<ChatMessage>,
  toolPlan: ToolPlan
) {
  dataStream.write({
    type: "data-tool-plan",
    data: {
      groups: toolPlan.groups,
      tools: toolPlan.activeTools === "all" ? [] : toolPlan.activeTools,
      rationale: toolPlan.rationale,
      contextManagement: toolPlan.contextManagement,
    },
  });
}
