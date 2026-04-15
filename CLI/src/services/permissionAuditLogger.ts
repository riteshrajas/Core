import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import type { PermissionDecisionReason } from '../types/permissions.js'

// ============================================================================
// Types
// ============================================================================

export type PolicyAction = 'allow' | 'deny' | 'require-approval'

export interface Policy {
  id: string
  name: string
  description?: string
  toolPattern: string
  actionPattern: string
  policyAction: PolicyAction
  requiresApproval?: boolean
  createdAt: string
  updatedAt: string
  enabled: boolean
}

export interface AuditEntry {
  id: string
  timestamp: string
  tool: string
  action: 'allow' | 'deny' | 'skip'
  reason?: string
  context?: {
    user?: string
    sessionId?: string
    commandName?: string
    arguments?: string[]
  }
  metadata?: {
    decisionReason?: PermissionDecisionReason
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    policyId?: string
  }
}

export interface AuditReport {
  period: {
    startDate: string
    endDate: string
  }
  summary: {
    totalEntries: number
    allowedCount: number
    deniedCount: number
    skippedCount: number
  }
  byTool: Record<
    string,
    {
      total: number
      allowed: number
      denied: number
      skipped: number
      percentDenied: number
    }
  >
  byAction: {
    [key: string]: number
  }
  denialTrends?: {
    date: string
    count: number
  }[]
  topDeniedTools?: {
    tool: string
    count: number
  }[]
}

interface AuditLogData {
  version: string
  entries: AuditEntry[]
  policies: Policy[]
  lastUpdated: string
}

// ============================================================================
// Policy Templates
// ============================================================================

export type PolicyTemplateType = 'read-only' | 'restricted' | 'full-access' | 'require-approval'

