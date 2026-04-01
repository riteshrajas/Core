export type ProviderName = "ollama" | "openai" | "anthropic";

export type ProviderMode = ProviderName | "auto";

export type AgentKind = "general" | "researcher" | "coder" | "system";

export type AgentMode = AgentKind | "auto";

export type ChatRole = "system" | "user" | "assistant";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

export type RouteDecision = {
  agent: AgentKind;
  provider: ProviderName;
  reason: string;
};

export type ToolUse = {
  name: string;
  input: Record<string, unknown>;
  output: string;
};

export type ModelCompletionRequest = {
  provider: ProviderName;
  messages: ChatTurn[];
  model?: string;
  temperature?: number;
};

export type ModelCompletion = {
  text: string;
  provider: ProviderName;
  model: string;
};

export type ApexChatRequest = {
  message: string;
  history: ChatTurn[];
  system?: string;
  model?: string;
  temperature?: number;
  provider?: ProviderMode;
  agent?: AgentMode;
  threadId?: string;
  includeMemory?: boolean;
};

export type ApexChatResponse = {
  reply: string;
  threadId: string;
  model: string;
  provider: ProviderName;
  route: RouteDecision;
  usedTools: ToolUse[];
};

