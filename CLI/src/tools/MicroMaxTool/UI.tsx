import React from 'react'
import { Text, Box } from 'ink'
import type { Input, Output } from './MicroMaxTool.js'

export function renderToolUseMessage(input: Input) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">MicroMax</Text> •{' '}
        {input.action ? `Action: ${input.action}` : `Query: ${input.query}`}
      </Text>
      {input.target && (
        <Text color="gray">
          Target: {input.target} | Value: {JSON.stringify(input.value)}
        </Text>
      )}
    </Box>
  )
}

export function renderToolResultMessage(output: Output) {
  if (output.error) {
    return <Text color="red">Error: {output.error}</Text>
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="green">Response from Node:</Text>
      <Text>{JSON.stringify(output.data, null, 2)}</Text>
    </Box>
  )
}
