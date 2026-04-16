import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { EmbeddingService, VectorStore } from './index';

function createArtifactDirectory(prefix: string): string {
  const randomSuffix = Math.random().toString(16).slice(2);
  const directory = path.join(
    process.cwd(),
    '.test-artifacts',
    `${prefix}-${Date.now()}-${randomSuffix}`
  );
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function removeArtifactDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true });
}

test('EmbeddingService vectorizes strings locally with FastEmbed', async () => {
  const embeddingService = new EmbeddingService({ batchSize: 2 });
  const documents = [
    'APEX builds autonomous systems for robotics.',
    'Vector search enables semantic retrieval over local memories.',
  ];

  const embeddings = await embeddingService.embedDocuments(documents);
  assert.equal(embeddings.length, documents.length);
  assert.ok(embeddings[0].length > 0);
  assert.equal(embeddings[0].length, embeddings[1].length);

  const queryEmbedding = await embeddingService.embedQuery(
    'APEX builds autonomous systems for robotics.'
  );
  assert.equal(queryEmbedding.length, embeddings[0].length);
});

test('VectorStore persists FAISS index and vectors to disk', async () => {
  const storageDir = createArtifactDirectory('vector-store');
  const embeddingService = new EmbeddingService({ batchSize: 2 });

  try {
    const store = new VectorStore({
      storageDir,
      embeddingService,
    });

    const upsertResult = await store.upsert([
      {
        id: 'doc-1',
        text: 'APEX robotics command and control platform.',
        metadata: { source: 'integration-test' },
      },
      {
        id: 'doc-2',
        text: 'Financial planning insights and bookkeeping workflows.',
      },
    ]);

    assert.equal(upsertResult.upsertedCount, 2);
    assert.equal(upsertResult.totalCount, 2);
    assert.ok(fs.existsSync(path.join(storageDir, 'index.faiss')));
    assert.ok(fs.existsSync(path.join(storageDir, 'store.json')));

    const initialResults = await store.query({
      query: 'APEX robotics command and control platform.',
      topK: 1,
    });
    assert.equal(initialResults.length, 1);
    assert.equal(initialResults[0].id, 'doc-1');

    const reloadedStore = new VectorStore({
      storageDir,
      embeddingService,
    });

    const reloadedResults = await reloadedStore.query({
      query: 'APEX robotics command and control platform.',
      topK: 1,
    });

    assert.equal(reloadedResults.length, 1);
    assert.equal(reloadedResults[0].id, 'doc-1');
    assert.ok(reloadedResults[0].score > 0);
  } finally {
    removeArtifactDirectory(storageDir);
  }
});
