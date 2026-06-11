import { spawn } from 'child_process'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  get9RouterApiKey,
  get9RouterBaseUrl,
} from '../../utils/model/providers.js'
import type { ModelOption } from '../../utils/model/modelOptions.js'

export type ApexInfrastructureProbeResult =
  | {
      status: 'ready'
      models: ModelOption[]
    }
  | {
      status: 'empty'
      models: []
    }
  | {
      status: 'auth-required'
      models: []
      statusCode: number
    }
  | {
      status: 'not-running'
      models: []
      error: string
    }
  | {
      status: 'error'
      models: []
      error: string
      statusCode?: number
    }

type ModelsResponse = {
  data?: Array<{
    id?: unknown
    owned_by?: unknown
  }>
}

const STARTUP_TIMEOUT_MS = 20_000
const PROBE_TIMEOUT_MS = 2_500

function getModelsUrl(): string {
  return `${get9RouterBaseUrl()}/v1`
}

function getDashboardUrl(): string {
  return get9RouterBaseUrl()
}

export function getApexInfrastructureDashboardUrl(): string {
  return getDashboardUrl()
}

function modelToOption(modelId: string, ownedBy?: unknown): ModelOption {
  const owner = typeof ownedBy === 'string' && ownedBy ? ownedBy : undefined
  return {
    value: modelId,
    label: modelId,
    description: owner
      ? `APEX Infrastructure · ${owner}`
      : 'APEX Infrastructure model',
    provider: owner ?? '9Router',
  }
}

function parseModelOptions(payload: unknown): ModelOption[] {
  const response = payload as ModelsResponse
  if (!Array.isArray(response.data)) {
    return []
  }

  const seen = new Set<string>()
  const options: ModelOption[] = []
  for (const model of response.data) {
    if (typeof model.id !== 'string' || !model.id || seen.has(model.id)) {
      continue
    }
    seen.add(model.id)
    options.push(modelToOption(model.id, model.owned_by))
  }
  return options
}

export async function probeApexInfrastructure(): Promise<ApexInfrastructureProbeResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const apiKey = get9RouterApiKey()
    const response = await fetch(getModelsUrl(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'x-api-key': apiKey,
      },
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      return { status: 'auth-required', models: [], statusCode: response.status }
    }

    if (!response.ok) {
      return {
        status: 'error',
        models: [],
        statusCode: response.status,
        error: `9Router returned HTTP ${response.status}`,
      }
    }

    const models = parseModelOptions(await response.json())
    return models.length > 0
      ? { status: 'ready', models }
      : { status: 'empty', models: [] }
  } catch (error) {
    return {
      status: 'not-running',
      models: [],
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function is9RouterCommandAvailable(): Promise<boolean> {
  const command = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = await execFileNoThrow(command, ['9router'], {
    timeout: 3_000,
    preserveOutputOnError: false,
    useCwd: false,
  })
  return result.code === 0
}

export function startApexInfrastructure(): void {
  logForDebugging('[APEX Infrastructure] Starting 9Router')
  const child = spawn('9router', [], {
    detached: true,
    shell: process.platform === 'win32',
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

export async function installApexInfrastructure(): Promise<{
  ok: boolean
  message?: string
}> {
  logForDebugging('[APEX Infrastructure] Installing 9Router')
  const result = await execFileNoThrow('npm', ['install', '-g', '9router'], {
    timeout: 5 * 60_000,
    preserveOutputOnError: true,
    useCwd: false,
    stdin: 'ignore',
  })

  if (result.code === 0) {
    return { ok: true }
  }

  return {
    ok: false,
    message:
      result.stderr ||
      result.stdout ||
      result.error ||
      'npm install -g 9router failed',
  }
}

export async function waitForApexInfrastructure(): Promise<ApexInfrastructureProbeResult> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  let lastResult = await probeApexInfrastructure()

  while (
    lastResult.status !== 'ready' &&
    lastResult.status !== 'empty' &&
    lastResult.status !== 'auth-required' &&
    Date.now() < deadline
  ) {
    await new Promise(resolve => setTimeout(resolve, 750))
    lastResult = await probeApexInfrastructure()
  }

  return lastResult
}

export function persistApexInfrastructureModels(models: ModelOption[]): void {
  const current = getGlobalConfig().additionalModelOptionsCache ?? []
  if (JSON.stringify(current) === JSON.stringify(models)) {
    return
  }
  saveGlobalConfig(config => ({
    ...config,
    additionalModelOptionsCache: models,
  }))
}
