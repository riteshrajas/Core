import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptMemoryQuery } from './decrypter.js'

test('decryptMemoryQuery expands natural-language query into semantic probes', () => {
  const decrypted = decryptMemoryQuery(
    'How did we fix the login token bug in production?',
  )

  assert.ok(decrypted.queries.length >= 2)
  assert.ok(
    decrypted.queries.some(query => query.includes('authentication')),
    'expected authentication synonym expansion',
  )
  assert.ok(decrypted.keyTerms.includes('login'))
  assert.ok(decrypted.keyTerms.includes('token'))
})

test('decryptMemoryQuery normalizes topK and minScore bounds', () => {
  const decrypted = decryptMemoryQuery('deploy timeline', {
    topK: 100,
    minScore: -1,
  })
  assert.equal(decrypted.topK, 20)
  assert.equal(decrypted.minScore, 0)
})

