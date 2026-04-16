'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createBrainFeedAdapter,
  type BrainFeedAdapterOptions,
  type BrainFeedAdapter,
} from './brain-feed-adapter';
import type {
  BrainFeedConnectionEvent,
  PerformanceSnapshotFeedEvent,
  RetrievalHitFeedEvent,
  VectorizationFeedEvent,
} from './brain-feed-types';

const MAX_FEED_EVENTS = 32;
const MAX_METRIC_SAMPLES = 120;
const ACTIVE_WINDOW_MS = 15_000;
const RATE_WINDOW_MS = 60_000;

interface BrainFeedState {
  connection: BrainFeedConnectionEvent;
  vectorizations: VectorizationFeedEvent[];
  retrievalHits: RetrievalHitFeedEvent[];
  overrides: PerformanceSnapshotFeedEvent['metrics'];
  embeddingSamples: number[];
  faissSamples: number[];
  vectorizationTimestamps: string[];
  retrievalTimestamps: string[];
}

export interface BrainFeedPerformanceSummary {
  embeddingLatencyMs?: number;
  embeddingP95Ms?: number;
  faissSearchMs?: number;
  faissP95Ms?: number;
  retrievalLatencyMs?: number;
  vectorizationsPerMinute?: number;
  retrievalsPerMinute?: number;
}

export interface UseBrainFeedResult {
  connection: BrainFeedConnectionEvent;
  vectorizations: VectorizationFeedEvent[];
  activeVectorizations: VectorizationFeedEvent[];
  retrievalHits: RetrievalHitFeedEvent[];
  performance: BrainFeedPerformanceSummary;
}

const initialState: BrainFeedState = {
  connection: {
    kind: 'connection',
    status: 'connecting',
    message: 'Initializing visual brain feed...',
    updatedAt: new Date().toISOString(),
  },
  vectorizations: [],
  retrievalHits: [],
  overrides: {},
  embeddingSamples: [],
  faissSamples: [],
  vectorizationTimestamps: [],
  retrievalTimestamps: [],
};

export function useBrainFeed(options?: BrainFeedAdapterOptions): UseBrainFeedResult {
  const [state, setState] = useState<BrainFeedState>(initialState);

  const eventStreamUrl = options?.eventStreamUrl;
  const websocketUrl = options?.websocketUrl;
  const connectionTimeoutMs = options?.connectionTimeoutMs;

  useEffect(() => {
    const adapter: BrainFeedAdapter = createBrainFeedAdapter({
      eventStreamUrl,
      websocketUrl,
      connectionTimeoutMs,
    });

    const stop = adapter.start((event) => {
      setState((previous) => {
        if (event.kind === 'connection') {
          return {
            ...previous,
            connection: event,
          };
        }

        if (event.kind === 'vectorization') {
          const embeddingSamples = appendSample(previous.embeddingSamples, event.embeddingLatencyMs);
          return {
            ...previous,
            vectorizations: appendEvent(previous.vectorizations, event),
            embeddingSamples,
            vectorizationTimestamps: appendTimestamp(previous.vectorizationTimestamps, event.timestamp),
          };
        }

        if (event.kind === 'retrieval-hit') {
          const embeddingSamples = appendSample(previous.embeddingSamples, event.embeddingLatencyMs);
          const faissSamples = appendSample(previous.faissSamples, event.faissSearchMs);
          return {
            ...previous,
            retrievalHits: appendEvent(previous.retrievalHits, event),
            embeddingSamples,
            faissSamples,
            retrievalTimestamps: appendTimestamp(previous.retrievalTimestamps, event.timestamp),
          };
        }

        const embeddingSamples = appendSample(
          previous.embeddingSamples,
          event.metrics.embeddingLatencyMs
        );
        const faissSamples = appendSample(previous.faissSamples, event.metrics.faissSearchMs);
        return {
          ...previous,
          overrides: {
            ...previous.overrides,
            ...event.metrics,
          },
          embeddingSamples,
          faissSamples,
        };
      });
    });

    return () => {
      stop();
    };
  }, [connectionTimeoutMs, eventStreamUrl, websocketUrl]);

  const activeVectorizations = useMemo(() => {
    const referenceTimestamp = state.vectorizations[0]?.timestamp;
    if (!referenceTimestamp) {
      return [];
    }
    const referenceTime = Date.parse(referenceTimestamp);
    if (Number.isNaN(referenceTime)) {
      return state.vectorizations.slice(0, 8);
    }

    return state.vectorizations.filter((event) => {
      const timestamp = Date.parse(event.timestamp);
      if (Number.isNaN(timestamp)) {
        return false;
      }
      return referenceTime - timestamp <= ACTIVE_WINDOW_MS;
    });
  }, [state.vectorizations]);

  const performance = useMemo<BrainFeedPerformanceSummary>(() => {
    const embeddingLatencyMs =
      state.overrides.embeddingLatencyMs ?? lastValue(state.embeddingSamples);
    const faissSearchMs = state.overrides.faissSearchMs ?? lastValue(state.faissSamples);

    return {
      embeddingLatencyMs,
      embeddingP95Ms: state.overrides.embeddingP95Ms ?? percentile(state.embeddingSamples, 0.95),
      faissSearchMs,
      faissP95Ms: state.overrides.faissP95Ms ?? percentile(state.faissSamples, 0.95),
      retrievalLatencyMs: state.overrides.retrievalLatencyMs,
      vectorizationsPerMinute:
        state.overrides.vectorizationsPerMinute ??
        perMinuteRate(
          state.vectorizationTimestamps,
          RATE_WINDOW_MS,
          state.vectorizationTimestamps.at(-1)
        ),
      retrievalsPerMinute:
        state.overrides.retrievalsPerMinute ??
        perMinuteRate(state.retrievalTimestamps, RATE_WINDOW_MS, state.retrievalTimestamps.at(-1)),
    };
  }, [state]);

  return {
    connection: state.connection,
    vectorizations: state.vectorizations,
    activeVectorizations,
    retrievalHits: state.retrievalHits,
    performance,
  };
}

function appendEvent<T>(existing: T[], next: T): T[] {
  return [next, ...existing].slice(0, MAX_FEED_EVENTS);
}

function appendSample(existing: number[], maybeValue: number | undefined): number[] {
  if (typeof maybeValue !== 'number' || !Number.isFinite(maybeValue)) {
    return existing;
  }
  return [...existing, maybeValue].slice(-MAX_METRIC_SAMPLES);
}

function appendTimestamp(existing: string[], timestamp: string): string[] {
  return [...existing, timestamp].slice(-MAX_METRIC_SAMPLES);
}

function percentile(samples: number[], value: number): number | undefined {
  if (samples.length === 0) {
    return undefined;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * value) - 1));
  return sorted[index];
}

function lastValue(values: number[]): number | undefined {
  return values.at(-1);
}

function perMinuteRate(
  timestamps: string[],
  windowMs: number,
  referenceTimestamp?: string
): number | undefined {
  if (timestamps.length === 0) {
    return undefined;
  }
  const reference = referenceTimestamp ?? timestamps.at(-1);
  if (!reference) {
    return undefined;
  }
  const referenceMs = Date.parse(reference);
  if (Number.isNaN(referenceMs)) {
    return undefined;
  }

  const count = timestamps.reduce((total, timestamp) => {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
      return total;
    }
    const delta = referenceMs - parsed;
    return delta >= 0 && delta <= windowMs ? total + 1 : total;
  }, 0);

  return Number(((count / windowMs) * 60_000).toFixed(1));
}
