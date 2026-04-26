import type {
  LocalJSXCommandCall,
  LocalJSXCommandOnDone,
} from '../../types/command.js'

export const call: LocalJSXCommandCall = async (
  onDone: LocalJSXCommandOnDone,
  _context,
  args = '',
) => {
  const sessionId = args.trim()

  if (!sessionId) {
    onDone('Usage: /attach <session-id>', { display: 'system' })
    return null
  }

  onDone(`Run "APEX attach ${sessionId}" in your terminal to attach interactively.`, {
    display: 'system',
  })
  return null
}
