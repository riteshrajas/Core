import type { Command } from '../../commands.js'

const errorRecovery: Command = {
  type: 'local-jsx',
  name: 'error-recovery',
  aliases: ['error', 'recovery', 'retry'],
  description: 'View, analyze, and recover from errors',
  group: 'utility',
  tags: ['error-handling', 'recovery', 'troubleshooting'],
  examples: [
    {
      usage: 'error-recovery',
      description: 'View recent errors and recovery suggestions',
    },
    {
      usage: 'error-recovery',
      description: 'Analyze error patterns and recovery rate statistics',
    },
    {
      usage: 'error-recovery',
      description: 'Filter errors by category (network, permission, timeout, etc.)',
    },
    {
      usage: 'error-recovery',
      description: 'Retry failed operations with recovery strategies',
    },
  ],
  relatedCommands: ['doctor', 'logs'],
  load: () => import('./error-recovery.js'),
}

export default errorRecovery
