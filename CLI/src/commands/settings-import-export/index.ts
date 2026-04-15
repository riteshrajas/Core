import type { Command } from '../../types/command.js'

const settingsImportExport = {
  type: 'local-jsx',
  name: 'settings-import-export',
  aliases: ['settings-backup', 'settings-sync'],
  group: 'config',
  tags: ['settings', 'import', 'export', 'backup', 'sync'],
  description: 'Import and export settings profiles with backup and sharing capabilities',
  argumentHint: '[export|import] [--output|--from|--share|--from-url] [value]',
  examples: [
    {
      description: 'Export current settings to a JSON file',
      command: '/settings-import-export export --output settings.json',
    },
    {
      description: 'Export settings and get a shareable link',
      command: '/settings-import-export export --share',
    },
    {
      description: 'Import settings from a JSON file',
      command: '/settings-import-export import --from settings.json',
    },
    {
      description: 'Import settings from a shared link',
      command: '/settings-import-export import --from-url https://...',
    },
    {
      description: 'Export a specific profile',
      command: '/settings-import-export export --output backup.json --profile production',
    },
    {
      description: 'Import settings into a specific profile',
      command: '/settings-import-export import --from settings.json --profile staging',
    },
  ],
  load: () => import('./settings-import-export.js'),
} satisfies Command

export default settingsImportExport
