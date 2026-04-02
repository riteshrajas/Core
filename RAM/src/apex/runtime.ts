import { randomUUID } from "node:crypto";
import path from "node:path";

import { ApexMemory } from "./memory.js";
import { listAgents, routePrompt } from "./router.js";
import { MultiProviderClient } from "./providers.js";
import { ApexToolbox } from "./tools.js";
import type {
  AgentKind,
  AgentMode,
  ChatTurn,
  ApexChatRequest,
  ApexChatResponse,
  ProviderMode,
  RouteDecision,
  ToolUse
} from "./types.js";

const AGENT_SYSTEM_PROMPTS: Record<AgentKind, string> = {
  general: "You are Apex, a reliable orchestration assistant. Be clear and practical.",
  researcher:
    "You are the Researcher agent. Prefer grounded answers with cited evidence from tool output.",
  coder:
    "You are the Coder agent. Produce implementation-grade code and explain decisions briefly.",
  system:
    "You are the System agent. Focus on safe local operations and explicit next actions."
};

type RuntimeOptions = {
  projectRoot: string;
  maxHistory: number;
  defaultSystem?: string;
};

type ParsedDirective =
  | { name: "web_search"; query: string; directReply: false }
  | { name: "fs_read"; path: string; directReply: true }
  | { name: "fs_list"; path: string; directReply: true }
  | { name: "fs_write"; path: string; content: string; directReply: true }
  | { name: "fs_write_from_intent"; path: string; instruction: string; directReply: true };

export class ApexRuntime {
  private readonly providers: MultiProviderClient;
  private readonly tools: ApexToolbox;
  private readonly memory: ApexMemory;
  private readonly maxHistory: number;
  private readonly defaultSystem?: string;

  constructor(options: RuntimeOptions) {
    this.maxHistory = Math.max(1, options.maxHistory);
    this.defaultSystem = normalizeOptionalString(options.defaultSystem);
    this.providers = new MultiProviderClient();
    this.tools = new ApexToolbox(options.projectRoot);
    this.memory = new ApexMemory(
      process.env.APEX_MEMORY_FILE || path.join(options.projectRoot, ".apex-memory.json")
    );
  }

  health() {
    const defaultProvider = this.providers.getDefaultProvider();

    return {
      defaultProvider,
      defaultModel: this.providers.getDefaultModel(defaultProvider),
      defaultTemperature: this.providers.getDefaultTemperature(),
      providers: this.providers.listAvailable(),
      agents: listAgents(),
      maxHistory: this.maxHistory,
      recentThreads: this.memory.listThreads(8)
    };
  }

  inspectRoute(input: {
    prompt: string;
    provider?: ProviderMode;
    agent?: AgentMode;
  }): RouteDecision {
    return routePrompt({
      prompt: input.prompt,
      provider: input.provider,
      agent: input.agent,
      defaultProvider: this.providers.getDefaultProvider(),
      availableProviders: this.providers.listAvailable()
    });
  }

  searchMemory(query: string, limit = 5) {
    return this.memory.search(query, limit);
  }

  getThread(threadId: string, limit = 20) {
    return this.memory.getThreadTurns(threadId, limit);
  }

  async runTool(input: {
    name: "web_search" | "fs_read" | "fs_write" | "fs_list";
    query?: string;
    path?: string;
    content?: string;
  }): Promise<string> {
    switch (input.name) {
      case "web_search": {
        const query = requireString(input.query, "query");
        const result = await this.tools.webSearch(query);
        return result.output;
      }
      case "fs_read": {
        const filePath = requireString(input.path, "path");
        const result = await this.tools.fsRead(filePath);
        return result.output;
      }
      case "fs_write": {
        const filePath = requireString(input.path, "path");
        const content = input.content ?? "";
        const result = await this.tools.fsWrite(filePath, content);
        return result.output;
      }
      case "fs_list": {
        const result = await this.tools.fsList(input.path || ".");
        return result.output;
      }
      default:
        throw new Error(`Unknown tool ${input.name}`);
    }
  }

