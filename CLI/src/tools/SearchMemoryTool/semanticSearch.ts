import fs from 'node:fs'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { readFileInRange } from '../../utils/readFileInRange.js'
import { scanMemoryFiles } from '../../memdir/memoryScan.js'
import { decryptMemoryQuery } from './decrypter.js'
import { InMemoryVectorStoreAdapter } from './vectorAdapter.js'

const MAX_INDEX_LINES = 200
const MAX_INDEX_BYTES = 16 * 1024
const MAX_SNIPPET_CHARS = 480
const MAX_SNIPPETS_PER_FILE = 6
const RAM_STORE_ENV = 'APEX_RAM_VECTOR_STORE_METADATA_PATH'

type IndexedSnippet = {
  id: string
  path: string
  mtimeMs: number
  snippet: string
}

type CachedIndex = {
  fingerprint: string
  snippetsById: Map<string, IndexedSnippet>
  store: InMemoryVectorStoreAdapter
}

const semanticIndexCache = new Map<string, CachedIndex>()

export type SemanticMemoryMatch = {
  id: string
  path: string
  snippet: string
  score: number
  mtimeMs: number
}

export type SemanticMemorySearchResult = {
  decryptedQueries: string[]
  matches: SemanticMemoryMatch[]
}

export async function searchMemorySemantically(options: {
  memoryDir: string
  query: string
  topK?: number
  minScore?: number
  signal: AbortSignal
}): Promise<SemanticMemorySearchResult> {
  const decrypted = decryptMemoryQuery(options.query, {
    topK: options.topK,
    minScore: options.minScore,
  })
  if (decrypted.queries.length === 0) {
    return { decryptedQueries: [], matches: [] }
  }

  const index = await getOrCreateSemanticIndex(options.memoryDir, options.signal)
  const scoreById = new Map<string, number>()
  if (index.store.size > 0) {
    for (let i = 0; i < decrypted.queries.length; i++) {
      const query = decrypted.queries[i]
      const queryBoost = i === 0 ? 1 : 0.9
      const results = await index.store.query({
        query,
        topK: Math.max(decrypted.topK * 2, decrypted.topK),
        minScore: decrypted.minScore * 0.75,
      })
      for (const result of results) {
        const current = scoreById.get(result.id)
        const boostedScore = result.score * queryBoost
        if (current === undefined || boostedScore > current) {
          scoreById.set(result.id, boostedScore)
        }
      }
    }
  }

  const memoryMatches = Array.from(scoreById.entries())
    .map(([id, score]) => {
      const snippet = index.snippetsById.get(id)
      if (!snippet) return null
      return {
        id,
        path: snippet.path,
        snippet: snippet.snippet,
        score,
        mtimeMs: snippet.mtimeMs,
      } satisfies SemanticMemoryMatch
    })
    .filter((match): match is SemanticMemoryMatch => match !== null)
    .filter(match => match.score >= decrypted.minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.mtimeMs - a.mtimeMs
    })

  const ramStoreMatches = await searchPersistedRamStore({
    queryPlan: decrypted.queries,
    topK: decrypted.topK,
    minScore: decrypted.minScore,
  })

  const merged = mergeAndRankMatches([...memoryMatches, ...ramStoreMatches], decrypted.minScore)

  return {
    decryptedQueries: decrypted.queries,
    matches: merged.slice(0, decrypted.topK),
  }
}

export function selectTopRagMatches(
  matches: readonly SemanticMemoryMatch[],
  limit: number = 3,
): SemanticMemoryMatch[] {
  const seenPaths = new Set<string>()
  const selected: SemanticMemoryMatch[] = []
  for (const match of [...matches].sort((a, b) => b.score - a.score)) {
    if (seenPaths.has(match.path)) continue
    selected.push(match)
    seenPaths.add(match.path)
    if (selected.length >= limit) break
  }
  return selected
}

function mergeAndRankMatches(
  matches: SemanticMemoryMatch[],
  minScore: number,
): SemanticMemoryMatch[] {
  const bestById = new Map<string, SemanticMemoryMatch>()
  for (const match of matches) {
    if (match.score < minScore) continue
    const previous = bestById.get(match.id)
    if (!previous || match.score > previous.score) {
      bestById.set(match.id, match)
    }
  }
  return Array.from(bestById.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.mtimeMs - a.mtimeMs
  })
}

async function getOrCreateSemanticIndex(
  memoryDir: string,
  signal: AbortSignal,
): Promise<CachedIndex> {
  const headers = await scanMemoryFiles(memoryDir, signal)
  const fingerprint = headers
    .map(header => `${header.filePath}:${header.mtimeMs}`)
    .join('|')

  const cached = semanticIndexCache.get(memoryDir)
  if (cached && cached.fingerprint === fingerprint) {
    return cached
  }

  const store = new InMemoryVectorStoreAdapter()
  const snippetsById = new Map<string, IndexedSnippet>()
  const items: Array<{ id: string; text: string; metadata: Record<string, unknown> }> =
    []

  for (const header of headers) {
    const fileData = await readFileForIndexing(header.filePath, signal)
    if (!fileData) continue
    const parsed = parseFrontmatter(fileData, header.filePath)
    const snippetParts = chunkMemoryContent(parsed.content)

    for (let i = 0; i < snippetParts.length; i++) {
      const snippet = snippetParts[i]
      if (!snippet) continue
      const id = `${header.filePath}#${i}`
      snippetsById.set(id, {
        id,
        path: header.filePath,
        mtimeMs: header.mtimeMs,
        snippet,
      })
      items.push({
        id,
        text: `${header.filename}\n${header.description ?? ''}\n${snippet}`,
        metadata: {
          path: header.filePath,
          mtimeMs: header.mtimeMs,
        },
      })
    }
  }

  await store.upsert(items)

  const next: CachedIndex = {
    fingerprint,
    store,
    snippetsById,
  }
  semanticIndexCache.set(memoryDir, next)
  return next
}

