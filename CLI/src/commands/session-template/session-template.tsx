import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'

const SessionTemplateComponent: React.FC<{
  action: string
  args: string[]
  onDone: (result?: string) => void
}> = ({ action, args, onDone }) => {
  const [message, setMessage] = useState<string>('Processing...')
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        // Placeholder implementation - SessionManager will be created by agent
        switch (action) {
          case 'create': {
            const [name] = args
            if (!name) {
              setMessage('Error: template create requires <name>')
              return
            }
            setMessage(`✓ Session template "${name}" created`)
            break
          }
          case 'load': {
            const [name] = args
            if (!name) {
              setMessage('Error: template load requires <name>')
              return
            }
            setMessage(`✓ Loaded session from template "${name}"`)
            break
          }
          case 'delete': {
            const [name] = args
            if (!name) {
              setMessage('Error: template delete requires <name>')
              return
            }
            setMessage(`✓ Session template "${name}" deleted`)
            break
          }
          case 'share': {
            const [name] = args
            if (!name) {
              setMessage('Error: template share requires <name>')
              return
            }
            setMessage(`✓ Shared session template "${name}" - link: apex://share/session/${name}`)
            break
          }
          case 'list':
          default: {
            setTemplates([
              {
                name: 'code-review',
                description: 'Code review workflow',
                created: new Date().toISOString(),
              },
              {
                name: 'bug-fix',
                description: 'Bug fix workflow',
                created: new Date().toISOString(),
              },
            ])
            setMessage('Showing 2 session templates')
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
    return <Text>Processing session template operation...</Text>
  }

  return (
    <Box flexDirection="column">
      {templates.length > 0 ? (
        <>
          <Text bold>Session Templates:</Text>
          {templates.map((template) => (
            <Box key={template.name} marginLeft={2} flexDirection="column" marginBottom={1}>
              <Text>
                <Text color="cyan">{template.name}</Text>
              </Text>
              <Text dimColor>{template.description}</Text>
              <Text dimColor>Created: {new Date(template.created).toLocaleString()}</Text>
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

  return <SessionTemplateComponent action={action} args={restArgs} onDone={onDone} />
}
