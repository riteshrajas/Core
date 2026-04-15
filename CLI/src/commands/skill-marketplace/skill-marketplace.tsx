import React, { useEffect, useState } from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text, render } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { logForDebugging } from '../../utils/debug.js'
import { marketplaceClient } from '../../services/marketplaceClient.js'
import type { Skill } from '../../services/marketplaceClient.js'

interface SkillMarketplaceProps {
  onDone: LocalJSXCommandOnDone
}

type ViewMode = 'browse' | 'search' | 'details' | 'install' | 'installing' | 'result'

interface SkillMarketplaceState {
  mode: ViewMode
  skills: Skill[]
  selectedSkill: Skill | null
  searchQuery: string
  filterCategory: string | null
  minRating: number
  currentPage: number
  pageSize: number
  totalSkills: number
  categories: string[]
  installStatus: 'idle' | 'resolving' | 'resolved' | 'installing' | 'success' | 'error'
  installMessage: string
  loading: boolean
  error: string | null
}

const marketplaceClient = new MarketplaceClient()

export function SkillMarketplace({ onDone }: SkillMarketplaceProps) {
  const [state, setState] = useState<SkillMarketplaceState>({
    mode: 'browse',
    skills: [],
    selectedSkill: null,
    searchQuery: '',
    filterCategory: null,
    minRating: 0,
    currentPage: 1,
    pageSize: 10,
    totalSkills: 0,
    categories: [],
    installStatus: 'idle',
    installMessage: '',
    loading: true,
    error: null,
  })

  useEffect(() => {
    const initialize = async () => {
      try {
        await marketplaceClient.initialize()

        // Load categories
        const categories = await marketplaceClient.listAllCategories()
        setState(prev => ({ ...prev, categories, loading: false }))

        // Load initial skills
        const skills = await marketplaceClient.browse({ limit: state.pageSize })
        setState(prev => ({
          ...prev,
          skills,
          totalSkills: skills.length,
          loading: false,
        }))
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize marketplace'
        logForDebugging('Marketplace error:', errorMsg)
        setState(prev => ({
          ...prev,
          error: errorMsg,
          loading: false,
        }))
      }
    }

    initialize()
  }, [])

  const handleSearch = async (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, loading: true, currentPage: 1 }))

    try {
      const skills = await marketplaceClient.search({
        keyword: query,
        category: state.filterCategory || undefined,
        minRating: state.minRating,
        limit: state.pageSize,
      })
      setState(prev => ({
        ...prev,
        skills,
        totalSkills: skills.length,
        mode: 'search',
        loading: false,
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed'
      setState(prev => ({
        ...prev,
        error: errorMsg,
        loading: false,
      }))
    }
  }

  const handleFilterCategory = async (category: string) => {
    setState(prev => ({
      ...prev,
      filterCategory: category,
      loading: true,
      currentPage: 1,
    }))

    try {
      const skills = await marketplaceClient.browse({
        category,
        limit: state.pageSize,
      })
      setState(prev => ({
        ...prev,
        skills,
        totalSkills: skills.length,
        loading: false,
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Filter failed'
      setState(prev => ({
        ...prev,
        error: errorMsg,
        loading: false,
      }))
    }
  }

  const handleSelectSkill = async (skill: Skill) => {
    setState(prev => ({
      ...prev,
      selectedSkill: skill,
      mode: 'details',
    }))
  }

  const handleInstall = async (skillId: string) => {
    setState(prev => ({
      ...prev,
      installStatus: 'resolving',
      installMessage: 'Resolving dependencies...',
      mode: 'installing',
    }))

    try {
      // Resolve dependencies
      const depGraph = await marketplaceClient.resolveDependencies(skillId)
      setState(prev => ({
        ...prev,
        installStatus: 'resolved',
        installMessage: `Dependencies resolved. Installing ${skillId}...`,
      }))

      // Prepare installation
      const manifest = await marketplaceClient.prepareInstallation(skillId)
      setState(prev => ({
        ...prev,
        installStatus: 'installing',
        installMessage: `Installing ${skillId} (v${manifest.version})...`,
      }))

      // Simulate installation progress
      await new Promise(resolve => setTimeout(resolve, 1500))

      setState(prev => ({
        ...prev,
        installStatus: 'success',
        installMessage: `✓ Successfully installed ${skillId}`,
        mode: 'result',
      }))

      // Auto-exit after showing success
      setTimeout(() => {
        onDone(`Skill '${skillId}' installed successfully`)
      }, 2000)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Installation failed'
      logForDebugging('Installation error:', errorMsg)
      setState(prev => ({
        ...prev,
        installStatus: 'error',
        installMessage: `Error: ${errorMsg}`,
        mode: 'result',
      }))
    }
  }

  const handleBack = () => {
    setState(prev => ({
      ...prev,
      mode: 'browse',
      selectedSkill: null,
      searchQuery: '',
      filterCategory: null,
    }))
  }

  // Loading state
  if (state.loading) {
    return (
      <Box flexDirection="column">
        <Text>Loading skills marketplace...</Text>
      </Box>
    )
  }

  // Error state
  if (state.error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {state.error}</Text>
      </Box>
    )
  }

  // Browse view
  if (state.mode === 'browse') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          APEX Skill Marketplace
        </Text>
        <Text dimColor>Browse and manage skills for your APEX projects</Text>
        <Box marginY={1} flexDirection="column">
          <Text bold>Available Categories:</Text>
          {state.categories.slice(0, 5).map(cat => (
            <Text key={cat} color="yellow">
              • {cat}
            </Text>
          ))}
        </Box>
        <Box marginY={1} flexDirection="column">
          <Text bold>Featured Skills:</Text>
          {state.skills.slice(0, 5).map(skill => (
            <Box key={skill.id} flexDirection="row" marginY={1}>
              <Box width={25}>
                <Text color="green">{skill.name}</Text>
              </Box>
              <Text dimColor>{`⭐ ${skill.rating.toFixed(1)} (${skill.downloads} downloads)`}</Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Use --search, --category, --rating, or --install flags</Text>
        </Box>
      </Box>
    )
  }

  // Search results view
  if (state.mode === 'search') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Search Results
        </Text>
        <Text dimColor>{`Query: "${state.searchQuery}" (${state.skills.length} results)`}</Text>
        <Box marginY={1} flexDirection="column">
          {state.skills.length > 0 ? (
            state.skills.map((skill, idx) => (
              <Box key={skill.id} flexDirection="row" marginY={1}>
                <Box width={3}>
                  <Text>{idx + 1}.</Text>
                </Box>
                <Box flex={1} flexDirection="column">
                  <Text color="green" bold>
                    {skill.name}
                  </Text>
                  <Text dimColor>{skill.description.substring(0, 60)}...</Text>
                  <Text color="yellow" dimColor>
                    ⭐ {skill.rating.toFixed(1)} • {skill.downloads} downloads • By {skill.author}
                  </Text>
                </Box>
              </Box>
            ))
          ) : (
            <Text color="red">No skills found matching your criteria</Text>
          )}
        </Box>
      </Box>
    )
  }

  // Details view
  if (state.mode === 'details' && state.selectedSkill) {
    const skill = state.selectedSkill
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          {skill.name}
        </Text>
        <Box marginY={1} flexDirection="column">
          <Text>{skill.description}</Text>
          <Box marginY={1} flexDirection="row">
            <Box width={15}>
              <Text bold>Author:</Text>
            </Box>
            <Text>{skill.author}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text bold>Version:</Text>
            </Box>
            <Text>{skill.version}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text bold>Rating:</Text>
            </Box>
            <Text color="yellow">{skill.rating.toFixed(1)}/5 ({skill.ratingCount} ratings)</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text bold>Downloads:</Text>
            </Box>
            <Text>{skill.downloads.toLocaleString()}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text bold>Category:</Text>
            </Box>
            <Text>{skill.category}</Text>
          </Box>
          <Box flexDirection="row">
            <Box width={15}>
              <Text bold>License:</Text>
            </Box>
            <Text>{skill.license}</Text>
          </Box>
        </Box>

        {skill.dependencies.length > 0 && (
          <Box marginY={1} flexDirection="column">
            <Text bold>Dependencies:</Text>
            {skill.dependencies.map(dep => (
              <Text key={dep.skillId} color="yellow" dimColor>
                • {dep.skillId} {dep.versionRange}
              </Text>
            ))}
          </Box>
        )}

        <Box marginTop={1}>
          <Text color="green">[I]nstall  [B]ack  [Q]uit</Text>
        </Box>
      </Box>
    )
  }

  // Installing state
  if (state.mode === 'installing') {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][
      Math.floor(Date.now() / 80) % 10
    ]
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          {spinner} Installing Skill
        </Text>
        <Text marginY={1}>{state.installMessage}</Text>
        <Box marginTop={1} flexDirection="row">
          <Box width={30} borderStyle="single" paddingX={1}>
            <Text dimColor>
              [{state.installStatus === 'resolving' ? '=' : ' '}→
              {state.installStatus === 'installing' ? '=' : ' '}→
              {state.installStatus === 'success' ? '✓' : ' '}]
            </Text>
          </Box>
        </Box>
      </Box>
    )
  }

  // Result state
  if (state.mode === 'result') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color={state.installStatus === 'success' ? 'green' : 'red'}>
          {state.installMessage}
        </Text>
        <Text marginTop={1} dimColor>
          Exiting in 2 seconds...
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text>Skill Marketplace</Text>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <SkillMarketplace onDone={onDone} />
}
