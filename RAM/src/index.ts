import "dotenv/config";

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createApexRuntime } from "./apex/runtime.js";
import { PipecatManager, type PipecatTarget } from "./apex/pipecatManager.js";
import type { AgentMode, ProviderMode } from "./apex/types.js";


type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

type ChatHistoryItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

type SubagentStatus = "queued" | "running" | "paused" | "completed" | "failed";

type SubagentJob = {
  id: string;
  prompt: string;
  patches: string[];
  model?: string;
  temperature?: number;
  status: SubagentStatus;
  createdAt: string;
  updatedAt: string;
  stepsCompleted: number;
  maxSteps: number;
  pauseRequested: boolean;
  log: string[];
  result?: string;
  error?: string;
};

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen3:4b";
const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_TEMPERATURE = process.env.OLLAMA_TEMPERATURE
  ? Number(process.env.OLLAMA_TEMPERATURE)
  : undefined;
const DEFAULT_SYSTEM = process.env.SYSTEM_PROMPT;
const MAX_CHAT_HISTORY = 12;

const DEFAULT_SUBAGENT_SYSTEM =
  process.env.SUBAGENT_SYSTEM ||
  "You are a focused subagent. Provide concise progress notes and the best possible answer.";
const DEFAULT_SUBAGENT_STEPS = parsePositiveInteger(process.env.SUBAGENT_MAX_STEPS, 3);

const MCP_HOST = process.env.MCP_HOST || "127.0.0.1";
const MCP_PORT = parsePositiveInteger(process.env.MCP_PORT, 3000);
const MCP_ALLOWED_HOSTS = parseCsvList(process.env.MCP_ALLOWED_HOSTS);
const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(SOURCE_DIR, "..");

const apex = createApexRuntime({
  projectRoot: PROJECT_ROOT,
  maxHistory: MAX_CHAT_HISTORY,
  defaultSystem: DEFAULT_SYSTEM
});
const pipecat = new PipecatManager(PROJECT_ROOT);

const jobStore = new Map<string, SubagentJob>();
const jobQueue: string[] = [];
let workerActive = false;
let activeJobId: string | null = null;

