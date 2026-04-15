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

## Testing

```powershell
cd .\Core\CLI
pytest .\tests
```

## Related Docs

- Root architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Agent capability notes: [`../../AGENT.md`](../../AGENT.md)
- Planning/workflow docs: [`../../conductor/README.md`](../../conductor/README.md)

