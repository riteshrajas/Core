import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import type {
  ChatTurn,
  ModelCompletion,
  ModelCompletionRequest,
  ProviderMode,
  ProviderName
} from "./types.js";

type ProviderConfig = {
  ollamaBaseUrl: string;
  ollamaDefaultModel: string;
  openAiBaseUrl: string;
  openAiDefaultModel: string;
  anthropicBaseUrl: string;
  anthropicDefaultModel: string;
  anthropicMaxTokens: number;
  defaultProvider: ProviderName;
  defaultTemperature?: number;
  openAiApiKey?: string;
  anthropicApiKey?: string;
};

export class MultiProviderClient {
  private readonly config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = {
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      ollamaDefaultModel: process.env.OLLAMA_MODEL || "qwen3:4b",
      openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      openAiDefaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
      anthropicDefaultModel: process.env.ANTHROPIC_MODEL || "APEX-3-5-sonnet-latest",
      anthropicMaxTokens: parsePositiveInteger(process.env.ANTHROPIC_MAX_TOKENS, 1024),
      defaultProvider: parseProviderName(process.env.DEFAULT_AI_PROVIDER) || "ollama",
      defaultTemperature: parseOptionalNumber(process.env.DEFAULT_AI_TEMPERATURE),
      openAiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      ...config
    };

    if (!this.isAvailable(this.config.defaultProvider)) {
      this.config.defaultProvider = this.listAvailable()[0] ?? "ollama";
    }
  }

  getDefaultProvider(): ProviderName {
    return this.config.defaultProvider;
  }

  getDefaultModel(provider: ProviderName): string {
    switch (provider) {
      case "openai":
        return this.config.openAiDefaultModel;
      case "anthropic":
        return this.config.anthropicDefaultModel;
      case "ollama":
      default:
        return this.config.ollamaDefaultModel;
    }
  }

  getDefaultTemperature(): number | undefined {
    return this.config.defaultTemperature;
  }

  listAvailable(): ProviderName[] {
    const providers: ProviderName[] = ["ollama"];
    if (this.config.openAiApiKey) {
      providers.push("openai");
    }
    if (this.config.anthropicApiKey) {
      providers.push("anthropic");
    }
    return providers;
  }

  resolveProvider(mode: ProviderMode | undefined, preferred: ProviderName[]): ProviderName {
    if (mode && mode !== "auto") {
      if (!this.isAvailable(mode)) {
        throw new Error(
          `Provider ${mode} is not configured. Add credentials in .env or choose another provider.`
        );
      }
      return mode;
    }

    const available = new Set(this.listAvailable());
    for (const candidate of preferred) {
      if (available.has(candidate)) {
        return candidate;
      }
    }

    return this.config.defaultProvider;
  }

  async complete(request: ModelCompletionRequest): Promise<ModelCompletion> {
    switch (request.provider) {
      case "openai":
        return this.completeOpenAi(request);
      case "anthropic":
        return this.completeAnthropic(request);
      case "ollama":
      default:
        return this.completeOllama(request);
    }
  }

  private isAvailable(provider: ProviderName): boolean {
    if (provider === "openai") {
      return Boolean(this.config.openAiApiKey);
    }
    if (provider === "anthropic") {
      return Boolean(this.config.anthropicApiKey);
    }
    return true;
  }

  private async completeOllama(request: ModelCompletionRequest): Promise<ModelCompletion> {
    const model = request.model || this.config.ollamaDefaultModel;
    const temperature =
      isFiniteNumber(request.temperature) ? request.temperature : this.config.defaultTemperature;

    const chat = new ChatOllama({
      baseUrl: this.config.ollamaBaseUrl,
      model,
      temperature
    });

    const messages = toLangChainMessages(request.messages);
    const response = await chat.invoke(messages);
    const text = asText(response.content);

    return {
      text,
      provider: "ollama",
      model
    };
  }

  private async completeOpenAi(request: ModelCompletionRequest): Promise<ModelCompletion> {
    const apiKey = this.config.openAiApiKey;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const model = request.model || this.config.openAiDefaultModel;
    const url = `${stripTrailingSlash(this.config.openAiBaseUrl)}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: isFiniteNumber(request.temperature)
          ? request.temperature
          : this.config.defaultTemperature,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OpenAiChatResponse;
    const text = extractOpenAiText(data);

    return {
      text,
      provider: "openai",
      model: typeof data.model === "string" ? data.model : model
    };
  }

  private async completeAnthropic(request: ModelCompletionRequest): Promise<ModelCompletion> {
    const apiKey = this.config.anthropicApiKey;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }

    const model = request.model || this.config.anthropicDefaultModel;
    const url = `${stripTrailingSlash(this.config.anthropicBaseUrl)}/messages`;
    const { systemPrompt, messages } = toAnthropicMessages(request.messages);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: this.config.anthropicMaxTokens,
        temperature: isFiniteNumber(request.temperature)
          ? request.temperature
          : this.config.defaultTemperature,
        system: systemPrompt || undefined,
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = extractAnthropicText(data);

    return {
      text,
      provider: "anthropic",
      model
    };
  }
}

function toLangChainMessages(messages: ChatTurn[]) {
  return messages.map((message) => {
    if (message.role === "system") {
      return new SystemMessage(message.content);
    }
    if (message.role === "assistant") {
      return new AIMessage(message.content);
    }
    return new HumanMessage(message.content);
  });
}

function toAnthropicMessages(messages: ChatTurn[]): {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts: string[] = [];
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    turns.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    });
  }

  const safeTurns = turns.length === 0
    ? [{ role: "user" as const, content: "Respond to the latest instruction." }]
    : turns[0].role === "assistant"
      ? [{ role: "user" as const, content: "Continue." }, ...turns]
      : turns;

  return {
    systemPrompt: systemParts.join("\n\n"),
    messages: safeTurns
  };
}

function extractOpenAiText(response: OpenAiChatResponse): string {
  const choice = Array.isArray(response.choices) ? response.choices[0] : undefined;
  const message = choice?.message;

  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter((item) => item.length > 0)
      .join("\n");
  }

  return "";
}

function extractAnthropicText(response: AnthropicResponse): string {
  if (!Array.isArray(response.content)) {
    return "";
  }

  return response.content
    .map((item) => {
      if (item && typeof item === "object" && item.type === "text" && typeof item.text === "string") {
        return item.text;
      }
      return "";
    })
    .filter((text) => text.length > 0)
    .join("\n");
}

function asText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content);
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseProviderName(value: string | undefined): ProviderName | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "ollama" || normalized === "openai" || normalized === "anthropic") {
    return normalized;
  }
  return undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type OpenAiChatResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<
            | string
            | {
                type?: string;
                text?: string;
              }
          >;
    };
  }>;
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};
