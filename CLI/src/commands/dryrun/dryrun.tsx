import React from 'react'
import { Text, Box } from 'ink'
import type { LocalJSXCommandCall } from '../../types/command.js'

const DryRunHelpComponent: React.FC<{ onDone: (result?: string) => void }> = ({ onDone }) => {
  React.useEffect(() => {
    onDone(undefined, { display: 'skip' })
  }, [onDone])

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        🔍 Dry-Run Mode Guide
      </Text>
      <Text>{'\n'}Dry-run mode allows you to preview commands before execution.</Text>

      <Text bold marginTop={1}>
        {'\n'}How to use:
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>1. Add <Text color="green">--dry-run</Text> flag to any command</Text>
        <Text>2. Preview what would happen without making changes</Text>
        <Text>3. Confirm to execute or cancel to abort</Text>
      </Box>

      <Text bold marginTop={1}>
        {'\n'}Supported operations:
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>✓ Bash commands</Text>
        <Text>✓ PowerShell commands</Text>
        <Text>✓ File edits</Text>
        <Text>✓ Git operations</Text>
      </Box>

      <Text bold marginTop={1}>
        {'\n'}Examples:
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green">bash "git reset --hard" --dry-run</Text>
          <Text dimColor>Preview destructive command</Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green">/autofix --dry-run</Text>
          <Text dimColor>Preview auto-fixes before applying</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="green">/commit --dry-run --confirm-each</Text>
          <Text dimColor>Review each file before committing</Text>
        </Box>
      </Box>

      <Text bold marginTop={1}>
        {'\n'}Tips:
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>• Use dry-run for destructive operations</Text>
        <Text>• Combine with <Text color="yellow">--confirm-each</Text> for interactive approval</Text>
        <Text>• Safe for all commands - no changes unless confirmed</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone) => {
  return <DryRunHelpComponent onDone={onDone} />
}
