import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { getCommands } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'

type CommandGroup = 'code' | 'config' | 'planning' | 'tools' | 'integration' | 'admin' | 'utility'

const GROUPS: Record<CommandGroup, string> = {
  code: '💻 Code Operations',
  config: '⚙️ Configuration',
  planning: '📋 Planning & Tasks',
  tools: '🛠️ Tools & Integration',
  integration: '🔌 External Integration',
  admin: '👨‍💼 Administration',
  utility: '🔧 Utility',
}

const CommandListComponent: React.FC<{
  group?: CommandGroup
  search?: string
  context: ToolUseContext
  onDone: (result?: string) => void
}> = ({ group, search, context, onDone }) => {
  const [commands, setCommands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const cmds = await getCommands(context.cwd)
        let filtered = cmds.filter((cmd) => !cmd.isHidden && cmd.isEnabled?.() !== false)

        if (group) {
          filtered = filtered.filter((cmd) => cmd.group === group)
        }

        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (cmd) =>
              cmd.name.toLowerCase().includes(q) ||
              cmd.description.toLowerCase().includes(q) ||
              cmd.tags?.some((tag) => tag.toLowerCase().includes(q)),
          )
        }

        setCommands(filtered.sort((a, b) => a.name.localeCompare(b.name)))
      } finally {
        setLoading(false)
      }
    })()
  }, [context.cwd, group, search])

  if (loading) {
    return <Text>Loading commands...</Text>
  }

  if (commands.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No commands found{search ? ` matching "${search}"` : ''}</Text>
      </Box>
    )
  }

  const byGroup = commands.reduce(
    (acc, cmd) => {
      const g = cmd.group ?? 'utility'
      if (!acc[g]) acc[g] = []
      acc[g].push(cmd)
      return acc
    },
    {} as Record<CommandGroup, any[]>,
  )

  return (
    <Box flexDirection="column">
      {Object.entries(byGroup).map(([grp, cmds]) => (
        <Box key={grp} flexDirection="column" marginBottom={1}>
          <Text bold>{GROUPS[grp as CommandGroup]}</Text>
          {cmds.map((cmd) => (
            <Box key={cmd.name} marginLeft={2} flexDirection="column">
              <Text>
                <Text color="cyan">/{cmd.name}</Text>
                {cmd.aliases?.length ? (
                  <Text dimColor> (aliases: {cmd.aliases.join(', ')})</Text>
                ) : null}
              </Text>
              <Text dimColor>{cmd.description}</Text>
              {cmd.tags?.length ? <Text dimColor>Tags: {cmd.tags.join(', ')}</Text> : null}
            </Box>
          ))}
        </Box>
      ))}
      <Text>
        {'\n'}Found {commands.length} command{commands.length !== 1 ? 's' : ''}
      </Text>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const groupMatch = args.match(/--group\s+(\w+)/)
  const searchMatch = args.match(/--search\s+(.+?)(?=\s--|\s*$)/)

  const group = groupMatch ? (groupMatch[1] as CommandGroup) : undefined
  const search = searchMatch ? searchMatch[1].trim() : undefined

  onDone(undefined, { display: 'skip' })

  return <CommandListComponent group={group} search={search} context={context} onDone={onDone} />
}
