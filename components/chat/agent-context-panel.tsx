"use client";

import {
  BrainCircuit,
  CheckCircle2,
  ChevronDownIcon,
  Loader2,
  Route,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getSubagentSteps,
  getToolPlan,
  resetAgentContext,
  subscribeToSubagentSteps,
  type SubagentStepState,
  type ToolPlanState,
} from "./data-stream-handler";

type AgentContextPanelProps = {
  chatId: string;
  className?: string;
};

function formatToolName(tool: string) {
  return tool
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Tool$/, "")
    .replace(/^./, (char) => char.toUpperCase());
}

export function AgentContextPanel({ chatId, className }: AgentContextPanelProps) {
  const [toolPlan, setToolPlan] = useState<ToolPlanState | null>(null);
  const [subagentSteps, setSubagentSteps] = useState<SubagentStepState>({});
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    resetAgentContext();
    setToolPlan(getToolPlan());
    setSubagentSteps({ ...getSubagentSteps() });

    return subscribeToSubagentSteps(() => {
      setToolPlan(getToolPlan());
      setSubagentSteps({ ...getSubagentSteps() });
      setIsOpen(true);
    });
  }, [chatId]);

  const subagents = useMemo(
    () => Object.entries(subagentSteps),
    [subagentSteps]
  );

  if (!toolPlan && subagents.length === 0) {
    return null;
  }

  const runningCount = subagents.filter(([, step]) =>
    ["running", "streaming"].includes(step.status)
  ).length;

  return (
    <Collapsible
      className={cn(
        "group not-prose mb-4 w-full rounded-md border bg-card",
        className
      )}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <CollapsibleTrigger className="w-full">
        <div className="flex w-full items-center justify-between p-3">
          <div className="flex min-w-0 items-center gap-2">
            {runningCount > 0 ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <BrainCircuit className="size-4 shrink-0 text-primary" />
            )}
            <span className="truncate font-medium text-sm">
              Agent Context
            </span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {runningCount > 0
                ? `${runningCount} running`
                : `${toolPlan?.groups.length ?? 0} tool groups`}
            </span>
          </div>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-3">
          {toolPlan && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Route className="size-3.5" />
                <span>Prepared tool groups</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {toolPlan.groups.map((group) => (
                  <span
                    className="rounded border bg-background px-2 py-1 text-xs"
                    key={group}
                  >
                    {group}
                  </span>
                ))}
              </div>

              {toolPlan.tools.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Wrench className="size-3.5" />
                    <span>Active tools</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {toolPlan.tools.slice(0, 18).map((tool) => (
                      <span
                        className="rounded border bg-muted/40 px-2 py-1 text-xs"
                        key={tool}
                      >
                        {formatToolName(tool)}
                      </span>
                    ))}
                    {toolPlan.tools.length > 18 && (
                      <span className="rounded border bg-muted/40 px-2 py-1 text-xs">
                        +{toolPlan.tools.length - 18} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {subagents.length > 0 && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs">Subagents</div>
              {subagents.map(([tool, step]) => (
                <div
                  className="flex items-start gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                  key={tool}
                >
                  {step.status === "error" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : step.status === "complete" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {formatToolName(tool)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {step.error ??
                        step.message ??
                        step.task ??
                        (step.status === "complete"
                          ? "Completed"
                          : "Spinning up")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
