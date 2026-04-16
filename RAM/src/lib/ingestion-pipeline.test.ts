import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CLIActivityStreamGateway,
  MemoryIngestionPipeline,
  ProjectContextIndexer,
  type VectorRecord,
  type VectorStore,
} from '../api';

class CollectingVectorStore implements VectorStore {
  records: VectorRecord[] = [];

  async upsert(records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

class AddOnlyVectorStore implements VectorStore {
  records: VectorRecord[] = [];

  async add(records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

const testWorkspaceRoot = path.join(process.cwd(), '.test-workspace');

async function withWorkspaceTempDir(
  name: string,
  run: (tempDir: string) => Promise<void>
): Promise<void> {
  fs.mkdirSync(testWorkspaceRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(testWorkspaceRoot, `${name}-`));
  try {
    await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number = 2000,
  pollMs: number = 25
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

test('CLI websocket frames are ingested into vector records', async () => {
  const store = new CollectingVectorStore();
  const pipeline = new MemoryIngestionPipeline({
    vectorStore: store,
    embeddingProvider: { embed: () => [1, 0, 0] },
  });
  const gateway = new CLIActivityStreamGateway(pipeline);

  const accepted = await gateway.ingestRawFrame(
    JSON.stringify({
      type: 'cli.command_history',
      source: 'core-cli',
      project: 'P:/APEX',
      sessionId: 'session-1',
      command: 'npm run test',
      timestamp: new Date().toISOString(),
    })
  );

  assert.equal(accepted, true);
  assert.equal(store.records.length, 1);
  assert.equal(store.records[0]?.metadata.source, 'cli-history');
  assert.equal(store.records[0]?.text, 'npm run test');
});

test('ingestion pipeline supports vector stores with add(records)', async () => {
  const store = new AddOnlyVectorStore();
  const pipeline = new MemoryIngestionPipeline({
    vectorStore: store,
    embeddingProvider: { embed: () => [0.5, 0.5] },
  });

  await pipeline.ingestCLICommand({
    type: 'cli.command_history',
    source: 'core-cli',
    project: 'P:/APEX',
    sessionId: 'session-2',
    command: 'bun run build',
    timestamp: new Date().toISOString(),
  });

  assert.equal(store.records.length, 1);
  assert.equal(store.records[0]?.metadata.source, 'cli-history');
});

test('ProjectContextIndexer indexes key files and reacts to changes', async () => {
  await withWorkspaceTempDir('context-indexer', async (tempDir) => {
    const readmePath = path.join(tempDir, 'README.md');
    fs.writeFileSync(readmePath, '# First Version', 'utf-8');

    const store = new CollectingVectorStore();
    const pipeline = new MemoryIngestionPipeline({
      vectorStore: store,
      embeddingProvider: { embed: () => [0.25, 0.75] },
    });
    const indexer = new ProjectContextIndexer({
      projectRoot: tempDir,
      pipeline,
      keyFiles: ['README.md'],
      debounceMs: 50,
    });

    await indexer.start();
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0]?.metadata.source, 'project-context');

    fs.writeFileSync(readmePath, '# Second Version', 'utf-8');
    await waitFor(() => store.records.length >= 2);
    await indexer.stop();

    assert.equal(store.records.length >= 2, true);
    assert.equal(store.records.at(-1)?.metadata.source, 'project-context');
  });
});

