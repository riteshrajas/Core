import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { settingsManager } from '../../services/settingsManager.js'

interface ParsedArgs {
  action: 'export' | 'import' | 'help'
  output?: string
  from?: string
  share?: boolean
  fromUrl?: string
  profile?: string
}

function parseArgs(argsString: string): ParsedArgs {
  const parts = argsString.trim().split(/\s+/)
  const action = (parts[0]?.toLowerCase() as any) || 'help'

  if (action !== 'export' && action !== 'import') {
    return { action: 'help' }
  }

  const parsed: ParsedArgs = { action }
  let i = 1

  while (i < parts.length) {
    const arg = parts[i]
    if (arg === '--output' && i + 1 < parts.length) {
      parsed.output = parts[++i]
    } else if (arg === '--from' && i + 1 < parts.length) {
      parsed.from = parts[++i]
    } else if (arg === '--from-url' && i + 1 < parts.length) {
      parsed.fromUrl = parts[++i]
    } else if (arg === '--share') {
      parsed.share = true
    } else if (arg === '--profile' && i + 1 < parts.length) {
      parsed.profile = parts[++i]
    }
    i++
  }

  return parsed
}

function generateShareLink(data: string): string {
  const encoded = Buffer.from(data).toString('base64')
  const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 12)
  return `apex://settings/${hash}/${encoded.slice(0, 64)}...`
}

function generateSettingsId(): string {
  return crypto.randomBytes(8).toString('hex')
}

const SettingsImportExportComponent: React.FC<{
  action: 'export' | 'import'
  parsed: ParsedArgs
  onDone: (result?: string) => void
}> = ({ action, parsed, onDone }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('Processing...')
  const [details, setDetails] = useState<string>('')
  const [profiles, setProfiles] = useState<string[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      try {
        if (action === 'export') {
          await handleExport()
        } else if (action === 'import') {
          await handleImport()
        }
      } catch (error) {
        setStatus('error')
        setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })()
  }, [])

  async function handleExport() {
    try {
      const profileToExport = parsed.profile || (await settingsManager.getCurrentProfile())
      const settingsData = await settingsManager.exportSettings(profileToExport)

      if (parsed.share) {
        const shareLink = generateShareLink(settingsData)
        const settingsId = generateSettingsId()
        setMessage(`✓ Settings exported and ready to share`)
        setDetails(`Share Link ID: ${settingsId}\nLink: ${shareLink}`)
        setStatus('success')
        onDone(`Settings exported from profile "${profileToExport}" - Ready to share`, {
          display: 'system',
        })
      } else if (parsed.output) {
        const outputPath = path.resolve(parsed.output)
        await fs.writeFile(outputPath, settingsData, 'utf-8')
        setMessage(`✓ Settings exported successfully`)
        setDetails(`Profile: ${profileToExport}\nFile: ${outputPath}`)
        setStatus('success')
        onDone(`Settings exported to ${parsed.output}`, { display: 'system' })
      } else {
        setMessage(`✓ Settings data ready`)
        setDetails(`Profile: ${profileToExport}\nSize: ${settingsData.length} bytes`)
        setStatus('success')
        onDone(`Settings from profile "${profileToExport}" exported`, { display: 'system' })
      }
    } catch (error) {
      throw error
    }
  }

  async function handleImport() {
    try {
      let settingsData: string

      if (parsed.from) {
        const filePath = path.resolve(parsed.from)
        settingsData = await fs.readFile(filePath, 'utf-8')
      } else if (parsed.fromUrl) {
        setMessage('Importing from URL...')
        const decoded = Buffer.from(parsed.fromUrl.split('/').pop() || '', 'base64').toString('utf-8')
        settingsData = decoded
      } else {
        throw new Error('Please specify --from <file> or --from-url <link>')
      }

      const targetProfile = parsed.profile || (await settingsManager.getCurrentProfile())
      await settingsManager.importSettings(settingsData, targetProfile)

      const imported = JSON.parse(settingsData)
      const settingCount = Object.keys(imported).length

      setMessage(`✓ Settings imported successfully`)
      setDetails(`Profile: ${targetProfile}\nSettings imported: ${settingCount}`)
      setStatus('success')
      onDone(`Imported ${settingCount} settings into profile "${targetProfile}"`, {
        display: 'system',
      })
    } catch (error) {
      throw error
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="row" gap={2} marginBottom={1}>
        <Text bold color={status === 'success' ? 'green' : status === 'error' ? 'red' : 'cyan'}>
          {status === 'loading' && '⟳'}
          {status === 'success' && '✓'}
          {status === 'error' && '✗'}
        </Text>
        <Text bold>{message}</Text>
      </Box>

      {details && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {details.split('\n').map((line, idx) => (
            <Text key={idx} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {status === 'loading' && (
        <Text dimColor>Please wait...</Text>
      )}

      {status === 'success' && action === 'export' && parsed.share && (
        <Box flexDirection="column" marginLeft={2} marginTop={1} gap={1}>
          <Text dimColor>To receive settings on another device:</Text>
          <Text dimColor>/settings-import-export import --from-url {details.split('\n')[1]?.replace('Link: ', '')}</Text>
        </Box>
      )}
    </Box>
  )
}

const HelpComponent: React.FC<{ onDone: (result?: string) => void }> = ({ onDone }) => {
  useEffect(() => {
    onDone('Settings Import/Export Help - Use /settings-import-export [export|import] with appropriate flags', {
      display: 'system',
    })
  }, [onDone])

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Text bold color="cyan">Settings Import/Export Usage</Text>

      <Box flexDirection="column" marginLeft={2} gap={1}>
        <Text bold>Export Commands:</Text>
        <Text dimColor>/settings-import-export export --output file.json</Text>
        <Text dimColor>/settings-import-export export --share</Text>
        <Text dimColor>/settings-import-export export --output backup.json --profile staging</Text>

        <Text bold marginTop={1}>Import Commands:</Text>
        <Text dimColor>/settings-import-export import --from file.json</Text>
        <Text dimColor>/settings-import-export import --from-url https://...</Text>
        <Text dimColor>/settings-import-export import --from file.json --profile staging</Text>

        <Text bold marginTop={1}>Options:</Text>
        <Text dimColor>--output FILE       Export to file path</Text>
        <Text dimColor>--share             Generate shareable link</Text>
        <Text dimColor>--from FILE         Import from file</Text>
        <Text dimColor>--from-url LINK     Import from share link</Text>
        <Text dimColor>--profile NAME      Target profile (default: current profile)</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const parsed = parseArgs(args)

  if (parsed.action === 'help') {
    return <HelpComponent onDone={onDone} />
  }

  return (
    <SettingsImportExportComponent
      action={parsed.action}
      parsed={parsed}
      onDone={onDone}
    />
  )
}
