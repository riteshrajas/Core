# APEX Core CLI

APEX Core CLI is the terminal AI runtime/orchestration layer. It provides the command entrypoints, tool execution paths, and interactive terminal UX.

## Navigation

- Root: [`../../README.md`](../../README.md)
- Core hub: [`../README.md`](../README.md)
- RAM module: [`../RAM/README.md`](../RAM/README.md)

## Key Directories

```text
Core/CLI/
├── src/        # Entry points, commands, tools, bridge, UI components
├── scripts/    # Build pipeline scripts
├── tests/      # Python-side tests and diagnostics
└── web/        # Web assets used by the runtime
```

## Requirements

- Bun `>= 1.3.11`
- Node.js (for ecosystem tooling where needed)
- Python 3.10+ (for Python-based tests/utilities in this module)

## Commands

```powershell
cd .\Core\CLI

# Run locally
bun run dev

# Build
bun run build
bun run build:dev
bun run build:dev:full

# Compile binary
bun run compile
```

## APEX Infrastructure

APEX routes model calls through local APEX Infrastructure, powered by 9Router. Startup checks `http://127.0.0.1:20128`, starts 9Router when it is installed but not running, and prompts before continuing when it needs installation or provider/model configuration.

```powershell
# In another terminal
npm install -g 9router
9router

# In the APEX CLI terminal
$env:APEX_CODE_USE_APEX_INFRASTRUCTURE = "1"
$env:APEX_CODE_9ROUTER_BASE_URL = "http://127.0.0.1:20128/v1"
$env:APEX_CODE_9ROUTER_MODEL = "kr/claude-sonnet-4.5"
bun run dev
```

`/model` shows models returned by 9Router's `/v1/models` endpoint plus local Ollama models found on the machine. First-run onboarding asks for separate general/plan, coding, and backup models from that APEX Infrastructure list. `APEX_CODE_9ROUTER_BASE_URL` also accepts `http://127.0.0.1:20128`; the CLI normalizes either form for the Anthropic SDK. If 9Router has `REQUIRE_API_KEY=true`, set `APEX_CODE_9ROUTER_API_KEY` to a generated 9Router key.

## Testing

```powershell
cd .\Core\CLI
pytest .\tests
```

## Related Docs

- Root architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Agent capability notes: [`../../AGENT.md`](../../AGENT.md)
- Planning/workflow docs: [`../../conductor/README.md`](../../conductor/README.md)

