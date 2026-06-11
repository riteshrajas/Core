import React from 'react'
import { Box, Text } from '../ink.js'
import { Select } from './CustomSelect/index.js'
import { Dialog } from './design-system/Dialog.js'

export type APEXInfrastructureSetupChoice = 'install' | 'retry' | 'exit'

type Props = {
  mode: 'install' | 'configure' | 'auth' | 'error'
  detail?: string
  dashboardUrl: string
  onDone: (choice: APEXInfrastructureSetupChoice) => void
}

export function APEXInfrastructureSetupDialog({
  mode,
  detail,
  dashboardUrl,
  onDone,
}: Props): React.ReactNode {
  const isInstall = mode === 'install'
  const title = isInstall
    ? 'Install APEX Infrastructure?'
    : 'Configure APEX Infrastructure'

  return (
    <Dialog title={title} onCancel={() => onDone('exit')}>
      <Box flexDirection="column" gap={1}>
        {isInstall ? (
          <Text>
            APEX routes models through local 9Router, but the `9router` command
            is not installed yet.
          </Text>
        ) : mode === 'auth' ? (
          <Text>
            9Router is running but requires an API key. Set
            `APEX_CODE_9ROUTER_API_KEY`, then retry.
          </Text>
        ) : mode === 'configure' ? (
          <Text>
            9Router is running, but it did not return any configured models.
            Open the dashboard, connect providers or local models, then retry.
          </Text>
        ) : (
          <Text>APEX could not start or reach local 9Router.</Text>
        )}
        <Text dimColor>Dashboard: {dashboardUrl}</Text>
        {detail ? <Text color="warning">{detail}</Text> : null}
      </Box>
      <Select
        options={
          isInstall
            ? [
                { value: 'install' as const, label: 'Install 9Router now' },
                { value: 'exit' as const, label: 'Exit' },
              ]
            : [
                { value: 'retry' as const, label: 'Retry' },
                { value: 'exit' as const, label: 'Exit' },
              ]
        }
        onChange={onDone}
      />
    </Dialog>
  )
}
