/**
 * SessionManager Service
 *
 * Manages APEX CLI session persistence, including:
 * - Session serialization and storage
 * - Session templates for common workflows
 * - Session sharing with secure links
 * - Context persistence and restoration
 * - Session history tracking
 *
 * Sessions are stored in ~/.apex/sessions/ with the following structure:
 * - ~/.apex/sessions/active/ - Active sessions
 * - ~/.apex/sessions/archive/ - Completed/archived sessions
 * - ~/.apex/sessions/templates/ - Session templates
 * - ~/.apex/sessions/shared/ - Shared session data
 */

import { mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { randomBytes } from 'crypto'
import { createHash } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface SessionContext {
  messages: SessionMessage[]
  settings: SessionSettings
  metadata: SessionMetadata
  tools?: Record<string, unknown>
  memory?: Record<string, unknown>
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    toolUse?: {
      name: string
      input: unknown
    }
    tags?: string[]
  }
}

export interface SessionSettings {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  context?: Record<string, unknown>
  [key: string]: unknown
}

export interface SessionMetadata {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  messageCount: number
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
  tags?: string[]
  projectPath?: string
  customData?: Record<string, unknown>
}

export interface Session {
  id: string
  context: SessionContext
  version: string
}

export interface SessionTemplate {
  id: string
  name: string
  description: string
  category: 'developer' | 'writer' | 'analyst' | 'custom'
  defaultSettings: SessionSettings
  systemPrompt: string
  initialMessages?: SessionMessage[]
  tags?: string[]
  createdAt: number
}

export interface SharedSession {
  id: string
  sessionId: string
  shareCode: string
  accessToken: string
  expiresAt: number
  createdAt: number
  maxAccesses?: number
  accessCount: number
  metadata: {
    sharedBy: string
    expiresIn: number
  }
}

export interface SessionHistory {
  sessionId: string
  action: 'created' | 'updated' | 'accessed' | 'archived' | 'shared' | 'restored'
  timestamp: number
  details?: Record<string, unknown>
}

// ============================================================================
// SessionManager Class
// ============================================================================

class SessionManager {
  private baseDir: string
  private activePath: string
  private archivePath: string
  private templatePath: string
  private sharedPath: string
  private historyPath: string

  constructor() {
    this.baseDir = join(homedir(), '.apex', 'sessions')
    this.activePath = join(this.baseDir, 'active')
    this.archivePath = join(this.baseDir, 'archive')
    this.templatePath = join(this.baseDir, 'templates')
    this.sharedPath = join(this.baseDir, 'shared')
    this.historyPath = join(this.baseDir, 'history')
  }

