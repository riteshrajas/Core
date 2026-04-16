import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from './embedding';
import { DeterministicEmbeddingProvider } from './embedding';
import type { CLIHistoryStreamEvent, IngestionFeedEvent, ProjectContextDocument } from './types';
import type { VectorStore } from './vector-store';
import { writeVectorRecords } from './vector-store';

export interface IngestionPipelineOptions {
  vectorStore: VectorStore;
  embeddingProvider?: EmbeddingProvider;
  onIngest?: (event: IngestionFeedEvent) => void;
}

export class MemoryIngestionPipeline {
  private readonly vectorStore: VectorStore;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly onIngest?: (event: IngestionFeedEvent) => void;

  constructor(options: IngestionPipelineOptions) {
    this.vectorStore = options.vectorStore;
    this.embeddingProvider = options.embeddingProvider ?? new DeterministicEmbeddingProvider();
    this.onIngest = options.onIngest;
  }

  async ingestCLICommand(event: CLIHistoryStreamEvent): Promise<void> {
    const normalizedTimestamp = event.timestamp || new Date().toISOString();
    const recordId = createDigestId(`cli:${event.sessionId}:${normalizedTimestamp}:${event.command}`);
    const metadata = {
      source: 'cli-history',
      sessionId: event.sessionId,
      project: event.project,
      timestamp: normalizedTimestamp,
      messageType: event.type,
    } as const;

    await this.writeRecord(recordId, event.command, metadata);
  }

  async ingestProjectContext(document: ProjectContextDocument): Promise<void> {
    const recordId = createDigestId(
      `project:${document.projectRoot}:${document.relativePath}:${document.content}`
    );
    const metadata = {
      source: 'project-context',
      projectRoot: document.projectRoot,
      relativePath: document.relativePath,
      absolutePath: document.absolutePath,
      timestamp: document.timestamp,
    } as const;

    await this.writeRecord(recordId, document.content, metadata);
  }

  private async writeRecord(
    recordId: string,
    text: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const embedStartedAt = performance.now();
    const embedding = await this.embeddingProvider.embed(text);
    const embeddingLatencyMs = Number((performance.now() - embedStartedAt).toFixed(2));
    const enrichedMetadata = {
      ...metadata,
      embeddingLatencyMs,
      vectorDimension: embedding.length,
    };

    await writeVectorRecords(this.vectorStore, [
      { id: recordId, text, embedding, metadata: enrichedMetadata },
    ]);
    this.onIngest?.({
      source: metadata.source as 'cli-history' | 'project-context',
      recordId,
      text,
      metadata: enrichedMetadata,
    });
  }
}

function createDigestId(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

