import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export interface Alias {
  name: string
  target: string
  description?: string
  createdAt: string
}

export interface MacroDefinition {
  name: string
  commands: string[]
  description?: string
  createdAt: string
}

interface AliasesConfig {
  aliases: Record<string, Alias>
  macros: Record<string, MacroDefinition>
}

const APEX_CONFIG_DIR = join(homedir(), '.apex')
const ALIASES_FILE = join(APEX_CONFIG_DIR, 'aliases.json')

class AliasManager {
  private config: AliasesConfig = { aliases: {}, macros: {} }
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    try {
      const content = await readFile(ALIASES_FILE, 'utf-8')
      this.config = JSON.parse(content)
    } catch {
      this.config = { aliases: {}, macros: {} }
    }
    this.initialized = true
  }

  private async ensureDir(): Promise<void> {
    await mkdir(APEX_CONFIG_DIR, { recursive: true })
  }

  private async save(): Promise<void> {
    await this.ensureDir()
    await writeFile(ALIASES_FILE, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  async addAlias(name: string, target: string, description?: string): Promise<void> {
    await this.initialize()
    this.config.aliases[name] = {
      name,
      target,
      description,
      createdAt: new Date().toISOString(),
    }
    await this.save()
  }

  async removeAlias(name: string): Promise<void> {
    await this.initialize()
    delete this.config.aliases[name]
    await this.save()
  }

  async getAlias(name: string): Promise<Alias | undefined> {
    await this.initialize()
    return this.config.aliases[name]
  }

  async listAliases(): Promise<Alias[]> {
    await this.initialize()
    return Object.values(this.config.aliases)
  }

  async addMacro(name: string, commands: string[], description?: string): Promise<void> {
    await this.initialize()
    this.config.macros[name] = {
      name,
      commands,
      description,
      createdAt: new Date().toISOString(),
    }
    await this.save()
  }

  async removeMacro(name: string): Promise<void> {
    await this.initialize()
    delete this.config.macros[name]
    await this.save()
  }

  async getMacro(name: string): Promise<MacroDefinition | undefined> {
    await this.initialize()
    return this.config.macros[name]
  }

  async listMacros(): Promise<MacroDefinition[]> {
    await this.initialize()
    return Object.values(this.config.macros)
  }

  async resolveAlias(input: string): Promise<string> {
    await this.initialize()
    const parts = input.trim().split(/\s+/)
    const potentialAlias = parts[0]

    const alias = this.config.aliases[potentialAlias]
    if (alias) {
      const restOfCommand = parts.slice(1).join(' ')
      return restOfCommand ? `${alias.target} ${restOfCommand}` : alias.target
    }

    return input
  }
}

export const aliasManager = new AliasManager()
