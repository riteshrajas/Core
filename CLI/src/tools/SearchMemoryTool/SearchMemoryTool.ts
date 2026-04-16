import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getAutoMemPath, isAutoMemoryEnabled } from '../../memdir/paths.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { SEARCH_MEMORY_TOOL_NAME } from './constants.js'
import { DESCRIPTION, PROMPT } from './prompt.js'
import {
  searchMemorySemantically,
  selectTopRagMatches,
} from './semanticSearch.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z
      .string()
      .min(1)
      .describe('Natural-language memory query to search semantically.'),
    topK: z
      .number()
      .int()
      .positive()
      .max(20)
      .optional()
      .default(5)
      .describe('Maximum number of semantic matches to return (default: 5).'),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Optional similarity threshold between 0 and 1.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    query: z.string(),
    decrypted_queries: z.array(z.string()),
    matches: z.array(
      z.object({
        path: z.string(),
        snippet: z.string(),
        score: z.number(),
        mtimeMs: z.number(),
      }),
    ),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const SearchMemoryTool = buildTool({
  name: SEARCH_MEMORY_TOOL_NAME,
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  shouldDefer: true,
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  isEnabled() {
    return isAutoMemoryEnabled()
  },
  renderToolUseMessage() {
    return null
  },
  async call({ query, topK, minScore }, context) {
    const result = await searchMemorySemantically({
      memoryDir: getAutoMemPath(),
      query,
      topK,
      minScore,
      signal: context.abortController.signal,
    })

    return {
      data: {
        query,
        decrypted_queries: result.decryptedQueries,
        matches: selectTopRagMatches(result.matches, topK).map(match => ({
          path: match.path,
          snippet: match.snippet,
          score: match.score,
          mtimeMs: match.mtimeMs,
        })),
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const output = content as Output
    if (output.matches.length === 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: `No relevant memory snippets found for "${output.query}".`,
      }
    }
    const lines = output.matches.map(
      (match, index) =>
        `${index + 1}. ${match.path} (score ${match.score.toFixed(3)})\n${match.snippet}`,
    )
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)

