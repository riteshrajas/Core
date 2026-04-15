import type { Command } from '../../commands.js'

const skillMarketplace = {
  type: 'local-jsx',
  name: 'skill-marketplace',
  aliases: ['marketplace', 'skills-browse', 'skills'],
  description: 'Browse and manage skills from the APEX marketplace',
  group: 'tools',
  tags: ['skills', 'plugins', 'marketplace', 'install'],
  examples: [
    {
      description: 'Browse all available skills',
      usage: 'skill-marketplace',
    },
    {
      description: 'Search for skills by keyword',
      usage: 'skill-marketplace --search "file analyzer"',
    },
    {
      description: 'Filter skills by category',
      usage: 'skill-marketplace --category "utilities"',
    },
    {
      description: 'Filter by minimum rating',
      usage: 'skill-marketplace --rating 4.0',
    },
    {
      description: 'Install a specific skill',
      usage: 'skill-marketplace --install "file-analyzer"',
    },
  ],
  load: () => import('./skill-marketplace.js'),
} satisfies Command

export default skillMarketplace
