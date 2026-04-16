export interface VectorMetadata {
  [key: string]: unknown;
}

export interface VectorUpsertItem {
  id: string;
  text: string;
  metadata?: VectorMetadata;
}

export interface VectorUpsertResult {
  upsertedCount: number;
  totalCount: number;
}

export interface VectorQueryRequest {
  query: string;
  topK?: number;
  minScore?: number;
}

export interface VectorQueryResult {
  id: string;
  text: string;
  score: number;
  metadata?: VectorMetadata;
}

export interface EmbeddingProvider {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(query: string): Promise<number[]>;
}
