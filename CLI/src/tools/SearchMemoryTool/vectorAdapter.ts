import type {
  EmbeddingProvider,
  VectorQueryRequest,
  VectorQueryResult,
  VectorUpsertItem,
} from '../../../../RAM/src/lib/vector-store/types.ts'

const DEFAULT_DIMENSION = 256
const DEFAULT_TOP_K = 5
const TOKEN_REGEX = /[a-z0-9]+/gi

type StoredVectorRecord = {
  id: string
  text: string
  metadata?: Record<string, unknown>
  vector: number[]
}

/**
 * Local deterministic embedder used by the CLI memory retrieval path.
 * The interface mirrors Core/RAM vector-store EmbeddingProvider.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
  private readonly dimension: number

  constructor(dimension: number = DEFAULT_DIMENSION) {
    this.dimension = Math.max(16, Math.floor(dimension))
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.embed(text))
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embed(query)
  }

  private embed(text: string): number[] {
    const vector = Array.from({ length: this.dimension }, () => 0)
    const lowered = text.toLowerCase()
    const tokens = lowered.match(TOKEN_REGEX) ?? []
    if (tokens.length === 0) {
      return vector
    }
    for (const token of tokens) {
      const hash = djb2(token)
      const index = hash % this.dimension
      if (index < 0) continue
      vector[index] += 1
    }
    return normalize(vector)
  }
}

/**
 * In-memory vector store adapter for CLI retrieval. It implements the query/upsert
 * contract defined in Core/RAM vector-store types.
 */
export class InMemoryVectorStoreAdapter {
  private readonly embeddingService: EmbeddingProvider
  private readonly records = new Map<string, StoredVectorRecord>()

  constructor(embeddingService: EmbeddingProvider = new HashEmbeddingProvider()) {
    this.embeddingService = embeddingService
  }

  async upsert(items: VectorUpsertItem[]): Promise<void> {
    if (items.length === 0) return
    const embeddings = await this.embeddingService.embedDocuments(
      items.map(item => item.text),
    )
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const vector = embeddings[i]
      if (!item || !vector) continue
      this.records.set(item.id, {
        id: item.id,
        text: item.text,
        metadata: item.metadata as Record<string, unknown> | undefined,
        vector,
      })
    }
  }

  async query(request: VectorQueryRequest): Promise<VectorQueryResult[]> {
    if (this.records.size === 0 || request.query.trim().length === 0) {
      return []
    }
    const topK = request.topK ?? DEFAULT_TOP_K
    const queryVector = await this.embeddingService.embedQuery(request.query)
    const scored = Array.from(this.records.values()).map(record => ({
      id: record.id,
      text: record.text,
      metadata: record.metadata,
      score: dot(queryVector, record.vector),
    }))
    return scored
      .filter(
        item =>
          request.minScore === undefined || item.score >= request.minScore,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK))
  }

  get size(): number {
    return this.records.size
  }
}

function dot(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let total = 0
  for (let i = 0; i < length; i++) {
    total += (left[i] ?? 0) * (right[i] ?? 0)
  }
  return total
}

function normalize(vector: number[]): number[] {
  let sumSquares = 0
  for (const component of vector) {
    sumSquares += component * component
  }
  if (sumSquares === 0) return vector
  const norm = Math.sqrt(sumSquares)
  return vector.map(component => component / norm)
}

function djb2(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i) || 0
    hash = (hash * 33 + code) >>> 0
  }
  return hash
}

