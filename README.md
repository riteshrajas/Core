# Core

`Core` contains the software runtime layers of APEX:

- **CLI**: terminal-first AI agent runtime (`Core/CLI`)
- **RAM**: realtime web dashboard + knowledge base (`Core/RAM`)

## Navigation

- Root: [`../README.md`](../README.md)
- CLI module: [`./CLI/README.md`](./CLI/README.md)
- RAM module: [`./RAM/README.md`](./RAM/README.md)
- System architecture: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)

## Structure

```text
Core/
├── CLI/
└── RAM/
```

## Typical Development Flow

```powershell
# Terminal agent runtime
cd .\CLI
bun run dev

# Dashboard
cd ..\RAM
npm install
npm run dev
```

Read each module's local README for module-specific setup and commands.

