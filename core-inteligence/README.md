# Apex Core

Apex is now a switchable multi-agent orchestration core.

It keeps the original MCP subagent queue and adds a supervisor runtime that can route prompts across multiple providers and specialized agents.

Detailed architecture and sprint roadmap: see [docs/apex-multi-agent-architecture-plan.md](docs/apex-multi-agent-architecture-plan.md).

## What You Get

- Supervisor router: auto-selects agent and provider by prompt intent
- Multi-provider model layer: Ollama, OpenAI, Anthropic (with fallback)
- Specialized agents:
  - general
  - researcher
  - coder
  - system
- Tool layer:
  - web search
  - file read/write/list (workspace-scoped)
- Persistent memory:
  - thread state + turns
  - semantic recall via lightweight vector-like scoring
- Interfaces:
  - MCP server
  - Web chat console
  - Local CLI

## Quick Start

1. Install dependencies

   npm install

2. Copy and edit env file

   copy .env.example .env

3. Run server

   npm run dev

4. Optional CLI

   npm run cli

Server URLs by default:

- MCP: http://127.0.0.1:3000/mcp
- Web UI: http://127.0.0.1:3000/

## Provider Switching

Configure one or more providers in .env:

- Ollama: OLLAMA_BASE_URL, OLLAMA_MODEL
- OpenAI: OPENAI_API_KEY, OPENAI_MODEL
- Anthropic: ANTHROPIC_API_KEY, ANTHROPIC_MODEL

At runtime you can choose:

- provider: auto, ollama, openai, anthropic
- agent: auto, general, researcher, coder, system

If provider is auto, Apex chooses based on agent preferences and configured keys.

## API

POST /api/chat

Request body:

{
  "message": "your prompt",
  "provider": "auto",
  "agent": "auto",
  "model": "optional-model-name",
  "temperature": 0.2,
  "threadId": "optional-thread-id",
  "system": "optional-system-prompt",
  "history": [{ "role": "user", "content": "..." }]
}

Response:

{
  "reply": "...",
  "model": "...",
  "provider": "...",
  "agent": "...",
  "routeReason": "...",
  "threadId": "...",
  "tools": []
}

GET /api/health returns provider availability, defaults, agents, and recent threads.

## MCP Tools

Core queue tools:

- core_dispatch
- core_status
- core_pause
- core_patch
- core_resume

Apex orchestration tools:

- apex_chat
- apex_route
- apex_memory_search
- apex_memory_thread
- web_search
- fs_read
- fs_write
- fs_list

Legacy tools (still available):

- ollama_chat
- math_add
- math_subtract
- math_multiply
- math_divide
- math_mean
- math_median

## CLI Commands

Inside npm run cli:

- /provider auto|ollama|openai|anthropic
- /agent auto|general|researcher|coder|system
- /thread <id>
- /memory <query>
- /route <prompt>
- /exit

Tool shortcuts in chat:

- /search <query>
- /list [path]
- /read <path>
- /write <path> then content on following lines

Natural-language file creation also works when a filename is explicit, for example:

- create a python file called `index.py` that prints hi 5 times

## Memory

Apex persists memory in .apex-memory.json by default.

- thread timeline for short-term continuity
- semantic entries for retrieval across older sessions

Change location with APEX_MEMORY_FILE in .env.

