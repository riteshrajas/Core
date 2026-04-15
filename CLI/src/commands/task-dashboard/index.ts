import type { Command } from '../../types/command.js'

const taskDashboard = {
  type: 'local-jsx',
  name: 'task-dashboard',
  aliases: ['tasks-visual', 'task-viz', 'dashboard'],
  group: 'planning',
  tags: ['tasks', 'visualization', 'progress', 'dependencies'],
  description: 'Visualize task hierarchy, progress, and dependencies in real-time',
  argumentHint: '[--view <tree|graph|timeline|json>] [--filter <status>] [--show-eta] [--show-critical-path]',
  examples: [
    {
      description: 'Display task dashboard in default tree view',
      command: '/task-dashboard',
    },
    {
      description: 'Show tasks in graph visualization format',
      command: '/task-dashboard --view graph',
    },
    {
      description: 'Display timeline view of task execution',
      command: '/task-dashboard --view timeline',
    },
    {
      description: 'Show only in-progress tasks with ETA estimates',
      command: '/task-dashboard --filter in_progress --show-eta',
    },
    {
      description: 'Display critical path for project completion',
      command: '/task-dashboard --show-critical-path',
    },
    {
      description: 'Export task data as JSON',
      command: '/task-dashboard --view json',
    },
  ],
  load: () => import('./task-dashboard.js'),
} satisfies Command

export default taskDashboard
