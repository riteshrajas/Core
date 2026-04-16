'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Database,
  Gauge,
  Loader2,
  Search,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { BRAIN_FEED_INTEGRATION_TODO } from './_lib/brain-feed-adapter';
import { useBrainFeed } from './_lib/use-brain-feed';
import type { RetrievalHitFeedEvent, VectorizationFeedEvent } from './_lib/brain-feed-types';

const LATENCY_TARGET_MS = 200;

export default function DashboardPage() {
  const { connection, activeVectorizations, vectorizations, retrievalHits, performance } = useBrainFeed();

  const showUnavailableNotice = connection.status === 'unavailable';
  const showConnecting = connection.status === 'connecting';

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-slate-100 selection:bg-indigo-500/30 sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[42%] w-[42%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1">
                <Activity className="h-3.5 w-3.5 text-indigo-300" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  RAM Dashboard
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Visual Brain Feed
              </h1>
              <p className="max-w-2xl text-sm text-slate-400 md:text-base">
                Live view of vectorization activity, semantic retrieval hits, and memory-loop performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ConnectionBadge
                status={connection.status}
                transport={connection.transport}
                message={connection.message}
              />
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voice Console
              </Link>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <article className="xl:col-span-2">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Database className="h-5 w-5 text-indigo-300" />
                  Realtime Memory Activity
                </h2>
                {showConnecting && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Connecting
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FeedColumn
                  title="Active Vectorizations"
                  subtitle="Incoming memory chunks"
                  icon={<Zap className="h-4 w-4 text-indigo-300" />}
                  events={activeVectorizations.length > 0 ? activeVectorizations : vectorizations.slice(0, 8)}
                  emptyLabel={
                    showUnavailableNotice
                      ? 'No vectorization stream detected.'
                      : 'Waiting for vectorization events...'
                  }
                  renderItem={(event) => <VectorizationRow key={event.id} event={event} />}
                />

                <FeedColumn
                  title="Retrieval Hits"
                  subtitle="Semantic matches returned"
                  icon={<Search className="h-4 w-4 text-cyan-300" />}
                  events={retrievalHits.slice(0, 8)}
                  emptyLabel={
                    showUnavailableNotice
                      ? 'No retrieval hit stream detected.'
                      : 'Waiting for retrieval results...'
                  }
                  renderItem={(event) => <RetrievalRow key={event.id} event={event} />}
                />
              </div>
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl backdrop-blur-sm sm:p-6">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                <Gauge className="h-5 w-5 text-indigo-300" />
                Performance Monitor
              </h2>

              <div className="space-y-4">
                <MetricCard
                  title="Embedding Latency"
                  value={performance.embeddingLatencyMs}
                  p95={performance.embeddingP95Ms}
                  targetMs={LATENCY_TARGET_MS}
                />
                <MetricCard
                  title="FAISS Search Time"
                  value={performance.faissSearchMs}
                  p95={performance.faissP95Ms}
                  targetMs={LATENCY_TARGET_MS}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <CompactStat
                  label="Vectorizations/min"
                  value={formatRate(performance.vectorizationsPerMinute)}
                />
                <CompactStat label="Retrievals/min" value={formatRate(performance.retrievalsPerMinute)} />
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Target</p>
                <p className="mt-1 text-sm font-medium text-slate-300">
                  Retrieval latency should remain under{' '}
                  <span className="font-semibold text-emerald-300">{LATENCY_TARGET_MS}ms</span>.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Observed total retrieval: {formatMs(performance.retrievalLatencyMs)}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-xl backdrop-blur-sm sm:p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                Stream Health
              </h2>
              <p className="text-sm text-slate-400">{connection.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                Last update: {formatTimestamp(connection.updatedAt)}
              </p>
              {showUnavailableNotice && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Integration boundary
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/90">{BRAIN_FEED_INTEGRATION_TODO}</p>
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

interface FeedColumnProps<T extends { id: string }> {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  events: T[];
  emptyLabel: string;
  renderItem: (event: T) => React.ReactNode;
}

function FeedColumn<T extends { id: string }>({
  title,
  subtitle,
  icon,
  events,
  emptyLabel,
  renderItem,
}: FeedColumnProps<T>) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <header className="mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          {icon}
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </header>

      <div className="space-y-2">
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/60 px-3 py-4 text-center text-xs text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          events.map(renderItem)
        )}
      </div>
    </section>
  );
}

function VectorizationRow({ event }: { event: VectorizationFeedEvent }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="rounded-full border border-indigo-400/25 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
          {event.source}
        </span>
        <span className="text-[10px] text-slate-500">{formatTimestamp(event.timestamp)}</span>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">
        {event.textPreview || 'Vectorized memory chunk received.'}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {formatMs(event.embeddingLatencyMs)}
        </span>
        <span>dim: {event.vectorDimension ?? '—'}</span>
        <span>q: {event.queueDepth ?? '—'}</span>
      </div>
    </article>
  );
}

function RetrievalRow({ event }: { event: RetrievalHitFeedEvent }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
          rank {event.rank ?? '—'}
        </span>
        <span className="text-[10px] text-slate-500">{formatTimestamp(event.timestamp)}</span>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">{event.query}</p>
      {event.excerpt && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">“{event.excerpt}”</p>}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>score: {formatScore(event.score)}</span>
        <span className="inline-flex items-center gap-1">
          <Search className="h-3 w-3" />
          {formatMs(event.faissSearchMs)}
        </span>
      </div>
    </article>
  );
}

function MetricCard({
  title,
  value,
  p95,
  targetMs,
}: {
  title: string;
  value?: number;
  p95?: number;
  targetMs: number;
}) {
  const ratio = value ? Math.min(100, (value / targetMs) * 100) : 0;
  const tone =
    typeof value !== 'number'
      ? 'bg-slate-700'
      : value <= targetMs
        ? 'bg-emerald-400'
        : value <= targetMs * 1.5
          ? 'bg-amber-400'
          : 'bg-rose-400';

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <span className="text-sm font-semibold text-white">{formatMs(value)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-300 ${tone}`} style={{ width: `${ratio}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">p95: {formatMs(p95)}</p>
    </article>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </article>
  );
}

function ConnectionBadge({
  status,
  transport,
  message,
}: {
  status: 'connecting' | 'live' | 'unavailable' | 'error';
  transport?: 'sse' | 'ws';
  message: string;
}) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
        <Wifi className="h-3.5 w-3.5" />
        Live {transport ? `• ${transport.toUpperCase()}` : ''}
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Connecting
      </span>
    );
  }

  return (
    <span
      title={message}
      className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300"
    >
      <WifiOff className="h-3.5 w-3.5" />
      {status === 'unavailable' ? 'Stream Offline' : 'Connection Error'}
    </span>
  );
}

function formatMs(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (value < 10) {
    return `${value.toFixed(1)}ms`;
  }
  return `${Math.round(value)}ms`;
}

function formatRate(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(1);
}

function formatScore(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(3);
}

function formatTimestamp(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) {
    return '—';
  }
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
