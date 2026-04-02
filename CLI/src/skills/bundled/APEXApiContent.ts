// Content for the APEX-api bundled skill.
// Each .md file is inlined as a string at build time via Bun's text loader.

import csharpAPEXApi from './APEX-api/csharp/APEX-api.md'
import curlExamples from './APEX-api/curl/examples.md'
import goAPEXApi from './APEX-api/go/APEX-api.md'
import javaAPEXApi from './APEX-api/java/APEX-api.md'
import phpAPEXApi from './APEX-api/php/APEX-api.md'
import pythonAgentSdkPatterns from './APEX-api/python/agent-sdk/patterns.md'
import pythonAgentSdkReadme from './APEX-api/python/agent-sdk/README.md'
import pythonAPEXApiBatches from './APEX-api/python/APEX-api/batches.md'
import pythonAPEXApiFilesApi from './APEX-api/python/APEX-api/files-api.md'
import pythonAPEXApiReadme from './APEX-api/python/APEX-api/README.md'
import pythonAPEXApiStreaming from './APEX-api/python/APEX-api/streaming.md'
import pythonAPEXApiToolUse from './APEX-api/python/APEX-api/tool-use.md'
import rubyAPEXApi from './APEX-api/ruby/APEX-api.md'
import skillPrompt from './APEX-api/SKILL.md'
import sharedErrorCodes from './APEX-api/shared/error-codes.md'
import sharedLiveSources from './APEX-api/shared/live-sources.md'
import sharedModels from './APEX-api/shared/models.md'
import sharedPromptCaching from './APEX-api/shared/prompt-caching.md'
import sharedToolUseConcepts from './APEX-api/shared/tool-use-concepts.md'
import typescriptAgentSdkPatterns from './APEX-api/typescript/agent-sdk/patterns.md'
import typescriptAgentSdkReadme from './APEX-api/typescript/agent-sdk/README.md'
import typescriptAPEXApiBatches from './APEX-api/typescript/APEX-api/batches.md'
import typescriptAPEXApiFilesApi from './APEX-api/typescript/APEX-api/files-api.md'
import typescriptAPEXApiReadme from './APEX-api/typescript/APEX-api/README.md'
import typescriptAPEXApiStreaming from './APEX-api/typescript/APEX-api/streaming.md'
import typescriptAPEXApiToolUse from './APEX-api/typescript/APEX-api/tool-use.md'

// @[MODEL LAUNCH]: Update the model IDs/names below. These are substituted into {{VAR}}
// placeholders in the .md files at runtime before the skill prompt is sent.
// After updating these constants, manually update the two files that still hardcode models:
//   - APEX-api/SKILL.md (Current Models pricing table)
//   - APEX-api/shared/models.md (full model catalog with legacy versions and alias mappings)
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'APEX-opus-4-6',
  OPUS_NAME: 'APEX Opus 4.6',
  SONNET_ID: 'APEX-sonnet-4-6',
  SONNET_NAME: 'APEX Sonnet 4.6',
  HAIKU_ID: 'APEX-haiku-4-5',
  HAIKU_NAME: 'APEX Haiku 4.5',
  // Previous Sonnet ID — used in "do not append date suffixes" example in SKILL.md.
  PREV_SONNET_ID: 'APEX-sonnet-4-5',
} satisfies Record<string, string>

export const SKILL_PROMPT: string = skillPrompt

export const SKILL_FILES: Record<string, string> = {
  'csharp/APEX-api.md': csharpAPEXApi,
  'curl/examples.md': curlExamples,
  'go/APEX-api.md': goAPEXApi,
  'java/APEX-api.md': javaAPEXApi,
  'php/APEX-api.md': phpAPEXApi,
  'python/agent-sdk/README.md': pythonAgentSdkReadme,
  'python/agent-sdk/patterns.md': pythonAgentSdkPatterns,
  'python/APEX-api/README.md': pythonAPEXApiReadme,
  'python/APEX-api/batches.md': pythonAPEXApiBatches,
  'python/APEX-api/files-api.md': pythonAPEXApiFilesApi,
  'python/APEX-api/streaming.md': pythonAPEXApiStreaming,
  'python/APEX-api/tool-use.md': pythonAPEXApiToolUse,
  'ruby/APEX-api.md': rubyAPEXApi,
  'shared/error-codes.md': sharedErrorCodes,
  'shared/live-sources.md': sharedLiveSources,
  'shared/models.md': sharedModels,
  'shared/prompt-caching.md': sharedPromptCaching,
  'shared/tool-use-concepts.md': sharedToolUseConcepts,
  'typescript/agent-sdk/README.md': typescriptAgentSdkReadme,
  'typescript/agent-sdk/patterns.md': typescriptAgentSdkPatterns,
  'typescript/APEX-api/README.md': typescriptAPEXApiReadme,
  'typescript/APEX-api/batches.md': typescriptAPEXApiBatches,
  'typescript/APEX-api/files-api.md': typescriptAPEXApiFilesApi,
  'typescript/APEX-api/streaming.md': typescriptAPEXApiStreaming,
  'typescript/APEX-api/tool-use.md': typescriptAPEXApiToolUse,
}
