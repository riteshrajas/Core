export type IngestionSource = 'cli-history' | 'project-context' | 'agent-thought' | 'unknown';

export interface VectorizationFeedEvent {
  kind: 'vectorization';
  id: string;
  recordId: string;
  source: IngestionSource;
  textPreview: string;
  timestamp: string;
  embeddingLatencyMs?: number;
  vectorDimension?: number;
  queueDepth?: number;
}

export interface RetrievalHitFeedEvent {
  kind: 'retrieval-hit';
  id: string;
  query: string;
  timestamp: string;
  score?: number;
  rank?: number;
  recordId?: string;
  source?: string;
  excerpt?: string;
  embeddingLatencyMs?: number;
  faissSearchMs?: number;
  totalLatencyMs?: number;
}

export interface PerformanceSnapshotFeedEvent {
  kind: 'performance';
  id: string;
  timestamp: string;
  metrics: {
    embeddingLatencyMs?: number;
    embeddingP95Ms?: number;
    faissSearchMs?: number;
    faissP95Ms?: number;
    retrievalLatencyMs?: number;
    vectorizationsPerMinute?: number;
    retrievalsPerMinute?: number;
  };
}

export interface BrainFeedConnectionEvent {
  kind: 'connection';
  status: 'connecting' | 'live' | 'unavailable' | 'error';
  message: string;
  updatedAt: string;
  transport?: 'sse' | 'ws';
}

export type BrainFeedDataEvent =
  | VectorizationFeedEvent
  | RetrievalHitFeedEvent
  | PerformanceSnapshotFeedEvent;

export type BrainFeedAdapterEvent = BrainFeedConnectionEvent | BrainFeedDataEvent;

const vectorizationEventTypes = new Set([
  'ram.vectorization',
  'ram.ingestion',
  'ram.ingestion.vectorized',
  'vectorization',
  'ingestion',
]);

const retrievalEventTypes = new Set([
  'ram.retrieval.hit',
  'ram.retrieval',
  'retrieval.hit',
  'retrieval',
]);

const performanceEventTypes = new Set([
  'ram.performance',
  'ram.performance.snapshot',
  'performance',
  'performance.snapshot',
]);

export function parseBrainFeedPayload(raw: unknown): BrainFeedDataEvent | null {
  const payload = parseUnknownPayload(raw);
  if (!payload) {
    return null;
  }

  if (isLegacyIngestionEvent(payload)) {
    return toVectorizationEvent(payload);
  }

  const type = asString(payload.type)?.toLowerCase();
  const body = asRecord(payload.payload) ?? payload;

  if (type && vectorizationEventTypes.has(type)) {
    return toVectorizationEvent(body);
  }
  if (type && retrievalEventTypes.has(type)) {
    return toRetrievalHitEvent(body);
  }
  if (type && performanceEventTypes.has(type)) {
    return toPerformanceEvent(body);
  }

  if (asString(body.kind) === 'vectorization') {
    return toVectorizationEvent(body);
  }
  if (asString(body.kind) === 'retrieval-hit') {
    return toRetrievalHitEvent(body);
  }
  if (asString(body.kind) === 'performance') {
    return toPerformanceEvent(body);
  }

  return null;
}

function toVectorizationEvent(raw: Record<string, unknown>): VectorizationFeedEvent | null {
  const metadata = asRecord(raw.metadata);
  const source = normalizeSource(raw.source ?? metadata?.source);
  const recordId = asString(raw.recordId) ?? asString(raw.id);
  if (!recordId) {
    return null;
  }

  const text = asString(raw.textPreview) ?? asString(raw.text) ?? '';

  return {
    kind: 'vectorization',
    id: buildId('vectorization', recordId),
    recordId,
    source,
    textPreview: text.length > 220 ? `${text.slice(0, 217)}...` : text,
    timestamp: normalizeTimestamp(raw.timestamp ?? metadata?.timestamp),
    embeddingLatencyMs: asNumber(raw.embeddingLatencyMs ?? metadata?.embeddingLatencyMs),
    vectorDimension: asNumber(raw.vectorDimension ?? metadata?.vectorDimension),
    queueDepth: asNumber(raw.queueDepth ?? metadata?.queueDepth),
  };
}

function toRetrievalHitEvent(raw: Record<string, unknown>): RetrievalHitFeedEvent | null {
  const query = asString(raw.query) ?? asString(raw.prompt) ?? asString(raw.text);
  if (!query) {
    return null;
  }

  return {
    kind: 'retrieval-hit',
    id: buildId('retrieval', asString(raw.recordId)),
    query,
    timestamp: normalizeTimestamp(raw.timestamp),
    score: asNumber(raw.score),
    rank: asNumber(raw.rank),
    recordId: asString(raw.recordId),
    source: asString(raw.source),
    excerpt: asString(raw.excerpt) ?? asString(raw.matchText),
    embeddingLatencyMs: asNumber(raw.embeddingLatencyMs),
    faissSearchMs: asNumber(raw.faissSearchMs ?? raw.searchLatencyMs),
    totalLatencyMs: asNumber(raw.totalLatencyMs),
  };
}

function toPerformanceEvent(raw: Record<string, unknown>): PerformanceSnapshotFeedEvent {
  return {
    kind: 'performance',
    id: buildId('performance'),
    timestamp: normalizeTimestamp(raw.timestamp),
    metrics: {
      embeddingLatencyMs: asNumber(raw.embeddingLatencyMs),
      embeddingP95Ms: asNumber(raw.embeddingP95Ms),
      faissSearchMs: asNumber(raw.faissSearchMs),
      faissP95Ms: asNumber(raw.faissP95Ms),
      retrievalLatencyMs: asNumber(raw.retrievalLatencyMs ?? raw.totalLatencyMs),
      vectorizationsPerMinute: asNumber(raw.vectorizationsPerMinute),
      retrievalsPerMinute: asNumber(raw.retrievalsPerMinute),
    },
  };
}

function normalizeSource(source: unknown): IngestionSource {
  const value = asString(source);
  if (value === 'cli-history' || value === 'project-context' || value === 'agent-thought') {
    return value;
  }
  return 'unknown';
}

function parseUnknownPayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return asRecord(parsed);
    } catch {
      return null;
    }
  }

  return asRecord(raw);
}

function isLegacyIngestionEvent(value: Record<string, unknown>): boolean {
  return (
    typeof value.source === 'string' &&
    typeof value.recordId === 'string' &&
    typeof value.text === 'string'
  );
}

function normalizeTimestamp(value: unknown): string {
  const timestamp = asString(value);
  if (timestamp && !Number.isNaN(Date.parse(timestamp))) {
    return timestamp;
  }
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
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

function buildId(prefix: string, suffix?: string): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}:${suffix ?? 'event'}:${Date.now()}:${token}`;
}
