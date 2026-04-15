import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export interface CommandMetric {
  commandName: string
  count: number
  lastUsed: string
}

interface MetricsData {
  commandUsage: Record<string, number>
  lastUsed: Record<string, string>
}

const APEX_CONFIG_DIR = join(homedir(), '.apex')
const METRICS_FILE = join(APEX_CONFIG_DIR, 'metrics.json')

class MetricsTracker {
  private data: MetricsData = { commandUsage: {}, lastUsed: {} }
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    try {
      const content = await readFile(METRICS_FILE, 'utf-8')
      this.data = JSON.parse(content)
    } catch {
      this.data = { commandUsage: {}, lastUsed: {} }
    }
    this.initialized = true
  }

  private async ensureDir(): Promise<void> {
    await mkdir(APEX_CONFIG_DIR, { recursive: true })
  }

  private async save(): Promise<void> {
    await this.ensureDir()
    await writeFile(METRICS_FILE, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  async recordUsage(commandName: string): Promise<void> {
    await this.initialize()
    this.data.commandUsage[commandName] = (this.data.commandUsage[commandName] ?? 0) + 1
    this.data.lastUsed[commandName] = new Date().toISOString()
    await this.save()
  }

  async getTrendingCommands(limit: number = 10): Promise<CommandMetric[]> {
    await this.initialize()
    return Object.entries(this.data.commandUsage)
      .map(([name, count]) => ({
        commandName: name,
        count,
        lastUsed: this.data.lastUsed[name] ?? new Date().toISOString(),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  async getMetricsFor(commandName: string): Promise<CommandMetric | undefined> {
    await this.initialize()
    const count = this.data.commandUsage[commandName]
    if (!count) return undefined
    return {
      commandName,
      count,
      lastUsed: this.data.lastUsed[commandName] ?? new Date().toISOString(),
    }
  }

  async reset(): Promise<void> {
    this.data = { commandUsage: {}, lastUsed: {} }
    await this.save()
  }
}

export const metricsTracker = new MetricsTracker()
