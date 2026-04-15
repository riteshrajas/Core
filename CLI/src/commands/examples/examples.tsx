import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { getCommands } from '../../commands.js'
import { metricsTracker } from '../../services/metricsTracker.js'
import type { ToolUseContext } from '../../Tool.js'

const ExamplesComponent: React.FC<{
  commandName?: string
  trending?: boolean
  context: ToolUseContext
  onDone: (result?: string) => void
}> = ({ commandName, trending, context, onDone }) => {
  const [content, setContent] = useState<React.ReactNode>(<Text>Loading examples...</Text>)

  useEffect(() => {
    ;(async () => {
      try {
        const cmds = await getCommands(context.cwd)

        if (trending) {
          const trendingMetrics = await metricsTracker.getTrendingCommands(5)
          const trendingCommands = cmds.filter((cmd) =>
            trendingMetrics.some((m) => m.commandName === cmd.name),
          )

          if (trendingCommands.length === 0) {
            setContent(<Text>No trending commands yet. Try some commands to build history!</Text>)
            return
          }

          setContent(
            <Box flexDirection="column">
              <Text bold>📈 Trending Commands</Text>
              {trendingCommands.map((cmd) => (
                <Box key={cmd.name} flexDirection="column" marginBottom={1} marginLeft={2}>
                  <Text>
                    <Text color="cyan">/{cmd.name}</Text>
                  </Text>
                  {cmd.examples?.length ? (
                    <>
                      <Text dimColor>Examples:</Text>
                      {cmd.examples.map((ex, i) => (
                        <Box key={i} flexDirection="column" marginLeft={2}>
                          <Text dimColor>{ex.description}</Text>
                          <Text color="green">{ex.command}</Text>
                        </Box>
                      ))}
                    </>
                  ) : (
                    <Text dimColor>No examples available</Text>
                  )}
                </Box>
              ))}
            </Box>,
          )
        } else if (commandName) {
          const cmd = cmds.find((c) => c.name === commandName || c.aliases?.includes(commandName))

          if (!cmd) {
            setContent(<Text>Command "{commandName}" not found</Text>)
            return
          }

          setContent(
            <Box flexDirection="column">
              <Text bold>Examples for /{cmd.name}</Text>
              <Text dimColor>{cmd.description}</Text>
              {cmd.examples?.length ? (
                <>
                  <Text>{'\n'}</Text>
                  {cmd.examples.map((ex, i) => (
                    <Box key={i} flexDirection="column" marginBottom={1} marginLeft={2}>
                      <Text dimColor>{ex.description}</Text>
                      <Text color="green">{ex.command}</Text>
                    </Box>
                  ))}
                </>
              ) : (
                <Text dimColor>No examples available for this command</Text>
              )}
            </Box>,
          )
        } else {
          const cmdsWithExamples = cmds.filter((cmd) => cmd.examples?.length)
          setContent(
            <Box flexDirection="column">
              <Text bold>Commands with Examples ({cmdsWithExamples.length})</Text>
              {cmdsWithExamples.slice(0, 10).map((cmd) => (
                <Box key={cmd.name} flexDirection="column" marginBottom={1} marginLeft={2}>
                  <Text color="cyan">/{cmd.name}</Text>
                  {cmd.examples?.slice(0, 2).map((ex, i) => (
                    <Box key={i} flexDirection="column" marginLeft={2}>
                      <Text dimColor>{ex.description}</Text>
                      <Text color="green" dimColor>
                        {ex.command}
                      </Text>
                    </Box>
                  ))}
                </Box>
              ))}
              <Text>{'\n'}Use: /examples [command-name] to see all examples</Text>
            </Box>,
          )
        }
      } catch (error) {
        setContent(<Text color="red">Error loading examples: {String(error)}</Text>)
      }
    })()
  }, [commandName, trending, context.cwd])

  useEffect(() => {
    onDone(undefined, { display: 'skip' })
  }, [onDone])

  return content as React.ReactElement
}

export const call: LocalJSXCommandCall = async (onDone, context, args) => {
  const trendingMatch = args.match(/--trending/)
  const trending = !!trendingMatch
  const commandName = args.replace(/--trending/, '').trim()

  return <ExamplesComponent commandName={commandName || undefined} trending={trending} context={context} onDone={onDone} />
}
