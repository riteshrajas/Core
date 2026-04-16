import { EmbeddingModel, FlagEmbedding } from 'fastembed';
import os from 'os';
import path from 'path';
import type { EmbeddingProvider } from './types';

const DEFAULT_BATCH_SIZE = 32;
type SupportedEmbeddingModel = Exclude<EmbeddingModel, EmbeddingModel.CUSTOM>;

export interface EmbeddingServiceOptions {
  model?: SupportedEmbeddingModel;
  batchSize?: number;
  cacheDir?: string;
  showDownloadProgress?: boolean;
}

export class EmbeddingService implements EmbeddingProvider {
  private readonly model: SupportedEmbeddingModel;
  private readonly batchSize: number;
  private readonly cacheDir: string;
  private readonly showDownloadProgress: boolean;
  private modelPromise?: Promise<FlagEmbedding>;

  constructor(options: EmbeddingServiceOptions = {}) {
    const configuredBatchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(configuredBatchSize) || configuredBatchSize <= 0) {
      throw new Error('EmbeddingService batchSize must be a positive integer.');
    }

    this.model = options.model ?? EmbeddingModel.BGESmallENV15;
    this.batchSize = configuredBatchSize;
    this.cacheDir = options.cacheDir ?? path.join(os.homedir(), '.apex', 'fastembed-cache');
    this.showDownloadProgress = options.showDownloadProgress ?? false;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    this.validateTextCollection(texts, 'texts');
    const model = await this.getModel();
    const generator = model.passageEmbed(texts, this.batchSize);
    const embeddings = await this.collectEmbeddings(generator);

    if (embeddings.length !== texts.length) {
      throw new Error(
        `Embedding count mismatch: expected ${texts.length}, received ${embeddings.length}.`
      );
    }

    return embeddings;
  }

  async embedQuery(query: string): Promise<number[]> {
    this.validateText(query, 'query');
    const model = await this.getModel();
    const embedding = await model.queryEmbed(query);
    return [...embedding];
  }

  private async getModel(): Promise<FlagEmbedding> {
    if (!this.modelPromise) {
      this.modelPromise = FlagEmbedding.init({
        model: this.model,
        cacheDir: this.cacheDir,
        showDownloadProgress: this.showDownloadProgress,
      });
    }

    return this.modelPromise;
  }

  private async collectEmbeddings(
    generator: AsyncGenerator<number[][], void, unknown>
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    for await (const batch of generator) {
      for (const embedding of batch) {
        embeddings.push([...embedding]);
      }
    }
    return embeddings;
  }

  private validateTextCollection(texts: string[], fieldName: string): void {
    for (const text of texts) {
      this.validateText(text, fieldName);
    }
  }

  private validateText(value: string, fieldName: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`EmbeddingService ${fieldName} must contain non-empty strings.`);
    }
  }
}