export interface PolicyTemplate {
  type: PolicyTemplateType
  description: string
  rules: PolicyRule[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface PolicyRule {
  condition: {
    type: 'AND' | 'OR'
    matchers: PermissionMatcher[]
  }
  action: PolicyAction
  priority: number
}

export interface PermissionMatcher {
  field: 'tool' | 'action' | 'user' | 'riskLevel'
  operator: 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith'
  value: string
}

export interface PolicyViolation {
  id: string
  timestamp: string
  policyId: string
  toolPattern: string
  actionPattern: string
  reason: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  metadata?: Record<string, unknown>
}

export interface ViolationReport {
  period: {
    startDate: string
    endDate: string
  }
  summary: {
    totalViolations: number
    bySeverity: {
      LOW: number
      MEDIUM: number
      HIGH: number
    }
    byPolicy: Record<string, number>
  }
  violations: PolicyViolation[]
  trends?: {
    date: string
    count: number
  }[]
}

// ============================================================================
// PolicyEngine Class
// ============================================================================

class PolicyEngine {
  private violations: PolicyViolation[] = []
  private policyHierarchy: Map<string, Policy[]> = new Map()
  private templates: Map<PolicyTemplateType, PolicyTemplate> = new Map()

  constructor() {
    this.initializeTemplates()
  }

  /**
   * Initialize default policy templates
   */
  private initializeTemplates(): void {
    this.templates.set('read-only', {
      type: 'read-only',
      description: 'Only allow read-only operations',
      riskLevel: 'LOW',
      rules: [
        {
          condition: {
            type: 'OR',
            matchers: [
              {
                field: 'action',
                operator: 'contains',
                value: 'read',
              },
              {
                field: 'action',
                operator: 'contains',
                value: 'list',
              },
              {
                field: 'action',
                operator: 'contains',
                value: 'get',
              },
            ],
          },
          action: 'allow',
          priority: 1,
        },
        {
          condition: {
            type: 'OR',
            matchers: [
              {
                field: 'action',
                operator: 'contains',
                value: 'write',
              },
              {
                field: 'action',
                operator: 'contains',
                value: 'delete',
              },
              {
                field: 'action',
                operator: 'contains',
                value: 'create',
              },
              {
                field: 'action',
                operator: 'contains',
                value: 'modify',
              },
            ],
          },
          action: 'deny',
          priority: 2,
        },
      ],
    })

    this.templates.set('restricted', {
      type: 'restricted',
      description: 'Limited tool access with approval requirement',
      riskLevel: 'MEDIUM',
      rules: [
        {
          condition: {
            type: 'AND',
            matchers: [
              {
                field: 'riskLevel',
                operator: 'equals',
                value: 'LOW',
              },
            ],
          },
          action: 'allow',
          priority: 1,
        },
        {
          condition: {
            type: 'AND',
            matchers: [
              {
                field: 'riskLevel',
                operator: 'equals',
                value: 'MEDIUM',
              },
            ],
          },
          action: 'require-approval',
          priority: 2,
        },
        {
          condition: {
            type: 'AND',
            matchers: [
              {
                field: 'riskLevel',
                operator: 'equals',
                value: 'HIGH',
              },
            ],
          },
          action: 'deny',
          priority: 3,
        },
      ],
    })

    this.templates.set('full-access', {
      type: 'full-access',
      description: 'Unrestricted access to all operations',
      riskLevel: 'HIGH',
      rules: [
        {
          condition: {
            type: 'OR',
            matchers: [
              {
                field: 'tool',
                operator: 'equals',
                value: '*',
              },
            ],
          },
          action: 'allow',
          priority: 1,
        },
      ],
    })

    this.templates.set('require-approval', {
      type: 'require-approval',
      description: 'All operations require manual approval',
      riskLevel: 'HIGH',
      rules: [
        {
          condition: {
            type: 'OR',
            matchers: [
              {
                field: 'tool',
                operator: 'equals',
                value: '*',
              },
            ],
          },
          action: 'require-approval',
          priority: 1,
        },
      ],
    })
  }

  /**
   * Create a policy from a template
   */
  createTemplate(
    templateType: PolicyTemplateType,
    name: string,
    toolPattern: string,
  ): Policy {
    const template = this.templates.get(templateType)
    if (!template) {
      throw new Error(`Unknown template type: ${templateType}`)
    }

    return {
      id: `policy-${templateType}-${Date.now()}`,
      name,
      description: template.description,
      toolPattern,
      actionPattern: '*',
      policyAction: template.rules[0].action,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    }
  }

  /**
   * Evaluate a permission against all applicable policies
   */
  evaluatePolicy(tool: string, action: string, context?: {
    user?: string
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  }): {
    allowed: boolean
    action: PolicyAction
    matchedPolicies: string[]
    reason: string
  } {
    const hierarchy = this.getPolicyHierarchy(tool)

    let result: PolicyAction = 'allow'
    const matchedPolicies: string[] = []

    for (const policy of hierarchy) {
      if (!policy.enabled) continue

      const matches = this.matchesPolicyConditions(
        tool,
        action,
        policy,
        context,
      )

      if (matches) {
        matchedPolicies.push(policy.id)

        if (policy.policyAction === 'deny') {
          result = 'deny'
          break
        } else if (policy.policyAction === 'require-approval' && result !== 'deny') {
          result = 'require-approval'
        }
      }
    }

    return {
      allowed: result !== 'deny',
      action: result,
      matchedPolicies,
      reason: this.getEvaluationReason(result, matchedPolicies),
    }
  }

  /**
   * Get the effective policy hierarchy for a tool
   */
  getPolicyHierarchy(toolPattern: string): Policy[] {
    if (this.policyHierarchy.has(toolPattern)) {
      return this.policyHierarchy.get(toolPattern) || []
    }

    return []
  }

  /**
   * Set policy hierarchy for a tool
   */
  setPolicyHierarchy(toolPattern: string, policies: Policy[]): void {
    this.policyHierarchy.set(
      toolPattern,
      policies.sort((a, b) => {
        const priorityA = this.calculatePolicyPriority(a)
        const priorityB = this.calculatePolicyPriority(b)
        return priorityB - priorityA
      }),
    )
  }

  /**
   * Track a policy violation
   */
  trackViolation(
    policyId: string,
    toolPattern: string,
    actionPattern: string,
    reason: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM',
    metadata?: Record<string, unknown>,
  ): PolicyViolation {
    const violation: PolicyViolation = {
      id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      policyId,
      toolPattern,
      actionPattern,
      reason,
      severity,
      metadata,
    }

    this.violations.push(violation)
    return violation
  }

  /**
   * Get a violation report for a date range
   */
  getViolationReport(
    startDate?: string,
    endDate?: string,
  ): ViolationReport {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const filtered = this.violations.filter((v) => {
      const violationTime = new Date(v.timestamp).getTime()
      return violationTime >= start.getTime() && violationTime <= end.getTime()
    })

    const bySeverity = {
      LOW: filtered.filter((v) => v.severity === 'LOW').length,
      MEDIUM: filtered.filter((v) => v.severity === 'MEDIUM').length,
      HIGH: filtered.filter((v) => v.severity === 'HIGH').length,
    }

    const byPolicy: Record<string, number> = {}
    filtered.forEach((v) => {
      byPolicy[v.policyId] = (byPolicy[v.policyId] || 0) + 1
    })

    // Calculate trends by date
    const trendsByDate: Record<string, number> = {}
    filtered.forEach((v) => {
      const date = new Date(v.timestamp).toISOString().split('T')[0]
      trendsByDate[date] = (trendsByDate[date] || 0) + 1
    })

    const trends = Object.entries(trendsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
      summary: {
        totalViolations: filtered.length,
        bySeverity,
        byPolicy,
      },
      violations: filtered,
      trends: trends.length > 0 ? trends : undefined,
    }
  }

  /**
   * Validate for conflicting policies
   */
  validatePolicyConflicts(policies: Policy[]): {
    hasConflicts: boolean
    conflicts: Array<{
      policy1: string
      policy2: string
      reason: string
    }>
  } {
    const conflicts: Array<{
      policy1: string
      policy2: string
      reason: string
    }> = []

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const p1 = policies[i]
        const p2 = policies[j]

        if (this.patternsOverlap(p1.toolPattern, p2.toolPattern) &&
            this.patternsOverlap(p1.actionPattern, p2.actionPattern)) {
          if (p1.policyAction !== p2.policyAction) {
            conflicts.push({
              policy1: p1.id,
              policy2: p2.id,
              reason: `Conflicting actions for overlapping patterns: ${p1.policyAction} vs ${p2.policyAction}`,
            })
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    }
  }

  /**
   * Get all tracked violations
   */
  getViolations(): PolicyViolation[] {
    return [...this.violations]
  }

  /**
   * Clear violations (useful for testing or archiving)
   */
  clearViolations(): void {
    this.violations = []
  }

  /**
   * Get template by type
   */
  getTemplate(type: PolicyTemplateType): PolicyTemplate | undefined {
    return this.templates.get(type)
  }

  /**
   * List all available templates
   */
  listTemplates(): PolicyTemplate[] {
    return Array.from(this.templates.values())
  }

  // Private helper methods

  private matchesPolicyConditions(
    tool: string,
    action: string,
    policy: Policy,
    context?: {
      user?: string
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    },
  ): boolean {
    return this.matchPattern(tool, policy.toolPattern) &&
           this.matchPattern(action, policy.actionPattern)
  }

  private matchPattern(value: string, pattern: string): boolean {
    if (pattern === '*') return true

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(value)
  }

  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    if (pattern1 === '*' || pattern2 === '*') return true

    const regex1 = this.patternToRegex(pattern1)
    const regex2 = this.patternToRegex(pattern2)

    const testCases = ['test', 'read', 'write', '*', 'action', 'tool']
    return testCases.some((tc) => regex1.test(tc) && regex2.test(tc))
  }

  private patternToRegex(pattern: string): RegExp {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    return new RegExp(`^${regexPattern}$`, 'i')
  }

  private calculatePolicyPriority(policy: Policy): number {
    if (policy.policyAction === 'deny') return 3
    if (policy.policyAction === 'require-approval') return 2
    return 1
  }

  private getEvaluationReason(action: PolicyAction, matchedPolicies: string[]): string {
    if (matchedPolicies.length === 0) {
      return 'No policies matched'
    }

    switch (action) {
      case 'deny':
        return `Denied by policy: ${matchedPolicies[matchedPolicies.length - 1]}`
      case 'require-approval':
        return `Approval required by policy: ${matchedPolicies[matchedPolicies.length - 1]}`
      case 'allow':
      default:
        return `Allowed by policy: ${matchedPolicies[matchedPolicies.length - 1]}`
    }
  }
}

// ============================================================================
// PermissionAuditLogger Service
// ============================================================================

const APEX_CONFIG_DIR = join(homedir(), '.apex')
const AUDIT_LOG_FILE = join(APEX_CONFIG_DIR, 'audit-logs.json')

class PermissionAuditLogger {
  private data: AuditLogData = {
    version: '1.0',
    entries: [],
    policies: [],
    lastUpdated: new Date().toISOString(),
  }
  private initialized = false

  /**
   * Initialize the audit logger, loading existing audit logs
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await mkdir(APEX_CONFIG_DIR, { recursive: true })
      const content = await readFile(AUDIT_LOG_FILE, 'utf-8')
      this.data = JSON.parse(content)
    } catch {
      this.data = {
        version: '1.0',
        entries: [],
        policies: [],
        lastUpdated: new Date().toISOString(),
      }
    }

    this.initialized = true
  }

  /**
   * Log a permission decision
   */
  async logPermissionDecision(
    tool: string,
    action: 'allow' | 'deny' | 'skip',
    options?: {
      reason?: string
      user?: string
      sessionId?: string
      commandName?: string
      arguments?: string[]
      decisionReason?: PermissionDecisionReason
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
      policyId?: string
    },
  ): Promise<void> {
    await this.initialize()

    const entry: AuditEntry = {
      id: `${tool}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tool,
      action,
      reason: options?.reason,
      context: {
        user: options?.user,
        sessionId: options?.sessionId,
        commandName: options?.commandName,
        arguments: options?.arguments,
      },
      metadata: {
        decisionReason: options?.decisionReason,
        riskLevel: options?.riskLevel,
        policyId: options?.policyId,
      },
    }

    this.data.entries.push(entry)
    this.data.lastUpdated = new Date().toISOString()

    // Enforce policies if applicable
    if (options?.policyId) {
      const policy = this.data.policies.find((p) => p.id === options.policyId)
      if (policy && policy.enabled) {
        await this.enforcePolicy(entry, policy)
      }
    }

    await this.persistAuditLog()
  }

  /**
   * Query audit logs by various filters
   */
  async queryAuditLogs(filters?: {
    tool?: string
    action?: 'allow' | 'deny' | 'skip'
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }): Promise<AuditEntry[]> {
    await this.initialize()

    let results = [...this.data.entries]

    if (filters?.tool) {
      results = results.filter((e) => e.tool.includes(filters.tool))
    }

    if (filters?.action) {
      results = results.filter((e) => e.action === filters.action)
    }

    if (filters?.startDate) {
      const startTime = new Date(filters.startDate).getTime()
      results = results.filter((e) => new Date(e.timestamp).getTime() >= startTime)
    }

    if (filters?.endDate) {
      const endTime = new Date(filters.endDate).getTime()
      results = results.filter((e) => new Date(e.timestamp).getTime() <= endTime)
    }

    const offset = filters?.offset ?? 0
    const limit = filters?.limit ?? 100

    return results.slice(offset, offset + limit)
  }

  /**
   * Generate an audit report for a date range
   */
  async generateAuditReport(
    startDate?: string,
    endDate?: string,
  ): Promise<AuditReport> {
    await this.initialize()

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const filtered = this.data.entries.filter((e) => {
      const entryTime = new Date(e.timestamp).getTime()
      return entryTime >= start.getTime() && entryTime <= end.getTime()
    })

    const summary = {
      totalEntries: filtered.length,
      allowedCount: filtered.filter((e) => e.action === 'allow').length,
      deniedCount: filtered.filter((e) => e.action === 'deny').length,
      skippedCount: filtered.filter((e) => e.action === 'skip').length,
    }

    const byTool: Record<
      string,
      { total: number; allowed: number; denied: number; skipped: number; percentDenied: number }
    > = {}

    filtered.forEach((entry) => {
      if (!byTool[entry.tool]) {
        byTool[entry.tool] = {
          total: 0,
          allowed: 0,
          denied: 0,
          skipped: 0,
          percentDenied: 0,
        }
      }

      byTool[entry.tool].total += 1

      if (entry.action === 'allow') {
        byTool[entry.tool].allowed += 1
      } else if (entry.action === 'deny') {
        byTool[entry.tool].denied += 1
      } else if (entry.action === 'skip') {
        byTool[entry.tool].skipped += 1
      }
    })

    Object.values(byTool).forEach((stats) => {
      stats.percentDenied = stats.total > 0 ? (stats.denied / stats.total) * 100 : 0
    })

    const byAction: Record<string, number> = {}
    filtered.forEach((entry) => {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1
    })

    // Calculate denial trends by date
    const denialsByDate: Record<string, number> = {}
    filtered
      .filter((e) => e.action === 'deny')
      .forEach((entry) => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0]
        denialsByDate[date] = (denialsByDate[date] ?? 0) + 1
      })

    const denialTrends = Object.entries(denialsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Get top denied tools
    const topDeniedTools = Object.entries(byTool)
      .map(([tool, stats]) => ({ tool, count: stats.denied }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      },
      summary,
      byTool,
      byAction,
      denialTrends: denialTrends.length > 0 ? denialTrends : undefined,
      topDeniedTools: topDeniedTools.length > 0 ? topDeniedTools : undefined,
    }
  }

  /**
   * Add a policy rule
   */
  async addPolicy(policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    await this.initialize()

    const newPolicy: Policy = {
      ...policy,
      id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.data.policies.push(newPolicy)
    this.data.lastUpdated = new Date().toISOString()
    await this.persistAuditLog()

    return newPolicy
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy | null> {
    await this.initialize()

    const policy = this.data.policies.find((p) => p.id === id)
    if (!policy) return null

    Object.assign(policy, updates, {
      updatedAt: new Date().toISOString(),
    })

    this.data.lastUpdated = new Date().toISOString()
    await this.persistAuditLog()

    return policy
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id: string): Promise<boolean> {
    await this.initialize()

    const index = this.data.policies.findIndex((p) => p.id === id)
    if (index === -1) return false

    this.data.policies.splice(index, 1)
    this.data.lastUpdated = new Date().toISOString()
    await this.persistAuditLog()

    return true
  }

  /**
   * List all policies
   */
  async listPolicies(): Promise<Policy[]> {
    await this.initialize()
    return [...this.data.policies]
  }

  /**
   * Get a specific policy
   */
  async getPolicy(id: string): Promise<Policy | null> {
    await this.initialize()
    return this.data.policies.find((p) => p.id === id) || null
  }

  /**
   * Check if an action matches any policies
   */
  async evaluatePolicy(tool: string, action: string): Promise<PolicyAction | null> {
    await this.initialize()

    const matchingPolicies = this.data.policies.filter(
      (p) =>
        p.enabled &&
        this.matchPattern(tool, p.toolPattern) &&
        this.matchPattern(action, p.actionPattern),
    )

    if (matchingPolicies.length === 0) return null

    // Return the most restrictive policy action (deny > require-approval > allow)
    if (matchingPolicies.some((p) => p.policyAction === 'deny')) return 'deny'
    if (matchingPolicies.some((p) => p.policyAction === 'require-approval'))
      return 'require-approval'

    return 'allow'
  }

  /**
   * Clear all audit logs (use with caution)
   */
  async clearAuditLogs(): Promise<void> {
    await this.initialize()
    this.data.entries = []
    this.data.lastUpdated = new Date().toISOString()
    await this.persistAuditLog()
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(): Promise<{
    totalEntries: number
    allowedCount: number
    deniedCount: number
    skippedCount: number
    uniqueTools: number
    firstEntry?: string
    lastEntry?: string
  }> {
    await this.initialize()

    const allowed = this.data.entries.filter((e) => e.action === 'allow').length
    const denied = this.data.entries.filter((e) => e.action === 'deny').length
    const skipped = this.data.entries.filter((e) => e.action === 'skip').length
    const uniqueTools = new Set(this.data.entries.map((e) => e.tool)).size

    const sorted = [...this.data.entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    return {
      totalEntries: this.data.entries.length,
      allowedCount: allowed,
      deniedCount: denied,
      skippedCount: skipped,
      uniqueTools,
      firstEntry: sorted.length > 0 ? sorted[0].timestamp : undefined,
      lastEntry: sorted.length > 0 ? sorted[sorted.length - 1].timestamp : undefined,
    }
  }

  /**
   * Export audit logs as JSON
   */
  async exportAuditLogs(filepath?: string): Promise<string> {
    await this.initialize()

    const exportData = {
      exportDate: new Date().toISOString(),
      entries: this.data.entries,
      policies: this.data.policies,
    }

    const jsonString = JSON.stringify(exportData, null, 2)

    if (filepath) {
      await writeFile(filepath, jsonString, 'utf-8')
    }

    return jsonString
  }

  // Private helper methods

  private matchPattern(value: string, pattern: string): boolean {
    if (pattern === '*') return true

    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(value)
  }

  private async enforcePolicy(entry: AuditEntry, policy: Policy): Promise<void> {
    if (policy.policyAction === 'deny' && entry.action !== 'deny') {
      // Policy specifies deny but action was allow/skip - could log warning
    } else if (policy.policyAction === 'allow' && entry.action === 'deny') {
      // Policy specifies allow but action was deny - could log warning
    }
    // require-approval would typically trigger a notification or alert
  }

  private async persistAuditLog(): Promise<void> {
    try {
      await mkdir(APEX_CONFIG_DIR, { recursive: true })
      const jsonString = JSON.stringify(this.data, null, 2)
      await writeFile(AUDIT_LOG_FILE, jsonString, 'utf-8')
    } catch (error) {
      console.error('Failed to persist audit log:', error)
    }
  }
}

export const permissionAuditLogger = new PermissionAuditLogger()
export const policyEngine = new PolicyEngine()
