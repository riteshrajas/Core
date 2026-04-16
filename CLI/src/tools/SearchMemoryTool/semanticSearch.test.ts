import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  searchMemorySemantically,
  selectTopRagMatches,
  type SemanticMemoryMatch,
} from './semanticSearch.js'

function createArtifactDirectory(prefix: string): string {
  const randomSuffix = Math.random().toString(16).slice(2)
  const directory = path.join(
    process.cwd(),
    '.test-artifacts',
    `${prefix}-${Date.now()}-${randomSuffix}`,
  )
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

function removeArtifactDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true })
}

test('semantic memory search returns relevant snippets and decrypted queries', async () => {
  const memoryDir = createArtifactDirectory('semantic-memory-search')
  const abortController = new AbortController()

  try {
    fs.writeFileSync(
      path.join(memoryDir, 'auth.md'),
      `---
description: Authentication incident and token refresh fix
---
We fixed login failures by rotating stale refresh tokens and adding a retry guard around token exchange.`,
      'utf-8',
    )
    fs.writeFileSync(
      path.join(memoryDir, 'deploy.md'),
      `---
description: Deployment checklist
---
Release rollouts must include smoke tests, changelog updates, and staged verification.`,
      'utf-8',
    )

    const result = await searchMemorySemantically({
      memoryDir,
      query: 'How did we fix the login token issue?',
      topK: 3,
      signal: abortController.signal,
    })

    assert.ok(result.decryptedQueries.length >= 1)
    assert.ok(result.matches.length >= 1)
    assert.ok(
      result.matches.some(match => match.path.endsWith('auth.md')),
      'expected auth memory to be surfaced',
    )
  } finally {
    removeArtifactDirectory(memoryDir)
  }
})

test('selectTopRagMatches keeps top 3 unique memory paths', () => {
  const matches: SemanticMemoryMatch[] = [
    { id: 'a-1', path: 'a.md', snippet: 'a1', score: 0.91, mtimeMs: 1 },
    { id: 'a-2', path: 'a.md', snippet: 'a2', score: 0.9, mtimeMs: 1 },
    { id: 'b-1', path: 'b.md', snippet: 'b1', score: 0.8, mtimeMs: 1 },
    { id: 'c-1', path: 'c.md', snippet: 'c1', score: 0.7, mtimeMs: 1 },
    { id: 'd-1', path: 'd.md', snippet: 'd1', score: 0.6, mtimeMs: 1 },
  ]

  const selected = selectTopRagMatches(matches, 3)
  assert.equal(selected.length, 3)
  assert.deepEqual(
    selected.map(match => match.path),
    ['a.md', 'b.md', 'c.md'],
  )
})

test('semantic memory search can read persisted RAM vector metadata', async () => {
  const memoryDir = createArtifactDirectory('semantic-memory-ram-store')
  const metadataPath = path.join(memoryDir, 'store.json')
  const previousMetadataPath = process.env.APEX_RAM_VECTOR_STORE_METADATA_PATH
  const abortController = new AbortController()

  try {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          version: 1,
          dimension: 384,
          records: [
            {
              id: 'ram-record-1',
              text: 'Executed command: npm run lint in Core/RAM to validate memory pipeline.',
              metadata: {
                source: 'cli-history',
                timestamp: new Date().toISOString(),
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    )

    process.env.APEX_RAM_VECTOR_STORE_METADATA_PATH = metadataPath
    const result = await searchMemorySemantically({
      memoryDir,
      query: 'what command did we run to validate memory pipeline?',
      topK: 3,
      minScore: 0,
      signal: abortController.signal,
    })

    assert.ok(result.matches.length >= 1)
    assert.ok(
      result.matches.some(match => match.path.startsWith('ram://record/')),
      'expected RAM metadata-backed match to be returned',
    )
  } finally {
    if (previousMetadataPath === undefined) {
      delete process.env.APEX_RAM_VECTOR_STORE_METADATA_PATH
    } else {
      process.env.APEX_RAM_VECTOR_STORE_METADATA_PATH = previousMetadataPath
    }
    removeArtifactDirectory(memoryDir)
  }
})

