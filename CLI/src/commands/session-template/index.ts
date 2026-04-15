import type { Command } from '../../types/command.js'

const sessionTemplate = {
  type: 'local-jsx',
  name: 'session-template',
  aliases: ['session', 'template', 'session-load'],
  group: 'planning',
  tags: ['sessions', 'templates', 'workflows'],
  description: 'Create and manage session templates for common workflows',
  argumentHint: '[create|list|load|delete|share] [template-name]',
  examples: [
    {
      description: 'Create a new session template',
      command: '/session-template create code-review',
    },
    {
      description: 'List all session templates',
      command: '/session-template list',
    },
    {
      description: 'Load and resume from a template',
      command: '/session-template load code-review',
    },
    {
      description: 'Share a session template with others',
      command: '/session-template share code-review',
    },
  ],
  load: () => import('./session-template.js'),
} satisfies Command

export default sessionTemplate
