import { logForDebugging } from '../utils/debug.js'

// ==================== Types ====================

export interface Rating {
  userId: string
  username: string
  rating: number // 1-5
  timestamp: string
  helpfulCount: number
}

export interface Review {
  id: string
  userId: string
  username: string
  skillId: string
  rating: number // 1-5
  title: string
  content: string
  timestamp: string
  upvotes: number
  downvotes: number
}

export interface Skill {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: string
  tags: string[]
  rating: number // 0-5, average of all ratings
  ratingCount: number
  downloads: number
  repository?: string
  documentation?: string
  license: string
  createdAt: string
  updatedAt: string
  dependencies: DependencySpec[]
  compatible: {
    minApexVersion: string
    maxApexVersion?: string
    platforms: string[]
  }
}

export interface DependencySpec {
  skillId: string
  versionRange: string // e.g., "^1.0.0", "~2.1.0", ">=1.0.0"
}

export interface DependencyGraph {
  skillId: string
  version: string
  dependencies: DependencySpec[]
  resolved: Map<string, string> // skillId -> resolved version
  conflicts: DependencyConflict[]
}

export interface DependencyConflict {
  skillId: string
  requestedVersions: string[]
  reason: string
}

export interface ResolutionStrategy {
  type: 'newest' | 'stable' | 'pinned' | 'conservative'
  pinnedVersions?: Map<string, string>
}

export interface ConflictResolution {
  skillId: string
  selectedVersion: string
  alternatives: string[]
  reasoning: string
}

export interface InstallationOrder {
  order: string[]
  installationGroups: string[][]
  totalDependencies: number
}

export interface CompatibilityCheckResult {
  compatible: boolean
  apexVersion: string
  warnings: string[]
  supportedPlatforms: string[]
}

export interface InstallationManifest {
  skillId: string
  version: string
  dependencies: DependencyGraph
  installPath: string
  timestamp: string
  metadata: Skill
}

export interface SearchOptions {
  keyword?: string
  category?: string
  author?: string
  minRating?: number
  sortBy?: 'downloads' | 'rating' | 'recent' | 'name'
  limit?: number
  offset?: number
}

export interface BrowseOptions {
  category?: string
  sortBy?: 'downloads' | 'rating' | 'recent' | 'name'
  limit?: number
  offset?: number
}

// ==================== DependencyResolver ====================

class DependencyResolver {
  private skillRegistry: Map<string, Skill> = new Map()
  private resolvedCache: Map<string, Map<string, string>> = new Map()
  private currentStrategy: ResolutionStrategy = { type: 'newest' }

  constructor(skillRegistry: Map<string, Skill>) {
    this.skillRegistry = skillRegistry
  }

  setStrategy(strategy: ResolutionStrategy): void {
    this.currentStrategy = strategy
  }

  /**
   * Resolve all dependencies recursively with selected strategy
   */
  async resolveAll(skillId: string): Promise<Map<string, string>> {
    if (this.resolvedCache.has(skillId)) {
      return this.resolvedCache.get(skillId)!
    }

    const resolved = new Map<string, string>()
    const visited = new Set<string>()

    const resolve = (currentSkillId: string, depth: number = 0): void => {
      if (depth > 20) throw new Error('Maximum dependency depth exceeded')
      if (visited.has(currentSkillId)) return

      visited.add(currentSkillId)
      const skill = this.skillRegistry.get(currentSkillId)

      if (!skill) {
        throw new Error(`Skill ${currentSkillId} not found in registry`)
      }

      if (skill.dependencies.length === 0) return

      for (const dep of skill.dependencies) {
        if (resolved.has(dep.skillId)) continue

        const selectedVersion = this.selectVersion(dep.skillId, dep.versionRange)
        if (selectedVersion) {
          resolved.set(dep.skillId, selectedVersion)
          resolve(dep.skillId, depth + 1)
        }
      }
    }

    resolve(skillId)
    this.resolvedCache.set(skillId, resolved)
    return resolved
  }

