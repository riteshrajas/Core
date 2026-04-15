import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { taskVisualizer, type VisualizationOptions, type AggregateProgress } from '../../services/taskVisualizer.js'

interface TaskDashboardProps {
  context: LocalJSXCommandContext
  onDone: LocalJSXCommandOnDone
}

interface DashboardState {
  viewMode: 'tree' | 'graph' | 'timeline' | 'json'
  filterStatus?: string
  showEta: boolean
  showCriticalPath: boolean
  refreshInterval: number
}

function formatDuration(ms: number): string {
  if (!ms) return '0s'
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor(ms / (1000 * 60 * 60))

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function ProgressBar({ progress, width = 20 }: { progress: number; width?: number }): React.ReactNode {
  const filled = Math.floor((progress / 100) * width)
  const empty = width - filled
  return `[${Array(filled + 1).join('=')}${Array(empty + 1).join(' ')}] ${progress.toFixed(0)}%`
}

function TaskNode({ id, name, progress, status, dependencies }: {
  id: string
  name: string
  progress: number
  status: string
  dependencies: string[]
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
    </Box>
  )
}

function AggregateStats({ stats }: { stats: AggregateProgress }): React.ReactNode {
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
      {stats.estimatedTimeRemaining && (
        <Box marginTop={1}>
          <Text dimColor>
            ETA: {formatDuration(stats.estimatedTimeRemaining)}
          </Text>
        </Box>
      )}
    </Box>
  )
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

function TreeView(): React.ReactNode {
  const tasks = taskVisualizer.getExecutionOrder()

  if (!tasks || tasks.length === 0) {
    return <Text dimColor>No tasks to display</Text>
  }

  return (
    <Box flexDirection="column">
      {tasks.map((task) => (
        <TaskNode
          key={task.id}
          id={task.id}
          name={task.name}
          progress={task.progress}
          status={task.status}
          dependencies={task.dependencies}
        />
      ))}
    </Box>
  )
}

function GraphView(): React.ReactNode {
  const options: VisualizationOptions = {
    format: 'graph',
    showProgress: true,
    showEta: false,
    includeMetadata: false,
  }
  const graphViz = taskVisualizer.render(undefined, options)
  return <Text>{graphViz}</Text>
}

function TimelineView(): React.ReactNode {
  const options: VisualizationOptions = {
    format: 'timeline',
    showProgress: true,
    showEta: true,
    includeMetadata: false,
  }
  const timeline = taskVisualizer.render(undefined, options)
  return <Text>{timeline}</Text>
}

function JSONView(): React.ReactNode {
  const options: VisualizationOptions = {
    format: 'json',
    showProgress: true,
    showEta: true,
    includeMetadata: true,
  }
  const jsonOutput = taskVisualizer.render(undefined, options)
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

  const aggregateStats = taskVisualizer.getAggregateProgress()

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={2}>
        <Text bold color="cyan">
          📊 Task Dashboard
        </Text>
      </Box>

      <AggregateStats stats={aggregateStats} />

      {showCriticalPath && (
        <CriticalPathView />
      )}

      <Box marginBottom={1} borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text bold>View: {viewMode}</Text>
        <Box marginTop={1}>
          {viewMode === 'tree' && <TreeView />}
          {viewMode === 'graph' && <GraphView />}
          {viewMode === 'timeline' && <TimelineView />}
          {viewMode === 'json' && <JSONView />}
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text dimColor fontSize="small">
          Use --view [tree|graph|timeline|json] to change view mode | --show-critical-path to highlight critical tasks
        </Text>
      </Box>
    </Box>
  )
}
