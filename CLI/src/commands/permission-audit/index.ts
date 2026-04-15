import type { Command } from '../../types/command.js'

const permissionAudit = {
  type: 'local-jsx',
  name: 'permission-audit',
  aliases: ['audit', 'permissions-audit'],
  group: 'admin',
  tags: ['security', 'audit', 'permissions', 'compliance'],
  description: 'Audit and manage permission decisions and policies',
  argumentHint: '[--filter-tool <name>] [--action allow|deny|skip] [--start-date <date>] [--end-date <date>] [--export <path>]',
  examples: [
    {
      description: 'View recent permission audit log entries',
      command: '/permission-audit',
    },
    {
      description: 'Filter audit logs by specific tool',
      command: '/permission-audit --filter-tool git',
    },
    {
      description: 'View denied operations only',
      command: '/permission-audit --action deny',
    },
    {
      description: 'Generate audit report for date range',
      command: '/permission-audit --start-date 2024-01-01 --end-date 2024-01-31',
    },
    {
      description: 'Export audit logs to file',
      command: '/permission-audit --export ./audit-logs.json',
    },
    {
      description: 'View permission policies',
      command: '/permission-audit policies',
    },
  ],
  load: () => import('./permission-audit.js'),
} satisfies Command

export default permissionAudit
