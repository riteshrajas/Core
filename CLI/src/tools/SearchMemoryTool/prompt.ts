export const DESCRIPTION =
  'Search long-term memory semantically and return the most relevant snippets.'

export const PROMPT = `Use this tool to explicitly search memory when the user asks you to recall prior context, preferences, incidents, or project decisions.

This tool performs semantic retrieval (not just keyword matching) and returns relevance-ranked snippets.

Use it when:
- The user asks what happened before, or asks you to remember/recall context.
- You need specific prior decisions, constraints, or preferences from memory.
- You need to verify whether memory contains context before making assumptions.

Avoid it when:
- You already have the exact answer in the current conversation context.
- The user asked you to ignore memory for this request.`

