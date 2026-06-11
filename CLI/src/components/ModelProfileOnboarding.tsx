import React, { useMemo, useState } from 'react'
import { Box, Text } from '../ink.js'
import {
  getGlobalConfig,
  saveGlobalConfig,
  type GlobalConfig,
} from '../utils/config.js'
import {
  type ModelSetting,
  modelDisplayString,
} from '../utils/model/model.js'
import { getModelOptions } from '../utils/model/modelOptions.js'
import { updateSettingsForSource } from '../utils/settings/settings.js'
import { Select } from './CustomSelect/index.js'

type ModelProfiles = NonNullable<GlobalConfig['apexModelProfiles']>
type ModelProfileKey = keyof ModelProfiles

type ProfileStep = {
  key: ModelProfileKey
  title: string
  description: string
}

type SelectValue = string

const DEFAULT_VALUE = '__apex_profile_default__'
const NO_BACKUP_VALUE = '__apex_profile_no_backup__'

const PROFILE_STEPS: ProfileStep[] = [
  {
    key: 'generalPlan',
    title: 'General / plan model',
    description: 'Used for planning, broad reasoning, and non-coding work.',
  },
  {
    key: 'coding',
    title: 'Coding model',
    description: 'Used as your normal APEX coding model.',
  },
  {
    key: 'backup',
    title: 'Backup model',
    description: 'Used as a fallback when the primary model is unavailable.',
  },
]

type Props = {
  onDone(): void
}

export function ModelProfileOnboarding({
  onDone,
}: Props): React.ReactNode {
  const [stepIndex, setStepIndex] = useState(0)
  const [profiles, setProfiles] = useState<ModelProfiles>(
    () => getGlobalConfig().apexModelProfiles ?? {},
  )
  const currentStep = PROFILE_STEPS[stepIndex]!

  const modelOptions = useMemo(() => getModelOptions(false), [])
  const profileOptions = useMemo(
    () =>
      modelOptions.map(option => ({
        value: modelSettingToSelectValue(option.value),
        label: option.label,
        description: option.description,
      })),
    [modelOptions],
  )
  const concreteProfileOptions = useMemo(
    () => profileOptions.filter(option => option.value !== DEFAULT_VALUE),
    [profileOptions],
  )
  const backupOptions = useMemo(
    () => [
      ...concreteProfileOptions,
      {
        value: NO_BACKUP_VALUE,
        label: 'No backup',
        description: 'Do not configure a fallback model for headless runs',
      },
    ],
    [concreteProfileOptions],
  )

  const options =
    currentStep.key === 'backup' ? backupOptions : profileOptions
  const defaultFocusValue =
    currentStep.key === 'backup'
      ? profiles.backup
        ? modelSettingToSelectValue(profiles.backup)
        : concreteProfileOptions[0]?.value ?? NO_BACKUP_VALUE
      : modelSettingToSelectValue(profiles[currentStep.key] ?? null)

  function saveProfiles(nextProfiles: ModelProfiles) {
    saveGlobalConfig(current => ({
      ...current,
      apexModelProfiles: {
        ...current.apexModelProfiles,
        ...nextProfiles,
      },
    }))

    if (Object.prototype.hasOwnProperty.call(nextProfiles, 'coding')) {
      updateSettingsForSource('userSettings', {
        model: nextProfiles.coding ?? undefined,
      })
    }
  }

  function finish(nextProfiles: ModelProfiles) {
    saveProfiles(nextProfiles)
    onDone()
  }

  function handleSelect(value: SelectValue) {
    const selectedModel = selectValueToModelSetting(value, currentStep.key)
    const nextProfiles = {
      ...profiles,
      [currentStep.key]: selectedModel,
    }

    if (stepIndex === PROFILE_STEPS.length - 1) {
      finish(nextProfiles)
      return
    }

    setProfiles(nextProfiles)
    setStepIndex(stepIndex + 1)
  }

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Box flexDirection="column">
        <Text bold>{currentStep.title}</Text>
        <Text dimColor>{currentStep.description}</Text>
        <Text dimColor>
          Step {stepIndex + 1} of {PROFILE_STEPS.length}
        </Text>
      </Box>
      <Select
        options={options}
        defaultFocusValue={defaultFocusValue}
        visibleOptionCount={Math.min(10, options.length)}
        onChange={handleSelect}
        onCancel={() => finish(profiles)}
      />
      <Text dimColor>Enter to confirm · Esc to skip model setup</Text>
      {profiles.generalPlan || profiles.coding || profiles.backup ? (
        <Box flexDirection="column">
          {profiles.generalPlan ? (
            <Text dimColor>
              General / plan: {modelDisplayString(profiles.generalPlan)}
            </Text>
          ) : null}
          {profiles.coding ? (
            <Text dimColor>Coding: {modelDisplayString(profiles.coding)}</Text>
          ) : null}
          {profiles.backup ? (
            <Text dimColor>Backup: {modelDisplayString(profiles.backup)}</Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}

function modelSettingToSelectValue(model: ModelSetting | undefined): SelectValue {
  return model ?? DEFAULT_VALUE
}

function selectValueToModelSetting(
  value: SelectValue,
  profileKey: ModelProfileKey,
): string | null {
  if (profileKey === 'backup' && value === NO_BACKUP_VALUE) {
    return null
  }
  if (value === DEFAULT_VALUE) {
    return null
  }
  return value
}
