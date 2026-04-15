import type { Command } from '../../types/command.js'

const commands = {
  type: 'local-jsx',
  name: 'commands',
  aliases: ['cmd', 'cmd-list'],
  group: 'utility',
  tags: ['discovery', 'help', 'search'],
  description: 'Discover and search available commands',
  argumentHint: '[--group <name>] [--search <keyword>] [--suggest]',
  examples: [
    {
      description: 'List all available commands',
      command: '/commands',
    },
    {
      description: 'Filter commands by group',
      command: '/commands --group code',
    },
    {
      description: 'Search for commands by keyword',
      command: '/commands --search file',
    },
    {
      description: 'Get smart suggestions based on context',
      command: '/commands --suggest',
    },
  ],
  load: () => import('./commands.js'),
} satisfies Command

export default commands
