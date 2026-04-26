import type { Command } from '../../commands.js'

const kill = {
  type: 'local-jsx',
  name: 'kill',
  group: 'utility',
  tags: ['sessions', 'background'],
  description: 'Terminate a background session',
  argumentHint: '<session-id>',
  load: () => import('./kill.js'),
} satisfies Command

export default kill
