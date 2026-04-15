import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { settingsManager } from '../../services/settingsManager.js'

const SettingsBrowserComponent: React.FC<{
  search?: string
  onDone: (result?: string) => void
}> = ({ search, onDone }) => {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [currentProfile, setCurrentProfile] = useState<string>('')
  const [loading, setLoading] = useState(true)

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
      <Box flexDirection="column">
        <Text>No settings found{search ? ` matching "${search}"` : ''}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>Profile: {currentProfile}</Text>
      {search && (
        <Text dimColor>
          Search: {search} ({Object.keys(settings).length} results)
        </Text>
      )}
      <Text>{'\n'}</Text>
      <Text bold>Settings:</Text>
      {Object.entries(settings).map(([key, value]) => (
        <Box key={key} flexDirection="column" marginLeft={2} marginBottom={1}>
          <Text>
            <Text color="cyan">{key}</Text>
          </Text>
          <Text dimColor>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </Text>
        </Box>
      ))}
      <Text dimColor>
        {'\n'}Total: {Object.keys(settings).length} settings in profile "{currentProfile}"
      </Text>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const searchMatch = args.match(/--search\s+(\S+)/)
  const search = searchMatch ? searchMatch[1] : undefined

  onDone(undefined, { display: 'skip' })

  return <SettingsBrowserComponent search={search} onDone={onDone} />
}
