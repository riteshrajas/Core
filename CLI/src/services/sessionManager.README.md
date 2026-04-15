# SessionManager Service

The `SessionManager` service provides comprehensive session management capabilities for the APEX CLI, including session persistence, templates, sharing, and history tracking.

## Overview

SessionManager handles:
- **Session Persistence**: Save and load sessions with full context preservation
- **Session Templates**: Pre-built templates for common workflows (Developer, Writer, Analyst, etc.)
- **Session Sharing**: Generate secure shareable links for sessions
- **Context Restoration**: Resume sessions and restore application state
- **Session History**: Track all session operations with timestamps
- **Session Cloning**: Duplicate sessions for workflow variations
- **Import/Export**: Exchange sessions between users

## Usage

### Initialization

```typescript
import { sessionManager } from './sessionManager'

// Initialize the session manager (creates directories)
await sessionManager.initialize()
```

### Creating Sessions

```typescript
// Create a new session
const session = await sessionManager.createSession('My Development Session', {
  description: 'Working on feature X',
  template: 'developer', // Optional: Use a template
  projectPath: '/path/to/project',
})

// Or with a template
const session = await sessionManager.createSession('Writing Task', {
  template: 'writer',
})
```

### Loading and Saving

```typescript
// Load a session
const session = await sessionManager.loadSession(sessionId)

// Add a message to the session
const message = await sessionManager.addMessage(sessionId, {
  role: 'user',
  content: 'What should I do next?',
})

// The session is automatically saved when you load or update it
await sessionManager.saveSession(session)
```

### Session Templates

Available built-in templates:
- **developer**: For coding and software development
- **writer**: For content creation and writing
- **analyst**: For data analysis and research
- **architect**: For system design (developer category)
- **tutor**: For teaching and learning
- **creative**: For creative ideation tasks

```typescript
// Get a specific template
const template = await sessionManager.getTemplate('developer')

// List all templates
const templates = await sessionManager.listTemplates()

// Create a custom template
await sessionManager.createTemplate({
  id: 'my-template',
  name: 'My Custom Template',
  description: 'Custom workflow template',
  category: 'custom',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.5,
  },
  systemPrompt: 'Your custom system prompt...',
  createdAt: Date.now(),
})
```

### Session Sharing

```typescript
// Create a shareable link
const shared = await sessionManager.createShareLink(sessionId, {
  expiresIn: 24 * 60 * 60 * 1000, // 24 hours
  maxAccesses: 5, // Optional: Limit access count
  sharedBy: 'user@example.com',
})

// Access code and token
console.log(shared.shareCode) // e.g., "A1B2C3D4E5F6G7H8"
console.log(shared.accessToken) // e.g., "abc123def456..."

// Later, someone can access with the code and token
const accessedSession = await sessionManager.accessSharedSession(
  'A1B2C3D4E5F6G7H8',
  'abc123def456...'
)

// List all shares for a session
const shares = await sessionManager.listSharedSessions(sessionId)

// Revoke a share link
await sessionManager.revokeShareLink(shareId)
```

### Session Management

```typescript
// List active sessions
const sessions = await sessionManager.listSessions()

// List archived sessions
const archived = await sessionManager.listArchivedSessions()

// Archive a completed session
await sessionManager.archiveSession(sessionId)

// Clone a session
const cloned = await sessionManager.cloneSession(sessionId, 'New Name')

// Delete a session
await sessionManager.deleteSession(sessionId)

// Update metadata
await sessionManager.updateSessionMetadata(sessionId, {
  tags: ['important', 'active'],
  description: 'Updated description',
})
```

### Import/Export

```typescript
// Export session as JSON
const json = await sessionManager.exportSession(sessionId)

// Import from JSON
const imported = await sessionManager.importSession(json)
```

### History and Statistics

```typescript
// Get session history
const history = await sessionManager.getHistory(sessionId)
// Returns array of { sessionId, action, timestamp, details }

// Get service statistics
const stats = await sessionManager.getStatistics()
// Returns { activeSessions, archivedSessions, templates, sharedSessions, totalMessages }
```

## Session Structure

### Session

```typescript
interface Session {
  id: string // Unique session ID
  context: SessionContext
  version: string // Service version
}
```

### SessionContext

