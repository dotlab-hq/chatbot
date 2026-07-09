import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  order: number;
};

// ─── In-memory store (scoped to server instance, keyed by chatId) ──────────

const todoStore = new Map<string, TodoItem[]>();

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getTodos(chatId: string): TodoItem[] {
  return todoStore.get(chatId) ?? [];
}

function emitTodoUpdate(
  dataStream: UIMessageStreamWriter<ChatMessage>,
  chatId: string
): void {
  if (dataStream?.write) {
    dataStream.write({
      type: "data-todo-update" as any,
      data: { items: getTodos(chatId) },
    });
  }
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const todoActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    text: z.string().describe("The text/content of the todo item"),
  }),
  z.object({
    action: z.literal("add-multiple"),
    items: z
      .array(z.object({ text: z.string() }))
      .describe("Multiple todo items to add at once"),
  }),
  z.object({
    action: z.literal("check"),
    id: z.string().describe("The ID of the todo item to mark as done"),
  }),
  z.object({
    action: z.literal("uncheck"),
    id: z.string().describe("The ID of the todo item to mark as not done"),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string(),
    text: z.string(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.string().describe("The ID of the todo item to remove"),
  }),
  z.object({
    action: z.literal("clear"),
  }),
]);

// ─── Tool Factory ───────────────────────────────────────────────────────────

export function createTodoTool(dataStream: UIMessageStreamWriter<ChatMessage>) {
  return tool({
    description: `Manage a todo list for the current conversation. Use this to create, track, and update tasks. 
You can add individual items, add multiple at once, check them off, uncheck them, update text, delete items, or clear the whole list. 
Always call this at the START of a conversation to create a plan, and update it as tasks progress. 
The todo list displays in the UI so the user can track progress visually.`,

    inputSchema: z.object({
      chatId: z
        .string()
        .describe(
          "The chat/conversation ID — use the chatId from the conversation context"
        ),
      action: todoActionSchema,
    }),

    execute: ({ chatId, action }) => {
      const current = getTodos(chatId);

      switch (action.action) {
        case "add": {
          const newItem: TodoItem = {
            id: generateId(),
            text: action.text,
            done: false,
            order: current.length,
          };
          const updated = [...current, newItem];
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return { items: updated, message: `Added: "${action.text}"` };
        }

        case "add-multiple": {
          const newItems: TodoItem[] = action.items.map((item, i) => ({
            id: generateId(),
            text: item.text,
            done: false,
            order: current.length + i,
          }));
          const updated = [...current, ...newItems];
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return {
            items: updated,
            message: `Added ${newItems.length} items.`,
          };
        }

        case "check": {
          const updated = current.map((item) =>
            item.id === action.id ? { ...item, done: true } : item
          );
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return { items: updated, message: "Item checked off." };
        }

        case "uncheck": {
          const updated = current.map((item) =>
            item.id === action.id ? { ...item, done: false } : item
          );
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return { items: updated, message: "Item unchecked." };
        }

        case "update": {
          const updated = current.map((item) =>
            item.id === action.id ? { ...item, text: action.text } : item
          );
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return { items: updated, message: "Item updated." };
        }

        case "delete": {
          const updated = current.filter((item) => item.id !== action.id);
          todoStore.set(chatId, updated);
          emitTodoUpdate(dataStream, chatId);
          return { items: updated, message: "Item deleted." };
        }

        case "clear": {
          todoStore.set(chatId, []);
          emitTodoUpdate(dataStream, chatId);
          return { items: [], message: "Todo list cleared." };
        }

        default:
          return { items: current, message: "No changes." };
      }
    },
  });
}
