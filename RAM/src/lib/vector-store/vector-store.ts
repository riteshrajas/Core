import fs from 'fs';
import path from 'path';
import { IndexFlatIP } from 'faiss-node';
import type {
  EmbeddingProvider,
  VectorQueryRequest,
  VectorQueryResult,
  VectorUpsertItem,
  VectorUpsertResult,
} from './types';

const PERSISTED_SCHEMA_VERSION = 1 as const;
const DEFAULT_INDEX_FILE_NAME = 'index.faiss';
const DEFAULT_METADATA_FILE_NAME = 'store.json';
const DEFAULT_TOP_K = 5;

interface StoredVectorRecord {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  vector: number[];
  createdAt: string;
  updatedAt: string;
}

interface PersistedStorePayload {
  version: typeof PERSISTED_SCHEMA_VERSION;
  dimension: number;
  records: StoredVectorRecord[];
}

export interface VectorStoreOptions {
  storageDir: string;
  embeddingService: EmbeddingProvider;
  indexFileName?: string;
  metadataFileName?: string;
}

export class VectorStore {
  private readonly storageDir: string;
  private readonly indexFilePath: string;
  private readonly metadataFilePath: string;
  private readonly embeddingService: EmbeddingProvider;
  private readonly records = new Map<string, StoredVectorRecord>();
  private labelToIds: string[] = [];
  private dimension?: number;
  private index?: IndexFlatIP;
  private initializationPromise?: Promise<void>;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: VectorStoreOptions) {
    if (!options.storageDir || options.storageDir.trim().length === 0) {
      throw new Error('VectorStore storageDir must be a non-empty path.');
    }

    this.storageDir = path.resolve(options.storageDir);
    this.indexFilePath = path.join(
      this.storageDir,
      options.indexFileName ?? DEFAULT_INDEX_FILE_NAME
    );
    this.metadataFilePath = path.join(
      this.storageDir,
      options.metadataFileName ?? DEFAULT_METADATA_FILE_NAME
    );
    this.embeddingService = options.embeddingService;
  }

  async upsert(items: VectorUpsertItem[]): Promise<VectorUpsertResult> {
    if (items.length === 0) {
      await this.ensureInitialized();
      return {
        upsertedCount: 0,
        totalCount: this.records.size,
      };
    }

    return this.runExclusive(async () => {
      await this.ensureInitialized();
      this.validateUpsertItems(items);

      const embeddings = await this.embeddingService.embedDocuments(items.map((item) => item.text));
      if (embeddings.length !== items.length) {
        throw new Error(
          `Embedding count mismatch: expected ${items.length}, received ${embeddings.length}.`
        );
      }

      const now = new Date().toISOString();
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const normalizedVector = this.normalizeAndValidateVector(embeddings[i]);
        const existing = this.records.get(item.id);

        this.records.set(item.id, {
          id: item.id,
          text: item.text,
          metadata: item.metadata,
          vector: normalizedVector,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      }

      this.rebuildIndex();
      this.persistToDisk();

      return {
        upsertedCount: items.length,
        totalCount: this.records.size,
      };
    });
  }

  async query(request: VectorQueryRequest): Promise<VectorQueryResult[]> {
    await this.ensureInitialized();
    await this.writeQueue;

    this.validateQueryRequest(request);
    if (!this.index || !this.dimension || this.records.size === 0) {
      return [];
    }

    const topK = request.topK ?? DEFAULT_TOP_K;
    const cappedTopK = Math.min(topK, this.records.size);
    const queryEmbedding = await this.embeddingService.embedQuery(request.query);
    const normalizedQueryVector = this.normalizeAndValidateVector(queryEmbedding);
    const searchResult = this.index.search(normalizedQueryVector, cappedTopK);

    const results: VectorQueryResult[] = [];
    for (let i = 0; i < searchResult.labels.length; i += 1) {
      const label = searchResult.labels[i];
      if (label < 0) {
        continue;
      }

      const id = this.labelToIds[label];
      if (!id) {
        continue;
      }

      const record = this.records.get(id);
      if (!record) {
        continue;
      }

      const score = searchResult.distances[i];
      if (request.minScore !== undefined && score < request.minScore) {
        continue;
      }

      results.push({
        id: record.id,
        text: record.text,
        metadata: record.metadata,
        score,
      });
    }

    return results;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.loadFromDisk();
    }

    await this.initializationPromise;
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(operation, operation);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async loadFromDisk(): Promise<void> {
    fs.mkdirSync(this.storageDir, { recursive: true });
    if (!fs.existsSync(this.metadataFilePath)) {
      return;
    }

    const raw = fs.readFileSync(this.metadataFilePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const payload = this.parsePayload(parsed);

    this.records.clear();
    for (const record of payload.records) {
      this.records.set(record.id, record);
    }

    if (payload.records.length === 0) {
      this.dimension = undefined;
      this.index = undefined;
      this.labelToIds = [];
      return;
    }

    this.dimension = payload.dimension;
    this.labelToIds = payload.records.map((record) => record.id);

    if (fs.existsSync(this.indexFilePath)) {
      try {
        const loadedIndex = IndexFlatIP.read(this.indexFilePath);
        if (
          loadedIndex.getDimension() === payload.dimension &&
          loadedIndex.ntotal() === payload.records.length
        ) {
          this.index = loadedIndex;
          return;
        }
      } catch {
        // If loading fails, we rebuild from persisted vectors below.
      }
    }

    this.rebuildIndex();
    this.persistToDisk();
  }

  private parsePayload(value: unknown): PersistedStorePayload {
    if (!isObject(value)) {
      throw new Error('VectorStore metadata payload is not a valid object.');
    }

    if (value.version !== PERSISTED_SCHEMA_VERSION) {
      throw new Error(
        `VectorStore metadata schema version mismatch. Expected ${PERSISTED_SCHEMA_VERSION}.`
      );
    }

    const dimension = value.dimension;
    if (typeof dimension !== 'number' || !Number.isInteger(dimension) || dimension <= 0) {
      throw new Error('VectorStore metadata has an invalid vector dimension.');
    }

    const recordsRaw = value.records;
    if (!Array.isArray(recordsRaw)) {
      throw new Error('VectorStore metadata records must be an array.');
    }

    const records = recordsRaw.map((entry) => this.parseRecord(entry, dimension));
    return {
      version: PERSISTED_SCHEMA_VERSION,
      dimension,
      records,
    };
  }

  private parseRecord(value: unknown, expectedDimension: number): StoredVectorRecord {
    if (!isObject(value)) {
      throw new Error('VectorStore record is not a valid object.');
    }

    if (typeof value.id !== 'string' || value.id.trim().length === 0) {
      throw new Error('VectorStore record id must be a non-empty string.');
    }

    if (typeof value.text !== 'string' || value.text.trim().length === 0) {
      throw new Error('VectorStore record text must be a non-empty string.');
    }

    if (
      !Array.isArray(value.vector) ||
      value.vector.length !== expectedDimension ||
      value.vector.some((component) => typeof component !== 'number' || !Number.isFinite(component))
    ) {
      throw new Error('VectorStore record contains an invalid vector payload.');
    }

    if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
      throw new Error('VectorStore record timestamps must be ISO strings.');
    }

    return {
      id: value.id,
      text: value.text,
      metadata: isObject(value.metadata) ? value.metadata : undefined,
      vector: [...value.vector],
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  }

  private validateUpsertItems(items: VectorUpsertItem[]): void {
    for (const item of items) {
      if (typeof item.id !== 'string' || item.id.trim().length === 0) {
        throw new Error('VectorStore upsert item id must be a non-empty string.');
      }
      if (typeof item.text !== 'string' || item.text.trim().length === 0) {
        throw new Error('VectorStore upsert item text must be a non-empty string.');
      }
      if (item.metadata !== undefined && !isObject(item.metadata)) {
        throw new Error('VectorStore upsert item metadata must be an object when provided.');
      }
    }
  }

  private validateQueryRequest(request: VectorQueryRequest): void {
    if (typeof request.query !== 'string' || request.query.trim().length === 0) {
      throw new Error('VectorStore query text must be a non-empty string.');
    }
    if (request.topK !== undefined && (!Number.isInteger(request.topK) || request.topK <= 0)) {
      throw new Error('VectorStore topK must be a positive integer when provided.');
    }
  }

  private normalizeAndValidateVector(vector: number[]): number[] {
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Embedding vector must be a non-empty numeric array.');
    }
    if (vector.some((component) => typeof component !== 'number' || !Number.isFinite(component))) {
      throw new Error('Embedding vector contains non-finite values.');
    }

    const normalized = normalizeVector(vector);
    if (!this.dimension) {
      this.dimension = normalized.length;
    } else if (normalized.length !== this.dimension) {
      throw new Error(
        `Embedding dimension mismatch. Expected ${this.dimension}, received ${normalized.length}.`
      );
    }

    return normalized;
  }

  private rebuildIndex(): void {
    if (this.records.size === 0) {
      this.index = undefined;
      this.dimension = undefined;
      this.labelToIds = [];
      return;
    }

    const orderedRecords = Array.from(this.records.values());
    const dimension = orderedRecords[0].vector.length;
    const index = new IndexFlatIP(dimension);
    const vectors: number[] = [];

    for (const record of orderedRecords) {
      if (record.vector.length !== dimension) {
        throw new Error('Stored vectors contain inconsistent dimensions.');
      }
      vectors.push(...record.vector);
    }

    index.add(vectors);
    this.dimension = dimension;
    this.index = index;
    this.labelToIds = orderedRecords.map((record) => record.id);
  }

  private persistToDisk(): void {
    fs.mkdirSync(this.storageDir, { recursive: true });

    if (this.index) {
      this.index.write(this.indexFilePath);
    } else if (fs.existsSync(this.indexFilePath)) {
      fs.rmSync(this.indexFilePath, { force: true });
    }

    const payload: PersistedStorePayload = {
      version: PERSISTED_SCHEMA_VERSION,
      dimension: this.dimension ?? 1,
      records: Array.from(this.records.values()),
    };

    const tempMetadataPath = `${this.metadataFilePath}.tmp`;
    fs.writeFileSync(tempMetadataPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempMetadataPath, this.metadataFilePath);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeVector(vector: number[]): number[] {
  let sumSquares = 0;
  for (const component of vector) {
    sumSquares += component * component;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    throw new Error('Cannot normalize a zero-length vector.');
  }

  return vector.map((component) => component / norm);
}
