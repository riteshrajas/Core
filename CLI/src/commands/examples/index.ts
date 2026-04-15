import type { Command } from '../../types/command.js'

const examples = {
  type: 'local-jsx',
  name: 'examples',
  aliases: ['ex'],
  group: 'utility',
  tags: ['help', 'learn', 'documentation'],
  description: 'Show command examples and usage patterns',
  argumentHint: '[command-name]',
  examples: [
    {
      description: 'Show examples for a specific command',
      command: '/examples commit',
    },
    {
      description: 'View trending command examples',
      command: '/examples --trending',
    },
  ],
  load: () => import('./examples.js'),
} satisfies Command

export default examples