  /**
   * Select a version based on the current resolution strategy
   */
  private selectVersion(skillId: string, versionRange: string): string | null {
    const skill = this.skillRegistry.get(skillId)
    if (!skill) return null

    switch (this.currentStrategy.type) {
      case 'pinned':
        if (this.currentStrategy.pinnedVersions?.has(skillId)) {
          const pinnedVersion = this.currentStrategy.pinnedVersions.get(skillId)!
          return this.matchesRange(pinnedVersion, versionRange) ? pinnedVersion : null
        }
        return skill.version
      case 'newest':
        return this.matchesRange(skill.version, versionRange) ? skill.version : null
      case 'stable':
        return this.isStableVersion(skill.version) && this.matchesRange(skill.version, versionRange)
          ? skill.version
          : null
      case 'conservative':
        return this.matchesRange(skill.version, versionRange) ? skill.version : null
      default:
        return skill.version
    }
  }

  /**
   * Detect version conflicts in dependency chain
   */
  detectConflicts(skillId: string): DependencyConflict[] {
    const skill = this.skillRegistry.get(skillId)
    if (!skill) return []

    const conflicts: DependencyConflict[] = []
    const versionRequirements = new Map<string, Set<string>>()

    const traverse = (currentSkillId: string): void => {
      const current = this.skillRegistry.get(currentSkillId)
      if (!current) return

      for (const dep of current.dependencies) {
        if (!versionRequirements.has(dep.skillId)) {
          versionRequirements.set(dep.skillId, new Set())
        }
        versionRequirements.get(dep.skillId)!.add(dep.versionRange)
      }

      for (const dep of current.dependencies) {
        traverse(dep.skillId)
      }
    }

    traverse(skillId)

    for (const [depSkillId, ranges] of versionRequirements.entries()) {
      if (ranges.size > 1) {
        const depSkill = this.skillRegistry.get(depSkillId)
        const compatible = Array.from(ranges).every((r) => this.matchesRange(depSkill?.version || '', r))

        if (!compatible) {
          conflicts.push({
            skillId: depSkillId,
            requestedVersions: Array.from(ranges),
            reason: `Multiple version requirements: ${Array.from(ranges).join(', ')}`,
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Suggest resolutions for detected conflicts
   */
  suggestResolutions(skillId: string, conflicts: DependencyConflict[]): ConflictResolution[] {
    const suggestions: ConflictResolution[] = []

    for (const conflict of conflicts) {
      const skill = this.skillRegistry.get(conflict.skillId)
      if (!skill) continue

      const compatibleRanges = conflict.requestedVersions.filter((r) => this.matchesRange(skill.version, r))

      suggestions.push({
        skillId: conflict.skillId,
        selectedVersion: skill.version,
        alternatives: compatibleRanges,
        reasoning: compatibleRanges.length > 0
          ? `Version ${skill.version} satisfies ${compatibleRanges.length} requirement(s)`
          : 'Manual intervention required - no version satisfies all requirements',
      })
    }

    return suggestions
  }

  /**
   * Generate installation order using topological sort
   */
  getInstallationOrder(skillId: string, resolved: Map<string, string>): InstallationOrder {
    const order: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const topologicalSort = (currentId: string): void => {
      if (visited.has(currentId)) return
      if (visiting.has(currentId)) {
        throw new Error(`Circular dependency detected: ${currentId}`)
      }

      visiting.add(currentId)
      const skill = this.skillRegistry.get(currentId)

      if (skill) {
        for (const dep of skill.dependencies) {
          if (resolved.has(dep.skillId)) {
            topologicalSort(dep.skillId)
          }
        }
      }

      visiting.delete(currentId)
      visited.add(currentId)
      order.push(currentId)
    }

    topologicalSort(skillId)
    for (const [depId] of resolved) {
      if (!visited.has(depId)) {
        topologicalSort(depId)
      }
    }

    // Group dependencies by depth level for parallel installation
    const installationGroups = this.groupByDepth(skillId, resolved)

    return {
      order: order.reverse(),
      installationGroups,
      totalDependencies: resolved.size + 1,
    }
  }

  /**
   * Group dependencies by installation depth for parallel processing
   */
  private groupByDepth(skillId: string, resolved: Map<string, string>): string[][] {
    const depthMap = new Map<string, number>()
    depthMap.set(skillId, 0)

    const getDepth = (currentId: string): number => {
      if (depthMap.has(currentId)) return depthMap.get(currentId)!

      const skill = this.skillRegistry.get(currentId)
      if (!skill || skill.dependencies.length === 0) {
        depthMap.set(currentId, 0)
        return 0
      }

      const maxChildDepth = Math.max(
        ...skill.dependencies
          .filter((d) => resolved.has(d.skillId))
          .map((d) => getDepth(d.skillId)),
        -1,
      )

      const depth = maxChildDepth + 1
      depthMap.set(currentId, depth)
      return depth
    }

    getDepth(skillId)

    const groups: string[][] = []
    const maxDepth = Math.max(...Array.from(depthMap.values()))

    for (let i = 0; i <= maxDepth; i++) {
      const group = Array.from(depthMap.entries())
        .filter(([, d]) => d === i)
        .map(([id]) => id)

      if (group.length > 0) {
        groups.push(group)
      }
    }

    return groups.reverse()
  }

  /**
   * Validate APEX version compatibility
   */
  validateCompatibility(skillId: string, apexVersion: string): CompatibilityCheckResult {
    const skill = this.skillRegistry.get(skillId)

    if (!skill) {
      return {
        compatible: false,
        apexVersion,
        warnings: [`Skill ${skillId} not found`],
        supportedPlatforms: [],
      }
    }

    const compatible = this.isVersionInRange(apexVersion, skill.compatible.minApexVersion, skill.compatible.maxApexVersion)
    const warnings: string[] = []

    if (!compatible) {
      warnings.push(
        `APEX ${apexVersion} does not meet requirement: ${skill.compatible.minApexVersion}${
          skill.compatible.maxApexVersion ? ` - ${skill.compatible.maxApexVersion}` : '+'
        }`,
      )
    }

    return {
      compatible,
      apexVersion,
      warnings,
      supportedPlatforms: skill.compatible.platforms,
    }
  }

  /**
   * Simulate installation without actually installing
   */
  async simulateInstallation(
    skillId: string,
    apexVersion: string,
  ): Promise<{
    success: boolean
    installationOrder: InstallationOrder
    compatibilityChecks: CompatibilityCheckResult[]
    conflicts: DependencyConflict[]
    estimatedSize: number
  }> {
    const skill = this.skillRegistry.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const compatibilityCheck = this.validateCompatibility(skillId, apexVersion)
    const conflicts = this.detectConflicts(skillId)
    const resolved = await this.resolveAll(skillId)
    const installationOrder = this.getInstallationOrder(skillId, resolved)

    const compatibilityChecks: CompatibilityCheckResult[] = [compatibilityCheck]
    for (const [depId] of resolved) {
      compatibilityChecks.push(this.validateCompatibility(depId, apexVersion))
    }

    const success = compatibilityCheck.compatible && conflicts.length === 0 && compatibilityChecks.every((c) => c.compatible)

    // Estimate size (mock)
    const estimatedSize = (installationOrder.totalDependencies * 1024 * 100) + (skill.downloads * 10)

    return {
      success,
      installationOrder,
      compatibilityChecks,
      conflicts,
      estimatedSize,
    }
  }

  /**
   * Helper: Check if version matches range
   */
  private matchesRange(version: string, range: string): boolean {
    if (range === '*' || range === '') return true
    if (range === version) return true

    if (range.startsWith('^')) {
      const baseParts = range.slice(1).split('.')
      const versionParts = version.split('.')
      return (
        versionParts[0] === baseParts[0] &&
        (parseInt(versionParts[1]) > parseInt(baseParts[1]) ||
          (versionParts[1] === baseParts[1] && parseInt(versionParts[2]) >= parseInt(baseParts[2])))
      )
    }

    if (range.startsWith('~')) {
      const baseParts = range.slice(1).split('.')
      const versionParts = version.split('.')
      return (
        versionParts[0] === baseParts[0] &&
        versionParts[1] === baseParts[1] &&
        parseInt(versionParts[2]) >= parseInt(baseParts[2])
      )
    }

    if (range.startsWith('>=')) {
      const rangeVersion = range.slice(2)
      return version >= rangeVersion
    }

    if (range.startsWith('>')) {
      const rangeVersion = range.slice(1)
      return version > rangeVersion
    }

    if (range.startsWith('<=')) {
      const rangeVersion = range.slice(2)
      return version <= rangeVersion
    }

    if (range.startsWith('<')) {
      const rangeVersion = range.slice(1)
      return version < rangeVersion
    }

    return false
  }

  /**
   * Helper: Check if version is marked stable
   */
  private isStableVersion(version: string): boolean {
    const parts = version.split('-')
    return parts.length === 1 && !version.includes('alpha') && !version.includes('beta')
  }

  /**
   * Helper: Check if version is within range
   */
  private isVersionInRange(version: string, minVersion: string, maxVersion?: string): boolean {
    if (version < minVersion) return false
    if (maxVersion && version > maxVersion) return false
    return true
  }

  clearCache(): void {
    this.resolvedCache.clear()
  }
}

// ==================== Mock Registry ====================

const MOCK_SKILLS: Record<string, Skill> = {
  'file-analyzer': {
    id: 'file-analyzer',
    name: 'File Analyzer',
    description: 'Advanced file analysis tool for multiple formats',
    author: 'APEX Team',
    version: '2.1.0',
    category: 'file-management',
    tags: ['analysis', 'files', 'utilities'],
    rating: 4.7,
    ratingCount: 234,
    downloads: 15420,
    repository: 'https://github.com/apex/file-analyzer',
    documentation: 'https://docs.apex.ai/skills/file-analyzer',
    license: 'MIT',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2025-04-01T14:30:00Z',
    dependencies: [],
    compatible: {
      minApexVersion: '1.0.0',
      maxApexVersion: undefined,
      platforms: ['linux', 'darwin', 'win32'],
    },
  },
  'json-validator': {
    id: 'json-validator',
    name: 'JSON Validator Pro',
    description: 'Comprehensive JSON validation and schema checking',
    author: 'Schema Masters',
    version: '1.5.2',
    category: 'data-validation',
    tags: ['json', 'validation', 'schema'],
    rating: 4.5,
    ratingCount: 156,
    downloads: 8930,
    repository: 'https://github.com/apex/json-validator',
    license: 'Apache 2.0',
    createdAt: '2024-02-20T08:15:00Z',
    updatedAt: '2025-03-28T11:45:00Z',
    dependencies: [],
    compatible: {
      minApexVersion: '1.1.0',
      platforms: ['linux', 'darwin', 'win32'],
    },
  },
  'api-tester': {
    id: 'api-tester',
    name: 'API Tester',
    description: 'Complete API testing and debugging toolkit',
    author: 'Test Labs',
    version: '3.2.1',
    category: 'testing',
    tags: ['api', 'testing', 'http', 'debug'],
    rating: 4.8,
    ratingCount: 312,
    downloads: 22150,
    repository: 'https://github.com/apex/api-tester',
    documentation: 'https://docs.apex.ai/skills/api-tester',
    license: 'MIT',
    createdAt: '2024-03-10T12:00:00Z',
    updatedAt: '2025-04-10T16:20:00Z',
    dependencies: [
      {
        skillId: 'json-validator',
        versionRange: '^1.0.0',
      },
    ],
    compatible: {
      minApexVersion: '1.2.0',
      platforms: ['linux', 'darwin', 'win32'],
    },
  },
  'code-formatter': {
    id: 'code-formatter',
    name: 'Universal Code Formatter',
    description: 'Format code across multiple languages',
    author: 'Code Standards Inc',
    version: '2.0.3',
    category: 'code-quality',
    tags: ['formatting', 'code', 'style'],
    rating: 4.3,
    ratingCount: 189,
    downloads: 11240,
    license: 'GPL 3.0',
    createdAt: '2024-04-05T09:30:00Z',
    updatedAt: '2025-04-08T13:10:00Z',
    dependencies: [],
    compatible: {
      minApexVersion: '1.0.0',
      platforms: ['linux', 'darwin', 'win32'],
    },
  },
  'database-cli': {
    id: 'database-cli',
    name: 'Database CLI Manager',
    description: 'Manage databases from command line',
    author: 'Database Tools Co',
    version: '1.8.0',
    category: 'database',
    tags: ['database', 'sql', 'cli', 'management'],
    rating: 4.6,
    ratingCount: 267,
    downloads: 18900,
    documentation: 'https://docs.apex.ai/skills/database-cli',
    license: 'MIT',
    createdAt: '2024-01-20T14:45:00Z',
    updatedAt: '2025-04-05T10:50:00Z',
    dependencies: [],
    compatible: {
      minApexVersion: '1.1.0',
      platforms: ['linux', 'darwin', 'win32'],
    },
  },
}

const MOCK_REVIEWS: Record<string, Review[]> = {
  'file-analyzer': [
    {
      id: 'rev-1',
      userId: 'user-123',
      username: 'alice-dev',
      skillId: 'file-analyzer',
      rating: 5,
      title: 'Excellent tool, very reliable',
      content: 'This skill has saved me countless hours analyzing complex file structures.',
      timestamp: '2025-03-20T10:30:00Z',
      upvotes: 24,
      downvotes: 1,
    },
    {
      id: 'rev-2',
      userId: 'user-456',
      username: 'bob-coder',
      skillId: 'file-analyzer',
      rating: 4,
      title: 'Good, but could use better docs',
      content: 'Works well for most use cases. Documentation could be more detailed.',
      timestamp: '2025-03-15T15:45:00Z',
      upvotes: 12,
      downvotes: 2,
    },
  ],
  'api-tester': [
    {
      id: 'rev-3',
      userId: 'user-789',
      username: 'charlie-qa',
      skillId: 'api-tester',
      rating: 5,
      title: 'Perfect for API testing',
      content: 'Comprehensive testing capabilities. Exactly what we needed.',
      timestamp: '2025-04-01T08:00:00Z',
      upvotes: 31,
      downvotes: 0,
    },
  ],
}

const MOCK_RATINGS: Record<string, Rating[]> = {
  'file-analyzer': [
    { userId: 'user-1', username: 'user1', rating: 5, timestamp: '2025-04-10T10:00:00Z', helpfulCount: 0 },
    { userId: 'user-2', username: 'user2', rating: 4, timestamp: '2025-04-09T14:00:00Z', helpfulCount: 0 },
    { userId: 'user-3', username: 'user3', rating: 5, timestamp: '2025-04-08T09:00:00Z', helpfulCount: 0 },
  ],
}

// ==================== MarketplaceClient ====================

class MarketplaceClient {
  private skills: Map<string, Skill> = new Map()
  private reviews: Map<string, Review[]> = new Map()
  private ratings: Map<string, Rating[]> = new Map()
  private initialized = false
  private dependencyResolver: DependencyResolver | null = null

  async initialize(): Promise<void> {
    if (this.initialized) return
    try {
      // Load mock data
      Object.entries(MOCK_SKILLS).forEach(([id, skill]) => {
        this.skills.set(id, skill)
      })
      Object.entries(MOCK_REVIEWS).forEach(([id, reviews]) => {
        this.reviews.set(id, reviews)
      })
      Object.entries(MOCK_RATINGS).forEach(([id, ratings]) => {
        this.ratings.set(id, ratings)
      })
      this.initialized = true
      this.dependencyResolver = new DependencyResolver(this.skills)
      logForDebugging('MarketplaceClient initialized with mock registry')
    } catch (error) {
      logForDebugging(`MarketplaceClient initialization error: ${error}`)
      throw error
    }
  }

  // ==================== Browsing ====================

  async browse(options: BrowseOptions = {}): Promise<Skill[]> {
    await this.initialize()

    let skills = Array.from(this.skills.values())

    // Filter by category
    if (options.category) {
      skills = skills.filter((s) => s.category === options.category)
    }

    // Sort
    const sortBy = options.sortBy || 'downloads'
    switch (sortBy) {
      case 'downloads':
        skills.sort((a, b) => b.downloads - a.downloads)
        break
      case 'rating':
        skills.sort((a, b) => b.rating - a.rating)
        break
      case 'recent':
        skills.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case 'name':
        skills.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    // Paginate
    const limit = options.limit || 10
    const offset = options.offset || 0
    return skills.slice(offset, offset + limit)
  }

  // ==================== Search ====================

  async search(options: SearchOptions = {}): Promise<Skill[]> {
    await this.initialize()

    let skills = Array.from(this.skills.values())

    // Filter by keyword (searches name, description, and tags)
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase()
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(keyword) ||
          s.description.toLowerCase().includes(keyword) ||
          s.tags.some((tag) => tag.toLowerCase().includes(keyword)),
      )
    }

    // Filter by category
    if (options.category) {
      skills = skills.filter((s) => s.category === options.category)
    }

    // Filter by author
    if (options.author) {
      skills = skills.filter((s) => s.author.toLowerCase() === options.author.toLowerCase())
    }

    // Filter by minimum rating
    if (options.minRating !== undefined) {
      skills = skills.filter((s) => s.rating >= options.minRating!)
    }

    // Sort
    const sortBy = options.sortBy || 'downloads'
    switch (sortBy) {
      case 'downloads':
        skills.sort((a, b) => b.downloads - a.downloads)
        break
      case 'rating':
        skills.sort((a, b) => b.rating - a.rating)
        break
      case 'recent':
        skills.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case 'name':
        skills.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    // Paginate
    const limit = options.limit || 10
    const offset = options.offset || 0
    return skills.slice(offset, offset + limit)
  }

  // ==================== Skill Details ====================

  async getSkill(skillId: string): Promise<Skill | null> {
    await this.initialize()
    return this.skills.get(skillId) || null
  }

  async listAllCategories(): Promise<string[]> {
    await this.initialize()
    const categories = new Set(Array.from(this.skills.values()).map((s) => s.category))
    return Array.from(categories).sort()
  }

  // ==================== Ratings ====================

  async getRatings(skillId: string): Promise<Rating[]> {
    await this.initialize()
    return this.ratings.get(skillId) || []
  }

  async addRating(skillId: string, userId: string, username: string, rating: number): Promise<void> {
    await this.initialize()

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const newRating: Rating = {
      userId,
      username,
      rating,
      timestamp: new Date().toISOString(),
      helpfulCount: 0,
    }

    if (!this.ratings.has(skillId)) {
      this.ratings.set(skillId, [])
    }

    this.ratings.get(skillId)!.push(newRating)

    // Update skill's average rating
    const ratings = this.ratings.get(skillId)!
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    skill.rating = Math.round(avgRating * 10) / 10
    skill.ratingCount = ratings.length

    logForDebugging(`Added rating for ${skillId}: ${rating} stars`)
  }

  async getAverageRating(skillId: string): Promise<number> {
    const ratings = await this.getRatings(skillId)
    if (ratings.length === 0) return 0
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
    return Math.round((sum / ratings.length) * 10) / 10
  }

  // ==================== Reviews ====================

  async getReviews(skillId: string): Promise<Review[]> {
    await this.initialize()
    return (this.reviews.get(skillId) || []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
  }

  async addReview(
    skillId: string,
    userId: string,
    username: string,
    rating: number,
    title: string,
    content: string,
  ): Promise<Review> {
    await this.initialize()

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const review: Review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      skillId,
      rating,
      title,
      content,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
    }

    if (!this.reviews.has(skillId)) {
      this.reviews.set(skillId, [])
    }

    this.reviews.get(skillId)!.push(review)
    logForDebugging(`Added review for ${skillId}: "${title}"`)

    return review
  }

  async upvoteReview(reviewId: string, skillId: string): Promise<void> {
    const reviews = this.reviews.get(skillId)
    if (!reviews) return

    const review = reviews.find((r) => r.id === reviewId)
    if (review) {
      review.upvotes++
    }
  }

  async downvoteReview(reviewId: string, skillId: string): Promise<void> {
    const reviews = this.reviews.get(skillId)
    if (!reviews) return

    const review = reviews.find((r) => r.id === reviewId)
    if (review) {
      review.downvotes++
    }
  }

  // ==================== Dependency Resolution ====================

  private parseVersionRange(range: string): (version: string) => boolean {
    // Simple semver range parsing
    if (range.startsWith('^')) {
      const baseParts = range.slice(1).split('.')
      return (version: string) => {
        const versionParts = version.split('.')
        return (
          versionParts[0] === baseParts[0] &&
          (parseInt(versionParts[1]) > parseInt(baseParts[1]) ||
            (versionParts[1] === baseParts[1] && versionParts[2] >= baseParts[2]))
        )
      }
    }
    if (range.startsWith('~')) {
      const baseParts = range.slice(1).split('.')
      return (version: string) => {
        const versionParts = version.split('.')
        return (
          versionParts[0] === baseParts[0] &&
          versionParts[1] === baseParts[1] &&
          parseInt(versionParts[2]) >= parseInt(baseParts[2])
        )
      }
    }
    if (range.startsWith('>=')) {
      const baseParts = range.slice(2).split('.')
      return (version: string) => {
        const versionParts = version.split('.')
        const base = `${baseParts[0]}.${baseParts[1]}.${baseParts[2]}`
        return version >= base
      }
    }
    // Default: exact match
    return (version: string) => version === range
  }

  async resolveDependencies(skillId: string): Promise<DependencyGraph> {
    await this.initialize()

    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const resolved = new Map<string, string>()
    const conflicts: DependencyConflict[] = []
    const visited = new Set<string>()

    const resolveDeps = (depSpec: DependencySpec, level: number = 0): void => {
      if (level > 10) {
        conflicts.push({
          skillId: depSpec.skillId,
          requestedVersions: [],
          reason: 'Circular dependency or too deep',
        })
        return
      }

      const depSkill = this.skills.get(depSpec.skillId)
      if (!depSkill) {
        conflicts.push({
          skillId: depSpec.skillId,
          requestedVersions: [depSpec.versionRange],
          reason: 'Skill not found in registry',
        })
        return
      }

      const matcher = this.parseVersionRange(depSpec.versionRange)
      if (!matcher(depSkill.version)) {
        conflicts.push({
          skillId: depSpec.skillId,
          requestedVersions: [depSpec.versionRange],
          reason: `Available version ${depSkill.version} does not match ${depSpec.versionRange}`,
        })
        return
      }

      if (resolved.has(depSpec.skillId)) {
        const existingVersion = resolved.get(depSpec.skillId)!
        if (existingVersion !== depSkill.version) {
          conflicts.push({
            skillId: depSpec.skillId,
            requestedVersions: [depSpec.versionRange, existingVersion],
            reason: `Version conflict: ${depSpec.versionRange} vs existing ${existingVersion}`,
          })
        }
        return
      }

      resolved.set(depSpec.skillId, depSkill.version)

      // Recursively resolve transitive dependencies
      for (const transitiveDep of depSkill.dependencies) {
        resolveDeps(transitiveDep, level + 1)
      }
    }

    // Resolve all dependencies
    for (const dep of skill.dependencies) {
      resolveDeps(dep)
    }

    return {
      skillId,
      version: skill.version,
      dependencies: skill.dependencies,
      resolved,
      conflicts,
    }
  }

  // ==================== Advanced Dependency Resolution ====================

  /**
   * Resolve all dependencies using enhanced resolver with strategy support
   */
  async resolveAllDependencies(skillId: string, strategy: ResolutionStrategy = { type: 'newest' }): Promise<Map<string, string>> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    this.dependencyResolver.setStrategy(strategy)
    return this.dependencyResolver.resolveAll(skillId)
  }

  /**
   * Detect all version conflicts in dependency tree
   */
  async detectDependencyConflicts(skillId: string): Promise<DependencyConflict[]> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    return this.dependencyResolver.detectConflicts(skillId)
  }

  /**
   * Suggest resolutions for detected conflicts
   */
  async suggestConflictResolutions(skillId: string): Promise<ConflictResolution[]> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    const conflicts = this.dependencyResolver.detectConflicts(skillId)
    return this.dependencyResolver.suggestResolutions(skillId, conflicts)
  }

  /**
   * Get optimal installation order for skill and dependencies
   */
  async getInstallationOrder(skillId: string): Promise<InstallationOrder> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    const resolved = await this.dependencyResolver.resolveAll(skillId)
    return this.dependencyResolver.getInstallationOrder(skillId, resolved)
  }

  /**
   * Validate skill compatibility with APEX version
   */
  async validateSkillCompatibility(skillId: string, apexVersion: string): Promise<CompatibilityCheckResult> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    return this.dependencyResolver.validateCompatibility(skillId, apexVersion)
  }

  /**
   * Simulate installation without executing
   */
  async simulateDependencyInstallation(
    skillId: string,
    apexVersion: string,
  ): Promise<{
    success: boolean
    installationOrder: InstallationOrder
    compatibilityChecks: CompatibilityCheckResult[]
    conflicts: DependencyConflict[]
    estimatedSize: number
  }> {
    await this.initialize()
    if (!this.dependencyResolver) throw new Error('DependencyResolver not initialized')

    return this.dependencyResolver.simulateInstallation(skillId, apexVersion)
  }

  /**
   * Clear dependency resolution cache
   */
  clearDependencyCache(): void {
    if (this.dependencyResolver) {
      this.dependencyResolver.clearCache()
    }
  }

  // ==================== Installation ====================

  async prepareInstallation(skillId: string): Promise<InstallationManifest> {
    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`)
    }

    const dependencyGraph = await this.resolveDependencies(skillId)

    if (dependencyGraph.conflicts.length > 0) {
      const conflictSummary = dependencyGraph.conflicts.map((c) => `${c.skillId}: ${c.reason}`).join('; ')
      throw new Error(`Cannot resolve dependencies: ${conflictSummary}`)
    }

    return {
      skillId,
      version: skill.version,
      dependencies: dependencyGraph,
      installPath: `/apex/skills/${skillId}`,
      timestamp: new Date().toISOString(),
      metadata: skill,
    }
  }

  // ==================== Version Management ====================

  async checkForUpdates(skillId: string, currentVersion: string): Promise<Skill | null> {
    const skill = await this.getSkill(skillId)
    if (!skill) return null

    // In a real scenario, this would check against actual registry versions
    // For now, just return the latest version if it's different
    if (skill.version !== currentVersion) {
      return skill
    }

    return null
  }

  async getVersionHistory(skillId: string): Promise<string[]> {
    // Mock version history
    const skill = await this.getSkill(skillId)
    if (!skill) return []

    // Generate realistic version history based on current version
    const [major, minor, patch] = skill.version.split('.').map(Number)
    const versions: string[] = []

    // Generate some historical versions
    for (let m = major; m >= Math.max(0, major - 2); m--) {
      for (let mi = minor; mi >= Math.max(0, minor - 3); mi--) {
        if (m === major && mi > minor) continue
        for (let p = patch; p >= Math.max(0, patch - 3); p--) {
          if (m === major && mi === minor && p >= patch) continue
          versions.push(`${m}.${mi}.${p}`)
        }
      }
    }

    return versions
  }

  async compareVersions(version1: string, version2: string): Promise<-1 | 0 | 1> {
    const [maj1, min1, pat1] = version1.split('.').map(Number)
    const [maj2, min2, pat2] = version2.split('.').map(Number)

    if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1
    if (min1 !== min2) return min1 > min2 ? 1 : -1
    if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1

    return 0
  }
}

// ==================== Export ====================

export const marketplaceClient = new MarketplaceClient()
export { DependencyResolver }
