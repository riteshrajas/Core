import * as React from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { permissionAuditLogger, type AuditEntry, type AuditReport } from '../../services/permissionAuditLogger.js'

interface ViewState {
  currentView: 'menu' | 'logs' | 'report' | 'policies' | 'detail' | 'export'
  filter: {
    tool?: string
    action?: 'allow' | 'deny' | 'skip'
    startDate?: string
    endDate?: string
  }
  logs: AuditEntry[]
  report?: AuditReport
  policies: any[]
  selectedEntry?: AuditEntry
  exportPath?: string
  message?: string
  loading: boolean
}

const PermissionAuditComponent: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [state, setState] = React.useState<ViewState>({
    currentView: 'menu',
    filter: {},
    logs: [],
    policies: [],
    loading: false,
  })

  const [stats, setStats] = React.useState<any>(null)

  React.useEffect(() => {
    const loadInitialData = async () => {
      setState(prev => ({ ...prev, loading: true }))
      try {
        const initialStats = await permissionAuditLogger.getStatistics()
        setStats(initialStats)

        const initialLogs = await permissionAuditLogger.queryAuditLogs({ limit: 50 })
        setState(prev => ({
          ...prev,
          logs: initialLogs,
          loading: false,
        }))

        const initialPolicies = await permissionAuditLogger.listPolicies()
        setState(prev => ({
          ...prev,
          policies: initialPolicies,
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          message: `Error loading data: ${error instanceof Error ? error.message : String(error)}`,
          loading: false,
        }))
      }
    }

    loadInitialData()
  }, [])

  const handleLoadLogs = async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const logs = await permissionAuditLogger.queryAuditLogs({
        tool: state.filter.tool,
        action: state.filter.action,
        startDate: state.filter.startDate,
        endDate: state.filter.endDate,
        limit: 50,
      })
      setState(prev => ({
        ...prev,
        logs,
        currentView: 'logs',
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        message: `Error loading logs: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
      }))
    }
  }

  const handleGenerateReport = async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const report = await permissionAuditLogger.generateAuditReport(
        state.filter.startDate,
        state.filter.endDate,
      )
      setState(prev => ({
        ...prev,
        report,
        currentView: 'report',
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        message: `Error generating report: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
      }))
    }
  }

  const handleExport = async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const exported = await permissionAuditLogger.exportAuditLogs(state.exportPath)
      setState(prev => ({
        ...prev,
        message: state.exportPath
          ? `Audit logs exported to ${state.exportPath}`
          : 'Audit logs copied to clipboard',
        loading: false,
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        message: `Error exporting logs: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
      }))
    }
  }

  const renderMenu = () => (
    <Box flexDirection="column" gap={1} marginBottom={2}>
      <Text bold>📊 Permission Audit</Text>
      {stats && (
        <Box flexDirection="column" gap={1} marginBottom={1}>
          <Text>
            Total entries: <Text color="cyan">{stats.totalEntries}</Text> | Allowed:{' '}
            <Text color="green">{stats.allowedCount}</Text> | Denied:{' '}
            <Text color="red">{stats.deniedCount}</Text> | Skipped:{' '}
            <Text color="yellow">{stats.skippedCount}</Text>
          </Text>
          <Text>Unique tools: {stats.uniqueTools}</Text>
        </Box>
      )}
      <SelectInput
        items={[
          { label: 'View Recent Audit Logs', value: 'logs' },
          { label: 'Generate Audit Report', value: 'report' },
          { label: 'View Permission Policies', value: 'policies' },
          { label: 'Export Audit Logs', value: 'export' },
          { label: 'Exit', value: 'exit' },
        ]}
        onSelect={item => {
          if (item.value === 'exit') {
            onDone()
          } else if (item.value === 'logs') {
            handleLoadLogs()
          } else if (item.value === 'report') {
            handleGenerateReport()
          } else if (item.value === 'policies') {
            setState(prev => ({ ...prev, currentView: 'policies' }))
          } else if (item.value === 'export') {
            setState(prev => ({ ...prev, currentView: 'export' }))
          }
        }}
      />
    </Box>
  )

  const renderLogs = () => (
    <Box flexDirection="column" gap={1} marginBottom={2}>
      <Text bold>📋 Recent Audit Logs (Last 50)</Text>
      {state.logs.length === 0 ? (
        <Text color="yellow">No audit entries found.</Text>
      ) : (
        <Box flexDirection="column" gap={0}>
          {state.logs.slice(0, 10).map(entry => (
            <Box key={entry.id} flexDirection="row" gap={2}>
              <Text width={10} color={entry.action === 'allow' ? 'green' : entry.action === 'deny' ? 'red' : 'yellow'}>
                [{entry.action.toUpperCase()}]
              </Text>
              <Text width={20}>{entry.tool}</Text>
              <Text color="gray" width={30}>
                {new Date(entry.timestamp).toLocaleString()}
              </Text>
            </Box>
          ))}
          {state.logs.length > 10 && <Text color="gray">... and {state.logs.length - 10} more</Text>}
        </Box>
      )}
      <Box gap={2} marginTop={1}>
        <Text
          onPress={() => {
            setState(prev => ({ ...prev, filter: {}, currentView: 'menu' }))
          }}
        >
          ← Back
        </Text>
      </Box>
    </Box>
  )

  const renderReport = () => (
    <Box flexDirection="column" gap={1} marginBottom={2}>
      <Text bold>📈 Audit Report</Text>
      {state.report && (
        <Box flexDirection="column" gap={1}>
          <Text>
            Period: {state.report.period.startDate} to {state.report.period.endDate}
          </Text>
          <Text>
            Total entries: {state.report.summary.totalEntries} | Allowed:{' '}
            <Text color="green">{state.report.summary.allowedCount}</Text> | Denied:{' '}
            <Text color="red">{state.report.summary.deniedCount}</Text> | Skipped:{' '}
            <Text color="yellow">{state.report.summary.skippedCount}</Text>
          </Text>

          {Object.keys(state.report.byTool).length > 0 && (
            <Box flexDirection="column" gap={1} marginTop={1}>
              <Text bold>By Tool:</Text>
              {Object.entries(state.report.byTool)
                .slice(0, 5)
                .map(([tool, stats]) => (
                  <Text key={tool}>
                    {tool}: {stats.total} total ({stats.denied} denied, {stats.percentDenied.toFixed(1)}% denial rate)
                  </Text>
                ))}
            </Box>
          )}

          {state.report.topDeniedTools && state.report.topDeniedTools.length > 0 && (
            <Box flexDirection="column" gap={1} marginTop={1}>
              <Text bold>Top Denied Tools:</Text>
              {state.report.topDeniedTools.map(item => (
                <Text key={item.tool} color="red">
                  {item.tool}: {item.count} denials
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      <Box gap={2} marginTop={1}>
        <Text
          onPress={() => {
            setState(prev => ({ ...prev, report: undefined, currentView: 'menu' }))
          }}
        >
          ← Back
        </Text>
      </Box>
    </Box>
  )

  const renderPolicies = () => (
    <Box flexDirection="column" gap={1} marginBottom={2}>
      <Text bold>📋 Permission Policies</Text>
      {state.policies.length === 0 ? (
        <Text color="yellow">No policies configured.</Text>
      ) : (
        <Box flexDirection="column" gap={1}>
          {state.policies.slice(0, 10).map(policy => (
            <Box key={policy.id} flexDirection="column" gap={0.5}>
              <Text>
                <Text bold>{policy.name}</Text> ({policy.enabled ? '✓ enabled' : '✗ disabled'})
              </Text>
              <Text color="gray">
                Pattern: {policy.toolPattern} → {policy.actionPattern}
              </Text>
              <Text color="gray">Action: {policy.policyAction}</Text>
            </Box>
          ))}
          {state.policies.length > 10 && <Text color="gray">... and {state.policies.length - 10} more</Text>}
        </Box>
      )}
      <Box gap={2} marginTop={1}>
        <Text
          onPress={() => {
            setState(prev => ({ ...prev, currentView: 'menu' }))
          }}
        >
          ← Back
        </Text>
      </Box>
    </Box>
  )

  const renderExport = () => (
    <Box flexDirection="column" gap={1} marginBottom={2}>
      <Text bold>💾 Export Audit Logs</Text>
      <Text>Enter export file path (leave blank to copy to clipboard):</Text>
      <TextInput
        value={state.exportPath || ''}
        onChange={value => setState(prev => ({ ...prev, exportPath: value }))}
        onSubmit={() => {
          handleExport()
        }}
        placeholder="./audit-logs.json"
      />
      <Box gap={2} marginTop={1}>
        <Text
          onPress={() => {
            setState(prev => ({ ...prev, exportPath: undefined, currentView: 'menu' }))
          }}
        >
          ← Cancel
        </Text>
      </Box>
    </Box>
  )

  if (state.loading) {
    return <Text>Loading...</Text>
  }

  return (
    <Box flexDirection="column" gap={1}>
      {state.message && <Text color="yellow">{state.message}</Text>}
      {state.currentView === 'menu' && renderMenu()}
      {state.currentView === 'logs' && renderLogs()}
      {state.currentView === 'report' && renderReport()}
      {state.currentView === 'policies' && renderPolicies()}
      {state.currentView === 'export' && renderExport()}
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, context) => {
  return <PermissionAuditComponent onDone={onDone} />
}
