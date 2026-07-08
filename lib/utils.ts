import type {
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatbotError, type ErrorCode } from '@/lib/errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatbotError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatbotError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatbotError('offline:chat');
    }

    throw error;
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
    })) as ChatMessage[];
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}
/**
 * Prune internal reasoning and tool-call parts from messages before sending to LLM.
 * This prevents context bloat and ensures only user-facing content (text, tool results)
 * is included in subsequent LLM requests.
 */
export function pruneMessageParts(
  parts: UIMessagePart<CustomUIDataTypes, ChatTools>[]
): UIMessagePart<CustomUIDataTypes, ChatTools>[] {
  return parts.filter((part) => {
    const type = part.type as string;
    // Keep text deltas and text outputs (meaningful user-facing content)
    if (type === 'text-delta' || type === 'text-start' || type === 'text-end' || type === 'custom') return true;
    // Keep tool outputs (meaningful output from tool execution)
    if (type === 'tool-output' || type === 'tool-result') return true;
    // Remove reasoning input parts (internal thinking, not visible to user)
    if (type === 'reasoning-start' || type === 'reasoning-delta' || type === 'reasoning-end') return false;
    // Remove tool call input parts (function calls, not visible to user)
    if (type === 'tool-call-begin' || type === 'tool-call') return false;
    // Keep artifact/data stream parts (visible UI updates)
    if (type === 'data-id' || type === 'data-title' || type === 'data-kind' || type === 'data-clear' || type === 'data-finish' || type === 'data-chat-title' || type === 'data-suggestion') return true;
    // Keep other system/ui parts
    if (type === 'step-start' || type === 'finish') return true;
    // Keep other artifact-related parts
    if (type.startsWith('image') || type.startsWith('sheet') || type.startsWith('code') || type.startsWith('svg') || type.startsWith('html') || type.startsWith('diagram') || type.startsWith('video')) return true;
    // Default to keeping unknown types for safety
    return true;
  });
}

/**
 * Prune messages for LLM consumption - removes reasoning and tool-call
 * input parts while preserving tool results and user-facing content.
 */
export function pruneMessagesForLLM(
  messages: ChatMessage[]
): ChatMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: pruneMessageParts(msg.parts),
  }));
}