import type { Command } from '../../types/command.js'

const profile = {
  type: 'local-jsx',
  name: 'profile',
  group: 'config',
  tags: ['settings', 'profiles', 'configuration'],
  description: 'Manage settings profiles (create, list, use, delete)',
  argumentHint: '[create|list|use|delete] [profile-name]',
  examples: [
    {
      description: 'Create a new profile',
      command: '/profile create work-mode',
    },
    {
      description: 'List all profiles',
      command: '/profile list',
    },
    {
      description: 'Switch to a profile',
      command: '/profile use work-mode',
    },
    {
      description: 'Delete a profile',
      command: '/profile delete work-mode',
    },
  ],
  load: () => import('./profile.js'),
} satisfies Command

export default profile
