# APEX Core RAM

Core RAM is the Next.js dashboard + knowledge-base layer used by APEX for realtime UX and structured context.

## Navigation

- Root: [`../../README.md`](../../README.md)
- Core hub: [`../README.md`](../README.md)
- CLI module: [`../CLI/README.md`](../CLI/README.md)
- Active implementation tracks: [`../../conductor/tracks.md`](../../conductor/tracks.md)

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- ElevenLabs React SDK integration

## Structure

```text
Core/RAM/
├── src/app/             # App router pages and server actions
├── src/api/             # Ingestion and streaming pipeline modules
├── src/components/      # UI components
├── src/knowledge-base/  # Knowledge-base data and loaders
└── src/lib/             # Shared logic and tests
```

## Setup

```powershell
cd .\Core\RAM
npm install
```

## Commands

```powershell
cd .\Core\RAM

npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:coverage
```

## Related Docs

- Architecture overview: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Conductor workflow: [`../../conductor/workflow.md`](../../conductor/workflow.md)

