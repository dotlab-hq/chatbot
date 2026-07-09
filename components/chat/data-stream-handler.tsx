"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { artifactDefinitions } from "@/components/chat/artifact";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";

export type SubagentStepState = Record<
  string,
  {
    status: "running" | "streaming" | "complete" | "error";
    step?: number;
    message?: string;
    error?: string;
    task?: string;
  }
>;

export type ToolPlanState = {
  groups: string[];
  tools: string[];
  rationale: string[];
  contextManagement: string[];
};

// Global state so multiple consumers can access the latest subagent state
const globalSubagentSteps: SubagentStepState = {};
const listeners = new Set<() => void>();
let globalToolPlan: ToolPlanState | null = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToSubagentSteps(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSubagentSteps(): SubagentStepState {
  return globalSubagentSteps;
}

export function getToolPlan(): ToolPlanState | null {
  return globalToolPlan;
}

export function resetAgentContext() {
  globalToolPlan = null;
  for (const key of Object.keys(globalSubagentSteps)) {
    delete globalSubagentSteps[key];
  }
  notifyListeners();
}

// ─── Global todo list state ─────────────────────────────────────────────────

export type TodoUpdate = {
  items: Array<{
    id: string;
    text: string;
    done: boolean;
    order: number;
  }>;
};

const globalTodoItems: TodoUpdate["items"] = [];
const todoListeners = new Set<() => void>();

function notifyTodoListeners() {
  for (const listener of todoListeners) {
    listener();
  }
}

export function subscribeToTodoUpdates(cb: () => void) {
  todoListeners.add(cb);
  return () => {
    todoListeners.delete(cb);
  };
}

export function getTodoItems(): TodoUpdate["items"] {
  return globalTodoItems;
}

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice();
    setDataStream([]);

    for (const delta of newDeltas) {
      if (delta.type === "data-chat-title") {
        document.title = delta.data;
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        continue;
      }
      if (delta.type === "data-tool-plan") {
        globalToolPlan = {
          groups: delta.data.groups,
          tools: delta.data.tools,
          rationale: delta.data.rationale,
          contextManagement: delta.data.contextManagement,
        };
        for (const key of Object.keys(globalSubagentSteps)) {
          delete globalSubagentSteps[key];
        }
        notifyListeners();
        continue;
      }
      if (delta.type === "data-subagent-step") {
        globalSubagentSteps[delta.data.tool] = {
          status: delta.data.status,
          step: delta.data.step,
          message: delta.data.message,
          error: delta.data.error,
          task: delta.data.task,
        };
        notifyListeners();
        continue;
      }
      if (delta.type === "data-todo-update") {
        globalTodoItems.length = 0;
        globalTodoItems.push(...delta.data.items);
        notifyTodoListeners();
        continue;
      }
      const artifactDefinition = artifactDefinitions.find(
        (currentArtifactDefinition) =>
          currentArtifactDefinition.kind === artifact.kind
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: "streaming" };
        }

        switch (delta.type) {
          case "data-id":
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: "streaming",
            };

          case "data-title":
            return {
              ...draftArtifact,
              title: delta.data,
              status: "streaming",
            };

          case "data-kind":
            return {
              ...draftArtifact,
              kind: delta.data,
              status: "streaming",
            };

          case "data-clear":
            return {
              ...draftArtifact,
              content: "",
              status: "streaming",
            };

          case "data-finish":
            return {
              ...draftArtifact,
              status: "idle",
            };

          default:
            return draftArtifact;
        }
      });
    }
  }, [dataStream, setArtifact, setMetadata, artifact, setDataStream, mutate]);

  return null;
}
