import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrainFeedPayload } from '../app/dashboard/_lib/brain-feed-types';

test('dashboard brain feed parser maps ingestion payloads to vectorization events', () => {
  const parsed = parseBrainFeedPayload({
    source: 'cli-history',
    recordId: 'record-123',
    text: 'apex memory e2e smoke command',
    metadata: {
      timestamp: new Date().toISOString(),
      vectorDimension: 384,
    },
  });

  assert.ok(parsed);
  assert.equal(parsed?.kind, 'vectorization');
  if (!parsed || parsed.kind !== 'vectorization') {
    return;
  }

  assert.equal(parsed.recordId, 'record-123');
  assert.equal(parsed.source, 'cli-history');
  assert.ok(parsed.textPreview.includes('smoke command'));
});

