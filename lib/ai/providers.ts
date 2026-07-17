import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { isTestEnvironment } from "@/lib/constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // Image-generation models can't stream chat text — the generateImage
  // tool uses its own openai.image() backend. Fall back so selecting
  // gpt-image-1 as the chat model doesn't hard-crash the stream.
  if (modelId.startsWith("gpt-image")) {
    return anthropic(DEFAULT_CHAT_MODEL);
  }

  if (modelId.startsWith("claude-")) {
    return anthropic(modelId);
  }
  return openai.chat(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return openai.chat("gpt-4.1-nano");
}
