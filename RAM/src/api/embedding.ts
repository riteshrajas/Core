export interface EmbeddingProvider {
  embed(text: string): Promise<number[]> | number[];
}

const DEFAULT_EMBED_DIMENSION = 32;

/**
 * Lightweight deterministic embedding for local ingestion scaffolding.
 * This keeps the pipeline functional while the production embedder is wired in.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  private readonly dimension: number;

  constructor(dimension: number = DEFAULT_EMBED_DIMENSION) {
    this.dimension = dimension;
  }

  embed(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    if (!text) {
      return vector;
    }

    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      const slot = (code + index) % this.dimension;
      vector[slot] += code;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) {
      return vector;
    }

    return vector.map((value) => Number((value / magnitude).toFixed(8)));
  }
}

