import type { Command } from '../commands.js'

const ALLOWED_TOOLS = [
  'Bash(*)',
  'FileRead(*)',
  'FileWrite(*)',
  'Glob(*)',
]

interface AutofixState {
  originalCommand: string
  attempt: number
  maxAttempts: number
  previousErrors: string[]
}

function getPromptContent(state: AutofixState): string {
  const attemptCount = state.attempt
  const maxAttempts = state.maxAttempts
  
  let history = ''
  if (state.previousErrors.length > 0) {
    history = `## Previous Attempts\n\n${state.previousErrors
      .map(
        (err, i) =>
          `### Attempt ${i + 1}\nError:\n\`\`\`\n${err}\n\`\`\``,
      )
      .join('\n\n')}\n\n`
  }

  return `${history}## Auto-Fix Task (Attempt ${attemptCount}/${maxAttempts})

You are in recursive auto-fix mode. Your job is to:

1. **Run the command**: Execute the original command
2. **If it succeeds**: Stop immediately and confirm success
3. **If it fails**: 
   - Analyze the error message
   - Identify the root cause
   - Execute a fix command (e.g., install dependencies, create directories, fix permissions)
   - Retry the original command using Bash tool
   - Repeat until success or max attempts reached

## Original Command

\`\`\`
${state.originalCommand}
\`\`\`

## Rules

- Run the original command first using BashTool
- If it fails, the error output will tell you what to fix
- Execute ONLY ONE fix command per attempt
- After each fix, retry the original command
- Do not make assumptions — read error messages carefully
- Common fixes:
  - Missing packages: \`pip install <package>\` or \`npm install\` or \`bun install\`
  - Missing directories: \`mkdir -p <path>\`
  - Missing files: \`touch <file>\` or create with FileWriteTool
  - Permission issues: \`chmod +x <file>\`
  - Path not in PATH: add to environment or use full path
- If you hit max attempts (${maxAttempts}) without success, report the final error

## Action Plan

1. Call BashTool with the original command
2. Inspect the output
3. If error detected:
   - Identify and execute ONE fix
   - Re-run the original command
4. Repeat until success or max attempts
5. Report the result (success or final failure)

Start now. Run the original command first.`
}

const command = {
  type: 'prompt',
  name: 'autofix',
  description:
    'Run a command and automatically fix errors (recursive). Example: /autofix python athera_server.py',
  allowedTools: ALLOWED_TOOLS,
  contentLength: 0,
  progressMessage: 'running auto-fix loop',
  source: 'builtin',
  argsDescription: '<command> - The command to run and auto-fix on failure',
  async getPromptForCommand(argsString: string, context) {
    if (!argsString?.trim()) {
      return [
        {
          type: 'text',
          text: 'Please provide a command to run. Example: `/autofix python src/bridge/athera_server.py`',
        },
      ]
    }

    const state: AutofixState = {
      originalCommand: argsString.trim(),
      attempt: 1,
      maxAttempts: 5,
      previousErrors: [],
    }

    const promptContent = getPromptContent(state)

    // Return a prompt that will be sent to APEX
    return [
      {
        type: 'text',
        text: promptContent,
      },
    ]
  },
} satisfies Command

export default command
