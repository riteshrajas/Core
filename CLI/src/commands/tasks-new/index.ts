import type { Command } from '../../commands.js'

const tasksNew = {
  type: 'local-jsx',
  name: 'tasks-new',
  description: 'Generate questions about tasks and plan implementation',
  load: () => import('./tasks-new.js'),
} satisfies Command

export default tasksNew
