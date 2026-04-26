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
  const result = runSessionControlSubcommand('ps', args)
  if (result.type !== 'text') {
    onDone(undefined, { display: 'skip' })
    return null
  }
  onDone(result.value, { display: 'system' })
  return null
}
