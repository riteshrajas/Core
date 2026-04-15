import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { aliasManager } from '../../services/aliasManager.js'

const AliasManagementComponent: React.FC<{
  action: string
  args: string[]
  onDone: (result?: string) => void
}> = ({ action, args, onDone }) => {
  const [message, setMessage] = useState<string>('Processing...')
  const [aliases, setAliases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        switch (action) {
          case 'add': {
            const [name, target, ...desc] = args
            if (!name || !target) {
              setMessage('Error: alias add requires <name> and <target>')
              return
            }
            await aliasManager.addAlias(name, target, desc.join(' '))
            setMessage(`✓ Alias "${name}" → "${target}" created`)
            break
          }
          case 'remove': {
            const [name] = args
            if (!name) {
              setMessage('Error: alias remove requires <name>')
              return
            }
            await aliasManager.removeAlias(name)
            setMessage(`✓ Alias "${name}" removed`)
            break
          }
          case 'list':
          default: {
            const list = await aliasManager.listAliases()
            setAliases(list)
            setMessage(`Showing ${list.length} alias${list.length !== 1 ? 'es' : ''}`)
            break
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [action, args])

  if (loading) {
    return <Text>Processing alias operation...</Text>
  }

  return (
    <Box flexDirection="column">
      {aliases.length > 0 ? (
        <>
          <Text bold>Current Aliases:</Text>
          {aliases.map((alias) => (
            <Box key={alias.name} marginLeft={2} flexDirection="column">
              <Text>
                <Text color="cyan">{alias.name}</Text>
                <Text> → </Text>
                <Text color="green">{alias.target}</Text>
              </Text>
              {alias.description && <Text dimColor>{alias.description}</Text>}
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

  return <AliasManagementComponent action={action} args={restArgs} onDone={onDone} />
}
