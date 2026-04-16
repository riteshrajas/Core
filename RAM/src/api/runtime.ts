import type { EmbeddingProvider } from './embedding';
import {
  CLIActivityStreamGateway,
  startCLIActivityWebSocketServer,
  type CLIStreamServerHandle,
} from './cli-activity-stream';
import { MemoryIngestionPipeline } from './ingestion-pipeline';
import { ProjectContextIndexer, type ProjectContextIndexerOptions } from './project-context-indexer';
import type { IngestionFeedEvent } from './types';
import type { VectorStore } from './vector-store';

export interface MemoryIngestionRuntimeOptions {
  vectorStore: VectorStore;
  projectRoot: string;
  embeddingProvider?: EmbeddingProvider;
  keyFiles?: ProjectContextIndexerOptions['keyFiles'];
  onIngest?: (event: IngestionFeedEvent) => void;
  wsPort?: number;
  wsHost?: string;
  wsPath?: string;
}

export class MemoryIngestionRuntime {
  readonly pipeline: MemoryIngestionPipeline;
  readonly projectContextIndexer: ProjectContextIndexer;
  readonly cliGateway: CLIActivityStreamGateway;

  private readonly wsPort: number;
  private readonly wsHost?: string;
  private readonly wsPath?: string;
  private wsServer: CLIStreamServerHandle | null = null;

  constructor(options: MemoryIngestionRuntimeOptions) {
    this.pipeline = new MemoryIngestionPipeline({
      vectorStore: options.vectorStore,
      embeddingProvider: options.embeddingProvider,
      onIngest: options.onIngest,
    });
    this.cliGateway = new CLIActivityStreamGateway(this.pipeline);
    this.projectContextIndexer = new ProjectContextIndexer({
      projectRoot: options.projectRoot,
      pipeline: this.pipeline,
      keyFiles: options.keyFiles,
    });
    this.wsPort = options.wsPort ?? 4174;
    this.wsHost = options.wsHost;
    this.wsPath = options.wsPath ?? '/api/ingestion/cli-stream';
  }

  async start(): Promise<void> {
    await this.projectContextIndexer.start();
    this.wsServer = await startCLIActivityWebSocketServer({
      gateway: this.cliGateway,
      port: this.wsPort,
      host: this.wsHost,
      path: this.wsPath,
    });
  }

  async stop(): Promise<void> {
    await this.projectContextIndexer.stop();
    if (this.wsServer) {
      await this.wsServer.close();
      this.wsServer = null;
    }
  }
}

