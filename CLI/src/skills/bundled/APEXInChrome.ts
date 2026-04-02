import { BASE_CHROME_PROMPT } from '../../utils/APEXInChrome/prompt.js'
import { getChromeBrowserTools } from '../../utils/APEXInChrome/package.js'
import { shouldAutoEnableAPEXInChrome } from '../../utils/APEXInChrome/setup.js'
import { registerBundledSkill } from '../bundledSkills.js'

const SKILL_ACTIVATION_MESSAGE = `
Now that this skill is invoked, you have access to Chrome browser automation tools. You can now use the mcp__APEX-in-chrome__* tools to interact with web pages.

IMPORTANT: Start by calling mcp__APEX-in-chrome__tabs_context_mcp to get information about the user's current browser tabs.
`

export function registerAPEXInChromeSkill(): void {
  const allowedTools = getChromeBrowserTools().map(
    tool => `mcp__APEX-in-chrome__${tool.name}`,
  )

  registerBundledSkill({
    name: 'APEX-in-chrome',
    description:
      'Automates your Chrome browser to interact with web pages - clicking elements, filling forms, capturing screenshots, reading console logs, and navigating sites. Opens pages in new tabs within your existing Chrome session. Requires site-level permissions before executing (configured in the extension).',
    whenToUse:
      'When the user wants to interact with web pages, automate browser tasks, capture screenshots, read console logs, or perform any browser-based actions. Always invoke BEFORE attempting to use any mcp__APEX-in-chrome__* tools.',
    allowedTools,
    userInvocable: true,
    isEnabled: () => shouldAutoEnableAPEXInChrome(),
    async getPromptForCommand(args) {
      let prompt = `${BASE_CHROME_PROMPT}\n${SKILL_ACTIVATION_MESSAGE}`
      if (args) {
        prompt += `\n## Task\n\n${args}`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
