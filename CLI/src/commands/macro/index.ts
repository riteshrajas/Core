import type { Command } from '../../types/command.js'

const macro = {
  type: 'local-jsx',
  name: 'macro',
  aliases: ['macros'],
  group: 'config',
  tags: ['automation', 'workflows'],
  description: 'Create and manage command macros (command sequences)',
  argumentHint: '[add|remove|list|run] [name] [commands...]',
  examples: [
    {
      description: 'Create a macro to autofix and commit',
      command: '/macro add fix-and-commit "autofix && commit"',
    },
    {
      description: 'List all defined macros',
      command: '/macro list',
    },
    {
      description: 'Run a macro',
      command: '/macro run fix-and-commit',
    },
    {
      description: 'Remove a macro',
      command: '/macro remove fix-and-commit',
    },
  ],
  load: () => import('./macro.js'),
} satisfies Command

export default macro
