#!/usr/bin/env bun
/**
 * APEX Todo CLI
 * -------------
 * Interactive command-line interface for the APEX to-do list module.
 *
 * Usage:
 *   bun run todo.ts <command> [options]
 *
 * Commands:
 *   add      Add a new task
 *   list     List tasks (with optional filters)
 *   done     Mark a task as completed
 *   update   Update a task's fields
 *   remove   Delete a task
 *   summary  Show task count by status
 *   purge    Remove all completed tasks
 *   help     Show this help message
 *
 * Examples:
 *   bun run todo.ts add "Write AAL parser tests" --priority high --tags aal,testing
 *   bun run todo.ts list --status pending
 *   bun run todo.ts done todo_1234_abcde
 *   bun run todo.ts remove todo_1234_abcde
 */

import { TodoManager, Priority, Status, TodoItem } from "./TodoManager";

// ─── ANSI colour helpers ──────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function colorPriority(p: Priority): string {
  if (p === "high") return `${c.red}${p}${c.reset}`;
  if (p === "medium") return `${c.yellow}${p}${c.reset}`;
  return `${c.dim}${p}${c.reset}`;
}

function colorStatus(s: Status): string {
  if (s === "done") return `${c.green}${s}${c.reset}`;
  if (s === "in-progress") return `${c.cyan}${s}${c.reset}`;
  return `${c.dim}${s}${c.reset}`;
}

function printItem(item: TodoItem, index?: number): void {
  const prefix = index !== undefined ? `${c.dim}${index + 1}.${c.reset} ` : "";
  const due = item.dueDate ? ` ${c.magenta}due:${item.dueDate}${c.reset}` : "";
  const tags =
    item.tags.length > 0
      ? ` ${c.blue}[${item.tags.join(", ")}]${c.reset}`
      : "";
  const desc = item.description
    ? `\n   ${c.dim}${item.description}${c.reset}`
    : "";

  console.log(
    `${prefix}${c.bold}${item.title}${c.reset}` +
      `  ${colorStatus(item.status)}` +
      `  ${colorPriority(item.priority)}` +
      due +
      tags +
      `\n   ${c.dim}id: ${item.id}${c.reset}` +
      desc
  );
}

// ─── Argument parsing helpers ─────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }
  return { positional, flags };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

const manager = new TodoManager();

function cmdAdd(args: ReturnType<typeof parseArgs>): void {
  const title = args.positional[0];
  if (!title) {
    console.error(`${c.red}Error:${c.reset} Please provide a task title.`);
    process.exit(1);
  }
  const tagsRaw = args.flags["tags"];
  const tags =
    typeof tagsRaw === "string" ? tagsRaw.split(",").map((t) => t.trim()) : [];
  const item = manager.add({
    title,
    description: typeof args.flags["desc"] === "string" ? args.flags["desc"] : undefined,
    priority: (args.flags["priority"] as Priority) ?? "medium",
    tags,
    dueDate: typeof args.flags["due"] === "string" ? args.flags["due"] : undefined,
  });
  console.log(`${c.green}✔ Task added${c.reset}`);
  printItem(item);
}

function cmdList(args: ReturnType<typeof parseArgs>): void {
  const items = manager.list({
    status: args.flags["status"] as Status | undefined,
    priority: args.flags["priority"] as Priority | undefined,
    tag: typeof args.flags["tag"] === "string" ? args.flags["tag"] : undefined,
  });

  if (items.length === 0) {
    console.log(`${c.dim}No tasks found.${c.reset}`);
    return;
  }

  const summary = manager.summary();
  console.log(
    `\n${c.bold}APEX Tasks${c.reset}  ` +
      `${c.green}done:${summary.done}${c.reset}  ` +
      `${c.cyan}in-progress:${summary["in-progress"]}${c.reset}  ` +
      `${c.dim}pending:${summary.pending}${c.reset}\n`
  );
  items.forEach((item, idx) => {
    printItem(item, idx);
    console.log();
  });
}

function cmdDone(args: ReturnType<typeof parseArgs>): void {
  const id = args.positional[0];
  if (!id) {
    console.error(`${c.red}Error:${c.reset} Please provide a task id.`);
    process.exit(1);
  }
  const item = manager.complete(id);
  if (!item) {
    console.error(`${c.red}Error:${c.reset} Task not found: ${id}`);
    process.exit(1);
  }
  console.log(`${c.green}✔ Marked as done${c.reset}`);
  printItem(item);
}