async function readFileForIndexing(
  filePath: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const file = await readFileInRange(
      filePath,
      0,
      MAX_INDEX_LINES,
      MAX_INDEX_BYTES,
      signal,
      { truncateOnByteLimit: true },
    )
    return file.content
  } catch {
    return null
  }
}

function chunkMemoryContent(content: string): string[] {
  const normalized = content.replace(/\r/g, '').trim()
  if (!normalized) {
    return []
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const snippets: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= MAX_SNIPPET_CHARS) {
      snippets.push(paragraph)
      if (snippets.length >= MAX_SNIPPETS_PER_FILE) break
      continue
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/)
    let buffer = ''
    for (const sentence of sentences) {
      const next = buffer ? `${buffer} ${sentence}` : sentence
      if (next.length > MAX_SNIPPET_CHARS) {
        if (buffer) snippets.push(buffer)
        buffer = sentence
      } else {
        buffer = next
      }
      if (snippets.length >= MAX_SNIPPETS_PER_FILE) break
    }
    if (buffer && snippets.length < MAX_SNIPPETS_PER_FILE) {
      snippets.push(buffer)
    }
    if (snippets.length >= MAX_SNIPPETS_PER_FILE) break
  }

  if (snippets.length === 0) {
    return [normalized.slice(0, MAX_SNIPPET_CHARS)]
  }
  return snippets
}

type PersistedRamRecord = {
  id: string
  text: string
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

async function searchPersistedRamStore(options: {
  queryPlan: string[]
  topK: number
  minScore: number
}): Promise<SemanticMemoryMatch[]> {
  const metadataPath = getRamStoreMetadataPath()
  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return []
  }

  const records = readPersistedRamRecords(metadataPath)
  if (records.length === 0) {
    return []
  }

  const adapter = new InMemoryVectorStoreAdapter()
  const recordById = new Map<string, PersistedRamRecord>()
  await adapter.upsert(
    records.map(record => {
      const id = `ram:${record.id}`
      recordById.set(id, record)
      return {
        id,
        text: record.text,
        metadata: record.metadata,
      }
    }),
  )

  const scoreById = new Map<string, number>()
  for (let i = 0; i < options.queryPlan.length; i++) {
    const query = options.queryPlan[i]
    const queryBoost = i === 0 ? 1 : 0.9
    const results = await adapter.query({
      query,
      topK: Math.max(options.topK * 2, options.topK),
      minScore: options.minScore * 0.75,
    })
    for (const result of results) {
      const boosted = result.score * queryBoost
      const current = scoreById.get(result.id)
      if (current === undefined || boosted > current) {
        scoreById.set(result.id, boosted)
      }
    }
  }

  return Array.from(scoreById.entries())
    .map(([id, score]) => {
      const record = recordById.get(id)
      if (!record) return null
      const metadata = record.metadata ?? {}
      const timestamp =
        asString(metadata.timestamp) ?? record.updatedAt ?? record.createdAt
      const mtimeMs = timestamp ? Date.parse(timestamp) : Date.now()
      return {
        id,
        path:
          asString(metadata.absolutePath) ??
          asString(metadata.relativePath) ??
          `ram://record/${record.id}`,
        snippet: buildSnippet(record.text),
        score,
        mtimeMs: Number.isNaN(mtimeMs) ? Date.now() : mtimeMs,
      } satisfies SemanticMemoryMatch
    })
    .filter((match): match is SemanticMemoryMatch => match !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK)
}

function getRamStoreMetadataPath(): string | null {
  const configured = process.env[RAM_STORE_ENV]
  if (!configured) {
    return null
  }
  const trimmed = configured.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readPersistedRamRecords(metadataPath: string): PersistedRamRecord[] {
  try {
    const raw = fs.readFileSync(metadataPath, 'utf-8')
    const parsed = JSON.parse(raw) as { records?: unknown }
    if (!parsed || !Array.isArray(parsed.records)) {
      return []
    }
    return parsed.records
      .map(value => parsePersistedRamRecord(value))
      .filter((record): record is PersistedRamRecord => record !== null)
  } catch {
    return []
  }
}

function parsePersistedRamRecord(value: unknown): PersistedRamRecord | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const id = asString(candidate.id)
  const text = asString(candidate.text)
  if (!id || !text) return null
  return {
    id,
    text,
    metadata:
      candidate.metadata && typeof candidate.metadata === 'object'
        ? (candidate.metadata as Record<string, unknown>)
        : undefined,
    createdAt: asString(candidate.createdAt),
    updatedAt: asString(candidate.updatedAt),
  }
}

function buildSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_SNIPPET_CHARS) {
    return normalized
  }
  return `${normalized.slice(0, MAX_SNIPPET_CHARS - 3)}...`
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined
}

