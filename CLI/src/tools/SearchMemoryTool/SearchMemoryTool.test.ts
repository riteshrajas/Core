import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getAutoMemPath } from '../../memdir/paths.js'
import { SearchMemoryTool, type Output } from './SearchMemoryTool.js'

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

function clearAutoMemPathCache(): void {
  ;(getAutoMemPath as unknown as { cache?: { clear?: () => void } }).cache?.clear?.()
}

test('SearchMemoryTool returns semantic memory matches from auto memory dir', async () => {
  const memoryDir = createArtifactDirectory('search-memory-tool')
  const previousOverride = process.env.APEX_COWORK_MEMORY_PATH_OVERRIDE
  process.env.APEX_COWORK_MEMORY_PATH_OVERRIDE = memoryDir
  clearAutoMemPathCache()

  try {
    fs.writeFileSync(
      path.join(memoryDir, 'release.md'),
      `---
description: Release and rollout process
---
Deployments require staged rollout, smoke tests, and rollback validation.`,
      'utf-8',
    )

    const result = await SearchMemoryTool.call(
      {
        query: 'What is our deployment rollout process?',
        topK: 2,
      },
      { abortController: new AbortController() } as never,
    )

    const output = result.data as Output
    assert.equal(output.query, 'What is our deployment rollout process?')
    assert.ok(output.decrypted_queries.length >= 1)
    assert.ok(output.matches.length >= 1)
    assert.ok(output.matches[0]?.snippet.length > 0)

    const rendered = SearchMemoryTool.mapToolResultToToolResultBlockParam?.(
      output,
      'tool-use-1',
    )
    assert.equal(rendered?.type, 'tool_result')
    assert.ok(String(rendered?.content).includes('release.md'))
  } finally {
    if (previousOverride === undefined) {
      delete process.env.APEX_COWORK_MEMORY_PATH_OVERRIDE
    } else {
      process.env.APEX_COWORK_MEMORY_PATH_OVERRIDE = previousOverride
    }
    clearAutoMemPathCache()
    removeArtifactDirectory(memoryDir)
  }
})

