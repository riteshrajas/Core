import type { AgentKind, AgentMode, ProviderMode, ProviderName, RouteDecision } from "./types.js";

type RouteInput = {
  prompt: string;
  provider?: ProviderMode;
  agent?: AgentMode;
  defaultProvider: ProviderName;
  availableProviders: ProviderName[];
};

const PROVIDER_PREFERENCE: Record<AgentKind, ProviderName[]> = {
  general: ["openai", "anthropic", "ollama"],
  researcher: ["openai", "ollama", "anthropic"],
  coder: ["anthropic", "openai", "ollama"],
  system: ["ollama", "openai", "anthropic"]
};

export function routePrompt(input: RouteInput): RouteDecision {
  const agent = resolveAgent(input.prompt, input.agent);
  const provider = resolveProvider({
    requestedProvider: input.provider,
    preferredProviders: PROVIDER_PREFERENCE[agent],
    defaultProvider: input.defaultProvider,
    availableProviders: input.availableProviders
  });

  const reason = buildReason(agent, provider, input.provider, input.agent);

  return {
    agent,
    provider,
    reason
  };
}

export function listAgents(): AgentKind[] {
  return ["general", "researcher", "coder", "system"];
}

function resolveAgent(prompt: string, agentMode: AgentMode | undefined): AgentKind {
  if (agentMode && agentMode !== "auto") {
    return agentMode;
  }

  const text = prompt.toLowerCase();

  if (matchesAny(text, ["search", "research", "look up", "latest", "news", "web", "source"])) {
    return "researcher";
  }

  if (
    matchesAny(text, [
      "code",
      "typescript",
      "javascript",
      "python",
      "bug",
      "fix",
      "refactor",
      "stack trace",
      "compile",
      "test"
    ])
  ) {
    return "coder";
  }

  if (
    matchesAny(text, [
      "filesystem",
      "file",
      "folder",
      "directory",
      "shell",
      "terminal",
      "operating system",
      "read",
      "write"
    ])
  ) {
    return "system";
  }

  return "general";
}

function resolveProvider(input: {
  requestedProvider?: ProviderMode;
  preferredProviders: ProviderName[];
  defaultProvider: ProviderName;
  availableProviders: ProviderName[];
}): ProviderName {
  if (input.requestedProvider && input.requestedProvider !== "auto") {
    if (!input.availableProviders.includes(input.requestedProvider)) {
      throw new Error(
        `Provider ${input.requestedProvider} is unavailable. Configured providers: ${input.availableProviders.join(", ")}`
      );
    }
    return input.requestedProvider;
  }

  for (const provider of input.preferredProviders) {
    if (input.availableProviders.includes(provider)) {
      return provider;
    }
  }

  return input.defaultProvider;
}

function buildReason(
  agent: AgentKind,
  provider: ProviderName,
  providerMode: ProviderMode | undefined,
  agentMode: AgentMode | undefined
): string {
  const source = providerMode && providerMode !== "auto" ? "forced provider" : "auto provider";
  const agentSource = agentMode && agentMode !== "auto" ? "forced agent" : "auto agent";
  return `${agentSource}; ${source}; selected ${agent} on ${provider}`;
}

function matchesAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}
