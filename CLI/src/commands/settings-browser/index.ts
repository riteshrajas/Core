import type { Command } from '../../types/command.js'

const settingsBrowser = {
  type: 'local-jsx',
  name: 'settings-browser',
  aliases: ['settings', 'config-browser'],
  group: 'config',
  tags: ['settings', 'configuration', 'browse', 'search'],
  description: 'Browse and search settings interactively',
  argumentHint: '[--search <keyword>] [--edit]',
  examples: [
    {
      description: 'Browse all settings',
      command: '/settings-browser',
    },
    {
      description: 'Search for specific settings',
      command: '/settings-browser --search timeout',
    },
    {
      description: 'Edit settings interactively',
      command: '/settings-browser --edit',
    },
  ],
  load: () => import('./settings-browser.js'),
} satisfies Command

export default settingsBrowser