  async chat(request: ApexChatRequest): Promise<ApexChatResponse> {
    const message = requireString(request.message, "message");
    const modelOverride = normalizeOptionalString(request.model);
    const includeMemory = request.includeMemory !== false;
    const threadId = normalizeOptionalString(request.threadId) || randomUUID();
    const userHistory = normalizeHistory(request.history, this.maxHistory);
    const route = this.inspectRoute({
      prompt: message,
      provider: request.provider,
      agent: request.agent
    });

    if (includeMemory) {
      this.memory.setThreadState(threadId, "received");
    }

    const usedTools: ToolUse[] = [];
    const directive = parseDirective(message);

    if (directive) {
      const toolUse = await this.executeDirective(directive, {
        provider: route.provider,
        model: modelOverride,
        temperature: request.temperature
      });
      usedTools.push(toolUse);

      if (directive.directReply) {
        if (includeMemory) {
          this.memory.appendTurn(threadId, "user", message);
          this.memory.appendTurn(threadId, "assistant", toolUse.output);
          this.memory.remember({
            threadId,
            text: `${message}\n${toolUse.output}`,
            agent: route.agent,
            provider: route.provider
          });
          this.memory.setThreadState(threadId, "completed");
        }

        return {
          reply: toolUse.output,
          provider: route.provider,
          model: "tool-only",
          route,
          threadId,
          usedTools
        };
      }
    }

    const memoryTurns = includeMemory ? this.memory.getThreadTurns(threadId, this.maxHistory) : [];
    const history = userHistory.length > 0 ? userHistory : memoryTurns;

    const memoryContext = includeMemory
      ? this.memory
          .search(message, 4)
          .map(
            (entry, index) =>
              `${index + 1}. (${entry.score.toFixed(2)}) [${entry.threadId}] ${entry.text.slice(0, 220)}`
          )
          .join("\n")
      : "";

    const systemSegments: string[] = [
      AGENT_SYSTEM_PROMPTS[route.agent],
      this.defaultSystem || "",
      normalizeOptionalString(request.system) || ""
    ].filter((segment) => segment.length > 0);

    if (memoryContext) {
      systemSegments.push(`Relevant memory snippets:\n${memoryContext}`);
    }

    const toolContext = usedTools
      .map((tool) => `${tool.name}:\n${clip(tool.output, 2500)}`)
      .join("\n\n");

    const messages: ChatTurn[] = [];
    if (systemSegments.length > 0) {
      messages.push({ role: "system", content: systemSegments.join("\n\n") });
    }

    for (const turn of history) {
      messages.push(turn);
    }

    if (toolContext) {
      messages.push({
        role: "system",
        content: `Tool context for this response:\n${toolContext}`
      });
    }

    messages.push({
      role: "user",
      content: message
    });

    if (includeMemory) {
      this.memory.setThreadState(threadId, "model-running");
    }

    const completion = await this.providers.complete({
      provider: route.provider,
      model: modelOverride,
      temperature: request.temperature,
      messages
    });

    if (includeMemory) {
      this.memory.appendTurn(threadId, "user", message);
      this.memory.appendTurn(threadId, "assistant", completion.text);
      this.memory.remember({
        threadId,
        text: `${message}\n${completion.text}`,
        agent: route.agent,
        provider: completion.provider
      });
      this.memory.setThreadState(threadId, "completed");
    }

    return {
      reply: completion.text,
      threadId,
      model: completion.model,
      provider: completion.provider,
      route,
      usedTools
    };
  }

  private async executeDirective(
    directive: ParsedDirective,
    options: {
      provider: RouteDecision["provider"];
      model?: string;
      temperature?: number;
    }
  ): Promise<ToolUse> {
    switch (directive.name) {
      case "web_search": {
        const result = await this.tools.webSearch(directive.query);
        return {
          name: directive.name,
          input: { query: directive.query },
          output: result.output
        };
      }
      case "fs_read": {
        const result = await this.tools.fsRead(directive.path);
        return {
          name: directive.name,
          input: { path: directive.path },
          output: result.output
        };
      }
      case "fs_list": {
        const result = await this.tools.fsList(directive.path);
        return {
          name: directive.name,
          input: { path: directive.path },
          output: result.output
        };
      }
      case "fs_write": {
        const result = await this.tools.fsWrite(directive.path, directive.content);
        return {
          name: directive.name,
          input: { path: directive.path, bytes: directive.content.length },
          output: result.output
        };
      }
      case "fs_write_from_intent": {
        const generated = await this.generateFileContentFromInstruction({
          path: directive.path,
          instruction: directive.instruction,
          provider: options.provider,
          model: options.model,
          temperature: options.temperature
        });
        const result = await this.tools.fsWrite(directive.path, generated.content);
        const preview = clip(generated.content, 700);

        return {
          name: "fs_write",
          input: {
            path: directive.path,
            bytes: generated.content.length,
            generated: true,
            provider: generated.provider,
            model: generated.model
          },
          output: `${result.output}\n\nGenerated from natural-language instruction.\nPreview:\n${preview}`
        };
      }
      default:
        throw new Error(`Unsupported directive: ${String(directive)}`);
    }
  }

