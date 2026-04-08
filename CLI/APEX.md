# APEX.md

This file provides guidance to APEX Code (APEX.ai/code) when working with code in this repository.

## Commands

### Build
```bash
bun run ./scripts/build.ts          # production build
bun run ./scripts/build.ts --dev     # development build
bun run ./scripts/build.ts --dev --feature-set=dev-full   # fully‑featured dev build
```
The binary is emitted to `./dist/cli` (or `./cli` after packaging). It can be executed directly, or the `APEX` command can be used once the binary is on `PATH`.

### Run
```bash
bun run ./src/entrypoints/cli.tsx   # runs the CLI in dev mode (hot code reload)
./dist/cli                         # run the compiled binary
APEX <args>                         # once the CLI binary is on the system PATH
```

### Test
The repository includes a minimal Python test suite that exercises the bundled `src.app.main`. To run all tests:

```bash
pytest
```
To run a single test file:

```bash
pytest tests/test_app.py
```
No JavaScript/TypeScript tests are currently included.

### Lint
Linting is performed with ESLint (and Prettier). To run lint:

```bash
npm exec eslint .
# or, if using the bundled exec:
bun exec eslint .
```
If the repository lacks an ESLint configuration, you can skip linting or add a basic config.

## High‑Level Architecture
| Layer | Responsibility | Key Files |
|------|----------------|-----------|
| **CLI Entrypoint** | Command line parsing & dispatch | `src/entrypoints/cli.tsx` |
| **Feature Modules** | Individual slash commands (/diagram, /frontend‑design, etc.) and workers | `src/cli/*.ts` |
| **Core Services** | Auth, config, messaging, analytics, and shell tool bridges | `src/utils/*`, `src/services/*` |
| **Terminal UI** | Ink‑based components (`LogoV2`, `Clawd`, etc.) | `src/components/*` |
| **Engine SDK** | Anthropic, Bedrock, Vertex SDK wrappers | `src/sdk/*` |
| **State & Caching** | Session storage, recent activity, subscription data | `src/utils/sessionStorage.ts`, `src/utils/*` |
| **Build** | Bun‑based build pipeline | `scripts/build.ts` |
| **Entrypoint rendering** | Compile‑time constants (`MACRO.*`) for version, billing, and session display | `src/utils/logoV2Utils.ts` |

The CLI uses a feature‑flag system (`feature('SOME_FLAG')`) via Bun’s bundle plugin; experimental features are gated accordingly. The build script injects compile‑time constants that control the badge and branding shown in the terminal header. 

> **Note:** The repository is a mixed‑language project: the core CLI is written in TypeScript (together with a bundled Python `src.app.main` that is exercised by tests). Most development occurs in the `src/*` tree.

## Common Tasks for Contributors
1. **Install dependencies**: `bun install` 
2. **Run in dev mode**: `bun run ./src/entrypoints/cli.tsx` 
3. **Build for release**: `bun run ./scripts/build.ts` 
4. **Run tests**: `pytest` 
5. **Lint**: `npm exec eslint .` (or `bun exec eslint .`) 
6. **Check formatting**: `npm exec prettier --check .` (or `bun exec prettier --check .`) 

> If you are working on an experimental feature, prefix your command with the relevant flag, e.g. `bun run ./scripts/build.ts --feature=NEW_COMMAND`.
