const DEFAULT_TOP_K = 5
const MIN_TOP_K = 1
const MAX_TOP_K = 20
const DEFAULT_MIN_SCORE = 0.2

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
])

const SYNONYM_MAP: Record<string, readonly string[]> = {
  auth: ['authentication', 'login', 'token', 'credential'],
  login: ['authentication', 'auth', 'sign in', 'token'],
  token: ['session', 'auth token', 'credential'],
  bug: ['issue', 'failure', 'regression', 'error'],
  crash: ['failure', 'exception', 'panic', 'error'],
  deploy: ['deployment', 'release', 'rollout', 'ship'],
  incident: ['outage', 'production issue', 'postmortem'],
  test: ['testing', 'unit test', 'integration test', 'verification'],
  perf: ['performance', 'latency', 'slow', 'optimize'],
  memory: ['context', 'recall', 'remember'],
}

export type DecryptedMemorySearch = {
  queries: string[]
  topK: number
  minScore: number
  keyTerms: string[]
}

export function decryptMemoryQuery(
  query: string,
  options?: {
    topK?: number
    minScore?: number
  },
): DecryptedMemorySearch {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) {
    return {
      queries: [],
      topK: DEFAULT_TOP_K,
      minScore: DEFAULT_MIN_SCORE,
      keyTerms: [],
    }
  }

  const keyTerms = extractKeyTerms(normalizedQuery)
  const expandedQueries = new Set<string>([normalizedQuery])

  for (const term of keyTerms) {
    const synonyms = SYNONYM_MAP[term]
    if (!synonyms) continue
    for (const synonym of synonyms) {
      expandedQueries.add(`${normalizedQuery} ${synonym}`)
      if (expandedQueries.size >= 8) break
    }
    if (expandedQueries.size >= 8) break
  }

  if (keyTerms.length >= 2) {
    expandedQueries.add(keyTerms.slice(0, 2).join(' '))
  }

  return {
    queries: Array.from(expandedQueries),
    topK: normalizeTopK(options?.topK),
    minScore: normalizeMinScore(options?.minScore, normalizedQuery),
    keyTerms,
  }
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

function extractKeyTerms(query: string): string[] {
  const terms = query
    .split(/[^a-z0-9]+/)
    .map(t => t.trim())
    .filter(
      t => t.length >= 3 && !STOP_WORDS.has(t) && !/^\d+$/.test(t),
    )
  return Array.from(new Set(terms)).slice(0, 8)
}

function normalizeTopK(topK: number | undefined): number {
  if (topK === undefined) return DEFAULT_TOP_K
  if (!Number.isFinite(topK)) return DEFAULT_TOP_K
  const rounded = Math.round(topK)
  return Math.max(MIN_TOP_K, Math.min(MAX_TOP_K, rounded))
}

function normalizeMinScore(
  minScore: number | undefined,
  normalizedQuery: string,
): number {
  if (minScore !== undefined && Number.isFinite(minScore)) {
    return Math.max(0, Math.min(1, minScore))
  }
  if (normalizedQuery.split(' ').length >= 8) {
    return 0.14
  }
  return DEFAULT_MIN_SCORE
}

