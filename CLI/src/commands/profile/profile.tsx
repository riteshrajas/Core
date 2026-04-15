import React, { useState, useEffect } from 'react'
import { Text, Box, useInput } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { settingsManager } from '../../services/settingsManager.js'

const ProfileManagementComponent: React.FC<{
  action: string
  args: string[]
  onDone: (result?: string, options?: { display?: 'skip' | 'system' | 'user' }) => void
}> = ({ action, args, onDone }) => {
  const [message, setMessage] = useState<string>('Processing...')
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentProfile, setCurrentProfile] = useState<string>('')

  useInput((input, key) => {
    if (key.escape || key.return || (key.ctrl && input === 'c')) {
      onDone(undefined, { display: 'skip' })
    }
  })

  useEffect(() => {
    ;(async () => {
      try {
        switch (action) {
          case 'create': {
            const [name, ...desc] = args
            if (!name) {
              setMessage('Error: profile create requires <name>')
              return
            }
            await settingsManager.createProfile(name, desc.join(' '))
            setMessage(`✓ Profile "${name}" created. Press Enter/Esc to exit.`)
            break
          }
          case 'delete': {
            const [name] = args
            if (!name) {
              setMessage('Error: profile delete requires <name>')
              return
            }
            await settingsManager.deleteProfile(name)
            setMessage(`✓ Profile "${name}" deleted. Press Enter/Esc to exit.`)
            break
          }
          case 'use': {
            const [name] = args
            if (!name) {
              setMessage('Error: profile use requires <name>')
              return
            }
            await settingsManager.useProfile(name)
            setMessage(`✓ Switched to profile "${name}". Press Enter/Esc to exit.`)
            break
          }
          case 'list':
          default: {
            const list = await settingsManager.listProfiles()
            const current = await settingsManager.getCurrentProfile()
            setProfiles(list)
            setCurrentProfile(current)
            setMessage(`Showing ${list.length} profile${list.length !== 1 ? 's' : ''}. Press Enter/Esc to exit.`)
            break
          }
        }
      } catch (error) {
        setMessage(`Error: ${String(error)}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [action, args])

  if (loading) {
    return <Text>Processing profile operation...</Text>
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      {profiles.length > 0 ? (
        <>
          <Box marginBottom={1}>
            <Text bold underline>Available Profiles</Text>
          </Box>
          {profiles.map((profile) => (
            <Box key={profile.name} marginLeft={2} flexDirection="column" marginBottom={1}>
              <Text>
                {currentProfile === profile.name ? (
                  <Text color="green">● </Text>
                ) : (
                  <Text>○ </Text>
                )}
                <Text color="cyan" bold>{profile.name}</Text>
                {profile.description && (
                  <>
                    <Text> - </Text>
                    <Text dimColor italic>{profile.description}</Text>
                  </>
                )}
              </Text>
              <Box marginLeft={2}>
                <Text dimColor size="small">Modified: {new Date(profile.updatedAt).toLocaleString()}</Text>
              </Box>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>Press Enter or Esc to exit</Text>
          </Box>
        </>
      ) : (
        <Box flexDirection="column">
          <Text>{message}</Text>
          <Text dimColor marginTop={1}>Press Enter or Esc to exit</Text>
        </Box>
      )}
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const parts = args.trim().split(/\s+/)
  const action = parts[0] ?? 'list'
  const restArgs = parts.slice(1)

  return <ProfileManagementComponent action={action} args={restArgs} onDone={onDone} />
}
