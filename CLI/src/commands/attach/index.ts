import type { Command } from '../../commands.js'

const attach = {
  type: 'local-jsx',
  name: 'attach',
  group: 'utility',
  tags: ['sessions', 'background'],
  description: 'Show how to re-attach to a background session',
  argumentHint: '<session-id>',
  load: () => import('./attach.js'),
} satisfies Command

export default attach
