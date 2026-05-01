# APEX Todo

> Persistent, colour-coded task management for the APEX CLI ecosystem.

The **APEX Todo** module is a lightweight TypeScript CLI tool built on the Bun runtime. It stores tasks as JSON in `~/.apex/data/todos.json` and exposes a clean typed API that can be consumed by the `VERIFICATION_AGENT` or any other APEX sub-agent that needs task-tracking capabilities.

---

## Features

- Full CRUD — add, list, update, complete, remove tasks
- Priority levels: `low` · `medium` · `high`
- Status lifecycle: `pending` → `in-progress` → `done`
- Optional tags, descriptions, and due dates
- Persistent JSON store (survives process restarts)
- Colour-coded terminal output (ANSI)
- Zero external runtime dependencies — pure Node.js `fs` + Bun

---

## Quick Start

```bash
# From the APEX root
cd Core/todo

# Add a task
bun run src/todo.ts add "Write AAL parser tests" --priority high --tags aal,testing

# List all tasks
bun run src/todo.ts list

# List only pending tasks
bun run src/todo.ts list --status pending

# Mark a task as done (use the id printed when adding)
bun run src/todo.ts done todo_1234_abcde

# Update a task
bun run src/todo.ts update todo_1234_abcde --status in-progress --priority low

# Remove a task
bun run src/todo.ts remove todo_1234_abcde

# Show summary counts
bun run src/todo.ts summary

# Purge all completed tasks
bun run src/todo.ts purge
```

---

## CLI Reference

| Command | Arguments | Options |
|---------|-----------|---------|
| `add` | `<title>` | `--priority`, `--tags`, `--desc`, `--due` |
| `list` | — | `--status`, `--priority`, `--tag` |
| `done` | `<id>` | — |
| `update` | `<id>` | `--title`, `--status`, `--priority`, `--desc`, `--tags`, `--due` |
| `remove` | `<id>` | — |
| `summary` | — | — |
| `purge` | — | — |
| `help` | — | — |

---

## Programmatic API

```typescript
import { TodoManager } from "./src/TodoManager";

const manager = new TodoManager(); // defaults to ~/.apex/data/

const task = manager.add({
  title: "Implement WebSerial flashing",
  priority: "high",
  tags: ["micromax", "os-client"],
  dueDate: "2026-07-01",
});

manager.complete(task.id);
console.log(manager.summary()); // { pending: 0, "in-progress": 0, done: 1 }
```

---

## Running Tests

```bash
cd Core/todo
bun test
```

---

## Data Storage

Tasks are stored in `~/.apex/data/todos.json`. The schema is versioned (`"version": 1`) to allow future migrations.

---

## Integration with VERIFICATION_AGENT

The `TodoManager` class is designed to be imported directly by the `VERIFICATION_AGENT` (see `AGENT.md`) to track sub-task completion criteria before returning control to the orchestrator.

```typescript
// Inside VERIFICATION_AGENT
import { TodoManager } from "../todo/src/TodoManager";
const todos = new TodoManager();
const pending = todos.list({ status: "pending" });
if (pending.length > 0) {
  // block completion until all tasks are resolved
}
```
