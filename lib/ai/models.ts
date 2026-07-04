export const DEFAULT_CHAT_MODEL = "gpt-4.1-nano";

export const titleModel = {
  id: "gpt-4.1-nano",
  name: "GPT 4.1 Nano",
  provider: "openai",
  description: "Fast model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "gpt-4.1",
    name: "GPT 4.1",
    provider: "openai",
    description: "Flagship model with tool use and vision",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT 4.1 Mini",
    provider: "openai",
    description: "Fast and efficient with tool use",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT 4.1 Nano",
    provider: "openai",
    description: "Compact and fast",
  },
  {
    id: "gpt-4o",
    name: "GPT 4o",
    provider: "openai",
    description: "Multimodal model with tool use",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT 4o Mini",
    provider: "openai",
    description: "Fast multimodal model",
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  const capabilities: Record<string, ModelCapabilities> = {};
  for (const model of chatModels) {
    capabilities[model.id] = {
      tools: true,
      vision: true,
      reasoning: true,
    };
  }
  return capabilities;
}

export const isDemo = process.env.IS_DEMO === "1";

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
