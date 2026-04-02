import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AgentKind, ChatRole, ProviderName } from "./types.js";

type MemoryTurn = {
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ThreadRecord = {
  id: string;
  state: string;
  updatedAt: string;
  turns: MemoryTurn[];
};

type SemanticRecord = {
  id: string;
  threadId: string;
  agent: AgentKind;
  provider: ProviderName;
  text: string;
  createdAt: string;
  tokens: string[];
};

type MemoryDocument = {
  threads: Record<string, ThreadRecord>;
  semantic: SemanticRecord[];
};

type SemanticHit = {
  id: string;
  score: number;
  text: string;
  threadId: string;
  agent: AgentKind;
  provider: ProviderName;
  createdAt: string;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "this",
  "that",
  "with",
  "from",
  "have",
  "your",
  "about",
  "into",
  "then",
  "than",
  "they",
  "them",
  "will",
  "would",
  "there",
  "their",
  "what",
  "when",
  "where",
  "while",
  "were",
  "been",
  "are",
  "is",
  "to",
  "of",
  "in",
  "on",
  "at",
  "be"
]);

export class ApexMemory {
  private readonly filePath: string;
  private readonly maxSemanticRecords: number;
  private doc: MemoryDocument;

  constructor(filePath: string, maxSemanticRecords = 1200) {
    this.filePath = filePath;
    this.maxSemanticRecords = maxSemanticRecords;
    this.doc = this.load();
  }

  listThreads(limit = 20): Array<{ threadId: string; updatedAt: string; state: string }> {
    return Object.values(this.doc.threads)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, limit))
      .map((thread) => ({
        threadId: thread.id,
        updatedAt: thread.updatedAt,
        state: thread.state
      }));
  }

  getThreadTurns(threadId: string, limit = 12): MemoryTurn[] {
    const thread = this.doc.threads[threadId];
    if (!thread) {
      return [];
    }
    if (limit < 1) {
      return [];
    }
    return thread.turns.slice(-limit);
  }

  setThreadState(threadId: string, state: string): void {
    const thread = this.ensureThread(threadId);
    thread.state = state;
    thread.updatedAt = nowIso();
    this.persist();
  }

  appendTurn(threadId: string, role: ChatRole, content: string): void {
    const thread = this.ensureThread(threadId);
    thread.turns.push({
      role,
      content,
      createdAt: nowIso()
    });
    thread.updatedAt = nowIso();
    this.persist();
  }

  remember(input: {
    threadId: string;
    text: string;
    agent: AgentKind;
    provider: ProviderName;
  }): void {
    const text = input.text.trim();
    if (!text) {
      return;
    }

    const record: SemanticRecord = {
      id: randomUUID(),
      threadId: input.threadId,
      agent: input.agent,
      provider: input.provider,
      text,
      createdAt: nowIso(),
      tokens: tokenize(text)
    };

    this.doc.semantic.push(record);
    if (this.doc.semantic.length > this.maxSemanticRecords) {
      this.doc.semantic.splice(0, this.doc.semantic.length - this.maxSemanticRecords);
    }

    this.persist();
  }

  search(query: string, limit = 4): SemanticHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return [];
    }

    const queryVector = toTokenMap(tokens);

    return this.doc.semantic
      .map((record) => ({
        id: record.id,
        threadId: record.threadId,
        text: record.text,
        agent: record.agent,
        provider: record.provider,
        createdAt: record.createdAt,
        score: cosineSimilarity(queryVector, toTokenMap(record.tokens))
      }))
      .filter((record) => record.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(1, limit));
  }

  private ensureThread(threadId: string): ThreadRecord {
    if (!this.doc.threads[threadId]) {
      this.doc.threads[threadId] = {
        id: threadId,
        state: "new",
        updatedAt: nowIso(),
        turns: []
      };
    }
    return this.doc.threads[threadId];
  }

  private load(): MemoryDocument {
    try {
      if (!fs.existsSync(this.filePath)) {
        return emptyDocument();
      }

      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<MemoryDocument>;
      const threads = parsed.threads && typeof parsed.threads === "object" ? parsed.threads : {};
      const semantic = Array.isArray(parsed.semantic) ? parsed.semantic : [];

      return {
        threads,
        semantic
      };
    } catch {
      return emptyDocument();
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.doc, null, 2), "utf8");
  }
}

function emptyDocument(): MemoryDocument {
  return {
    threads: {},
    semantic: []
  };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function toTokenMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    const current = map.get(token) || 0;
    map.set(token, current + 1);
  }
  return map;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) {
    leftMagnitude += value * value;
  }

  for (const value of right.values()) {
    rightMagnitude += value * value;
  }

  for (const [token, value] of left.entries()) {
    const rightValue = right.get(token) || 0;
    dot += value * rightValue;
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

function nowIso(): string {
  return new Date().toISOString();
}

