import type { ToolUseContext } from '../Tool.js'

export interface DryRunOptions {
  enabled: boolean
  mode: 'preview' | 'interactive'
}

export const parseDryRunFlag = (args: string): [args: string, dryRunEnabled: boolean] => {
  const dryRunMatch = args.match(/--dry-run\b/i)
  if (dryRunMatch) {
    const cleanedArgs = args.replace(/--dry-run\b/i, '').trim()
    return [cleanedArgs, true]
  }
  return [args, false]
}

export const formatToolPreview = (
  toolName: string,
  operation: string,
  details: Record<string, string | number | boolean>,
): string => {
  let preview = `[DRY-RUN] ${toolName}: ${operation}\n`
  Object.entries(details).forEach(([key, value]) => {
    preview += `  ${key}: ${value}\n`
  })
  return preview
}

export const shouldShowDryRunPreview = (
  context: ToolUseContext,
  toolName: string,
  dryRunEnabled: boolean,
): boolean => {
  return dryRunEnabled && (context.permissions?.[toolName]?.mode === 'manual' || dryRunEnabled)
}
