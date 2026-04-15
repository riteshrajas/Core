import type { Command } from '../../types/command.js'

const dryrun = {
  type: 'local-jsx',
  name: 'dryrun',
  aliases: ['dry-run'],
  group: 'utility',
  tags: ['preview', 'safety', 'execution-control'],
  description: 'Preview commands without executing them',
  argumentHint: '[command to preview]',
  examples: [
    {
      description: 'Preview a bash command without running it',
      command: 'bash "rm -rf /" --dry-run',
    },
    {
      description: 'Preview file operations',
      command: '/commit --dry-run',
    },
    {
      description: 'Interactively approve each operation',
      command: '/autofix --dry-run --confirm-each',
    },
  ],
  load: () => import('./dryrun.js'),
} satisfies Command

export default dryrun
