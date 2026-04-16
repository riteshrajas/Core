import {
  ensureBrainFeedRuntime,
  getLatestPerformanceSnapshot,
  subscribeDashboardStream,
  type DashboardStreamEvent,
} from '@/api/brain-feed-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

export async function GET(request: Request): Promise<Response> {
  await ensureBrainFeedRuntime();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: DashboardStreamEvent): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      emit({
        type: 'ram.ingestion.ready',
        payload: {
          timestamp: new Date().toISOString(),
        },
      });
      emit(getLatestPerformanceSnapshot());

      const unsubscribe = subscribeDashboardStream(emit);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15_000);

      const close = (): void => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener('abort', close, { once: true });
    },
    cancel() {
      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

