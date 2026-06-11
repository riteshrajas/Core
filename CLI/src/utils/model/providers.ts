import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'

// APEX now uses ONLY 9Router/APEX Infrastructure for all model routing
export type APIProvider = '9router'

export const DEFAULT_9ROUTER_BASE_URL = 'http://127.0.0.1:20128'
export const DEFAULT_9ROUTER_MODEL = 'gc/gemini-3-flash-preview'
const LOCAL_9ROUTER_API_KEY = '9router-local'

/**
 * Always returns '9router' — APEX uses only 9Router for model routing.
 * No alternative providers are supported.
 */
export function getAPIProvider(): APIProvider {
  return '9router'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return '9router' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * APEX no longer supports first-party Anthropic API.
 * Always returns false since 9Router is the only provider.
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  return false
}

export function get9RouterBaseUrl(): string {
  const rawBaseUrl =
    process.env.APEX_CODE_9ROUTER_BASE_URL ||
    process.env.NINE_ROUTER_BASE_URL ||
    process.env['9ROUTER_BASE_URL'] ||
    DEFAULT_9ROUTER_BASE_URL

  const trimmed = rawBaseUrl.trim().replace(/\/+$/, '')
  const normalized = trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed
  return normalized || DEFAULT_9ROUTER_BASE_URL
}

export function get9RouterApiKey(): string {
  return (
    process.env.APEX_CODE_9ROUTER_API_KEY ||
    process.env.NINE_ROUTER_API_KEY ||
    process.env['9ROUTER_API_KEY'] ||
    LOCAL_9ROUTER_API_KEY
  )
}

export function get9RouterApiKeySource(): string {
  if (process.env.APEX_CODE_9ROUTER_API_KEY) {
    return 'APEX_CODE_9ROUTER_API_KEY'
  }
  if (process.env.NINE_ROUTER_API_KEY) {
    return 'NINE_ROUTER_API_KEY'
  }
  if (process.env['9ROUTER_API_KEY']) {
    return '9ROUTER_API_KEY'
  }
  return 'local placeholder'
}

export function get9RouterModelOverride(): string | undefined {
  return (
    process.env.APEX_CODE_9ROUTER_MODEL ||
    process.env.APEX_CODE_INFRASTRUCTURE_MODEL ||
    process.env.NINE_ROUTER_MODEL ||
    process.env['9ROUTER_MODEL'] ||
    undefined
  )
}
