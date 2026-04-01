# Apex Core Multi-Agent Architecture Plan

## 1. System Architecture Overview (The AI Brain)

Apex Core is a multi-agent orchestration system where a central supervisor routes each request to the best agent and model for the job.

### Pillar 1: Supervisor Agent (Router)

Function:
- Entry point for all user requests
- Performs intent classification
- Selects agent and model provider

Current implementation in this repo:
- Supervisor runtime in `src/apex/runtime.ts`
- Route policy in `src/apex/router.ts`
- API and MCP gateway in `src/index.ts`

Future extension:
- Optional Python orchestration service (LangGraph, AutoGen, or CrewAI) behind MCP or HTTP

### Pillar 2: Multi-Model Swarm (Specialists)

Function:
- Specialized agents with provider-aware model selection

Current agents:
- `general`
- `researcher`
- `coder`
- `system`

Current provider set:
- Ollama (local)
- OpenAI
- Anthropic

Routing behavior:
- Auto mode picks the best available provider for the selected agent
- Manual override supports `provider` and `agent` forcing

### Pillar 3: Tool Ecosystem (The Hands)

Function:
- Gives agents executable capabilities beyond text generation

Current tools:
- `web_search`
- `fs_read`
- `fs_write`
- `fs_list`
- MCP queue tools (`core_dispatch`, `core_status`, `core_pause`, `core_patch`, `core_resume`)

Future tools:
- Shell command execution with strict allowlists
- Web scraping + structured extraction pipeline
- Python script execution sandbox

### Pillar 4: Memory & State (The Hippocampus)

Function:
- Thread continuity + long-term recall

Current implementation:
- Thread state and turn history
- Lightweight semantic recall from persisted memory file

Current storage:
- `.apex-memory.json`
- Configurable via `APEX_MEMORY_FILE`

Planned upgrades:
- SQLite for thread/session state
- ChromaDB or FAISS for vector retrieval
- Memory compaction and retention policies

## 2. Agile Sprint Roadmap

### Sprint 1: Framework Foundation & Supervisor

Goal:
- Establish routing logic and core chat path

Tasks:
1. Select orchestration approach
- Primary path: keep TypeScript runtime as production supervisor
- Optional path: add Python orchestration bridge (LangGraph/AutoGen/CrewAI)
2. Initialize high-capability supervisor
- Use provider auto-routing with explicit fallback order
3. Build CLI
- `npm run cli` supports provider, agent, thread, memory, and route inspection

Acceptance:
- User can chat through supervisor
- Routing decision is inspectable

### Sprint 2: Give Apex "Hands" (Tool Execution)

Goal:
- Execute actions, not only generate text

Tasks:
1. Web Search Tool
- Baseline complete with `web_search`
- Upgrade to Tavily/Google API adapter with source ranking
2. File System Tooling
- Baseline complete with `fs_read`, `fs_write`, `fs_list`
- Add path policy profiles and write approval hooks
3. Executor Agent Binding
- Keep `system` and `researcher` tool-aware
- Add structured tool-call traces in API response

Acceptance:
- Tool calls are visible and deterministic
- File operations remain workspace-scoped and safe

### Sprint 3: Multi-Model Orchestration

Goal:
- Optimize cost, latency, and quality by task type

Tasks:
1. Anthropic for coding
- Ensure `coder` default preference prioritizes Anthropic when configured
2. Local Ollama for low-cost parsing
- Keep local model for lightweight tasks and fallback
3. Supervisor Routing Rules
- Maintain rule-based route selection
- Add optional confidence scoring and telemetry

Acceptance:
- Prompts route consistently by task intent
- Provider fallback is reliable when a key/model is unavailable

### Sprint 4: Memory Integration

Goal:
- Enable durable context over time

Tasks:
1. State Graph
- Track conversation stages and transitions per thread
2. Vector Memory
- Move semantic recall from JSON-only token matching to vector DB retrieval
- Add recency + relevance ranking

Acceptance:
- Assistant recalls relevant historical context across sessions
- Memory quality remains high under long-running usage

## 3. Immediate Implementation Backlog (Next 5 Tasks)

1. Add SQLite state store and migration script
2. Add ChromaDB/FAISS adapter behind a memory interface
3. Add Tavily provider for `web_search` with source URLs and confidence
4. Add route telemetry endpoint (`/api/route-stats`)
5. Add integration tests for provider fallback and memory recall
