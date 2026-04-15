import type { Command } from '../../types/command.js'

const alias = {
  type: 'local-jsx',
  name: 'alias',
  aliases: ['aliases'],
  group: 'config',
  tags: ['shortcuts', 'custom-commands'],
  description: 'Manage command aliases and shortcuts',
  argumentHint: '[add|remove|list] [name] [target]',
  examples: [
    {
      description: 'Create an alias "cm" for "commit"',
      command: '/alias add cm commit',
    },
    {
      description: 'Remove an alias',
      command: '/alias remove cm',
    },
    {
      description: 'List all aliases',
      command: '/alias list',
    },
  ],
  load: () => import('./alias.js'),
} satisfies Command

export default alias
