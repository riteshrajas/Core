import React, { useState, useEffect } from 'react'
import { errorRecoveryManager, ErrorCategory } from '../../services/errorRecoveryManager.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'

export const call = (
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> => {
  return Promise.resolve(<ErrorRecoveryCommand onDone={onDone} />)
}

type ViewMode = 'menu' | 'history' | 'patterns' | 'stats' | 'details'

interface ErrorEntryDisplay {
  id: string
  category: string
  message: string
  timestamp: string
  recovered: boolean
  attemptCount: number
}

function ErrorRecoveryCommand({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  const [viewMode, setViewMode] = useState<ViewMode>('menu')
  const [selectedFilter, setSelectedFilter] = useState<ErrorCategory | 'all'>('all')
  const [selectedError, setSelectedError] = useState<string | null>(null)

  const stats = errorRecoveryManager.getErrorStats()
  const allHistory = errorRecoveryManager.getErrorHistory(10)
  const allPatterns = errorRecoveryManager.getErrorPatterns(10)

  const filteredHistory: ErrorEntryDisplay[] = allHistory
    .filter(entry =>
      selectedFilter === 'all' ? true : entry.context.category === selectedFilter
    )
    .map((entry, idx) => ({
      id: `error-${idx}`,
      category: entry.context.category,
      message: entry.context.message.substring(0, 50),
      timestamp: new Date(entry.context.timestamp).toLocaleTimeString(),
      recovered: entry.recovered,
      attemptCount: entry.attemptCount,
    }))

  const menuItems = [
    { id: 'history', label: 'View Error History', icon: '📋' },
    { id: 'patterns', label: 'View Error Patterns', icon: '📊' },
    { id: 'stats', label: 'View Statistics', icon: '📈' },
    { id: 'clear', label: 'Clear Error History', icon: '🗑️' },
  ]

  if (viewMode === 'menu') {
    return (
      <Dialog
        title="Error Recovery Manager"
        subtitle={`${stats.totalErrors} errors tracked`}
        onCancel={() => onDone()}
      >
        <FuzzyPicker
          title="Select an option"
          items={menuItems}
          getKey={item => item.id}
          renderItem={(item, isFocused) => (
            <Box>
              <Text bold={isFocused} color={isFocused ? 'cyan' : undefined}>
                {item.icon} {item.label}
              </Text>
            </Box>
          )}
          onSelect={item => {
            if (item.id === 'history') {
              setViewMode('history')
            } else if (item.id === 'patterns') {
              setViewMode('patterns')
            } else if (item.id === 'stats') {
              setViewMode('stats')
            } else if (item.id === 'clear') {
              errorRecoveryManager.clearErrorHistory()
              onDone('Error history cleared')
            }
          }}
          onQueryChange={() => {}}
          onCancel={() => onDone()}
        />
      </Dialog>
    )
  }

  if (viewMode === 'history') {
    return (
      <Dialog
        title="Error History"
        subtitle={`Showing ${filteredHistory.length} of ${allHistory.length} errors`}
        onCancel={() => setViewMode('menu')}
      >
        <Box flexDirection="column" gap={1}>
          <Box gap={2}>
            <Text bold>Filter:</Text>
            <Box gap={1}>
              {(['all', ...Object.values(ErrorCategory)] as const).map(category => (
                <Text
                  key={category}
                  bold={selectedFilter === category}
                  color={selectedFilter === category ? 'cyan' : 'gray'}
                  onClick={() => setSelectedFilter(category)}
                >
                  [{category}]
                </Text>
              ))}
            </Box>
          </Box>

          {filteredHistory.length === 0 ? (
            <Text dimColor>No errors in selected category</Text>
          ) : (
            <Box flexDirection="column" gap={1}>
              {filteredHistory.map(error => (
                <Box key={error.id} flexDirection="column" gap={0} paddingLeft={1}>
                  <Box gap={2}>
                    <Text
                      color={error.recovered ? 'green' : 'red'}
                      bold={selectedError === error.id}
                    >
                      {error.recovered ? '✓' : '✗'} {error.category}
                    </Text>
                    <Text dimColor>{error.timestamp}</Text>
                    <Text dimColor>({error.attemptCount} attempts)</Text>
                  </Box>
                  <Text dimColor>{error.message}...</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Dialog>
    )
  }

  if (viewMode === 'patterns') {
    return (
      <Dialog
        title="Error Patterns"
        subtitle={`Top ${allPatterns.length} patterns by frequency`}
        onCancel={() => setViewMode('menu')}
      >
        <Box flexDirection="column" gap={1}>
          {allPatterns.length === 0 ? (
            <Text dimColor>No error patterns detected</Text>
          ) : (
            allPatterns.map((pattern, idx) => (
              <Box key={idx} flexDirection="column" gap={0} paddingLeft={1}>
                <Box gap={2}>
                  <Text bold>{idx + 1}.</Text>
                  <Text bold>{pattern.category}</Text>
                  <Text color="yellow">{pattern.frequency}x</Text>
                </Box>
                <Text dimColor>{pattern.pattern}</Text>
                {pattern.suggestion && (
                  <Text color="green">💡 {pattern.suggestion}</Text>
                )}
              </Box>
            ))
          )}
        </Box>
      </Dialog>
    )
  }

  if (viewMode === 'stats') {
    return (
      <Dialog
        title="Error Statistics"
        subtitle="Recovery and error analysis"
        onCancel={() => setViewMode('menu')}
      >
        <Box flexDirection="column" gap={2}>
          <Box gap={2}>
            <Text bold>Total Errors:</Text>
            <Text color="cyan">{stats.totalErrors}</Text>
          </Box>

          <Box gap={2}>
            <Text bold>Recovery Rate:</Text>
            <Text color={stats.recoveryRate > 0.7 ? 'green' : 'yellow'}>
              {(stats.recoveryRate * 100).toFixed(1)}%
            </Text>
          </Box>

          <Box flexDirection="column" gap={1}>
            <Text bold>Errors by Category:</Text>
            {Object.entries(stats.byCategory)
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => (
                <Box key={category} gap={2} paddingLeft={1}>
                  <Text dimColor>{category}:</Text>
                  <Text color="blue">{count}</Text>
                </Box>
              ))}
          </Box>

          {stats.topPatterns.length > 0 && (
            <Box flexDirection="column" gap={1}>
              <Text bold>Top 3 Patterns:</Text>
              {stats.topPatterns.slice(0, 3).map((pattern, idx) => (
                <Box key={idx} gap={2} paddingLeft={1}>
                  <Text dimColor>{idx + 1}.</Text>
                  <Text>{pattern.pattern}</Text>
                  <Text color="gray">({pattern.frequency}x)</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Dialog>
    )
  }

  return (
    <Dialog title="Error Recovery" onCancel={() => onDone()}>
      <Text>Loading...</Text>
    </Dialog>
  )
}
