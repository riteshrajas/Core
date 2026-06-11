import { getInitialMainLoopModel } from '../../bootstrap/state.js'
import { spawnSync } from 'child_process'
import {
  isAPEXAISubscriber,
} from '../auth.js'
import {
  COST_TIER_3_15,
  formatModelPricing,
} from '../modelCost.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import { getAPIProvider } from './providers.js'
import { isModelAllowed } from './modelAllowlist.js'
import {
  getCanonicalName,
  getAPEXAiUserDefaultModelDescription,
  getDefaultMainLoopModelSetting,
  getMarketingNameForModel,
  getUserSpecifiedModelSetting,
  renderDefaultModelSetting,
  type ModelSetting,
} from './model.js'
import { getGlobalConfig } from '../config.js'

export type ModelOption = {
  value: ModelSetting
  label: string
  description: string
  descriptionForModel?: string
  provider?: string
}

function discoverOllamaModelOptions(): ModelOption[] {
  const parseOllamaListOutput = (stdout: string): string[] => {
    return stdout
      .split(/\r?\n/)
      .slice(1) // Skip header row (NAME ID SIZE MODIFIED)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.split(/\s+/)[0])
      .filter((name): name is string => Boolean(name && name !== 'NAME'))
  }

  try {
    let result = spawnSync('ollama', ['list'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    })

    if ((!result.stdout || result.status !== 0) && process.platform === 'win32') {
      result = spawnSync('pwsh', ['-NoProfile', '-Command', 'ollama list'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      })
    }

    if (result.status !== 0 || !result.stdout) {
      return []
    }

    const models = parseOllamaListOutput(result.stdout)

    return [...new Set(models)].map(name => ({
      value: name,
      label: name,
      description:
        getAPIProvider() === '9router'
          ? `APEX Infrastructure local model (${name})`
          : `Local Ollama model (${name})`,
      provider: 'Ollama',
    }))
  } catch {
    return []
  }
}

export function getDefaultOptionForUser(fastMode = false): ModelOption {
  if (process.env.USER_TYPE === 'ant') {
    const currentModel = renderDefaultModelSetting(
      getDefaultMainLoopModelSetting(),
    )
    return {
      value: null,
      label: 'Default (recommended)',
      description: `Use the default model for Ants (currently ${currentModel})`,
      descriptionForModel: `Default model (currently ${currentModel})`,
      provider: 'Recommended',
    }
  }

  // Subscribers
  if (isAPEXAISubscriber()) {
    return {
      value: null,
      label: 'Default (recommended)',
      description: getAPEXAiUserDefaultModelDescription(fastMode),
      provider: 'Recommended',
    }
  }

  // PAYG
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: null,
    label: 'Default (recommended)',
    description: `Use the default model (currently ${renderDefaultModelSetting(getDefaultMainLoopModelSetting())})${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,
    provider: 'Recommended',
  }
}

function getModelOptionsBase(fastMode = false): ModelOption[] {
  return [getDefaultOptionForUser(fastMode)]
}

export function getModelOptions(fastMode = false): ModelOption[] {
  const options = getModelOptionsBase(fastMode)

  const appendOption = (option: ModelOption): void => {
    if (!options.some(existing => existing.value === option.value)) {
      options.push(option)
    }
  }

  // Models are now dynamic and fetched from the 9Router JSON list.
  // We use the cache for the initial synchronous render.
  for (const opt of getGlobalConfig().additionalModelOptionsCache ?? []) {
    appendOption(opt)
  }

  if (getAPIProvider() !== 'firstParty') {
    for (const localOption of discoverOllamaModelOptions()) {
      appendOption(localOption)
    }
  }

  const envCustomModel = process.env.ANTHROPIC_CUSTOM_MODEL_OPTION
  if (
    envCustomModel &&
    !options.some(existing => existing.value === envCustomModel)
  ) {
    appendOption({
      value: envCustomModel,
      label: process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME ?? envCustomModel,
      description:
        process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION ??
        `Custom model (${envCustomModel})`,
      provider: 'Other',
    })
  }

  let customModel: ModelSetting = null
  const currentMainLoopModel = getUserSpecifiedModelSetting()
  const initialMainLoopModel = getInitialMainLoopModel()
  if (currentMainLoopModel !== undefined && currentMainLoopModel !== null) {
    customModel = currentMainLoopModel
  } else if (initialMainLoopModel !== null) {
    customModel = initialMainLoopModel
  }
  
  if (customModel === null || options.some(opt => opt.value === customModel)) {
    return filterModelOptionsByAllowlist(options)
  } else {
    options.push({
      value: customModel,
      label: getMarketingNameForModel(customModel) ?? customModel,
      description: 'Custom model',
      provider: 'Other',
    })
    return filterModelOptionsByAllowlist(options)
  }
}

function filterModelOptionsByAllowlist(options: ModelOption[]): ModelOption[] {
  const settings = getSettings_DEPRECATED() || {}
  if (!settings.availableModels) {
    return options
  }

  const preserveLocalOllamaOption = (opt: ModelOption): boolean =>
    typeof opt.value === 'string' &&
    (opt.description.startsWith('Local Ollama model (') ||
      opt.description.startsWith('APEX Infrastructure local model ('))

  return options.filter(
    opt =>
      opt.value === null ||
      preserveLocalOllamaOption(opt) ||
      (opt.value !== null && isModelAllowed(opt.value)),
  )
}
