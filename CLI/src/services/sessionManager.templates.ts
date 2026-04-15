/**
 * SessionManager Templates
 *
 * Pre-built session templates for common APEX CLI workflows
 */

import type { SessionTemplate } from './sessionManager.js'

export const DEVELOPER_TEMPLATE: SessionTemplate = {
  id: 'developer',
  name: 'Developer',
  description: 'Optimized for software development and coding tasks',
  category: 'developer',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.3,
    maxTokens: 8000,
  },
  systemPrompt: `You are an expert software developer assistant. Help with:
- Code review and optimization
- Bug fixing and debugging
- Architecture and design patterns
- Testing strategies
- Performance optimization
- Best practices and conventions

Provide clear, well-documented code examples. Explain complex concepts thoroughly.`,
  tags: ['development', 'coding', 'engineering'],
  createdAt: Date.now(),
}

export const WRITER_TEMPLATE: SessionTemplate = {
  id: 'writer',
  name: 'Writer',
  description: 'Optimized for content creation and writing tasks',
  category: 'writer',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4000,
  },
  systemPrompt: `You are a professional writing assistant. Help with:
- Content creation and composition
- Editing and proofreading
- Style and tone refinement
- Structure and organization
- Clarity and readability
- Audience engagement

Provide thoughtful feedback and suggestions. Maintain consistent voice and style.`,
  tags: ['writing', 'content', 'communication'],
  createdAt: Date.now(),
}

export const ANALYST_TEMPLATE: SessionTemplate = {
  id: 'analyst',
  name: 'Analyst',
  description: 'Optimized for data analysis and research tasks',
  category: 'analyst',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.4,
    maxTokens: 6000,
  },
  systemPrompt: `You are a data analyst and research expert. Help with:
- Data analysis and interpretation
- Pattern recognition
- Statistical analysis
- Research methodology
- Problem-solving and reasoning
- Insights and recommendations

Provide thorough analysis with supporting evidence. Use data-driven approaches.`,
  tags: ['analysis', 'research', 'data'],
  createdAt: Date.now(),
}

export const ARCHITECT_TEMPLATE: SessionTemplate = {
  id: 'architect',
  name: 'Architect',
  description: 'Optimized for system design and architecture tasks',
  category: 'developer',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.4,
    maxTokens: 8000,
  },
  systemPrompt: `You are a system architect and design expert. Help with:
- System architecture and design
- Scalability and performance
- Technology selection
- Deployment strategies
- Infrastructure planning
- Security and reliability

Provide comprehensive architectural guidance with diagrams and explanations where helpful.`,
  tags: ['architecture', 'design', 'systems'],
  createdAt: Date.now(),
}

export const TUTOR_TEMPLATE: SessionTemplate = {
  id: 'tutor',
  name: 'Tutor',
  description: 'Optimized for teaching and learning tasks',
  category: 'custom',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.6,
    maxTokens: 5000,
  },
  systemPrompt: `You are an experienced tutor and educator. Help with:
- Explaining complex concepts
- Breaking down problems into steps
- Asking guiding questions
- Providing examples and analogies
- Identifying knowledge gaps
- Building understanding progressively

Adapt your explanations to the learner's level. Be patient and encouraging.`,
  tags: ['education', 'learning', 'teaching'],
  createdAt: Date.now(),
}

export const CREATIVE_TEMPLATE: SessionTemplate = {
  id: 'creative',
  name: 'Creative',
  description: 'Optimized for creative and ideation tasks',
  category: 'custom',
  defaultSettings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.8,
    maxTokens: 4000,
  },
  systemPrompt: `You are a creative thinking partner. Help with:
- Brainstorming and ideation
- Creative problem-solving
- Innovation and design thinking
- Storytelling and narrative
- Unconventional solutions
- Exploring possibilities

Encourage bold ideas. Think outside the box. Build on suggestions creatively.`,
  tags: ['creativity', 'innovation', 'brainstorming'],
  createdAt: Date.now(),
}

export const DEFAULT_TEMPLATES = [
  DEVELOPER_TEMPLATE,
  WRITER_TEMPLATE,
  ANALYST_TEMPLATE,
  ARCHITECT_TEMPLATE,
  TUTOR_TEMPLATE,
  CREATIVE_TEMPLATE,
]

/**
 * Initialize default templates in the session manager
 */
export async function initializeDefaultTemplates(
  sessionManager: any, // Avoid circular dependency
): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    try {
      const existing = await sessionManager.getTemplate(template.id)
      if (!existing) {
        await sessionManager.createTemplate(template)
      }
    } catch {
      // Silently ignore errors
    }
  }
}