const tools = [
  {
    name: "core_dispatch",
    description: "Spawn a subagent job that works through a prompt in multiple steps.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Subagent task prompt" },
        maxSteps: { type: "integer", minimum: 1, description: "Max steps to run" },
        model: { type: "string", description: "Override model name" },
        temperature: { type: "number", description: "Sampling temperature" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "core_status",
    description: "Check subagent job status. Omit jobId to list active jobs.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job id" }
      }
    }
  },
  {
    name: "core_pause",
    description: "Pause a running or queued subagent job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  },
  {
    name: "core_patch",
    description: "Attach an instruction patch to a subagent job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        patch: { type: "string" }
      },
      required: ["jobId", "patch"]
    }
  },
  {
    name: "core_resume",
    description: "Resume a paused subagent job.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  },
  {
    name: "apex_chat",
    description: "Route a prompt through Apex supervisor and auto-select the best agent/model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "User prompt" },
        provider: { type: "string", description: "auto | ollama | openai | anthropic" },
        agent: { type: "string", description: "auto | general | researcher | coder | system" },
        system: { type: "string", description: "Optional system prompt" },
        model: { type: "string", description: "Optional model override" },
        temperature: { type: "number", description: "Optional temperature" },
        threadId: { type: "string", description: "Optional memory thread id" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "apex_route",
    description: "Preview supervisor routing for a prompt without executing the model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "User prompt" },
        provider: { type: "string", description: "auto | ollama | openai | anthropic" },
        agent: { type: "string", description: "auto | general | researcher | coder | system" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "apex_memory_search",
    description: "Search Apex semantic memory for related prior context.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "integer", minimum: 1, description: "Max results" }
      },
      required: ["query"]
    }
  },
  {
    name: "apex_memory_thread",
    description: "Read recent turns for a memory thread id.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: { type: "string", description: "Thread id" },
        limit: { type: "integer", minimum: 1, description: "Max turns" }
      },
      required: ["threadId"]
    }
  },
  {
    name: "apex_pipecat_status",
    description: "Get live Pipecat integration status (server/client readiness and process state).",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "apex_pipecat_start",
    description: "Start Pipecat server/client processes from Apex Core.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "server | client | all" }
      }
    }
  },
  {
    name: "apex_pipecat_stop",
    description: "Stop Pipecat server/client processes managed by Apex Core.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "server | client | all" }
      }
    }
  },
  {
    name: "apex_pipecat_logs",
    description: "Read recent Pipecat logs captured by Apex Core.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "server | client" },
        lines: { type: "integer", minimum: 1, description: "Number of lines to return" }
      },
      required: ["target"]
    }
  },
  {
    name: "web_search",
    description: "Search the web using the built-in researcher tool.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "fs_read",
    description: "Read a text file under the workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace relative path" }
      },
      required: ["path"]
    }
  },
  {
    name: "fs_write",
    description: "Write a text file under the workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace relative path" },
        content: { type: "string", description: "Text to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "fs_list",
    description: "List files under the workspace root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace relative path (optional)" }
      }
    }
  },
  {
    name: "ollama_chat",
    description: "Send a prompt to the local Ollama model via LangChain.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "User prompt" },
        system: { type: "string", description: "Optional system instruction" },
        model: { type: "string", description: "Override model name" },
        temperature: { type: "number", description: "Sampling temperature" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "math_add",
    description: "Add two numbers.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["a", "b"]
    }
  },
  {
    name: "math_subtract",
    description: "Subtract b from a.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["a", "b"]
    }
  },
  {
    name: "math_multiply",
    description: "Multiply two numbers.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["a", "b"]
    }
  },
  {
    name: "math_divide",
    description: "Divide a by b.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["a", "b"]
    }
  },
  {
    name: "math_mean",
    description: "Compute the mean of a list of numbers.",
    inputSchema: {
      type: "object",
      properties: {
        numbers: { type: "array", items: { type: "number" }, minItems: 1 }
      },
      required: ["numbers"]
    }
  },
  {
    name: "math_median",
    description: "Compute the median of a list of numbers.",
    inputSchema: {
      type: "object",
      properties: {
        numbers: { type: "array", items: { type: "number" }, minItems: 1 }
      },
      required: ["numbers"]
    }
  }
];

