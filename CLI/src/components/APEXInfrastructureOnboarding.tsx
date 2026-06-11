import React, { useEffect, useState } from 'react'
import { Box, Text } from '../ink.js'
import { Select } from './CustomSelect/index.js'
import {
  is9RouterCommandAvailable,
  startApexInfrastructure,
  probeApexInfrastructure,
} from '../services/apexInfrastructure/9router.js'
import { logForDebugging } from '../utils/debug.js'

type OnboardingPhase =
  | 'confirm'
  | 'checking'
  | 'starting'
  | 'waiting'
  | 'error'
  | 'complete'

type Props = {
  onDone(): void
}

export function APEXInfrastructureOnboarding({ onDone }: Props): React.ReactNode {
  const [phase, setPhase] = useState<OnboardingPhase>('confirm')
  const [errorMessage, setErrorMessage] = useState<string>('')

  async function handleConfirm() {
    setPhase('checking')
    logForDebugging('[Onboarding] User confirmed APEX Infrastructure setup')

    // Check if 9Router is installed
    const isInstalled = await is9RouterCommandAvailable()

    if (!isInstalled) {
      setErrorMessage(
        'Install 9Router first: npm install -g 9router, then restart APEX.',
      )
      setPhase('error')
      return
    }

    // 9Router is installed, try to start it
    setPhase('starting')
    try {
      startApexInfrastructure()
      logForDebugging('[Onboarding] Started 9Router process')

      // Wait 5 seconds for 9Router to initialize
      setPhase('waiting')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Probe for infrastructure readiness
      const probeResult = await probeApexInfrastructure()

      if (probeResult.status !== 'ready' && probeResult.status !== 'empty') {
        setErrorMessage(
          `Failed to reach 9Router: ${probeResult.status}. Ensure 9Router is running and try again.`,
        )
        setPhase('error')
        return
      }

      // Success: set env vars and proceed
      process.env.APEX_CODE_USE_APEX_INFRASTRUCTURE = '1'
      process.env.APEX_CODE_USE_9ROUTER = '1'
      logForDebugging('[Onboarding] APEX Infrastructure ready, env vars set')
      setPhase('complete')

      // Auto-advance after brief success indication
      await new Promise(resolve => setTimeout(resolve, 1000))
      onDone()
    } catch (err) {
      setErrorMessage(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      )
      setPhase('error')
    }
  }

  if (phase === 'confirm') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Box flexDirection="column">
          <Text bold>Use APEX Infrastructure (9Router)?</Text>
          <Text dimColor>
            APEX requires local 9Router for model routing and configuration.
          </Text>
          <Text dimColor>This enables multi-provider and local LLM support.</Text>
        </Box>
        <Select
          options={[
            { value: 'yes', label: 'Yes, set up APEX Infrastructure' },
            { value: 'no', label: 'No, exit for now' },
          ]}
          onChange={value => {
            if (value === 'yes') {
              void handleConfirm()
            } else {
              onDone()
            }
          }}
        />
        <Text dimColor>Enter to confirm · Esc to skip</Text>
      </Box>
    )
  }

  if (phase === 'checking') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>APEX Infrastructure Setup</Text>
        <Text>Checking if 9Router is installed…</Text>
      </Box>
    )
  }

  if (phase === 'starting') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>APEX Infrastructure Setup</Text>
        <Text>Starting 9Router…</Text>
      </Box>
    )
  }

  if (phase === 'waiting') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>APEX Infrastructure Setup</Text>
        <Text>Waiting for 9Router to initialize (5 seconds)…</Text>
      </Box>
    )
  }

  if (phase === 'error') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>APEX Infrastructure Setup Failed</Text>
        <Text color="red">{errorMessage}</Text>
        <Select
          options={[
            { value: 'exit', label: 'Exit and fix manually' },
            { value: 'retry', label: 'Retry' },
          ]}
          onChange={value => {
            if (value === 'retry') {
              setPhase('confirm')
            } else {
              process.exit(1)
            }
          }}
        />
      </Box>
    )
  }

  if (phase === 'complete') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>✓ APEX Infrastructure Ready</Text>
        <Text>9Router is running and models are loaded.</Text>
      </Box>
    )
  }

  return null
}
