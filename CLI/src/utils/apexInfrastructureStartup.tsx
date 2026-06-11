import React from 'react'
import { Text } from '../ink.js'
import type { Root } from '../ink.js'
import {
  APEXInfrastructureSetupDialog,
  type APEXInfrastructureSetupChoice,
} from '../components/APEXInfrastructureSetupDialog.js'
import { showSetupDialog } from '../interactiveHelpers.js'
import {
  getApexInfrastructureDashboardUrl,
  installApexInfrastructure,
  is9RouterCommandAvailable,
  persistApexInfrastructureModels,
  probeApexInfrastructure,
  startApexInfrastructure,
  waitForApexInfrastructure,
  type ApexInfrastructureProbeResult,
} from '../services/apexInfrastructure/9router.js'
import { logForDebugging } from './debug.js'
import { getAPIProvider } from './model/providers.js'

type StartupResult =
  | { ready: true }
  | {
      ready: false
      message: string
    }

function resultToMessage(result: ApexInfrastructureProbeResult): string {
  switch (result.status) {
    case 'auth-required':
      return `9Router requires an API key. Set APEX_CODE_9ROUTER_API_KEY and restart APEX.`
    case 'empty':
      return `9Router is running, but no models are configured. Open ${getApexInfrastructureDashboardUrl()} and connect providers or local models.`
    case 'error':
      return result.error
    case 'not-running':
      return `9Router is not running: ${result.error}`
    case 'ready':
      return ''
  }
}

async function launchSetupDialog(
  root: Root,
  mode: 'install' | 'configure' | 'auth' | 'error',
  detail?: string,
): Promise<APEXInfrastructureSetupChoice> {
  return showSetupDialog(root, done => (
    <APEXInfrastructureSetupDialog
      mode={mode}
      detail={detail}
      dashboardUrl={getApexInfrastructureDashboardUrl()}
      onDone={done}
    />
  ))
}

async function installWithProgress(root: Root): Promise<StartupResult> {
  root.render(<Text>Installing 9Router for APEX Infrastructure…</Text>)
  const installResult = await installApexInfrastructure()
  if (!installResult.ok) {
    return {
      ready: false,
      message: `Could not install 9Router. Run npm install -g 9router manually.\n${installResult.message ?? ''}`,
    }
  }
  return { ready: true }
}

async function ensureCommandAvailable(root?: Root): Promise<StartupResult> {
  if (await is9RouterCommandAvailable()) {
    return { ready: true }
  }

  if (!root) {
    return {
      ready: false,
      message: '9Router is not installed. Run npm install -g 9router.',
    }
  }

  const choice = await launchSetupDialog(root, 'install')
  if (choice !== 'install') {
    return {
      ready: false,
      message: 'APEX Infrastructure setup was cancelled.',
    }
  }

  return installWithProgress(root)
}

async function resolveConfiguredState(
  root: Root | undefined,
  result: ApexInfrastructureProbeResult,
): Promise<StartupResult> {
  if (result.status === 'ready') {
    persistApexInfrastructureModels(result.models)
    return { ready: true }
  }

  if (!root) {
    return { ready: false, message: resultToMessage(result) }
  }

  const mode =
    result.status === 'auth-required'
      ? 'auth'
      : result.status === 'empty'
        ? 'configure'
        : 'error'

  const choice = await launchSetupDialog(root, mode, resultToMessage(result))
  if (choice !== 'retry') {
    return {
      ready: false,
      message: 'APEX Infrastructure setup was cancelled.',
    }
  }

  return ensureApexInfrastructureReady(root)
}

export async function ensureApexInfrastructureReady(
  root?: Root,
): Promise<StartupResult> {
  if (getAPIProvider() !== '9router') {
    return { ready: true }
  }

  let result = await probeApexInfrastructure()
  if (result.status === 'ready' || result.status === 'empty') {
    return resolveConfiguredState(root, result)
  }

  if (result.status === 'auth-required') {
    return resolveConfiguredState(root, result)
  }

  const commandResult = await ensureCommandAvailable(root)
  if (!commandResult.ready) {
    return commandResult
  }

  try {
    startApexInfrastructure()
  } catch (error) {
    return {
      ready: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  result = await waitForApexInfrastructure()
  logForDebugging(`[APEX Infrastructure] Startup probe: ${result.status}`)
  return resolveConfiguredState(root, result)
}
