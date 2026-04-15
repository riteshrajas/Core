import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export interface Setting {
  key: string
  value: any
  description?: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  defaultValue?: any
}

export interface SettingsProfile {
  name: string
  settings: Record<string, any>
  description?: string
  createdAt: string
  updatedAt: string
}

interface SettingsData {
  version: string
  currentProfile: string
  profiles: Record<string, SettingsProfile>
  globalSettings: Record<string, any>
}

const APEX_CONFIG_DIR = join(homedir(), '.apex')
const PROFILES_DIR = join(APEX_CONFIG_DIR, 'profiles')
const SETTINGS_FILE = join(APEX_CONFIG_DIR, 'settings.json')

class SettingsManager {
  private data: SettingsData = {
    version: '1.0',
    currentProfile: 'default',
    profiles: {},
    globalSettings: {},
  }
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    try {
      const content = await readFile(SETTINGS_FILE, 'utf-8')
      this.data = JSON.parse(content)
    } catch {
      this.data = {
        version: '1.0',
        currentProfile: 'default',
        profiles: { default: { name: 'default', settings: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
        globalSettings: {},
      }
    }
    this.initialized = true
  }

  private async ensureDir(): Promise<void> {
    await mkdir(APEX_CONFIG_DIR, { recursive: true })
    await mkdir(PROFILES_DIR, { recursive: true })
  }

  private async save(): Promise<void> {
    await this.ensureDir()
    await writeFile(SETTINGS_FILE, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  // Profile management
  async createProfile(name: string, description?: string): Promise<SettingsProfile> {
    await this.initialize()
    const profile: SettingsProfile = {
      name,
      settings: {},
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.data.profiles[name] = profile
    await this.save()
    return profile
  }

  async getProfile(name: string): Promise<SettingsProfile | undefined> {
    await this.initialize()
    return this.data.profiles[name]
  }

  async listProfiles(): Promise<SettingsProfile[]> {
    await this.initialize()
    return Object.values(this.data.profiles)
  }

  async useProfile(name: string): Promise<void> {
    await this.initialize()
    if (!this.data.profiles[name]) {
      throw new Error(`Profile "${name}" not found`)
    }
    this.data.currentProfile = name
    await this.save()
  }

  async deleteProfile(name: string): Promise<void> {
    await this.initialize()
    if (name === 'default') {
      throw new Error('Cannot delete default profile')
    }
    delete this.data.profiles[name]
    if (this.data.currentProfile === name) {
      this.data.currentProfile = 'default'
    }
    await this.save()
  }

  async getCurrentProfile(): Promise<string> {
    await this.initialize()
    return this.data.currentProfile
  }

  // Settings management
  async setSetting(key: string, value: any): Promise<void> {
    await this.initialize()
    const profile = this.data.profiles[this.data.currentProfile]
    if (profile) {
      profile.settings[key] = value
      profile.updatedAt = new Date().toISOString()
      await this.save()
    }
  }

  async getSetting(key: string): Promise<any> {
    await this.initialize()
    const profile = this.data.profiles[this.data.currentProfile]
    return profile?.settings[key]
  }

  async getAllSettings(): Promise<Record<string, any>> {
    await this.initialize()
    const profile = this.data.profiles[this.data.currentProfile]
    return profile?.settings || {}
  }

  async searchSettings(query: string): Promise<Record<string, any>> {
    await this.initialize()
    const profile = this.data.profiles[this.data.currentProfile]
    if (!profile) return {}

    const q = query.toLowerCase()
    return Object.fromEntries(
      Object.entries(profile.settings).filter(([key]) => key.toLowerCase().includes(q)),
    )
  }

  // Import/Export
  async exportSettings(profileName?: string): Promise<string> {
    await this.initialize()
    const name = profileName || this.data.currentProfile
    const profile = this.data.profiles[name]
    if (!profile) {
      throw new Error(`Profile "${name}" not found`)
    }
    return JSON.stringify(profile.settings, null, 2)
  }

  async importSettings(jsonData: string, profileName?: string): Promise<void> {
    await this.initialize()
    const name = profileName || this.data.currentProfile
    const settings = JSON.parse(jsonData)

    if (!this.data.profiles[name]) {
      await this.createProfile(name)
    }

    const profile = this.data.profiles[name]
    if (profile) {
      profile.settings = { ...profile.settings, ...settings }
      profile.updatedAt = new Date().toISOString()
      await this.save()
    }
  }

  async exportProfileToFile(profileName: string, filePath: string): Promise<void> {
    const data = await this.exportSettings(profileName)
    await writeFile(filePath, data, 'utf-8')
  }

  async importProfileFromFile(filePath: string, profileName?: string): Promise<void> {
    const data = await readFile(filePath, 'utf-8')
    await this.importSettings(data, profileName)
  }
}

export const settingsManager = new SettingsManager()