function createServer() {
  const server = new Server(
    {
      name: "apex-core",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "core_dispatch": {
          const prompt = getString(args.prompt, "prompt");
          const maxSteps = getOptionalInteger(args.maxSteps, "maxSteps");
          const modelOverride = getOptionalString(args.model, "model");
          const temperature = getOptionalNumber(args.temperature, "temperature");

          const job = createJob({
            prompt,
            maxSteps: maxSteps ?? DEFAULT_SUBAGENT_STEPS,
            model: modelOverride ?? undefined,
            temperature: temperature ?? undefined
          });
          enqueueJob(job.id);

          return ok(JSON.stringify({ jobId: job.id, status: job.status }, null, 2));
        }
        case "core_status": {
          const jobId = getOptionalString(args.jobId, "jobId");
          if (jobId) {
            const job = requireJob(jobId);
            return ok(JSON.stringify(formatJob(job), null, 2));
          }
          const jobs = Array.from(jobStore.values()).map(formatJobSummary);
          return ok(JSON.stringify({ activeJobId, queued: jobQueue, jobs }, null, 2));
        }
        case "core_pause": {
          const jobId = getString(args.jobId, "jobId");
          const job = requireJob(jobId);
          if (job.status === "completed" || job.status === "failed") {
            return err(`Job ${jobId} is already ${job.status}.`);
          }
          if (job.status === "queued") {
            job.status = "paused";
            job.updatedAt = nowIso();
            removeFromQueue(jobId);
            return ok(`Job ${jobId} paused.`);
          }
          job.pauseRequested = true;
          job.updatedAt = nowIso();
          return ok(`Pause requested for job ${jobId}.`);
        }
        case "core_patch": {
          const jobId = getString(args.jobId, "jobId");
          const patch = getString(args.patch, "patch");
          const job = requireJob(jobId);
          job.patches.push(patch);
          job.updatedAt = nowIso();
          return ok(`Patch added to job ${jobId}.`);
        }
        case "core_resume": {
          const jobId = getString(args.jobId, "jobId");
          const job = requireJob(jobId);
          if (job.status !== "paused") {
            return err(`Job ${jobId} is not paused.`);
          }
          job.status = "queued";
          job.pauseRequested = false;
          job.updatedAt = nowIso();
          enqueueJob(jobId);
          return ok(`Job ${jobId} resumed.`);
        }
        case "apex_chat": {
          const prompt = getString(args.prompt, "prompt");
          const provider = getOptionalProviderMode(args.provider);
          const agent = getOptionalAgentMode(args.agent);
          const system = getOptionalString(args.system, "system");
          const model = getOptionalString(args.model, "model");
          const temperature = getOptionalNumber(args.temperature, "temperature");
          const threadId = getOptionalString(args.threadId, "threadId");

          const result = await apex.chat({
            message: prompt,
            history: [],
            provider,
            agent,
            system,
            model,
            temperature,
            threadId
          });

          return ok(JSON.stringify(result, null, 2));
        }
        case "apex_route": {
          const prompt = getString(args.prompt, "prompt");
          const provider = getOptionalProviderMode(args.provider);
          const agent = getOptionalAgentMode(args.agent);
          const route = apex.inspectRoute({ prompt, provider, agent });
          return ok(JSON.stringify(route, null, 2));
        }
        case "apex_memory_search": {
          const query = getString(args.query, "query");
          const limit = getOptionalInteger(args.limit, "limit") ?? 5;
          const hits = apex.searchMemory(query, limit);
          return ok(JSON.stringify(hits, null, 2));
        }
        case "apex_memory_thread": {
          const threadId = getString(args.threadId, "threadId");
          const limit = getOptionalInteger(args.limit, "limit") ?? 20;
          const turns = apex.getThread(threadId, limit);
          return ok(JSON.stringify(turns, null, 2));
        }
        case "apex_pipecat_status": {
          return ok(JSON.stringify(pipecat.getStatus(), null, 2));
        }
        case "apex_pipecat_start": {
          const target = getOptionalPipecatTarget(args.target) ?? "all";
          const status = await pipecat.start(target);
          return ok(JSON.stringify(status, null, 2));
        }
        case "apex_pipecat_stop": {
          const target = getOptionalPipecatTarget(args.target) ?? "all";
          const status = await pipecat.stop(target);
          return ok(JSON.stringify(status, null, 2));
        }
        case "apex_pipecat_logs": {
          const target = getRequiredPipecatLogTarget(args.target);
          const lines = getOptionalInteger(args.lines, "lines") ?? 80;
          const logs = pipecat.getLogs(target, lines);
          return ok(JSON.stringify({ target, lines: logs.length, logs }, null, 2));
        }
        case "web_search": {
          const query = getString(args.query, "query");
          const output = await apex.runTool({ name: "web_search", query });
          return ok(output);
        }
        case "fs_read": {
          const filePath = getString(args.path, "path");
          const output = await apex.runTool({ name: "fs_read", path: filePath });
          return ok(output);
        }
        case "fs_write": {
          const filePath = getString(args.path, "path");
          const content = getString(args.content, "content");
          const output = await apex.runTool({ name: "fs_write", path: filePath, content });
          return ok(output);
        }
        case "fs_list": {
          const filePath = getOptionalString(args.path, "path") ?? ".";
          const output = await apex.runTool({ name: "fs_list", path: filePath });
          return ok(output);
        }
        case "ollama_chat": {
          const prompt = getString(args.prompt, "prompt");
          const system = getOptionalString(args.system, "system");
          const modelOverride = getOptionalString(args.model, "model");
          const temperature = getOptionalNumber(args.temperature, "temperature");

          const resolvedSystem = system ?? DEFAULT_SYSTEM;
          const chat = buildModel(modelOverride ?? undefined, temperature ?? undefined);
          const messages = resolvedSystem
            ? [new SystemMessage(resolvedSystem), new HumanMessage(prompt)]
            : [new HumanMessage(prompt)];

          const response = await chat.invoke(messages);
          const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

          return ok(text);
        }
        case "math_add": {
          const a = getNumber(args.a, "a");
          const b = getNumber(args.b, "b");
          return ok(String(a + b));
        }
        case "math_subtract": {
          const a = getNumber(args.a, "a");
          const b = getNumber(args.b, "b");
          return ok(String(a - b));
        }
        case "math_multiply": {
          const a = getNumber(args.a, "a");
          const b = getNumber(args.b, "b");
          return ok(String(a * b));
        }
        case "math_divide": {
          const a = getNumber(args.a, "a");
          const b = getNumber(args.b, "b");
          if (b === 0) {
            return err("Division by zero is not allowed.");
          }
          return ok(String(a / b));
        }
        case "math_mean": {
          const numbers = getNumberArray(args.numbers, "numbers");
          const total = numbers.reduce((sum, value) => sum + value, 0);
          return ok(String(total / numbers.length));
        }
        case "math_median": {
          const numbers = getNumberArray(args.numbers, "numbers");
          const sorted = [...numbers].sort((left, right) => left - right);
          const mid = Math.floor(sorted.length / 2);
          const median =
            sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          return ok(String(median));
        }
        default:
          return err(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown error");
    }
  });

  return server;
}

