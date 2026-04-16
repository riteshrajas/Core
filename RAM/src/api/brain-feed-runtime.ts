import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {
  MemoryIngestionRuntime,
  type IngestionFeedEvent,
  type VectorRecord,
  type VectorStore,
} from './index';

export interface DashboardStreamEvent {
  type: string;
  payload: Record<string, unknown>;
}

interface PersistedRuntimeStore {
  version: number;
  dimension: number;
  records: Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
    vector: number[];
    createdAt: string;
    updatedAt: string;
  }>;
}

const dashboardEmitter = new EventEmitter();
dashboardEmitter.setMaxListeners(200);

const RECENT_WINDOW_MS = 60_000;
const recentVectorizationTimestamps: number[] = [];

let runtimePromise: Promise<MemoryIngestionRuntime> | null = null;
let latestEmbeddingLatencyMs: number | undefined;

export async function ensureBrainFeedRuntime(): Promise<void> {
  if (!runtimePromise) {
    runtimePromise = startRuntime();
  }
  await runtimePromise;
}

export function subscribeDashboardStream(
  listener: (event: DashboardStreamEvent) => void
): () => void {
  dashboardEmitter.on('event', listener);
  return () => {
    dashboardEmitter.off('event', listener);
  };
}

export function getLatestPerformanceSnapshot(): DashboardStreamEvent {
  return {
    type: 'ram.performance.snapshot',
    payload: {
      timestamp: new Date().toISOString(),
      embeddingLatencyMs: latestEmbeddingLatencyMs,
      vectorizationsPerMinute: countRecentVectorizations(),
    },
  };
}

async function startRuntime(): Promise<MemoryIngestionRuntime> {
  const runtime = new MemoryIngestionRuntime({
    projectRoot: path.resolve(process.cwd(), '..', '..'),
    vectorStore: createPersistentRuntimeStore(),
    onIngest: publishIngestionEvent,
  });
  await runtime.start();
  return runtime;
}

function createPersistentRuntimeStore(): VectorStore {
  const storeDirectory = path.join(process.cwd(), '.apex-memory', 'vector-store');
  const metadataPath = path.join(storeDirectory, 'store.json');
  const recordsById = new Map<
    string,
    PersistedRuntimeStore['records'][number]
  >();
  let dimension = 0;

  loadExistingRecords();

  return {
    upsert: async (records: VectorRecord[]) => {
      const now = new Date().toISOString();
      for (const record of records) {
        const existing = recordsById.get(record.id);
        const vector = Array.isArray(record.embedding)
          ? record.embedding
          : [];
        if (dimension === 0 && vector.length > 0) {
          dimension = vector.length;
        }

        recordsById.set(record.id, {
          id: record.id,
          text: record.text,
          metadata: record.metadata,
          vector,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      }
      persistRecords();
    },
  };

  function loadExistingRecords(): void {
    if (!fs.existsSync(metadataPath)) {
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as
        | PersistedRuntimeStore
        | undefined;
      if (!parsed || !Array.isArray(parsed.records)) {
        return;
      }

      if (typeof parsed.dimension === 'number' && parsed.dimension > 0) {
        dimension = parsed.dimension;
      }

      for (const record of parsed.records) {
        if (!record || typeof record.id !== 'string' || typeof record.text !== 'string') {
          continue;
        }
        recordsById.set(record.id, record);
      }
    } catch {
      // Ignore malformed store payloads and rebuild from new runtime writes.
    }
  }

  function persistRecords(): void {
    fs.mkdirSync(storeDirectory, { recursive: true });

    const payload: PersistedRuntimeStore = {
      version: 1,
      dimension,
      records: Array.from(recordsById.values()),
    };

    const tempPath = `${metadataPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempPath, metadataPath);
  }
}

function publishIngestionEvent(event: IngestionFeedEvent): void {
  const timestamp = normalizeTimestamp(event.metadata.timestamp);
  const embeddingLatencyMs = asFiniteNumber(event.metadata.embeddingLatencyMs);
  latestEmbeddingLatencyMs = embeddingLatencyMs ?? latestEmbeddingLatencyMs;
  trackVectorization(timestamp);

  emit({
    type: 'ram.ingestion.vectorized',
    payload: {
      source: event.source,
      recordId: event.recordId,
      text: event.text,
      timestamp,
      metadata: {
        ...event.metadata,
        embeddingLatencyMs: embeddingLatencyMs ?? event.metadata.embeddingLatencyMs,
        vectorDimension: asFiniteNumber(event.metadata.vectorDimension),
      },
    },
  });

  emit(getLatestPerformanceSnapshot());
}

function emit(event: DashboardStreamEvent): void {
  dashboardEmitter.emit('event', event);
}

function trackVectorization(timestamp: string): void {
  const parsed = Date.parse(timestamp);
  const now = Number.isNaN(parsed) ? Date.now() : parsed;
  recentVectorizationTimestamps.push(now);
  const cutoff = now - RECENT_WINDOW_MS;
  while (
    recentVectorizationTimestamps.length > 0 &&
    recentVectorizationTimestamps[0] < cutoff
  ) {
    recentVectorizationTimestamps.shift();
  }
}

function countRecentVectorizations(): number {
  const now = Date.now();
  const cutoff = now - RECENT_WINDOW_MS;
  return recentVectorizationTimestamps.filter((timestamp) => timestamp >= cutoff)
    .length;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return new Date().toISOString();
}