  private async generateFileContentFromInstruction(input: {
    path: string;
    instruction: string;
    provider: RouteDecision["provider"];
    model?: string;
    temperature?: number;
  }): Promise<{ content: string; provider: RouteDecision["provider"]; model: string }> {
    const languageHint = languageHintFromPath(input.path);
    const completion = await this.providers.complete({
      provider: input.provider,
      model: input.model,
      temperature: input.temperature,
      messages: [
        {
          role: "system",
          content:
            "You generate complete file contents. Return only raw file text. Do not include markdown fences or extra explanation."
        },
        {
          role: "user",
          content: [
            `Create file content for: ${input.path}`,
            languageHint ? `Language hint: ${languageHint}` : "",
            `User request: ${input.instruction}`,
            "Return only the final file content."
          ]
            .filter(Boolean)
            .join("\n")
        }
      ]
    });

    const content = normalizeGeneratedFileContent(completion.text, input.path);

    return {
      content,
      provider: completion.provider,
      model: completion.model
    };
  }
}

export function createApexRuntime(options: RuntimeOptions): ApexRuntime {
  return new ApexRuntime(options);
}

function parseDirective(message: string): ParsedDirective | undefined {
  const trimmed = message.trim();

  const searchMatch = /^\/search\s+([\s\S]+)$/i.exec(trimmed);
  if (searchMatch) {
    return {
      name: "web_search",
      query: searchMatch[1].trim(),
      directReply: false
    };
  }

  const readMatch = /^\/read\s+(.+)$/i.exec(trimmed);
  if (readMatch) {
    return {
      name: "fs_read",
      path: readMatch[1].trim(),
      directReply: true
    };
  }

  const listMatch = /^\/list(?:\s+(.+))?$/i.exec(trimmed);
  if (listMatch) {
    return {
      name: "fs_list",
      path: (listMatch[1] || ".").trim(),
      directReply: true
    };
  }

  const lines = message.split(/\r?\n/);
  const header = /^\/write\s+(.+)$/i.exec(lines[0]?.trim() || "");
  if (header) {
    return {
      name: "fs_write",
      path: header[1].trim(),
      content: lines.slice(1).join("\n"),
      directReply: true
    };
  }

  const naturalWrite = parseNaturalWriteDirective(trimmed);
  if (naturalWrite) {
    return {
      name: "fs_write_from_intent",
      path: naturalWrite.path,
      instruction: naturalWrite.instruction,
      directReply: true
    };
  }

  return undefined;
}

function parseNaturalWriteDirective(message: string): { path: string; instruction: string } | undefined {
  if (message.startsWith("/")) {
    return undefined;
  }

  const patterns = [
    /\b(?:create|crete|make|write|save)\b[\s\S]{0,120}?\b(?:file|script|code)\b[\s\S]{0,80}?\b(?:called|caled|named|as)\s+[`'"]?([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9_+-]+)[`'"]?/i,
    /\b(?:create|crete|make|write|save)\s+[`'"]?([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9_+-]+)[`'"]?/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (!match) {
      continue;
    }

    const filePath = match[1]?.trim();
    if (!filePath) {
      continue;
    }

    return {
      path: filePath.replace(/\\/g, "/"),
      instruction: message
    };
  }

  return undefined;
}

function normalizeHistory(history: ChatTurn[], maxHistory: number): ChatTurn[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  const safeTurns = history
    .map((turn) => ({
      role: turn.role,
      content: typeof turn.content === "string" ? turn.content : ""
    }))
    .filter((turn) => turn.content.trim().length > 0)
    .filter((turn) => turn.role === "assistant" || turn.role === "user" || turn.role === "system");

  return safeTurns.slice(-maxHistory);
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireString(value: string | undefined, name: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return normalized;
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[context clipped]`;
}

function languageHintFromPath(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".py":
      return "python";
    case ".ts":
      return "typescript";
    case ".js":
      return "javascript";
    case ".json":
      return "json";
    case ".md":
      return "markdown";
    default:
      return undefined;
  }
}

function normalizeGeneratedFileContent(raw: string, filePath: string): string {
  const stripped = stripMarkdownFence(raw).trim();
  if (stripped.length > 0) {
    return stripped.endsWith("\n") ? stripped : `${stripped}\n`;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".py") {
    return "print(\"hi\")\n";
  }

  return "";
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  const fence = /^```(?:[^\n`]*)\n([\s\S]*?)\n?```$/;
  const match = fence.exec(trimmed);
  return match ? match[1] : trimmed;
}

