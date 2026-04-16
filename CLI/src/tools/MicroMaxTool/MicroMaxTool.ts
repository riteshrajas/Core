import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import { z } from 'zod'
import { buildTool, type ToolDef, type ToolUseContext } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  DESCRIPTION,
  PROMPT,
  MICROMAX_TOOL_NAME,
} from './prompt.js'
import { renderToolResultMessage, renderToolUseMessage } from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    query: z
      .enum(['WHO_ARE_YOU', 'GET_STATUS', 'GET_TELEMETRY', 'GET_CAPABILITIES'])
      .optional()
      .describe('The query to send to the node'),
    action: z
      .enum(['SET_STATE', 'SET_ROLE', 'SET_RGB', 'SET_RELAY', 'SET_SERVO', 'BUZZ'])
      .optional()
      .describe('The action to perform on the node'),
    target: z.string().optional().describe('Target component (e.g., LED_01, RELAY_01)'),
    value: z.any().optional().describe('Value for the action'),
    port: z.string().optional().describe('Serial port (defaults to auto-detect)'),
  })
)

type InputSchema = ReturnType<typeof inputSchema>
export type Input = z.infer<InputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    data: z.any().optional(),
    error: z.string().optional(),
  })
)

type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const MicroMaxTool = buildTool({
  name: MICROMAX_TOOL_NAME,
  searchHint: 'control micromax hardware nodes',
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    return true
  },
  isReadOnly(input: Input) {
    return !!input.query
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  async call(input: Input, context: ToolUseContext) {
    const { action, query, target, value, port = 'auto' } = input

    // High-impact action check
    const isHighImpact = action === 'SET_RELAY' || action === 'SET_SERVO' || action === 'BUZZ'
    if (isHighImpact && !context.isUserConfirmed) {
      // In a real implementation, we would trigger a confirmation tool here or 
      // return a result asking for confirmation. For now, we follow the pattern.
    }

    // Serial Communication Logic (Draft)
    // 1. Detect port if 'auto'
    // 2. Open port
    // 3. Send JSON
    // 4. Wait for response with timeout
    // 5. Close port (or keep a singleton for performance)

    // For now, returning a mock response to allow development to continue
    return {
      data: {
        node_id: 'MMX-SIM-01',
        status: 'OK',
        result: action ? 'ACTION_SUCCESS' : 'QUERY_RESULT',
        payload: { action, query, target, value }
      }
    }
  },
  renderToolUseMessage,
  renderToolResultMessage,
} satisfies ToolDef<InputSchema, Output>)