function cmdUpdate(args: ReturnType<typeof parseArgs>): void {
  const id = args.positional[0];
  if (!id) {
    console.error(`${c.red}Error:${c.reset} Please provide a task id.`);
    process.exit(1);
  }
  const patch: Record<string, unknown> = {};
  if (args.flags["title"]) patch["title"] = args.flags["title"];
  if (args.flags["desc"]) patch["description"] = args.flags["desc"];
  if (args.flags["priority"]) patch["priority"] = args.flags["priority"];
  if (args.flags["status"]) patch["status"] = args.flags["status"];
  if (args.flags["due"]) patch["dueDate"] = args.flags["due"];
  if (args.flags["tags"]) {
    patch["tags"] = (args.flags["tags"] as string)
      .split(",")
      .map((t) => t.trim());
  }
  const item = manager.update(id, patch as any);
  if (!item) {
    console.error(`${c.red}Error:${c.reset} Task not found: ${id}`);
    process.exit(1);
  }
  console.log(`${c.green}✔ Task updated${c.reset}`);
  printItem(item);
}

function cmdRemove(args: ReturnType<typeof parseArgs>): void {
  const id = args.positional[0];
  if (!id) {
    console.error(`${c.red}Error:${c.reset} Please provide a task id.`);
    process.exit(1);
  }
  const ok = manager.remove(id);
  if (!ok) {
    console.error(`${c.red}Error:${c.reset} Task not found: ${id}`);
    process.exit(1);
  }
  console.log(`${c.green}✔ Task removed: ${id}${c.reset}`);
}

function cmdSummary(): void {
  const s = manager.summary();
  const total = s.pending + s["in-progress"] + s.done;
  console.log(`\n${c.bold}Task Summary${c.reset}`);
  console.log(`  Total       : ${total}`);
  console.log(`  ${c.dim}Pending${c.reset}     : ${s.pending}`);
  console.log(`  ${c.cyan}In-Progress${c.reset} : ${s["in-progress"]}`);
  console.log(`  ${c.green}Done${c.reset}        : ${s.done}`);
}

function cmdPurge(): void {
  const removed = manager.purgeCompleted();
  console.log(
    `${c.green}✔ Purged ${removed} completed task(s).${c.reset}`
  );
}

function cmdHelp(): void {
  console.log(`
${c.bold}APEX Todo CLI${c.reset}
${c.dim}Persistent task management for the APEX ecosystem${c.reset}

${c.bold}Usage:${c.reset}
  bun run todo.ts <command> [options]

${c.bold}Commands:${c.reset}
  ${c.cyan}add${c.reset}     <title> [--priority low|medium|high] [--tags tag1,tag2]
          [--desc "description"] [--due YYYY-MM-DD]
  ${c.cyan}list${c.reset}    [--status pending|in-progress|done] [--priority ...] [--tag ...]
  ${c.cyan}done${c.reset}    <id>
  ${c.cyan}update${c.reset}  <id> [--title ...] [--status ...] [--priority ...] [--desc ...]
          [--tags ...] [--due ...]
  ${c.cyan}remove${c.reset}  <id>
  ${c.cyan}summary${c.reset}
  ${c.cyan}purge${c.reset}
  ${c.cyan}help${c.reset}

${c.bold}Examples:${c.reset}
  bun run todo.ts add "Write AAL parser tests" --priority high --tags aal,testing
  bun run todo.ts list --status pending
  bun run todo.ts done todo_1234_abcde
  bun run todo.ts update todo_1234_abcde --status in-progress
  bun run todo.ts remove todo_1234_abcde
  bun run todo.ts summary
  bun run todo.ts purge
`);
}

// ─── Router ───────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const command = rawArgs[0] ?? "help";
const parsed = parseArgs(rawArgs.slice(1));

switch (command) {
  case "add":
    cmdAdd(parsed);
    break;
  case "list":
    cmdList(parsed);
    break;
  case "done":
    cmdDone(parsed);
    break;
  case "update":
    cmdUpdate(parsed);
    break;
  case "remove":
  case "rm":
  case "delete":
    cmdRemove(parsed);
    break;
  case "summary":
    cmdSummary();
    break;
  case "purge":
    cmdPurge();
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    cmdHelp();
}
