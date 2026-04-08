import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'

type PromptSpec = {
  name: string
  description: string
  progressMessage: string
  argumentHint?: string
  prompt: (args: string) => string
}

function toBlocks(text: string): ContentBlockParam[] {
  return [{ type: 'text', text }]
}

function makePromptCommand(spec: PromptSpec): Command {
  const basePrompt = spec.prompt('')
  return {
    type: 'prompt',
    name: spec.name,
    description: spec.description,
    argumentHint: spec.argumentHint,
    progressMessage: spec.progressMessage,
    source: 'builtin',
    get contentLength() {
      return basePrompt.length
    },
    async getPromptForCommand(args: string, _context: ToolUseContext) {
      return toBlocks(spec.prompt(args.trim()))
    },
  }
}

export const productivityCommands: Command[] = [
  makePromptCommand({
    name: 'preview',
    description: 'Live preview a UI component in a lightweight sandbox',
    progressMessage: 'preparing component preview',
    argumentHint: '<framework> <component-name>',
    prompt: args => `
Create a fast local live-preview workflow for UI components.

User request args: "${args || '(none provided)'}"

Goals:
1. Detect framework (React/Vue/Angular) from args first, then repo context.
2. Implement a /preview flow that renders the target component in an isolated sandbox (iframe or equivalent local preview shell).
3. Generate or update minimal preview entry files, keep existing project patterns.
4. Print exact run instructions and touched files.

If args are missing, ask one concise question for framework + component name before writing.
`,
  }),
  makePromptCommand({
    name: 'review-summarize',
    description: 'Summarize a PR with key diffs, style issues, and test impact',
    progressMessage: 'summarizing pull request',
    argumentHint: '<pr-number-or-url>',
    prompt: args => `
Produce a concise code-review summary for the target PR.

Target: "${args || '(none provided)'}"

Output in markdown with these sections:
1. Overview (3-6 bullets)
2. Recommended changes
3. Style/quality issues
4. Test impact (what should be added/updated)

If the target is missing, ask for PR number/URL.
`,
  }),
  makePromptCommand({
    name: 'task-commit',
    description: 'Create branch, commit, push, and open/update PR for a task',
    progressMessage: 'creating task branch and PR',
    argumentHint: '<task description>',
    prompt: args => `
Execute a task-to-PR workflow.

Task: "${args || '(none provided)'}"

Required behavior:
1. If needed, create a branch from default branch.
2. Implement only the requested task.
3. Commit with a clear message.
4. Push and create/update PR.
5. Return PR URL and a short summary.

If task details are missing, ask for one concrete objective.
`,
  }),
  makePromptCommand({
    name: 'scan-deps',
    description: 'Scan dependencies for risk and suggest safe upgrade commands',
    progressMessage: 'scanning dependency risk',
    prompt: () => `
Run a dependency risk audit for this repo.

Requirements:
1. Detect package managers present (npm/yarn/pnpm/bun/pip/go/cargo/etc.).
2. Run appropriate audit/check commands.
3. Summarize vulnerabilities by severity and transitive root.
4. Provide exact upgrade/remediation commands.
5. Highlight likely breaking-change risks separately.
`,
  }),
  makePromptCommand({
    name: 'audit-arch',
    description: 'Audit architecture conformance against repository patterns',
    progressMessage: 'auditing architecture compliance',
    prompt: () => `
Generate an architecture compliance report for this repository.

Checklist:
1. Infer architectural conventions from docs and existing code.
2. Check module boundaries and layering.
3. Flag violations with file references.
4. Recommend minimal, actionable fixes.

Output markdown with: Compliant, Partial, Violations.
`,
  }),
  makePromptCommand({
    name: 'link-issue',
    description: 'Link work to an issue and update issue status context',
    progressMessage: 'linking issue and work item',
    argumentHint: '<issue-id-or-url>',
    prompt: args => `
Link this work to an issue tracker item.

Issue target: "${args || '(none provided)'}"

Do the following:
1. Detect tracker context (GitHub issues/Jira/etc. available tools).
2. Add/update linkage from branch/PR/commit to the issue.
3. Post a concise status update comment.

If tracker automation is unavailable, produce copy-paste content and exact manual steps.
`,
  }),
  makePromptCommand({
    name: 'gen-handler',
    description: 'Generate a language-specific handler skeleton',
    progressMessage: 'generating handler scaffold',
    argumentHint: '<language> <handler-name>',
    prompt: args => `
Create a polyglot handler skeleton matching repository style.

Args: "${args || '(none provided)'}"

Expectations:
1. Parse target language and handler/function name.
2. Generate idiomatic skeleton + tests where applicable.
3. Place files in the conventionally correct location.

If args are missing, ask for language and handler name.
`,
  }),
  makePromptCommand({
    name: 'docs-gen',
    description: 'Generate API/project documentation from code and comments',
    progressMessage: 'generating documentation',
    argumentHint: '[output-file]',
    prompt: args => `
Generate one-click documentation from current codebase.

Output target: "${args || 'API.md'}"

Requirements:
1. Discover public APIs/commands/interfaces.
2. Create concise markdown docs with examples.
3. Preserve existing docs style if present.
`,
  }),
  makePromptCommand({
    name: 'autocomplete',
    description: 'Set up context-aware autocomplete integration guidance',
    progressMessage: 'preparing autocomplete integration',
    prompt: () => `
Prepare context-aware autocomplete setup for this project.

Deliver:
1. Current capabilities available in this repo/CLI.
2. Steps to integrate with editor extension workflow.
3. Recommended config snippets and validation checks.
`,
  }),
  makePromptCommand({
    name: 'sec-scan',
    description: 'Run a security scan and return prioritized remediation steps',
    progressMessage: 'running security scan',
    prompt: () => `
Perform a static security scan focused on practical findings.

Return:
1. Risk score (High/Medium/Low buckets)
2. Findings with file references
3. Concrete remediation actions
4. Suggested CI check gating strategy
`,
  }),
  makePromptCommand({
    name: 'lint-setup',
    description: 'Auto-configure linting/formatting for repository style',
    progressMessage: 'configuring lint and format stack',
    prompt: () => `
Set up lint + formatting according to this repository conventions.

Requirements:
1. Detect stack/language.
2. Add config files with minimal noise.
3. Add scripts to package/build config where appropriate.
4. Avoid disruptive reformat of unrelated files.
`,
  }),
  makePromptCommand({
    name: 'e2e-scaffold',
    description: 'Scaffold end-to-end tests based on app routes/features',
    progressMessage: 'scaffolding e2e tests',
    argumentHint: '[area-or-route]',
    prompt: args => `
Scaffold a full-stack end-to-end test suite.

Target area: "${args || '(all core routes/features)'}"

Expectations:
1. Pick framework (Playwright/Cypress) based on repo context.
2. Create baseline test config + representative tests.
3. Include run instructions and CI hook suggestion.
`,
  }),
  makePromptCommand({
    name: 'upgrade-stack',
    description: 'Analyze and propose stack upgrades with safe rollout plan',
    progressMessage: 'analyzing stack upgrades',
    prompt: () => `
Run a dependency upgrade analysis across the project stack.

Deliver:
1. Outdated direct/transitive dependencies.
2. Safe upgrade order and commands.
3. Breaking-change hotspots and mitigation plan.
4. Optional PR batching strategy.
`,
  }),
  makePromptCommand({
    name: 'gen-assert',
    description: 'Generate reusable custom assertion helpers',
    progressMessage: 'generating assertion helpers',
    argumentHint: '<assertion-name>',
    prompt: args => `
Generate a custom assertion helper library addition.

Requested assertion: "${args || '(none provided)'}"

Include helper implementation, tests, and usage examples.
Ask for assertion name if missing.
`,
  }),
  makePromptCommand({
    name: 'wizard',
    description: 'Scaffold implementation from a product/design spec prompt',
    progressMessage: 'running document-to-code wizard',
    argumentHint: '<spec-or-feature-brief>',
    prompt: args => `
Run a document-to-code wizard workflow.

Spec input: "${args || '(none provided)'}"

Flow:
1. Parse spec intent and constraints.
2. Produce an initial implementation scaffold.
3. Generate next-step checklist for completion.

If no spec is provided, ask for a concise feature brief.
`,
  }),
  makePromptCommand({
    name: 'new-app',
    description: 'Generate a language/framework starter kit scaffold',
    progressMessage: 'scaffolding starter kit',
    argumentHint: '<framework-or-language>',
    prompt: args => `
Create a starter-kit scaffold.

Requested target: "${args || '(none provided)'}"

Requirements:
1. Generate minimal project structure and config.
2. Add essential scripts and quality tooling.
3. Keep scaffold aligned with modern defaults.

Ask for framework/language when missing.
`,
  }),
  makePromptCommand({
    name: 'search-bugs',
    description: 'Search issues/PRs for similar bugs and related fixes',
    progressMessage: 'searching related bugs',
    argumentHint: '<query>',
    prompt: args => `
Search for similar bugs in open issues/PRs and summarize matches.

Query: "${args || '(none provided)'}"

Output:
1. Closest related issues/PRs
2. Shared symptoms/root causes
3. Reusable fix patterns

Ask for a bug query if missing.
`,
  }),
  makePromptCommand({
    name: 'explain',
    description: 'Explain code in concise human-readable markdown',
    progressMessage: 'explaining code',
    argumentHint: '<path-or-symbol>',
    prompt: args => `
Explain target code in concise markdown.

Target: "${args || '(none provided)'}"

Include:
1. What it does
2. Key control flow/data flow
3. Edge cases and risks
4. Quick usage/example note

Ask for target path/symbol when missing.
`,
  }),
]
