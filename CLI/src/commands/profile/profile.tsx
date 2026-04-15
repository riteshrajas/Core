import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { settingsManager } from '../../services/settingsManager.js'

const ProfileManagementComponent: React.FC<{
  action: string
  args: string[]
  onDone: (result?: string) => void
}> = ({ action, args, onDone }) => {
  const [message, setMessage] = useState<string>('Processing...')
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentProfile, setCurrentProfile] = useState<string>('')

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
            setMessage(`✓ Profile "${name}" created`)
            break
          }
          case 'delete': {
            const [name] = args
            if (!name) {
              setMessage('Error: profile delete requires <name>')
              return
            }
            await settingsManager.deleteProfile(name)
            setMessage(`✓ Profile "${name}" deleted`)
            break
          }
          case 'use': {
            const [name] = args
            if (!name) {
              setMessage('Error: profile use requires <name>')
              return
            }
            await settingsManager.useProfile(name)
            setMessage(`✓ Switched to profile "${name}"`)
            break
          }
          case 'list':
          default: {
            const list = await settingsManager.listProfiles()
            const current = await settingsManager.getCurrentProfile()
            setProfiles(list)
            setCurrentProfile(current)
            setMessage(`Showing ${list.length} profile${list.length !== 1 ? 's' : ''}`)
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
    <Box flexDirection="column">
      {profiles.length > 0 ? (
        <>
          <Text bold>Available Profiles:</Text>
          {profiles.map((profile) => (
            <Box key={profile.name} marginLeft={2} flexDirection="column" marginBottom={1}>
              <Text>
                {currentProfile === profile.name ? (
                  <Text color="green">● </Text>
                ) : (
                  <Text>○ </Text>
                )}
                <Text color="cyan">{profile.name}</Text>
                {profile.description && (
                  <>
                    <Text> - </Text>
                    <Text dimColor>{profile.description}</Text>
                  </>
                )}
              </Text>
              <Text dimColor>Modified: {new Date(profile.updatedAt).toLocaleString()}</Text>
            </Box>
          ))}
        </>
      ) : (
        <Text>{message}</Text>
      )}
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const parts = args.trim().split(/\s+/)
  const action = parts[0] ?? 'list'
  const restArgs = parts.slice(1)

  onDone(undefined, { display: 'skip' })

  return <ProfileManagementComponent action={action} args={restArgs} onDone={onDone} />
}