  /**
   * Initialize the session manager by creating necessary directories
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.baseDir,
      this.activePath,
      this.archivePath,
      this.templatePath,
      this.sharedPath,
      this.historyPath,
    ]

    for (const dir of dirs) {
      await mkdir(dir, { recursive: true }).catch(() => {
        // Directory may already exist
      })
    }

    // Initialize default templates if not already present
    this.initializeDefaultTemplatesIfNeeded().catch(() => {
      // Silently fail if template initialization fails
    })
  }

  /**
   * Create a new session
   */
  async createSession(
    name: string,
    options?: {
      description?: string
      template?: string
      projectPath?: string
      tags?: string[]
      customData?: Record<string, unknown>
    },
  ): Promise<Session> {
    await this.initialize()

    const sessionId = this.generateSessionId()
    const now = Date.now()

    let settings: SessionSettings = { model: 'claude-3-5-sonnet-20241022' }
    let systemPrompt = ''
    let initialMessages: SessionMessage[] = []

    if (options?.template) {
      const template = await this.getTemplate(options.template)
      if (template) {
        settings = { ...settings, ...template.defaultSettings }
        systemPrompt = template.systemPrompt
        initialMessages = template.initialMessages || []
      }
    }

    const session: Session = {
      id: sessionId,
      version: '1.0.0',
      context: {
        messages: initialMessages,
        settings,
        metadata: {
          id: sessionId,
          name,
          description: options?.description,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
          messageCount: initialMessages.length,
          projectPath: options?.projectPath,
          tags: options?.tags,
          customData: options?.customData,
        },
      },
    }

    if (systemPrompt) {
      session.context.settings.systemPrompt = systemPrompt
    }

    await this.saveSession(session)
    await this.recordHistory(sessionId, 'created', {
      template: options?.template,
    })

    return session
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const filePath = join(this.activePath, `${sessionId}.json`)
      const data = await readFile(filePath, 'utf-8')
      const session = JSON.parse(data) as Session

      session.context.metadata.lastAccessedAt = Date.now()
      await this.saveSession(session)
      await this.recordHistory(sessionId, 'accessed')

      return session
    } catch {
      return null
    }
  }

  /**
   * Save a session to disk
   */
  async saveSession(session: Session): Promise<void> {
    await this.initialize()

    session.context.metadata.updatedAt = Date.now()
    const filePath = join(this.activePath, `${session.id}.json`)
    const data = JSON.stringify(session, null, 2)

    await writeFile(filePath, data, 'utf-8')
    await this.recordHistory(session.id, 'updated', {
      messageCount: session.context.metadata.messageCount,
    })
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'id' | 'timestamp'>,
  ): Promise<SessionMessage> {
    const session = await this.loadSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const messageId = this.generateMessageId()
    const fullMessage: SessionMessage = {
      ...message,
      id: messageId,
      timestamp: Date.now(),
    }

    session.context.messages.push(fullMessage)
    session.context.metadata.messageCount = session.context.messages.length

    await this.saveSession(session)
    return fullMessage
  }

  /**
   * Get session context for restoration
   */
  async getSessionContext(sessionId: string): Promise<SessionContext | null> {
    const session = await this.loadSession(sessionId)
    return session?.context || null
  }

  /**
   * Restore session context (resume from saved state)
   */
  async restoreSession(sessionId: string): Promise<Session | null> {
    const session = await this.loadSession(sessionId)
    if (session) {
      await this.recordHistory(sessionId, 'restored')
    }
    return session
  }

  /**
   * Archive a session (move to completed/archived)
   */
  async archiveSession(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const activeFile = join(this.activePath, `${sessionId}.json`)
    const archiveFile = join(this.archivePath, `${sessionId}.json`)

    const data = JSON.stringify(session, null, 2)
    await writeFile(archiveFile, data, 'utf-8')
    await unlink(activeFile).catch(() => {
      // File may not exist
    })

    await this.recordHistory(sessionId, 'archived')
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const activeFile = join(this.activePath, `${sessionId}.json`)
    const archiveFile = join(this.archivePath, `${sessionId}.json`)

    await unlink(activeFile).catch(() => {
      // File may not exist
    })
    await unlink(archiveFile).catch(() => {
      // File may not exist
    })
  }

  /**
   * List all active sessions
   */
  async listSessions(): Promise<SessionMetadata[]> {
    await this.initialize()

    try {
      const files = await readdir(this.activePath)
      const sessions: SessionMetadata[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.activePath, file)
          const data = await readFile(filePath, 'utf-8')
          const session = JSON.parse(data) as Session
          sessions.push(session.context.metadata)
        }
      }

      return sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
    } catch {
      return []
    }
  }

  /**
   * List archived sessions
   */
  async listArchivedSessions(): Promise<SessionMetadata[]> {
    await this.initialize()

    try {
      const files = await readdir(this.archivePath)
      const sessions: SessionMetadata[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.archivePath, file)
          const data = await readFile(filePath, 'utf-8')
          const session = JSON.parse(data) as Session
          sessions.push(session.context.metadata)
        }
      }

      return sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
    } catch {
      return []
    }
  }

  /**
   * Create a session template
   */
  async createTemplate(template: SessionTemplate): Promise<void> {
    await this.initialize()

    const filePath = join(this.templatePath, `${template.id}.json`)
    const data = JSON.stringify(template, null, 2)

    await writeFile(filePath, data, 'utf-8')
  }

  /**
   * Get a session template
   */
  async getTemplate(templateId: string): Promise<SessionTemplate | null> {
    try {
      const filePath = join(this.templatePath, `${templateId}.json`)
      const data = await readFile(filePath, 'utf-8')
      return JSON.parse(data) as SessionTemplate
    } catch {
      return null
    }
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<SessionTemplate[]> {
    await this.initialize()

    try {
      const files = await readdir(this.templatePath)
      const templates: SessionTemplate[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.templatePath, file)
          const data = await readFile(filePath, 'utf-8')
          const template = JSON.parse(data) as SessionTemplate
          templates.push(template)
        }
      }

      return templates
    } catch {
      return []
    }
  }

  /**
   * Create a shareable link for a session
   */
  async createShareLink(
    sessionId: string,
    options?: {
      expiresIn?: number
      maxAccesses?: number
      sharedBy?: string
    },
  ): Promise<SharedSession> {
    const session = await this.loadSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const now = Date.now()
    const expiresIn = options?.expiresIn || 7 * 24 * 60 * 60 * 1000 // 7 days default
    const shareId = this.generateShareId()
    const shareCode = this.generateShareCode()
    const accessToken = this.generateAccessToken()

    const sharedSession: SharedSession = {
      id: shareId,
      sessionId,
      shareCode,
      accessToken,
      expiresAt: now + expiresIn,
      createdAt: now,
      maxAccesses: options?.maxAccesses,
      accessCount: 0,
      metadata: {
        sharedBy: options?.sharedBy || 'user',
        expiresIn,
      },
    }

    const filePath = join(this.sharedPath, `${shareId}.json`)
    const data = JSON.stringify(sharedSession, null, 2)
    await writeFile(filePath, data, 'utf-8')

    await this.recordHistory(sessionId, 'shared', {
      shareId,
      expiresIn,
    })

    return sharedSession
  }

  /**
   * Access a shared session
   */
  async accessSharedSession(
    shareCode: string,
    accessToken: string,
  ): Promise<Session | null> {
    try {
      const files = await readdir(this.sharedPath)

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.sharedPath, file)
          const data = await readFile(filePath, 'utf-8')
          const shared = JSON.parse(data) as SharedSession

          if (
            shared.shareCode === shareCode &&
            shared.accessToken === accessToken &&
            shared.expiresAt > Date.now()
          ) {
            if (shared.maxAccesses && shared.accessCount >= shared.maxAccesses) {
              return null
            }

            shared.accessCount++
            await writeFile(filePath, JSON.stringify(shared, null, 2), 'utf-8')

            return this.loadSession(shared.sessionId)
          }
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * List shared sessions
   */
  async listSharedSessions(sessionId?: string): Promise<SharedSession[]> {
    try {
      const files = await readdir(this.sharedPath)
      const shared: SharedSession[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.sharedPath, file)
          const data = await readFile(filePath, 'utf-8')
          const sharedSession = JSON.parse(data) as SharedSession

          if (!sessionId || sharedSession.sessionId === sessionId) {
            if (sharedSession.expiresAt > Date.now()) {
              shared.push(sharedSession)
            } else {
              await unlink(filePath).catch(() => {
                // File may not exist
              })
            }
          }
        }
      }

      return shared
    } catch {
      return []
    }
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(shareId: string): Promise<void> {
    const filePath = join(this.sharedPath, `${shareId}.json`)
    await unlink(filePath).catch(() => {
      // File may not exist
    })
  }

  /**
   * Get session history
   */
  async getHistory(sessionId?: string): Promise<SessionHistory[]> {
    try {
      const filePath = join(this.historyPath, 'history.jsonl')
      const data = await readFile(filePath, 'utf-8')
      const lines: string[] = data.split('\n').filter((line: string) => line.trim())

      return lines
        .map((line: string) => {
          try {
            return JSON.parse(line) as SessionHistory
          } catch {
            return null
          }
        })
        .filter((entry: SessionHistory | null) => entry !== null && (!sessionId || entry.sessionId === sessionId)) as SessionHistory[]
    } catch {
      return []
    }
  }

  /**
   * Export session as JSON
   */
  async exportSession(sessionId: string): Promise<string | null> {
    const session = await this.loadSession(sessionId)
    if (!session) {
      return null
    }
    return JSON.stringify(session, null, 2)
  }

  /**
   * Import session from JSON
   */
  async importSession(json: string): Promise<Session> {
    const imported = JSON.parse(json) as Session

    if (!imported.context || !imported.context.metadata) {
      throw new Error('Invalid session format')
    }

    const sessionId = this.generateSessionId()
    imported.id = sessionId
    imported.context.metadata.id = sessionId
    imported.context.metadata.createdAt = Date.now()
    imported.context.metadata.updatedAt = Date.now()
    imported.context.metadata.lastAccessedAt = Date.now()

    await this.saveSession(imported)
    return imported
  }

  /**
   * Get session statistics
   */
  async getStatistics(): Promise<{
    activeSessions: number
    archivedSessions: number
    templates: number
    sharedSessions: number
    totalMessages: number
  }> {
    const activeSessions = await this.listSessions()
    const archivedSessions = await this.listArchivedSessions()
    const templates = await this.listTemplates()
    const sharedSessions = await this.listSharedSessions()

    const totalMessages = activeSessions.reduce((sum, s) => sum + s.messageCount, 0)

    return {
      activeSessions: activeSessions.length,
      archivedSessions: archivedSessions.length,
      templates: templates.length,
      sharedSessions: sharedSessions.length,
      totalMessages,
    }
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    updates: Partial<SessionMetadata>,
  ): Promise<void> {
    const session = await this.loadSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.context.metadata = {
      ...session.context.metadata,
      ...updates,
      id: sessionId,
      updatedAt: Date.now(),
    }

    await this.saveSession(session)
  }

  /**
   * Clone a session
   */
  async cloneSession(
    sourceSessionId: string,
    newName: string,
  ): Promise<Session> {
    const sourceSession = await this.loadSession(sourceSessionId)
    if (!sourceSession) {
      throw new Error(`Session not found: ${sourceSessionId}`)
    }

    const newSessionId = this.generateSessionId()
    const now = Date.now()

    const clonedSession: Session = {
      ...sourceSession,
      id: newSessionId,
      context: {
        ...sourceSession.context,
        messages: [...sourceSession.context.messages],
        metadata: {
          ...sourceSession.context.metadata,
          id: newSessionId,
          name: newName,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
        },
      },
    }

    await this.saveSession(clonedSession)
    await this.recordHistory(newSessionId, 'created', {
      clonedFrom: sourceSessionId,
    })

    return clonedSession
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async initializeDefaultTemplatesIfNeeded(): Promise<void> {
    const defaultTemplates = [
      {
        id: 'developer',
        name: 'Developer',
        description: 'Optimized for software development and coding tasks',
        category: 'developer' as const,
        defaultSettings: { model: 'claude-3-5-sonnet-20241022', temperature: 0.3, maxTokens: 8000 },
        systemPrompt: 'You are an expert software developer assistant.',
        tags: ['development', 'coding', 'engineering'],
        createdAt: Date.now(),
      },
      {
        id: 'writer',
        name: 'Writer',
        description: 'Optimized for content creation and writing tasks',
        category: 'writer' as const,
        defaultSettings: { model: 'claude-3-5-sonnet-20241022', temperature: 0.7, maxTokens: 4000 },
        systemPrompt: 'You are a professional writing assistant.',
        tags: ['writing', 'content', 'communication'],
        createdAt: Date.now(),
      },
      {
        id: 'analyst',
        name: 'Analyst',
        description: 'Optimized for data analysis and research tasks',
        category: 'analyst' as const,
        defaultSettings: { model: 'claude-3-5-sonnet-20241022', temperature: 0.4, maxTokens: 6000 },
        systemPrompt: 'You are a data analyst and research expert.',
        tags: ['analysis', 'research', 'data'],
        createdAt: Date.now(),
      },
    ]

    for (const template of defaultTemplates) {
      try {
        const existing = await this.getTemplate(template.id)
        if (!existing) {
          await this.createTemplate(template as SessionTemplate)
        }
      } catch {
        // Silently ignore errors
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${randomBytes(6).toString('hex')}`
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${randomBytes(4).toString('hex')}`
  }

  private generateShareId(): string {
    return `share_${Date.now()}_${randomBytes(6).toString('hex')}`
  }

  private generateShareCode(): string {
    return randomBytes(8).toString('hex').toUpperCase()
  }

  private generateAccessToken(): string {
    const hash = createHash('sha256')
    hash.update(randomBytes(32))
    return hash.digest('hex')
  }

  private async recordHistory(
    sessionId: string,
    action: SessionHistory['action'],
    details?: Record<string, unknown>,
  ): Promise<void> {
    const historyEntry: SessionHistory = {
      sessionId,
      action,
      timestamp: Date.now(),
      details,
    }

    const filePath = join(this.historyPath, 'history.jsonl')
    const line = JSON.stringify(historyEntry) + '\n'

    try {
      await writeFile(filePath, line, { flag: 'a' })
    } catch {
      // If append fails, try to create the file
      await writeFile(filePath, line, 'utf-8').catch(() => {
        // Silently fail if history tracking fails
      })
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const sessionManager = new SessionManager()

export default sessionManager
