import React, { useState, useEffect } from 'react'
import { Text, Box, useInput } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { settingsManager } from '../../services/settingsManager.js'

const SettingsBrowserComponent: React.FC<{
  search?: string
  onDone: (result?: string, options?: { display?: 'skip' | 'system' | 'user' }) => void
}> = ({ search, onDone }) => {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [currentProfile, setCurrentProfile] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useInput((input, key) => {
    if (key.escape || key.return || (key.ctrl && input === 'c')) {
      onDone(undefined, { display: 'skip' })
    }
  })

  useEffect(() => {
    ;(async () => {
      try {
        const allSettings = await settingsManager.getAllSettings()
        const profile = await settingsManager.getCurrentProfile()

        if (search) {
          const filtered = await settingsManager.searchSettings(search)
          setSettings(filtered)
        } else {
          setSettings(allSettings)
        }
        setCurrentProfile(profile)
      } catch (error) {
        setSettings({ error: String(error) })
      } finally {
        setLoading(false)
      }
    })()
  }, [search])

  if (loading) {
    return <Text>Loading settings...</Text>
  }

  if (Object.keys(settings).length === 0) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round">
        <Text>No settings found{search ? ` matching "${search}"` : ''}</Text>
        <Text dimColor marginTop={1}>Press Enter or Esc to exit</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      <Box marginBottom={1}>
        <Text bold underline>Settings Browser - Profile: {currentProfile}</Text>
      </Box>
      {search && (
        <Box marginBottom={1}>
          <Text dimColor>
            Search: <Text color="yellow">{search}</Text> ({Object.keys(settings).length} results)
          </Text>
        </Box>
      )}
      {Object.entries(settings).map(([key, value]) => (
        <Box key={key} flexDirection="column" marginLeft={2} marginBottom={1}>
          <Text>
            <Text color="cyan" bold>{key}</Text>
          </Text>
          <Box marginLeft={2}>
            <Text dimColor>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Text>
          </Box>
        </Box>
      ))}
      <Box marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
        <Text dimColor>
          Total: {Object.keys(settings).length} settings in profile "{currentProfile}"
        </Text>
        <Text marginLeft={2} dimColor italic>(Press Enter or Esc to exit)</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const searchMatch = args.match(/--search\s+(\S+)/)
  const search = searchMatch ? searchMatch[1] : undefined

  return <SettingsBrowserComponent search={search} onDone={onDone} />
}
