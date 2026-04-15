/**
 * TaskVisualizer Service
 * Manages task dependency graphs, progress tracking, and visual rendering
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProgressMetrics {
  current: number
  total: number
  percentage: number
  startTime: number
  estimatedEndTime?: number
  completionRate: number // items per millisecond
}

export interface TaskNode {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  progress: number // 0-100
  metrics: ProgressMetrics
  dependencies: string[] // task IDs
  dependents: string[] // tasks that depend on this one
  priority?: number
  estimatedDuration?: number // in milliseconds
  actualDuration?: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  metadata?: Record<string, unknown>
}

export interface TaskDependency {
  from: string // dependent task
  to: string // task being depended on
  type: 'blocking' | 'soft' // soft = non-blocking
}

export interface TaskGraph {
  nodes: Map<string, TaskNode>
  edges: TaskDependency[]
  criticalPath: string[] // task IDs on critical path
}

export interface VisualizationOptions {
  format: 'tree' | 'graph' | 'timeline' | 'json'
  showProgress: boolean
  showEta: boolean
  maxDepth?: number
  includeMetadata: boolean
}

export interface AggregateProgress {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  failedTasks: number
  blockedTasks: number
  pendingTasks: number
  overallPercentage: number
  estimatedTimeRemaining?: number
}

export interface ProgressSnapshot {
  timestamp: number
  taskId: string
  completed: number
  total: number
  percentage: number
  velocity: number // items per second
}

export interface ProgressReport {
  taskId: string
  isTracking: boolean
  startTime?: number
  currentCompleted: number
  totalItems: number
  percentage: number
  velocity: number // items per second
  eta?: number
  elapsedTime: number
  estimatedTimeRemaining?: number
  acceleration: number // items per second squared
  bottleneck?: string
  history: ProgressSnapshot[]
}

// ============================================================================
// TaskProgressTracker Class
// ============================================================================

class TaskProgressTracker {
  private trackers = new Map<string, {
    startTime: number
    currentCompleted: number
    totalItems: number
    lastUpdate: number
    lastCompleted: number
    snapshots: ProgressSnapshot[]
    callbacks: Array<(progress: ProgressSnapshot) => void>
  }>()

  /**
   * Start tracking progress for a task
   */
  startTracking(taskId: string): void {
    if (!this.trackers.has(taskId)) {
      this.trackers.set(taskId, {
        startTime: Date.now(),
        currentCompleted: 0,
        totalItems: 0,
        lastUpdate: Date.now(),
        lastCompleted: 0,
        snapshots: [],
        callbacks: [],
      })
    }
  }

  /**
   * Update progress for a task
   */
  updateProgress(taskId: string, completed: number, total: number): ProgressSnapshot {
    if (!this.trackers.has(taskId)) {
      this.startTracking(taskId)
    }

    const tracker = this.trackers.get(taskId)!
    const now = Date.now()

    tracker.currentCompleted = completed
    tracker.totalItems = total
    tracker.lastUpdate = now

    const elapsedSeconds = (now - tracker.startTime) / 1000
    const velocity = elapsedSeconds > 0 ? completed / elapsedSeconds : 0

    const snapshot: ProgressSnapshot = {
      timestamp: now,
      taskId,
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
      velocity,
    }

    tracker.snapshots.push(snapshot)

    // Emit callbacks
    for (const callback of tracker.callbacks) {
      callback(snapshot)
    }

    return snapshot
  }

  /**
   * Estimate ETA for a task using exponential moving average
   */
  estimateETA(taskId: string): number | undefined {
    const tracker = this.trackers.get(taskId)
    if (!tracker || tracker.snapshots.length < 2 || tracker.totalItems === 0) {
      return undefined
    }

    const remaining = tracker.totalItems - tracker.currentCompleted
    if (remaining <= 0) {
      return Date.now()
    }

    const recent = tracker.snapshots.slice(-5)
    const velocities = recent.map((s) => s.velocity).filter((v) => v > 0)

    if (velocities.length === 0) {
      return undefined
    }

    // Exponential moving average of velocity
    let ema = velocities[0]
    const alpha = 2 / (velocities.length + 1)
    for (let i = 1; i < velocities.length; i++) {
      ema = alpha * velocities[i] + (1 - alpha) * ema
    }

    if (ema <= 0) {
      return undefined
    }

    const estimatedSeconds = remaining / ema
    return Date.now() + estimatedSeconds * 1000
  }

  /**
   * Get detailed progress report for a task
   */
  getProgressReport(taskId: string): ProgressReport {
    const tracker = this.trackers.get(taskId)
    const now = Date.now()

    if (!tracker) {
      return {
        taskId,
        isTracking: false,
        currentCompleted: 0,
        totalItems: 0,
        percentage: 0,
        velocity: 0,
        elapsedTime: 0,
        acceleration: 0,
        history: [],
      }
    }

    const elapsedTime = now - tracker.startTime
    const elapsedSeconds = elapsedTime / 1000
    const velocity = elapsedSeconds > 0 ? tracker.currentCompleted / elapsedSeconds : 0

    // Calculate acceleration
    let acceleration = 0
    if (tracker.snapshots.length >= 2) {
      const recent = tracker.snapshots.slice(-2)
      const timeDiff = (recent[1].timestamp - recent[0].timestamp) / 1000
      const velocityDiff = recent[1].velocity - recent[0].velocity
      acceleration = timeDiff > 0 ? velocityDiff / timeDiff : 0
    }

    // Detect bottleneck
    let bottleneck: string | undefined
    if (tracker.snapshots.length >= 3) {
      const recent = tracker.snapshots.slice(-3)
      const velocities = recent.map((s) => s.velocity)
      const avgVelocity = velocities.reduce((a, b) => a + b) / velocities.length
      const slowestVelocity = Math.min(...velocities)
      const speedDiff = avgVelocity - slowestVelocity

      if (speedDiff > avgVelocity * 0.3) {
        bottleneck = 'Deceleration detected: completion rate is decreasing'
      }
    }

    const eta = this.estimateETA(taskId)
    const estimatedTimeRemaining = eta ? eta - now : undefined

    return {
      taskId,
      isTracking: true,
      startTime: tracker.startTime,
      currentCompleted: tracker.currentCompleted,
      totalItems: tracker.totalItems,
      percentage: tracker.totalItems > 0 ? (tracker.currentCompleted / tracker.totalItems) * 100 : 0,
      velocity,
      eta,
      elapsedTime,
      estimatedTimeRemaining: estimatedTimeRemaining && estimatedTimeRemaining > 0
        ? estimatedTimeRemaining
        : undefined,
      acceleration,
      bottleneck,
      history: tracker.snapshots,
    }
  }

  /**
   * Subscribe to real-time progress updates
   */
  subscribeToProgress(
    taskId: string,
    callback: (progress: ProgressSnapshot) => void,
  ): () => void {
    if (!this.trackers.has(taskId)) {
      this.startTracking(taskId)
    }

    const tracker = this.trackers.get(taskId)!
    tracker.callbacks.push(callback)

    return () => {
      const index = tracker.callbacks.indexOf(callback)
      if (index > -1) {
        tracker.callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Get progress history for a task
   */
  getProgressHistory(taskId: string): ProgressSnapshot[] {
    return this.trackers.get(taskId)?.snapshots || []
  }

  /**
   * Get aggregate progress across multiple tasks
   */
  getAggregateReport(taskIds?: string[]): {
    totalProgress: number
    overallVelocity: number
    aggregateETA?: number
    tasks: ProgressReport[]
  } {
    const ids = taskIds || Array.from(this.trackers.keys())
    const reports = ids.map((id) => this.getProgressReport(id))

    const totalProgress = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.percentage, 0) / reports.length
      : 0

    const overallVelocity = reports.reduce((sum, r) => sum + r.velocity, 0)

    const etas = reports
      .map((r) => r.eta)
      .filter((e): e is number => e !== undefined)

    const aggregateETA = etas.length > 0 ? Math.max(...etas) : undefined

    return {
      totalProgress,
      overallVelocity,
      aggregateETA,
      tasks: reports,
    }
  }

  /**
   * Clear tracking data for a task
   */
  clearTracking(taskId?: string): void {
    if (taskId) {
      this.trackers.delete(taskId)
    } else {
      this.trackers.clear()
    }
  }
}

// ============================================================================
// TaskVisualizer Class
// ============================================================================

class TaskVisualizer {
  private graph: TaskGraph = {
    nodes: new Map(),
    edges: [],
    criticalPath: [],
  }

  progressTracker: TaskProgressTracker = new TaskProgressTracker()

  /**
   * Add a task to the graph
   */
  addTask(
    id: string,
    name: string,
    options: {
      description?: string
      dependencies?: string[]
      estimatedDuration?: number
      priority?: number
      metadata?: Record<string, unknown>
    } = {},
  ): TaskNode {
    if (this.graph.nodes.has(id)) {
      throw new Error(`Task ${id} already exists`)
    }

    const node: TaskNode = {
      id,
      name,
      description: options.description,
      status: 'pending',
      progress: 0,
      dependencies: options.dependencies || [],
      dependents: [],
      priority: options.priority || 0,
      estimatedDuration: options.estimatedDuration,
      metadata: options.metadata,
      createdAt: Date.now(),
      metrics: {
        current: 0,
        total: 0,
        percentage: 0,
        startTime: Date.now(),
        completionRate: 0,
      },
    }

    this.graph.nodes.set(id, node)

    // Add dependencies to the graph
    for (const depId of options.dependencies || []) {
      this.addDependency(id, depId)
    }

    // Recalculate critical path
    this.calculateCriticalPath()

    return node
  }

  /**
   * Add a dependency relationship between tasks
   */
  addDependency(
    dependentId: string,
    dependsOnId: string,
    type: 'blocking' | 'soft' = 'blocking',
  ): void {
    const dependent = this.graph.nodes.get(dependentId)
    const dependsOn = this.graph.nodes.get(dependsOnId)

    if (!dependent || !dependsOn) {
      throw new Error(`One or both tasks not found: ${dependentId}, ${dependsOnId}`)
    }

    // Add to dependency lists
    if (!dependent.dependencies.includes(dependsOnId)) {
      dependent.dependencies.push(dependsOnId)
    }
    if (!dependsOn.dependents.includes(dependentId)) {
      dependsOn.dependents.push(dependentId)
    }

    // Add edge
    const edgeExists = this.graph.edges.some(
      (e) => e.from === dependentId && e.to === dependsOnId,
    )
    if (!edgeExists) {
      this.graph.edges.push({
        from: dependentId,
        to: dependsOnId,
        type,
      })
    }

    this.calculateCriticalPath()
  }

  /**
   * Update task progress
   */
  updateProgress(
    taskId: string,
    current: number,
    total: number,
  ): TaskNode {
    const task = this.graph.nodes.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    const percentage = total > 0 ? (current / total) * 100 : 0
    const now = Date.now()

    // Track timing for ETA calculation
    if (!task.startedAt && current > 0) {
      task.startedAt = now
      task.status = 'in_progress'
    }

    // Calculate completion rate (items per ms)
    const elapsed = Math.max(1, now - (task.startedAt || now))
    const completionRate = current > 0 ? current / elapsed : 0

    task.progress = Math.min(percentage, 100)
    task.metrics = {
      current,
      total,
      percentage,
      startTime: task.startedAt || now,
      completionRate,
      estimatedEndTime:
        completionRate > 0 && total > current
          ? now + (total - current) / completionRate
          : undefined,
    }

    // Auto-complete if progress reaches 100%
    if (task.progress >= 100 && task.status !== 'completed') {
      this.markCompleted(taskId)
    }

    return task
  }

  /**
   * Manually mark a task as started
   */
  markStarted(taskId: string): TaskNode {
    const task = this.graph.nodes.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'in_progress'
    task.startedAt = Date.now()
    return task
  }

  /**
   * Manually mark a task as completed
   */
  markCompleted(taskId: string): TaskNode {
    const task = this.graph.nodes.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'completed'
    task.progress = 100
    task.completedAt = Date.now()
    if (task.startedAt) {
      task.actualDuration = task.completedAt - task.startedAt
    }

    // Update metrics
    task.metrics.percentage = 100
    task.metrics.estimatedEndTime = task.completedAt

    return task
  }

  /**
   * Mark a task as failed
   */
  markFailed(taskId: string, reason?: string): TaskNode {
    const task = this.graph.nodes.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'failed'
    if (reason) {
      task.metadata = { ...task.metadata, failureReason: reason }
    }

    // Mark dependent tasks as blocked
    for (const dependentId of task.dependents) {
      const dependent = this.graph.nodes.get(dependentId)
      if (dependent && dependent.status === 'pending') {
        dependent.status = 'blocked'
      }
    }

    return task
  }

  /**
   * Mark a task as blocked
   */
  markBlocked(taskId: string, reason?: string): TaskNode {
    const task = this.graph.nodes.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'blocked'
    if (reason) {
      task.metadata = { ...task.metadata, blockReason: reason }
    }

    return task
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): TaskNode | undefined {
    return this.graph.nodes.get(taskId)
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskNode[] {
    return Array.from(this.graph.nodes.values())
  }

  /**
   * Get tasks in execution order (topological sort)
   */
  getExecutionOrder(): TaskNode[] {
    const visited = new Set<string>()
    const result: TaskNode[] = []

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return
      visited.add(taskId)

      const task = this.graph.nodes.get(taskId)
      if (!task) return

      // Visit dependencies first
      for (const depId of task.dependencies) {
        visit(depId)
      }

      result.push(task)
    }

    for (const task of this.graph.nodes.values()) {
      visit(task.id)
    }

    return result
  }

  /**
   * Calculate critical path (longest path through DAG)
   */
  private calculateCriticalPath(): void {
    const durations = new Map<string, number>()
    const order = this.getExecutionOrder()

    // Initialize durations
    for (const task of order) {
      durations.set(task.id, task.estimatedDuration || 0)
    }

    // Calculate critical path lengths
    const pathLengths = new Map<string, number>()
    for (const task of order) {
      let maxDep = 0
      for (const depId of task.dependencies) {
        maxDep = Math.max(maxDep, pathLengths.get(depId) || 0)
      }
      pathLengths.set(task.id, maxDep + (durations.get(task.id) || 0))
    }

    // Find tasks on critical path
    const maxLength = Math.max(...Array.from(pathLengths.values()), 0)
    const criticalPath: string[] = []

    if (maxLength > 0) {
      // Backtrack from nodes with max length
      let current = Array.from(pathLengths.entries()).find(
        ([_, length]) => length === maxLength,
      )

      while (current) {
        const [taskId, length] = current
        criticalPath.unshift(taskId)

        const task = this.graph.nodes.get(taskId)
        if (!task || task.dependencies.length === 0) break

        // Find which dependency is on the critical path
        let next = null
        for (const depId of task.dependencies) {
          const depLength = pathLengths.get(depId) || 0
          const taskDuration = durations.get(taskId) || 0
          if (depLength === length - taskDuration) {
            next = [depId, depLength]
            break
          }
        }
        current = next as [string, number] | null
      }
    }

    this.graph.criticalPath = criticalPath
  }

  /**
   * Get critical path
   */
  getCriticalPath(): TaskNode[] {
    return this.graph.criticalPath
      .map((id) => this.graph.nodes.get(id))
      .filter((task): task is TaskNode => task !== undefined)
  }

  /**
   * Calculate aggregate progress across all tasks or a subset
   */
  getAggregateProgress(taskIds?: string[]): AggregateProgress {
    const tasks = taskIds
      ? taskIds
          .map((id) => this.graph.nodes.get(id))
          .filter((task): task is TaskNode => task !== undefined)
      : this.getAllTasks()

    const counts = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
    }

    const overallPercentage =
      counts.total > 0
        ? (counts.completed + counts.inProgress * 0.5) / counts.total * 100
        : 0

    // Calculate time remaining
    let estimatedTimeRemaining = 0
    for (const task of tasks) {
      if (
        task.status === 'in_progress' ||
        task.status === 'pending'
      ) {
        if (task.metrics.estimatedEndTime) {
          const timeRemaining = Math.max(
            0,
            task.metrics.estimatedEndTime - Date.now(),
          )
          estimatedTimeRemaining = Math.max(estimatedTimeRemaining, timeRemaining)
        } else if (task.estimatedDuration && !task.startedAt) {
          estimatedTimeRemaining += task.estimatedDuration
        }
      }
    }

    return {
      totalTasks: counts.total,
      completedTasks: counts.completed,
      inProgressTasks: counts.inProgress,
      failedTasks: counts.failed,
      blockedTasks: counts.blocked,
      pendingTasks: counts.pending,
      overallPercentage,
      estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined,
    }
  }

  /**
   * Render tasks in tree format (ASCII art)
   */
  renderTree(taskId?: string, depth = 0, options: VisualizationOptions = {
    format: 'tree',
    showProgress: true,
    showEta: true,
    includeMetadata: false,
  }): string {
    const maxDepth = options.maxDepth || 10
    if (depth > maxDepth) return ''

    const root = taskId ? this.graph.nodes.get(taskId) : null
    if (taskId && !root) return ''

    const tasks = taskId ? [root!] : this.getExecutionOrder()
    let output = ''

    const renderTask = (task: TaskNode, d: number) => {
      const indent = '  '.repeat(d)
      const statusIcon = this.getStatusIcon(task.status)
      const progressBar = options.showProgress ? this.renderProgressBar(task) : ''

      let line = `${indent}${statusIcon} ${task.name}`
      if (progressBar) {
        line += ` [${progressBar}]`
      }
      if (options.showEta && task.metrics.estimatedEndTime) {
        const eta = new Date(task.metrics.estimatedEndTime).toLocaleTimeString()
        line += ` ETA: ${eta}`
      }

      output += line + '\n'

      // Render dependents
      if (d < maxDepth) {
        for (const depId of task.dependents) {
          const dep = this.graph.nodes.get(depId)
          if (dep) {
            renderTask(dep, d + 1)
          }
        }
      }
    }

    if (taskId && root) {
      renderTask(root, depth)
    } else {
      for (const task of tasks) {
        if (task.dependencies.length === 0) {
          renderTask(task, 0)
        }
      }
    }

    return output
  }

  /**
   * Render tasks in graph format
   */
  renderGraph(options: VisualizationOptions = {
    format: 'graph',
    showProgress: true,
    showEta: false,
    includeMetadata: false,
  }): string {
    let output = 'digraph TaskGraph {\n'
    output += '  rankdir=LR;\n'
    output += '  node [shape=box];\n\n'

    // Add nodes
    for (const task of this.graph.nodes.values()) {
      const label = `${task.name} (${task.progress.toFixed(0)}%)`
      const color = this.getStatusColor(task.status)
      output += `  "${task.id}" [label="${label}", fillcolor="${color}", style=filled];\n`
    }

    output += '\n'

    // Add edges
    for (const edge of this.graph.edges) {
      const style = edge.type === 'soft' ? 'dashed' : 'solid'
      output += `  "${edge.to}" -> "${edge.from}" [style=${style}];\n`
    }

    output += '}\n'
    return output
  }

  /**
   * Render tasks in timeline format
   */
  renderTimeline(options: VisualizationOptions = {
    format: 'timeline',
    showProgress: true,
    showEta: true,
    includeMetadata: false,
  }): string {
    const tasks = this.getExecutionOrder().filter((t) => t.startedAt)
    if (tasks.length === 0) return 'No started tasks\n'

    const minTime = Math.min(...tasks.map((t) => t.startedAt || Date.now()))
    const maxTime = Math.max(
      ...tasks.map((t) => t.completedAt || t.metrics.estimatedEndTime || Date.now()),
    )

    const timelineLength = 60
    const timespan = maxTime - minTime

    let output = 'Task Timeline:\n'
    output += '0' + ' '.repeat(timelineLength - 2) + 'now\n'

    for (const task of tasks) {
      const start = task.startedAt || minTime
      const end = task.completedAt || task.metrics.estimatedEndTime || Date.now()
      const startPos = Math.floor(((start - minTime) / timespan) * timelineLength)
      const endPos = Math.floor(((end - minTime) / timespan) * timelineLength)

      let timeline = ' '.repeat(startPos)
      timeline += '='.repeat(Math.max(1, endPos - startPos))
      timeline += ' '.repeat(Math.max(0, timelineLength - endPos))

      const status = this.getStatusIcon(task.status)
      output += `${status} ${task.name.padEnd(20)} ${timeline}\n`
    }

    return output
  }

  /**
   * Render in JSON format (structured data)
   */
  renderJSON(options: VisualizationOptions = {
    format: 'json',
    showProgress: true,
    showEta: true,
    includeMetadata: true,
  }): string {
    const tasks = this.getAllTasks().map((task) => {
      const obj: Record<string, unknown> = {
        id: task.id,
        name: task.name,
        status: task.status,
        progress: task.progress,
        dependencies: task.dependencies,
      }

      if (options.showProgress) {
        obj.metrics = task.metrics
      }

      if (options.showEta && task.metrics.estimatedEndTime) {
        obj.estimatedEndTime = new Date(task.metrics.estimatedEndTime).toISOString()
      }

      if (options.includeMetadata && task.metadata) {
        obj.metadata = task.metadata
      }

      return obj
    })

    const aggregate = this.getAggregateProgress()

    return JSON.stringify(
      {
        aggregate,
        tasks,
        criticalPath: this.graph.criticalPath,
      },
      null,
      2,
    )
  }

  /**
   * Render tasks with specified format
   */
  render(
    taskId?: string,
    options: VisualizationOptions = {
      format: 'tree',
      showProgress: true,
      showEta: true,
      includeMetadata: false,
    },
  ): string {
    switch (options.format) {
      case 'tree':
        return this.renderTree(taskId, 0, options)
      case 'graph':
        return this.renderGraph(options)
      case 'timeline':
        return this.renderTimeline(options)
      case 'json':
        return this.renderJSON(options)
      default:
        return this.renderTree(taskId, 0, options)
    }
  }

  /**
   * Get status icon for ASCII rendering
   */
  private getStatusIcon(status: TaskNode['status']): string {
    const icons: Record<TaskNode['status'], string> = {
      pending: '○',
      in_progress: '◐',
      completed: '●',
      failed: '✗',
      blocked: '⊘',
    }
    return icons[status] || '?'
  }

  /**
   * Get status color for graph rendering
   */
  private getStatusColor(status: TaskNode['status']): string {
    const colors: Record<TaskNode['status'], string> = {
      pending: 'lightgray',
      in_progress: 'lightyellow',
      completed: 'lightgreen',
      failed: 'lightcoral',
      blocked: 'lightpink',
    }
    return colors[status] || 'white'
  }

  /**
   * Render progress bar
   */
  private renderProgressBar(task: TaskNode, width = 20): string {
    const filled = Math.floor((task.progress / 100) * width)
    const empty = width - filled
    return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${task.progress.toFixed(0)}%`
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.graph = {
      nodes: new Map(),
      edges: [],
      criticalPath: [],
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const taskVisualizer = new TaskVisualizer()
