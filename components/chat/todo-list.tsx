"use client";

import { CheckSquare, ChevronDownIcon, ListTodo, Square } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getTodoItems,
  subscribeToTodoUpdates,
  type TodoUpdate,
} from "./data-stream-handler";

interface TodoListProps {
  className?: string;
  defaultOpen?: boolean;
}

export function TodoList({ className, defaultOpen = true }: TodoListProps) {
  const [items, setItems] = useState<TodoUpdate["items"]>([]);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    // Hydrate from global state
    setItems([...getTodoItems()]);

    const unsub = subscribeToTodoUpdates(() => {
      setItems([...getTodoItems()]);
      if (getTodoItems().length > 0) {
        setIsOpen(true);
      }
    });

    return unsub;
  }, []);

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Collapsible
      className={cn(
        "group not-prose mb-4 w-full rounded-md border bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
        className
      )}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <CollapsibleTrigger className="w-full">
        <div className="flex w-full items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <ListTodo className="size-4 text-emerald-600" />
            <span className="font-medium text-sm text-emerald-900 dark:text-emerald-100">
              Todo List
            </span>
            <span className="ml-2 text-xs text-emerald-600">
              {doneCount}/{totalCount}
            </span>
          </div>
          <ChevronDownIcon className="size-4 text-emerald-600 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-1 px-3 pb-3">
          {items
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <div
                className={cn(
                  "flex items-start gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                  item.done
                    ? "text-muted-foreground/50 line-through"
                    : "text-foreground"
                )}
                key={item.id}
              >
                {item.done ? (
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span>{item.text}</span>
              </div>
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
