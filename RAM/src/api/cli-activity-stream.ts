import type { MemoryIngestionPipeline } from './ingestion-pipeline';
import type { CLIHistoryStreamEvent } from './types';

type WebSocketServerInstance = {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  close: (callback?: (error?: Error) => void) => void;
};

type WebSocketConnection = {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  send: (payload: string) => void;
};

export class CLIActivityStreamGateway {
  private readonly pipeline: MemoryIngestionPipeline;

  constructor(pipeline: MemoryIngestionPipeline) {
    this.pipeline = pipeline;
  }

  async ingestRawFrame(raw: string | Buffer): Promise<boolean> {
    const parsed = parseCLIHistoryStreamEvent(raw);
    if (!parsed) {
      return false;
    }
    await this.pipeline.ingestCLICommand(parsed);
    return true;
  }
}

export interface CLIStreamServerOptions {
  gateway: CLIActivityStreamGateway;
  port: number;
  host?: string;
  path?: string;
}

export interface CLIStreamServerHandle {
  close: () => Promise<void>;
}

export async function startCLIActivityWebSocketServer(
  options: CLIStreamServerOptions
): Promise<CLIStreamServerHandle> {
  const wsModuleName = 'ws';
  const wsModule = (await import(wsModuleName)) as {
    WebSocketServer: new (opts: { port: number; host?: string; path?: string }) => WebSocketServerInstance;
  };
  const server = new wsModule.WebSocketServer({
    port: options.port,
    host: options.host,
    path: options.path,
  });

  server.on('connection', (...args: unknown[]) => {
    const socket = args[0] as WebSocketConnection | undefined;
    if (!socket) {
      return;
    }
    socket.on('message', (...messageArgs: unknown[]) => {
      const payload = messageArgs[0];
      if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
        void options.gateway.ingestRawFrame(payload);
      }
    });
    socket.send(JSON.stringify({ type: 'ram.ingestion.ready' }));
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

export function parseCLIHistoryStreamEvent(raw: string | Buffer): CLIHistoryStreamEvent | null {
  const jsonPayload = typeof raw === 'string' ? raw : raw.toString('utf-8');

  let candidate: unknown;
  try {
    candidate = JSON.parse(jsonPayload);
  } catch {
    return null;
  }

  if (!isCLIHistoryStreamEvent(candidate)) {
    return null;
  }

  return candidate;
}

function isCLIHistoryStreamEvent(candidate: unknown): candidate is CLIHistoryStreamEvent {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const value = candidate as Record<string, unknown>;
  return (
    value.type === 'cli.command_history' &&
    value.source === 'core-cli' &&
    typeof value.project === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.command === 'string' &&
    typeof value.timestamp === 'string'
  );
}

