import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { aliasManager } from '../../services/aliasManager.js'

const MacroManagementComponent: React.FC<{
  action: string
  args: string[]
  onDone: (result?: string) => void
}> = ({ action, args, onDone }) => {
  const [message, setMessage] = useState<string>('Processing...')
  const [macros, setMacros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        switch (action) {
          case 'add': {
            const [name, ...cmdParts] = args
            if (!name || cmdParts.length === 0) {
              setMessage('Error: macro add requires <name> and <commands>')
              return
            }
            const commands = cmdParts.join(' ').split('&&').map((cmd) => cmd.trim())
            await aliasManager.addMacro(name, commands, `Macro with ${commands.length} commands`)
            setMessage(`✓ Macro "${name}" created with ${commands.length} command(s)`)
            break
          }
          case 'remove': {
            const [name] = args
            if (!name) {
              setMessage('Error: macro remove requires <name>')
              return
            }
            await aliasManager.removeMacro(name)
            setMessage(`✓ Macro "${name}" removed`)
            break
          }
          case 'list':
          default: {
            const list = await aliasManager.listMacros()
            setMacros(list)
            setMessage(`Showing ${list.length} macro${list.length !== 1 ? 's' : ''}`)
            break
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [action, args])

  if (loading) {
    return <Text>Processing macro operation...</Text>
  }

  return (
    <Box flexDirection="column">
      {macros.length > 0 ? (
        <>
          <Text bold>Defined Macros:</Text>
          {macros.map((macro) => (
            <Box key={macro.name} marginLeft={2} flexDirection="column" marginBottom={1}>
              <Text>
                <Text color="cyan">{macro.name}</Text>
              </Text>
              <Text dimColor>Commands: {macro.commands.join(' → ')}</Text>
              {macro.description && <Text dimColor>{macro.description}</Text>}
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

  return <MacroManagementComponent action={action} args={restArgs} onDone={onDone} />
}