```typescript
interface SessionContext {
  messages: SessionMessage[]
  settings: SessionSettings
  metadata: SessionMetadata
  tools?: Record<string, unknown>
  memory?: Record<string, unknown>
}
```

### SessionMessage

```typescript
interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    toolUse?: { name: string; input: unknown }
    tags?: string[]
  }
}
```

### SessionSettings

```typescript
interface SessionSettings {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  context?: Record<string, unknown>
  [key: string]: unknown
}
```

### SessionMetadata

```typescript
interface SessionMetadata {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  lastAccessedAt: number
  messageCount: number
  tokenUsage?: { input: number; output: number; total: number }
  tags?: string[]
  projectPath?: string
  customData?: Record<string, unknown>
}
```

## Storage

Sessions are stored in the user's home directory:

```
~/.apex/sessions/
├── active/           # Active sessions (session_*.json)
├── archive/          # Archived sessions (session_*.json)
├── templates/        # Session templates (*.json)
├── shared/           # Shared session metadata (share_*.json)
└── history/          # Operation history (history.jsonl)
```

Each session is stored as a complete JSON file with all context, messages, and metadata.

## Security

### Share Links

- Share codes are 16-character hex strings (128-bit randomness)
- Access tokens are SHA-256 hashes (256-bit randomness)
- Shares can expire after a specified time
- Shares can limit the number of accesses
- Expired shares are automatically cleaned up on next list operation

### Local Storage

- Sessions are stored locally with standard file permissions
- Users should be aware that archived sessions remain in the file system
- Implement additional encryption if handling sensitive data

## Best Practices

1. **Use Templates**: Start sessions with relevant templates to get appropriate defaults
2. **Tag Sessions**: Use tags to organize and find sessions later
3. **Regular Archiving**: Archive completed sessions to keep active list manageable
4. **Token Usage**: Track token usage to monitor API costs
5. **Secure Shares**: Use short expiration times and access limits for sensitive sessions
6. **Metadata**: Include meaningful descriptions and project paths for context
7. **Cloning**: Clone sessions for variations instead of creating from scratch

## API Reference

### Main Methods

- `initialize()` - Initialize directory structure
- `createSession(name, options)` - Create new session
- `loadSession(sessionId)` - Load session from disk
- `saveSession(session)` - Save session to disk
- `addMessage(sessionId, message)` - Add message to session
- `getSessionContext(sessionId)` - Get session context
- `restoreSession(sessionId)` - Restore and resume session

### Session Management

- `listSessions()` - List active sessions
- `listArchivedSessions()` - List archived sessions
- `archiveSession(sessionId)` - Archive session
- `deleteSession(sessionId)` - Delete session
- `cloneSession(sourceId, newName)` - Clone session
- `updateSessionMetadata(sessionId, updates)` - Update metadata

### Templates

- `createTemplate(template)` - Create template
- `getTemplate(templateId)` - Get template
- `listTemplates()` - List all templates

### Sharing

- `createShareLink(sessionId, options)` - Create share link
- `accessSharedSession(code, token)` - Access shared session
- `listSharedSessions(sessionId?)` - List shared sessions
- `revokeShareLink(shareId)` - Revoke share link

### Utilities

- `exportSession(sessionId)` - Export as JSON
- `importSession(json)` - Import from JSON
- `getHistory(sessionId?)` - Get operation history
- `getStatistics()` - Get service statistics

## Example Workflow

```typescript
import { sessionManager } from './sessionManager'

// Initialize
await sessionManager.initialize()

// Create a developer session
const session = await sessionManager.createSession('API Development', {
  template: 'developer',
  projectPath: '/projects/api',
  description: 'Building REST API endpoints',
})

// Continue with multiple messages
await sessionManager.addMessage(session.id, {
  role: 'user',
  content: 'How should I structure the authentication?',
})

// Save work (happens automatically)
await sessionManager.saveSession(session)

// Later, share with a teammate
const shared = await sessionManager.createShareLink(session.id, {
  expiresIn: 3 * 24 * 60 * 60 * 1000, // 3 days
  sharedBy: 'developer@company.com',
})

console.log(`Share code: ${shared.shareCode}`)

// When done, archive it
await sessionManager.archiveSession(session.id)
```
