import { registerBundledSkill } from '../bundledSkills.js'

const FRONTEND_DESIGN_PROMPT = `# /frontend-design — generate Tailwind/Material-UI compliant HTML/CSS/React code

The user wants to generate UI prototypes, reducing boilerplate and enforcing consistency across screens.
The generated code must honor the repository's design system, with optional theming and accessibility checks.

## Input Handling
The user might provide a component name, a spec file (JSON/YAML) listing props, slots, and styles, or a description of the desired UI.
Read the spec files or the description carefully to understand what needs to be built.

## Context Awareness
Automatically detect existing design system usage in the repo (e.g., Tailwind config, MUI theme) by checking for configuration files or reading existing component implementations.
Adapt the generated output to match the detected style guide and configuration.
Expose a plugin hook/extension conceptually so teams can supply custom component libraries or icon sets if they request it.

## Rendering / Output
Generate the corresponding HTML, CSS, or React component code.
If applicable, invoke a small script or template logic to plug data into a base component.
Ensure the code uses the correct classes (Tailwind) or components/props (MUI).
Provide a preview or suggest a commit-friendly diff for the generated UI component so it can jump straight into tests or stories.

## Post-render interaction
Recommend the user to verify the generated component by running the local development server or storybook.
`

export function registerFrontendDesignSkill(): void {
  registerBundledSkill({
    name: 'frontend-design',
    description:
      'Generate Tailwind/Material-UI compliant HTML/CSS/React code honoring the repo design system.',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = FRONTEND_DESIGN_PROMPT
      if (args) {
        prompt += `\n## User Request\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
