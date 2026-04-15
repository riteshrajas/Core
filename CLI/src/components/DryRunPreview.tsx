import React from 'react'
import { Text, Box } from 'ink'

export interface DryRunPreviewProps {
  toolName: string
  operation: string
  details: Record<string, string | number | boolean | string[]>
  confirmed: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

export const DryRunPreview: React.FC<DryRunPreviewProps> = ({
  toolName,
  operation,
  details,
  confirmed,
  onConfirm,
  onCancel,
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1} marginBottom={1}>
      <Text bold color="yellow">
        🔍 DRY-RUN PREVIEW
      </Text>
      <Text>
        <Text bold>{toolName}</Text>
        {' - '}
        <Text>{operation}</Text>
      </Text>

      {Object.entries(details).map(([key, value]) => {
        const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
        return (
          <Box key={key} flexDirection="column" marginLeft={2}>
            <Text>
              <Text color="cyan">{key}:</Text>
              {' '}
              <Text>{displayValue}</Text>
            </Text>
          </Box>
        )
      })}

      {!confirmed && (
        <Box marginTop={1} flexDirection="row">
          <Text color="green" bold onPress={onConfirm}>
            ✓ Execute
          </Text>
          <Text> | </Text>
          <Text color="red" bold onPress={onCancel}>
            ✗ Cancel
          </Text>
        </Box>
      )}

      {confirmed && <Text color="green">✓ Confirmed - proceeding with execution</Text>}
    </Box>
  )
}

export const formatDryRunPreview = (
  toolName: string,
  operation: string,
  details: Record<string, string | number | boolean | string[]>,
): string => {
  let preview = `[DRY-RUN] ${toolName}: ${operation}\n`
  Object.entries(details).forEach(([key, value]) => {
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
    preview += `  ${key}: ${displayValue}\n`
  })
  return preview
}
