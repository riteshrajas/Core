/**
 * APEX Todo Manager
 * -----------------
 * Persistent task management module for the APEX CLI ecosystem.
 * Stores tasks as JSON on disk and exposes a typed API consumed by
 * the interactive TUI (todo.ts) and the VERIFICATION_AGENT.
 *
 * Stack: TypeScript · Bun runtime
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high";
export type Status = "pending" | "in-progress" | "done";

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: Status;
  tags: string[];
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
  dueDate?: string;    // ISO-8601 date (YYYY-MM-DD)
}

export interface TodoStore {
  version: 1;
  items: TodoItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── TodoManager ─────────────────────────────────────────────────────────────

export class TodoManager {
  private storePath: string;
  private store: TodoStore;

  constructor(storePath?: string) {
    const dir = storePath ?? join(homedir(), ".apex", "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.storePath = join(dir, "todos.json");
    this.store = this.load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private load(): TodoStore {
    if (!existsSync(this.storePath)) {
      return { version: 1, items: [] };
    }
    try {
      return JSON.parse(readFileSync(this.storePath, "utf-8")) as TodoStore;
    } catch {
      console.error("[APEX Todo] Corrupt store — starting fresh.");
      return { version: 1, items: [] };
    }
  }

  private save(): void {
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /** Add a new todo item. Returns the created item. */
  add(params: {
    title: string;
    description?: string;
    priority?: Priority;
    tags?: string[];
    dueDate?: string;
  }): TodoItem {
    const item: TodoItem = {
      id: generateId(),
      title: params.title.trim(),
      description: params.description?.trim(),
      priority: params.priority ?? "medium",
      status: "pending",
      tags: params.tags ?? [],
      createdAt: now(),
      updatedAt: now(),
      dueDate: params.dueDate,
    };
    this.store.items.push(item);
    this.save();
    return item;
  }

  /** Update fields on an existing item. Returns the updated item or null. */
  update(
    id: string,
    patch: Partial<Omit<TodoItem, "id" | "createdAt">>
  ): TodoItem | null {
    const idx = this.store.items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.store.items[idx] = {
      ...this.store.items[idx],
      ...patch,
      updatedAt: now(),
    };
    this.save();
    return this.store.items[idx];
  }

  /** Mark an item as done. */
  complete(id: string): TodoItem | null {
    return this.update(id, { status: "done" });
  }

  /** Delete an item by id. Returns true if removed. */
  remove(id: string): boolean {
    const before = this.store.items.length;
    this.store.items = this.store.items.filter((i) => i.id !== id);
    if (this.store.items.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Return all items, optionally filtered. */
  list(filter?: {
    status?: Status;
    priority?: Priority;
    tag?: string;
  }): TodoItem[] {
    let items = [...this.store.items];
    if (filter?.status) items = items.filter((i) => i.status === filter.status);
    if (filter?.priority)
      items = items.filter((i) => i.priority === filter.priority);
    if (filter?.tag)
      items = items.filter((i) => i.tags.includes(filter.tag!));
    return items;
  }

  /** Find a single item by id. */
  get(id: string): TodoItem | undefined {
    return this.store.items.find((i) => i.id === id);
  }

  /** Return a summary count by status. */
  summary(): Record<Status, number> {
    const counts: Record<Status, number> = {
      pending: 0,
      "in-progress": 0,
      done: 0,
    };
    for (const item of this.store.items) counts[item.status]++;
    return counts;
  }

  /** Clear all completed items. Returns number of items removed. */
  purgeCompleted(): number {
    const before = this.store.items.length;
    this.store.items = this.store.items.filter((i) => i.status !== "done");
    const removed = before - this.store.items.length;
    if (removed > 0) this.save();
    return removed;
  }
}
