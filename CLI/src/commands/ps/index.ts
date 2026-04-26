import type { Command } from '../../commands.js'

const ps = {
  type: 'local-jsx',
  name: 'ps',
  group: 'utility',
  tags: ['sessions', 'background'],
  description: 'List active and background sessions',
  load: () => import('./ps.js'),
} satisfies Command

export default ps
