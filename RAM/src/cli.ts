import "dotenv/config";

import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

import { createApexRuntime } from "./apex/runtime.js";
import type { AgentMode, ChatTurn, ProviderMode } from "./apex/types.js";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(sourceDir, "..");

const apex = createApexRuntime({
  projectRoot,
  maxHistory: 12,
  defaultSystem: process.env.SYSTEM_PROMPT
});

async function main() {
  const rl = readline.createInterface({ input, output });

  let provider: ProviderMode = "auto";
  let agent: AgentMode = "auto";
  let threadId = `cli-${Date.now()}`;
  const history: ChatTurn[] = [];

  printBanner();

  while (true) {
    const line = (await rl.question(`\n[${agent}/${provider}]> `)).trim();
    if (!line) {
      continue;
    }

    if (line === "/exit" || line === "/quit") {
      break;
    }

    if (line === "/help") {
      printHelp();
      continue;
    }

    if (line.startsWith("/provider ")) {
      const next = line.slice("/provider ".length).trim().toLowerCase();
      if (!isProviderMode(next)) {
        console.log("Provider must be auto, ollama, openai, or anthropic.");
        continue;
      }
      provider = next;
      console.log(`provider => ${provider}`);
      continue;
    }

    if (line.startsWith("/agent ")) {
      const next = line.slice("/agent ".length).trim().toLowerCase();
      if (!isAgentMode(next)) {
        console.log("Agent must be auto, general, researcher, coder, or system.");
        continue;
      }
      agent = next;
      console.log(`agent => ${agent}`);
      continue;
    }

    if (line.startsWith("/thread ")) {
      const next = line.slice("/thread ".length).trim();
      if (!next) {
        console.log("thread id cannot be empty.");
        continue;
      }
      threadId = next;
      console.log(`thread => ${threadId}`);
      continue;
    }

    if (line.startsWith("/memory ")) {
      const query = line.slice("/memory ".length).trim();
      const hits = apex.searchMemory(query, 5);
      if (hits.length === 0) {
        console.log("No memory hits.");
      } else {
        for (const hit of hits) {
          console.log(`- (${hit.score.toFixed(2)}) [${hit.threadId}] ${hit.text.slice(0, 180)}`);
        }
      }
      continue;
    }

    if (line.startsWith("/route ")) {
      const prompt = line.slice("/route ".length).trim();
      const route = apex.inspectRoute({ prompt, provider, agent });
      console.log(JSON.stringify(route, null, 2));
      continue;
    }

    try {
      const response = await apex.chat({
        message: line,
        history,
        provider,
        agent,
        threadId,
        includeMemory: true
      });

      threadId = response.threadId;
      history.push({ role: "user", content: line });
      history.push({ role: "assistant", content: response.reply });
      if (history.length > 12) {
        history.splice(0, history.length - 12);
      }

      console.log(`\n${response.reply}`);
      console.log(`\n[route] ${response.route.agent} on ${response.provider} (${response.model})`);
      if (response.usedTools.length > 0) {
        console.log(`[tools] ${response.usedTools.map((tool) => tool.name).join(", ")}`);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  rl.close();
}

function printBanner() {
  const health = apex.health();
  console.log("Apex CLI");
  console.log(`Providers: ${health.providers.join(", ")}`);
  console.log(`Default: ${health.defaultProvider}/${health.defaultModel}`);
  printHelp();
}

function printHelp() {
  console.log("Commands:");
  console.log("  /help");
  console.log("  /provider auto|ollama|openai|anthropic");
  console.log("  /agent auto|general|researcher|coder|system");
  console.log("  /thread <id>");
  console.log("  /memory <query>");
  console.log("  /route <prompt>");
  console.log("  /exit");
  console.log("Tool shortcuts in chat:");
  console.log("  /search <query>");
  console.log("  /list [path]");
  console.log("  /read <path>");
  console.log("  /write <path> then new lines for file content");
}

function isProviderMode(value: string): value is ProviderMode {
  return value === "auto" || value === "ollama" || value === "openai" || value === "anthropic";
}

function isAgentMode(value: string): value is AgentMode {
  return value === "auto" || value === "general" || value === "researcher" || value === "coder" || value === "system";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

