import { spawnSync } from 'child_process'
import type { LocalCommandResult } from '../../types/command.js'
import { isInBundledMode } from '../../utils/bundledMode.js'

function getSpawnCommandAndArgs(subcommand: string, rawArgs: string): {
  command: string
  args: string[]
} {
  const extraArgs = rawArgs.trim() ? rawArgs.trim().split(/\s+/) : []
  const subcommandArgs = [subcommand, ...extraArgs]

  if (isInBundledMode() || !process.argv[1]) {
    return {
      command: process.execPath,
      args: subcommandArgs,
    }
  }

  return {
    command: process.execPath,
    args: [process.argv[1], ...subcommandArgs],
  }
}

export function runSessionControlSubcommand(
  subcommand: string,
  rawArgs: string,
): LocalCommandResult {
  const { command, args } = getSpawnCommandAndArgs(subcommand, rawArgs)
  const primaryResult = spawnSync(command, args, {
    encoding: 'utf8',
  })

  const toMessage = (result: ReturnType<typeof spawnSync>): string => {
    const stdout = (result.stdout ?? '').trim()
    const stderr = (result.stderr ?? '').trim()
    const message = stderr || stdout || `Failed to run "${subcommand}"`
    if (message.includes('Script not found')) {
      return `Unable to run "${subcommand}" in this runtime. Try: APEX ${subcommand}${rawArgs.trim() ? ` ${rawArgs.trim()}` : ''}`
    }
    return message
  }

  if (primaryResult.status === 0) {
    const stdout = (primaryResult.stdout ?? '').trim()
    return {
      type: 'text',
      value: stdout || `${subcommand} completed`,
    }
  }

  const extraArgs = rawArgs.trim() ? rawArgs.trim().split(/\s+/) : []
  const fallbackArgs = [subcommand, ...extraArgs]

  for (const bin of ['APEX', 'apex']) {
    const fallbackResult = spawnSync(bin, fallbackArgs, {
      encoding: 'utf8',
    })
    if (fallbackResult.status === 0) {
      const stdout = (fallbackResult.stdout ?? '').trim()
      return {
        type: 'text',
        value: stdout || `${subcommand} completed`,
      }
    }
  }

  return {
    type: 'text',
    value: toMessage(primaryResult),
  }
}
