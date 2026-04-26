import type {
  LocalJSXCommandCall,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { runSessionControlSubcommand } from '../session-control/runSessionControlSubcommand.js'

export const call: LocalJSXCommandCall = async (
  onDone: LocalJSXCommandOnDone,
  _context,
  args = '',
) => {
  if (!args.trim()) {
    onDone('Usage: /kill <session-id>', { display: 'system' })
    return null
  }

  const result = runSessionControlSubcommand('kill', args)
  if (result.type !== 'text') {
    onDone(undefined, { display: 'skip' })
    return null
  }
  onDone(result.value, { display: 'system' })
  return null
}
