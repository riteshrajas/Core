import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  taskVisualizer,
  type AggregateProgress,
  type TaskNode as VisualTaskNode,
} from '../../services/taskVisualizer.js'

type TaskStatus = VisualTaskNode['status']

const VALID_STATUSES: readonly TaskStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'blocked',
]

function formatDuration(ms: number): string {
  if (!ms) return '0s'
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor(ms / (1000 * 60 * 60))

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatEtaTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

function ProgressBar({ progress, width = 20 }: { progress: number; width?: number }): React.ReactNode {
  const filled = Math.floor((progress / 100) * width)
  const empty = width - filled
  return `[${Array(filled + 1).join('=')}${Array(empty + 1).join(' ')}] ${progress.toFixed(0)}%`
}

function TaskRow({ id, name, progress, status, dependencies, showEta, estimatedEndTime }: {
  id: string
  name: string
  progress: number
  status: string
  dependencies: string[]
  showEta: boolean
  estimatedEndTime?: number
}): React.ReactNode {
  const statusIcon = {
    pending: '○',
    in_progress: '◐',
    completed: '●',
    failed: '✗',
    blocked: '⊘',
  }[status as keyof typeof statusIcon] || '?'

  const statusColor = {
    pending: 'gray',
    in_progress: 'yellow',
    completed: 'green',
    failed: 'red',
    blocked: 'magenta',
  }[status as keyof typeof statusColor] || 'white'

  return (
    <Box key={id} flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={statusColor}>{statusIcon}</Text>
        <Text> {name.padEnd(30)}</Text>
        <Text dimColor>{ProgressBar({ progress })}</Text>
      </Box>
      {dependencies && dependencies.length > 0 && (
        <Text dimColor marginLeft={2} fontSize="small">
          depends on: {dependencies.join(', ')}
        </Text>
      )}
      {showEta && estimatedEndTime && (
        <Text dimColor marginLeft={2} fontSize="small">
          ETA: {formatEtaTime(estimatedEndTime)}
        </Text>
      )}
    </Box>
  )
}

function AggregateStats({ stats, showEta }: { stats: AggregateProgress; showEta: boolean }): React.ReactNode {
  return (
    <Box flexDirection="column" marginBottom={2} borderStyle="round" borderColor="gray" padding={1}>
      <Text bold>Overall Progress</Text>
      <Text>{ProgressBar({ progress: stats.overallPercentage, width: 30 })}</Text>
      <Box marginTop={1} flexDirection="row" gap={2}>
        <Box flexDirection="column">
          <Text dimColor>Completed: {stats.completedTasks}/{stats.totalTasks}</Text>
          <Text dimColor>In Progress: {stats.inProgressTasks}</Text>
        </Box>
        <Box flexDirection="column">
          <Text dimColor>Pending: {stats.pendingTasks}</Text>
          <Text dimColor>Blocked: {stats.blockedTasks}</Text>
          <Text dimColor>Failed: {stats.failedTasks}</Text>
        </Box>
      </Box>
      {showEta && stats.estimatedTimeRemaining && (
        <Box marginTop={1}>
          <Text dimColor>
            ETA: {formatDuration(stats.estimatedTimeRemaining)}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function filterTasks(tasks: VisualTaskNode[], filterStatus?: string): VisualTaskNode[] {
  if (!filterStatus) return tasks
  return tasks.filter((task) => task.status === filterStatus)
}

function CriticalPathView(): React.ReactNode {
  const criticalPath = taskVisualizer.getCriticalPath()

  if (!criticalPath || criticalPath.length === 0) {
    return <Text dimColor>No critical path tasks identified</Text>
  }

  return (
    <Box flexDirection="column" marginBottom={2} borderStyle="round" borderColor="red" padding={1}>
      <Text bold color="red">Critical Path</Text>
      {criticalPath.map((task, index) => (
        <Box key={task.id} marginLeft={2}>
          <Text color="red">
            {index === 0 ? '└─' : '├─'} {task.name}
          </Text>
          {task.estimatedDuration && (
            <Text dimColor marginLeft={2}>
              ({formatDuration(task.estimatedDuration)})
            </Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

function TreeView({
  tasks,
  showEta,
}: {
  tasks: VisualTaskNode[]
  showEta: boolean
}): React.ReactNode {
  if (!tasks || tasks.length === 0) {
    return <Text dimColor>No tasks to display</Text>
  }

  return (
    <Box flexDirection="column">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          id={task.id}
          name={task.name}
          progress={task.progress}
          status={task.status}
          dependencies={task.dependencies}
          showEta={showEta}
          estimatedEndTime={task.metrics.estimatedEndTime}
        />
      ))}
    </Box>
  )
}

function GraphView({ tasks }: { tasks: VisualTaskNode[] }): React.ReactNode {
  if (tasks.length === 0) {
    return <Text dimColor>No tasks to display</Text>
  }

  const taskIds = new Set(tasks.map((task) => task.id))
  let output = 'digraph TaskGraph {\n'
  output += '  rankdir=LR;\n'
  output += '  node [shape=box];\n\n'

  for (const task of tasks) {
    output += `  "${task.id}" [label="${task.name} (${task.progress.toFixed(0)}%)"];\n`
  }

  output += '\n'

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (taskIds.has(depId)) {
        output += `  "${depId}" -> "${task.id}";\n`
      }
    }
  }

  output += '}\n'
  return <Text>{output}</Text>
}

function TimelineView({ tasks }: { tasks: VisualTaskNode[] }): React.ReactNode {
  const startedTasks = tasks.filter((task) => task.startedAt)
  if (startedTasks.length === 0) {
    return <Text dimColor>No started tasks</Text>
  }

  const minTime = Math.min(...startedTasks.map((task) => task.startedAt || Date.now()))
  const maxTime = Math.max(
    ...startedTasks.map((task) => task.completedAt || task.metrics.estimatedEndTime || Date.now()),
  )
  const timelineLength = 60
  const timespan = Math.max(1, maxTime - minTime)

  let output = 'Task Timeline:\n'
  output += '0' + ' '.repeat(timelineLength - 2) + 'now\n'

  for (const task of startedTasks) {
    const start = task.startedAt || minTime
    const end = task.completedAt || task.metrics.estimatedEndTime || Date.now()
    const startPos = Math.floor(((start - minTime) / timespan) * timelineLength)
    const endPos = Math.floor(((end - minTime) / timespan) * timelineLength)

    let timeline = ' '.repeat(startPos)
    timeline += '='.repeat(Math.max(1, endPos - startPos))
    timeline += ' '.repeat(Math.max(0, timelineLength - endPos))
    output += `${task.status.padEnd(10)} ${task.name.padEnd(20)} ${timeline}\n`
  }

  return <Text>{output}</Text>
}

function JSONView({
  tasks,
  aggregateStats,
  showEta,
}: {
  tasks: VisualTaskNode[]
  aggregateStats: AggregateProgress
  showEta: boolean
}): React.ReactNode {
  const jsonOutput = JSON.stringify(
    {
      aggregate: aggregateStats,
      tasks: tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        progress: task.progress,
        dependencies: task.dependencies,
        metrics: task.metrics,
        ...(showEta && task.metrics.estimatedEndTime
          ? { estimatedEndTime: new Date(task.metrics.estimatedEndTime).toISOString() }
          : {}),
        ...(task.metadata ? { metadata: task.metadata } : {}),
      })),
      criticalPath: taskVisualizer.getCriticalPath().map((task) => task.id),
    },
    null,
    2,
  )
  return <Text>{jsonOutput}</Text>
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  // Parse arguments to determine view mode and options
  const args = context.args || []
  let viewMode: 'tree' | 'graph' | 'timeline' | 'json' = 'tree'
  let filterStatus: string | undefined
  let showEta = false
  let showCriticalPath = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--view' && args[i + 1]) {
      const mode = args[i + 1]
      if (['tree', 'graph', 'timeline', 'json'].includes(mode)) {
        viewMode = mode as 'tree' | 'graph' | 'timeline' | 'json'
      }
      i++
    } else if (args[i] === '--filter' && args[i + 1]) {
      filterStatus = args[i + 1]
      i++
    } else if (args[i] === '--show-eta') {
      showEta = true
    } else if (args[i] === '--show-critical-path') {
      showCriticalPath = true
    }
  }

  const allTasks = taskVisualizer.getExecutionOrder()
  const normalizedFilterStatus = filterStatus?.trim()
  const filterIsValid = !normalizedFilterStatus || VALID_STATUSES.includes(normalizedFilterStatus as TaskStatus)
  const visibleTasks = filterIsValid ? filterTasks(allTasks, normalizedFilterStatus) : allTasks
  const aggregateStats = taskVisualizer.getAggregateProgress(
    normalizedFilterStatus ? visibleTasks.map((task) => task.id) : undefined,
  )

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={2}>
        <Text bold color="cyan">
          📊 Task Dashboard
        </Text>
      </Box>

      <AggregateStats stats={aggregateStats} showEta={showEta} />

      {!filterIsValid && normalizedFilterStatus && (
        <Box marginBottom={1}>
          <Text color="yellow">
            Unknown status filter "{normalizedFilterStatus}". Valid values: {VALID_STATUSES.join(', ')}
          </Text>
        </Box>
      )}

      {showCriticalPath && (
        <CriticalPathView />
      )}

      <Box marginBottom={1} borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text bold>View: {viewMode}</Text>
        {normalizedFilterStatus && filterIsValid && (
          <Text dimColor>Filter: {normalizedFilterStatus}</Text>
        )}
        <Box marginTop={1}>
          {viewMode === 'tree' && <TreeView tasks={visibleTasks} showEta={showEta} />}
          {viewMode === 'graph' && <GraphView tasks={visibleTasks} />}
          {viewMode === 'timeline' && <TimelineView tasks={visibleTasks} />}
          {viewMode === 'json' && (
            <JSONView tasks={visibleTasks} aggregateStats={aggregateStats} showEta={showEta} />
          )}
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text dimColor fontSize="small">
          Use --view [tree|graph|timeline|json] | --filter [pending|in_progress|completed|failed|blocked] | --show-eta | --show-critical-path
        </Text>
      </Box>
    </Box>
  )
}
