import { parseBrainFeedPayload, type BrainFeedAdapterEvent } from './brain-feed-types';

export const DEFAULT_BRAIN_FEED_SSE_URL = '/api/ingestion/feed';
export const BRAIN_FEED_INTEGRATION_TODO =
  'TODO: expose a live ingestion/retrieval feed at /api/ingestion/feed (SSE), or set NEXT_PUBLIC_RAM_BRAIN_FEED_WS_URL.';

export interface BrainFeedAdapterOptions {
  eventStreamUrl?: string;
  websocketUrl?: string;
  connectionTimeoutMs?: number;
}

export interface BrainFeedAdapter {
  start: (onEvent: (event: BrainFeedAdapterEvent) => void) => () => void;
}

export function createBrainFeedAdapter(options: BrainFeedAdapterOptions = {}): BrainFeedAdapter {
  const eventStreamUrl = options.eventStreamUrl ?? process.env.NEXT_PUBLIC_RAM_BRAIN_FEED_URL;
  const websocketUrl = options.websocketUrl ?? process.env.NEXT_PUBLIC_RAM_BRAIN_FEED_WS_URL;
  const connectionTimeoutMs = options.connectionTimeoutMs ?? 4000;

  return {
    start(onEvent) {
      if (typeof window === 'undefined') {
        return () => undefined;
      }

      let teardown = () => undefined;

      const emit = (event: BrainFeedAdapterEvent) => onEvent(event);
      const emitConnection = (
        status: 'connecting' | 'live' | 'unavailable' | 'error',
        message: string,
        transport?: 'sse' | 'ws'
      ): void => {
        emit({
          kind: 'connection',
          status,
          message,
          updatedAt: new Date().toISOString(),
          transport,
        });
      };

      const markUnavailable = (message: string): void => {
        emitConnection('unavailable', message);
      };

      const startWebSocket = (contextMessage?: string): void => {
        if (!websocketUrl) {
          markUnavailable(
            `${contextMessage ? `${contextMessage} ` : ''}Live stream unavailable. ${BRAIN_FEED_INTEGRATION_TODO}`
          );
          return;
        }

        emitConnection('connecting', `Connecting websocket feed: ${websocketUrl}`, 'ws');

        let opened = false;
        let socket: WebSocket;

        try {
          socket = new WebSocket(websocketUrl);
        } catch {
          markUnavailable(
            `Websocket feed could not be initialized at ${websocketUrl}. ${BRAIN_FEED_INTEGRATION_TODO}`
          );
          return;
        }

        socket.onopen = () => {
          opened = true;
          emitConnection('live', 'Live feed connected via websocket.', 'ws');
        };

        socket.onmessage = (event) => {
          const payload =
            typeof event.data === 'string' ? event.data : event.data instanceof Blob ? '' : event.data;
          const parsed = parseBrainFeedPayload(payload);
          if (parsed) {
            emit(parsed);
          }
        };

        socket.onerror = () => {
          emitConnection('error', 'Websocket feed reported an error.', 'ws');
        };

        socket.onclose = () => {
          if (!opened) {
            markUnavailable(
              `Websocket feed is not reachable at ${websocketUrl}. ${BRAIN_FEED_INTEGRATION_TODO}`
            );
            return;
          }
          emitConnection('error', 'Websocket feed disconnected.', 'ws');
        };

        teardown = () => {
          socket.close();
        };
      };

      const canUseEventSource = typeof window.EventSource === 'function';
      const sseUrl = eventStreamUrl ?? DEFAULT_BRAIN_FEED_SSE_URL;

      if (!canUseEventSource) {
        startWebSocket('EventSource is unavailable in this runtime.');
        return () => teardown();
      }

      emitConnection('connecting', `Connecting event stream: ${sseUrl}`, 'sse');
      let opened = false;
      const source = new EventSource(sseUrl);
      const timeoutHandle = window.setTimeout(() => {
        if (opened) {
          return;
        }
        source.close();
        startWebSocket(`SSE connection timed out at ${sseUrl}.`);
      }, connectionTimeoutMs);

      source.onopen = () => {
        opened = true;
        window.clearTimeout(timeoutHandle);
        emitConnection('live', 'Live feed connected via SSE.', 'sse');
      };

      source.onmessage = (event) => {
        const parsed = parseBrainFeedPayload(event.data);
        if (parsed) {
          emit(parsed);
        }
      };

      source.onerror = () => {
        if (!opened) {
          window.clearTimeout(timeoutHandle);
          source.close();
          startWebSocket(`SSE feed is unavailable at ${sseUrl}.`);
          return;
        }
        emitConnection('error', 'SSE feed interrupted. Browser retry is in progress.', 'sse');
      };

      teardown = () => {
        window.clearTimeout(timeoutHandle);
        source.close();
      };

      return () => teardown();
    },
  };
}