async function main() {
  const app = createMcpExpressApp({ host: MCP_HOST, allowedHosts: MCP_ALLOWED_HOSTS });
  const publicDir = path.join(SOURCE_DIR, "..", "public");
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const servers = new Map<string, Server>();

  app.use("/", express.static(publicDir, { index: "index.html" }));

  app.get("/api/health", (req, res) => {
    const health = apex.health();
    res.json({
      status: "ok",
      defaultModel: health.defaultModel,
      defaultProvider: health.defaultProvider,
      defaultTemperature: health.defaultTemperature,
      providers: health.providers,
      agents: health.agents,
      maxHistory: health.maxHistory,
      recentThreads: health.recentThreads,
      pipecat: pipecat.getStatus()
    });
  });

  app.get("/api/pipecat/status", (req, res) => {
    res.json(pipecat.getStatus());
  });

  app.get("/api/pipecat/logs", (req, res) => {
    try {
      const target = getRequiredPipecatLogTarget(req.query.target);
      const lines = parseNumberFromQuery(req.query.lines, 80);
      const logs = pipecat.getLogs(target, lines);
      res.json({
        target,
        lines: logs.length,
        logs
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  });

  app.post("/api/pipecat/start", async (req, res) => {
    try {
      const payload = toRecord(req.body);
      const target = getOptionalPipecatTarget(payload.target) ?? "all";
      const status = await pipecat.start(target);
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/pipecat/stop", async (req, res) => {
    try {
      const payload = toRecord(req.body);
      const target = getOptionalPipecatTarget(payload.target) ?? "all";
      const status = await pipecat.stop(target);
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    let payload: {
      message: string;
      system?: string;
      model?: string;
      temperature?: number;
      provider?: ProviderMode;
      agent?: AgentMode;
      threadId?: string;
      history: ChatHistoryItem[];
    };

    try {
      payload = parseChatRequest(req.body);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request"
      });
      return;
    }

    try {
      const result = await apex.chat({
        message: payload.message,
        system: payload.system,
        model: payload.model,
        temperature: payload.temperature,
        provider: payload.provider,
        agent: payload.agent,
        threadId: payload.threadId,
        history: payload.history
      });

      res.json({
        reply: result.reply,
        model: result.model,
        provider: result.provider,
        agent: result.route.agent,
        routeReason: result.route.reason,
        threadId: result.threadId,
        tools: result.usedTools
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.all("/mcp", async (req, res) => {
    try {
      const sessionIdHeader = req.headers["mcp-session-id"];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        if (req.method !== "POST" || !isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided"
            },
            id: null
          });
          return;
        }

        const server = createServer();
        const eventStore = new InMemoryEventStore();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport as StreamableHTTPServerTransport);
            servers.set(newSessionId, server);
          }
        });

        transport.onclose = () => {
          const id = transport?.sessionId;
          if (!id) {
            return;
          }
          transports.delete(id);
          const serverInstance = servers.get(id);
          if (serverInstance) {
            serverInstance.close();
            servers.delete(id);
          }
        };

        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  const httpServer = app.listen(MCP_PORT, MCP_HOST, () => {
    console.log(`Apex Core MCP server listening on http://${MCP_HOST}:${MCP_PORT}/mcp`);
  });

  httpServer.on("error", (error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down server...");
    try {
      await pipecat.stop("all");
    } catch (stopError) {
      console.error("Error stopping Pipecat processes:", stopError);
    }
    for (const [sessionId, transport] of transports.entries()) {
      try {
        await transport.close();
        const serverInstance = servers.get(sessionId);
        if (serverInstance) {
          await serverInstance.close();
        }
      } catch (closeError) {
        console.error(`Error closing session ${sessionId}:`, closeError);
      }
    }
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

function createJob(options: {
  prompt: string;
  maxSteps: number;
  model?: string;
  temperature?: number;
}): SubagentJob {
  const now = nowIso();
  const job: SubagentJob = {
    id: randomUUID(),
    prompt: options.prompt,
    patches: [],
    model: options.model,
    temperature: options.temperature,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    stepsCompleted: 0,
    maxSteps: Math.max(1, Math.floor(options.maxSteps)),
    pauseRequested: false,
    log: []
  };

  jobStore.set(job.id, job);
  return job;
}

function enqueueJob(jobId: string) {
  if (!jobQueue.includes(jobId)) {
    jobQueue.push(jobId);
  }
  void processQueue();
}

function removeFromQueue(jobId: string) {
  const index = jobQueue.indexOf(jobId);
  if (index >= 0) {
    jobQueue.splice(index, 1);
  }
}

async function processQueue() {
  if (workerActive) {
    return;
  }
  workerActive = true;

  try {
    while (jobQueue.length > 0) {
      const jobId = jobQueue.shift();
      if (!jobId) {
        continue;
      }
      const job = jobStore.get(jobId);
      if (!job || job.status !== "queued") {
        continue;
      }

      activeJobId = job.id;
      await runJob(job);
      activeJobId = null;
    }
  } finally {
    workerActive = false;
  }
}

async function runJob(job: SubagentJob) {
  job.status = "running";
  job.updatedAt = nowIso();

  try {
    while (job.stepsCompleted < job.maxSteps) {
      if (job.pauseRequested) {
        job.pauseRequested = false;
        job.status = "paused";
        job.updatedAt = nowIso();
        return;
      }

      const chat = buildModel(job.model, job.temperature);
      const messages = buildSubagentMessages(job);
      const response = await chat.invoke(messages);
      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

      job.log.push(text);
      job.stepsCompleted += 1;
      job.updatedAt = nowIso();

      if (job.pauseRequested) {
        job.pauseRequested = false;
        job.status = "paused";
        job.updatedAt = nowIso();
        return;
      }
    }

    job.status = "completed";
    job.result = job.log.join("\n\n");
    job.updatedAt = nowIso();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.updatedAt = nowIso();
  }
}

function buildSubagentMessages(job: SubagentJob) {
  const patchText = job.patches.length
    ? `Patches:\n${job.patches.map((patch, index) => `${index + 1}. ${patch}`).join("\n")}`
    : "";
  const historyText = job.log.length
    ? `Previous updates:\n${job.log.map((entry, index) => `${index + 1}. ${entry}`).join("\n")}`
    : "";
  const systemLines = [DEFAULT_SUBAGENT_SYSTEM, patchText].filter(Boolean).join("\n\n");
  const userLines = [job.prompt, historyText].filter(Boolean).join("\n\n");

  if (systemLines) {
    return [new SystemMessage(systemLines), new HumanMessage(userLines)];
  }
  return [new HumanMessage(userLines)];
}

function buildChatMessages(options: {
  prompt: string;
  system?: string;
  history: ChatHistoryItem[];
}) {
  const messages = [] as Array<SystemMessage | HumanMessage | AIMessage>;
  if (options.system) {
    messages.push(new SystemMessage(options.system));
  }
  for (const entry of options.history) {
    if (entry.role === "system") {
      messages.push(new SystemMessage(entry.content));
    } else if (entry.role === "assistant") {
      messages.push(new AIMessage(entry.content));
    } else {
      messages.push(new HumanMessage(entry.content));
    }
  }
  messages.push(new HumanMessage(options.prompt));
  return messages;
}

function formatJob(job: SubagentJob) {
  return {
    id: job.id,
    status: job.status,
    prompt: job.prompt,
    patches: job.patches,
    model: job.model ?? DEFAULT_MODEL,
    temperature: job.temperature ?? DEFAULT_TEMPERATURE,
    stepsCompleted: job.stepsCompleted,
    maxSteps: job.maxSteps,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error
  };
}

function formatJobSummary(job: SubagentJob) {
  return {
    id: job.id,
    status: job.status,
    updatedAt: job.updatedAt,
    stepsCompleted: job.stepsCompleted,
    maxSteps: job.maxSteps
  };
}

function requireJob(jobId: string): SubagentJob {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found.`);
  }
  return job;
}

function buildModel(modelOverride?: string, temperatureOverride?: number) {
  const resolvedModel = modelOverride || DEFAULT_MODEL;
  const resolvedTemperature = isFiniteNumber(temperatureOverride)
    ? temperatureOverride
    : isFiniteNumber(DEFAULT_TEMPERATURE)
      ? DEFAULT_TEMPERATURE
      : undefined;

  return new ChatOllama({
    baseUrl: DEFAULT_BASE_URL,
    model: resolvedModel,
    temperature: resolvedTemperature
  });
}

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function getNumber(value: unknown, name: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

function getNumberArray(value: unknown, name: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array of numbers.`);
  }
  return value.map((item, index) => getNumber(item, `${name}[${index}]`));
}

function getString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
}

function getOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }
  return value;
}

function getOptionalNumber(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isFiniteNumber(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

function getOptionalInteger(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function getOptionalProviderMode(value: unknown): ProviderMode | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("provider must be a string.");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "ollama" || normalized === "openai" || normalized === "anthropic") {
    return normalized;
  }
  throw new Error("provider must be one of: auto, ollama, openai, anthropic.");
}

function getOptionalAgentMode(value: unknown): AgentMode | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("agent must be a string.");
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "general" ||
    normalized === "researcher" ||
    normalized === "coder" ||
    normalized === "system"
  ) {
    return normalized;
  }
  throw new Error("agent must be one of: auto, general, researcher, coder, system.");
}

function getOptionalPipecatTarget(value: unknown): PipecatTarget | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("target must be a string.");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "server" || normalized === "client" || normalized === "all") {
    return normalized;
  }
  throw new Error("target must be one of: server, client, all.");
}

