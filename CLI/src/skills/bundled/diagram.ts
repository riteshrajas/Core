import { registerBundledSkill } from '../bundledSkills.js'

const DIAGRAM_PROMPT = `# /diagram — generate architecture, data flow, or structural diagrams

The user wants to generate a visual diagram (e.g., architecture, data flow, or proposed changes). You can generate diagrams using Mermaid.js syntax (which can be rendered in Markdown) or optionally excalidraw specs if requested.

## Input Handling
The user might provide a file path, a commit diff, a list of components, or a brief description. Analyze the input to understand the structural relationships, sequence of events, or system architecture.

## Context Awareness
Use tools to read the referenced files or diffs if they are not fully clear from the user's prompt. Ensure the diagram accurately reflects the system's state or the proposed changes.

## Output Structure
Output a Markdown document with an embedded Mermaid diagram block (\`\`\`mermaid ... \`\`\`).
Explain the diagram briefly before or after the code block.
Offer a short explanation of the key components and their relationships.
If the user prefers a file to be saved, suggest a commit-friendly diff for the generated diagram Markdown file.

## Follow-up / Validation
Suggest the user manually review the diagram. If there are changes needed, you can iterate on it by taking their feedback or generating a diff verification against the desired shape.
`

export function registerDiagramSkill(): void {
  registerBundledSkill({
    name: 'diagram',
    description:
      'Render a Mermaid diagram (e.g., architecture, data flow, or proposed changes) from a file, component list, or diff.',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = DIAGRAM_PROMPT
      if (args) {
        prompt += `\n## User Request\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
