/**
 * APEX Todo — Unit Tests
 * ----------------------
 * Tests for TodoManager using Bun's built-in test runner.
 * Run with: bun test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { TodoManager } from "./TodoManager";

const TEST_DIR = join(import.meta.dir, "..", ".test-data");

function freshManager(): TodoManager {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
  return new TodoManager(TEST_DIR);
}

describe("TodoManager", () => {
  let manager: TodoManager;

  beforeEach(() => {
    manager = freshManager();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  // ── add ──────────────────────────────────────────────────────────────────

  it("adds a task with default priority and status", () => {
    const item = manager.add({ title: "Test task" });
    expect(item.title).toBe("Test task");
    expect(item.priority).toBe("medium");
    expect(item.status).toBe("pending");
    expect(item.id).toMatch(/^todo_/);
  });

  it("adds a task with all optional fields", () => {
    const item = manager.add({
      title: "Full task",
      description: "A description",
      priority: "high",
      tags: ["aal", "testing"],
      dueDate: "2026-06-01",
    });
    expect(item.description).toBe("A description");
    expect(item.priority).toBe("high");
    expect(item.tags).toEqual(["aal", "testing"]);
    expect(item.dueDate).toBe("2026-06-01");
  });

  // ── list ─────────────────────────────────────────────────────────────────

  it("lists all tasks", () => {
    manager.add({ title: "Task A" });
    manager.add({ title: "Task B" });
    expect(manager.list()).toHaveLength(2);
  });

  it("filters by status", () => {
    const a = manager.add({ title: "Task A" });
    manager.add({ title: "Task B" });
    manager.complete(a.id);
    expect(manager.list({ status: "done" })).toHaveLength(1);
    expect(manager.list({ status: "pending" })).toHaveLength(1);
  });

  it("filters by priority", () => {
    manager.add({ title: "High", priority: "high" });
    manager.add({ title: "Low", priority: "low" });
    expect(manager.list({ priority: "high" })).toHaveLength(1);
  });

  it("filters by tag", () => {
    manager.add({ title: "Tagged", tags: ["aal"] });
    manager.add({ title: "Untagged" });
    expect(manager.list({ tag: "aal" })).toHaveLength(1);
  });

  // ── complete ─────────────────────────────────────────────────────────────

  it("marks a task as done", () => {
    const item = manager.add({ title: "Complete me" });
    const updated = manager.complete(item.id);
    expect(updated?.status).toBe("done");
  });

  it("returns null when completing a non-existent task", () => {
    expect(manager.complete("nonexistent")).toBeNull();
  });

  // ── update ───────────────────────────────────────────────────────────────

  it("updates task fields", () => {
    const item = manager.add({ title: "Old title" });
    const updated = manager.update(item.id, {
      title: "New title",
      priority: "high",
      status: "in-progress",
    });
    expect(updated?.title).toBe("New title");
    expect(updated?.priority).toBe("high");
    expect(updated?.status).toBe("in-progress");
  });

  // ── remove ───────────────────────────────────────────────────────────────

  it("removes a task", () => {
    const item = manager.add({ title: "Remove me" });
    expect(manager.remove(item.id)).toBe(true);
    expect(manager.list()).toHaveLength(0);
  });

  it("returns false when removing a non-existent task", () => {
    expect(manager.remove("nonexistent")).toBe(false);
  });

  // ── summary ──────────────────────────────────────────────────────────────

  it("returns correct summary counts", () => {
    const a = manager.add({ title: "A" });
    manager.add({ title: "B" });
    manager.complete(a.id);
    const s = manager.summary();
    expect(s.done).toBe(1);
    expect(s.pending).toBe(1);
    expect(s["in-progress"]).toBe(0);
  });

  // ── purgeCompleted ────────────────────────────────────────────────────────

  it("purges completed tasks", () => {
    const a = manager.add({ title: "A" });
    manager.add({ title: "B" });
    manager.complete(a.id);
    const removed = manager.purgeCompleted();
    expect(removed).toBe(1);
    expect(manager.list()).toHaveLength(1);
  });

  // ── persistence ──────────────────────────────────────────────────────────

  it("persists tasks across manager instances", () => {
    manager.add({ title: "Persisted task" });
    const manager2 = new TodoManager(TEST_DIR);
    expect(manager2.list()).toHaveLength(1);
    expect(manager2.list()[0].title).toBe("Persisted task");
  });
});