function getRequiredPipecatLogTarget(value: unknown): "server" | "client" {
  if (typeof value !== "string") {
    throw new Error("target must be server or client.");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "server" || normalized === "client") {
    return normalized;
  }
  throw new Error("target must be server or client.");
}

function getOptionalChatHistory(value: unknown, name: string): ChatHistoryItem[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  const items = value.map((item, index) => parseHistoryItem(item, `${name}[${index}]`));
  if (items.length <= MAX_CHAT_HISTORY) {
    return items;
  }
  return items.slice(-MAX_CHAT_HISTORY);
}

function parseHistoryItem(value: unknown, name: string): ChatHistoryItem {
  if (!value || typeof value !== "object") {
    throw new Error(`${name} must be an object.`);
  }
  const entry = value as Record<string, unknown>;
  const role = getString(entry.role, `${name}.role`);
  const content = getString(entry.content, `${name}.content`);
  if (role !== "user" && role !== "assistant" && role !== "system") {
    throw new Error(`${name}.role must be user, assistant, or system.`);
  }
  return { role, content };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseCsvList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
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

function parseChatRequest(body: unknown): {
  message: string;
  system?: string;
  model?: string;
  temperature?: number;
  provider?: ProviderMode;
  agent?: AgentMode;
  threadId?: string;
  history: ChatHistoryItem[];
} {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be an object.");
  }
  const payload = body as Record<string, unknown>;
  const message = getString(payload.message, "message");
  const system = normalizeOptionalString(getOptionalString(payload.system, "system"));
  const model = normalizeOptionalString(getOptionalString(payload.model, "model"));
  const temperature = getOptionalNumber(payload.temperature, "temperature");
  const provider = getOptionalProviderMode(payload.provider);
  const agent = getOptionalAgentMode(payload.agent);
  const threadId = normalizeOptionalString(getOptionalString(payload.threadId, "threadId"));
  const history = getOptionalChatHistory(payload.history, "history");

  return {
    message,
    system,
    model,
    temperature,
    provider,
    agent,
    threadId,
    history
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseNumberFromQuery(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nowIso() {
  return new Date().toISOString();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

