import capitalize from 'lodash-es/capitalize.js';
import * as React from 'react';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from 'src/utils/fastMode.js';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { convertEffortValueToLevel, type EffortLevel, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort.js';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model.js';
import { getModelOptions, type ModelOption } from '../utils/model/modelOptions.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Pane } from './design-system/Pane.js';
import { effortLevelToSymbol } from './EffortIndicator.js';
import { probeApexInfrastructure, persistApexInfrastructureModels } from '../services/apexInfrastructure/9router.js';
import { Spinner } from './Spinner.js';

export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped (written to the assistant's .APEX/settings.json via
   * install.ts) and should not leak to the user's global ~/.APEX/settings.
   */
  skipSettingsWrite?: boolean;
};

const NO_PREFERENCE = '__NO_PREFERENCE__';

export function ModelPicker({
  initial,
  sessionModel,
  onSelect,
  onCancel,
  isStandaloneCommand,
  showFastModeNotice,
  headerText,
  skipSettingsWrite
}: Props) {
  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const initialValue = initial === null ? NO_PREFERENCE : initial;

  const isFastMode = useAppState(s => isFastModeEnabled() ? s.fastMode : false);
  const effortValue = useAppState(s => s.effortValue);
  
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined
  );
  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicOptions, setDynamicOptions] = useState<ModelOption[]>([]);

  // Fetch dynamic models on mount
  useEffect(() => {
    let mounted = true;
    async function fetchModels() {
      try {
        const result = await probeApexInfrastructure();
        if (mounted && result.status === 'ready') {
          setDynamicOptions(result.models);
          persistApexInfrastructureModels(result.models);
        }
      } catch (e) {
        // Fallback to cache if probe fails
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void fetchModels();
    return () => { mounted = false; };
  }, []);

  const modelOptions = useMemo(() => {
    // Start with the base options (Default, etc.)
    const options = getModelOptions(isFastMode ?? false);
    
    // Merge with dynamic options if they are fresher/different
    if (dynamicOptions.length > 0) {
      for (const opt of dynamicOptions) {
        if (!options.some(existing => existing.value === opt.value)) {
          options.push(opt);
        }
      }
    }
    return options;
  }, [isFastMode, dynamicOptions]);

  const optionsWithInitial = useMemo(() => {
    if (initial !== null && !modelOptions.some(opt => opt.value === initial)) {
      return [...modelOptions, {
        value: initial,
        label: modelDisplayString(initial),
        description: "Current model",
        provider: 'Other'
      }];
    }
    return modelOptions;
  }, [initial, modelOptions]);

  // Extract unique providers
  const providers = useMemo(() => {
    const p = new Set<string>();
    for (const opt of optionsWithInitial) {
      if (opt.provider) p.add(opt.provider);
    }
    const list = Array.from(p).sort();
    // Ensure 'Recommended' is first if it exists
    if (list.includes('Recommended')) {
      return ['Recommended', ...list.filter(item => item !== 'Recommended')];
    }
    return list;
  }, [optionsWithInitial]);

  // Find initial provider based on initialValue
  const initialProvider = useMemo(() => {
    const initialOpt = optionsWithInitial.find(opt => (opt.value === null ? NO_PREFERENCE : opt.value) === initialValue);
    return initialOpt?.provider ?? providers[0] ?? 'Other';
  }, [optionsWithInitial, initialValue, providers]);

  const [selectedProvider, setSelectedProvider] = useState<string>(initialProvider);

  // Sync selected provider if it's no longer in the list or if we just loaded
  useEffect(() => {
    if (providers.length > 0 && !providers.includes(selectedProvider)) {
      setSelectedProvider(initialProvider);
    }
  }, [providers, selectedProvider, initialProvider]);

  // Filter options by selected provider
  const filteredOptions = useMemo(() => {
    return optionsWithInitial.filter(opt => opt.provider === selectedProvider);
  }, [optionsWithInitial, selectedProvider]);

  const selectOptions = useMemo(() => {
    return filteredOptions.map(opt => ({
      ...opt,
      value: opt.value === null ? NO_PREFERENCE : opt.value
    }));
  }, [filteredOptions]);

  const [focusedValue, setFocusedValue] = useState<string | undefined>(undefined);

  // When provider changes or options load, focus the first model if current focused value is not in the list
  useEffect(() => {
    if (selectOptions.length > 0 && (!focusedValue || !selectOptions.some(opt => opt.value === focusedValue))) {
      // Prefer initialValue if it's in the list
      if (selectOptions.some(opt => opt.value === initialValue)) {
        setFocusedValue(initialValue);
      } else {
        setFocusedValue(selectOptions[0]?.value);
      }
    }
  }, [selectedProvider, selectOptions, focusedValue, initialValue]);

  const initialFocusValue = useMemo(() => {
    return selectOptions.some(opt => opt.value === initialValue) ? initialValue : selectOptions[0]?.value;
  }, [selectOptions, initialValue]);

  const visibleCount = Math.min(10, selectOptions.length);
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount);

  const focusedModelName = useMemo(() => 
    selectOptions.find(opt => opt.value === focusedValue)?.label
  , [focusedValue, selectOptions]);

  const { focusedSupportsEffort, focusedSupportsMax } = useMemo(() => {
    const focusedModel = resolveOptionModel(focusedValue);
    return {
      focusedSupportsEffort: focusedModel ? modelSupportsEffort(focusedModel) : false,
      focusedSupportsMax: focusedModel ? modelSupportsMaxEffort(focusedModel) : false,
    };
  }, [focusedValue]);

  const focusedDefaultEffort = useMemo(() => 
    getDefaultEffortLevelForOption(focusedValue)
  , [focusedValue]);

  const displayEffort = effort === "max" && !focusedSupportsMax ? "high" : effort;

  const handleFocus = useCallback((value: string) => {
    setFocusedValue(value);
    if (!hasToggledEffort && effortValue === undefined) {
      setEffort(getDefaultEffortLevelForOption(value));
    }
  }, [hasToggledEffort, effortValue]);

  const handleCycleEffort = useCallback((direction: 'left' | 'right') => {
    if (!focusedSupportsEffort) return;
    setEffort(prev => cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsMax));
    setHasToggledEffort(true);
  }, [focusedDefaultEffort, focusedSupportsEffort, focusedSupportsMax]);

  const handleCycleProvider = useCallback((direction: 'next' | 'previous') => {
    const currentIndex = providers.indexOf(selectedProvider);
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % providers.length;
    } else {
      nextIndex = (currentIndex - 1 + providers.length) % providers.length;
    }
    setSelectedProvider(providers[nextIndex]!);
  }, [providers, selectedProvider]);

  useKeybindings({
    "modelPicker:decreaseEffort": () => handleCycleEffort("left"),
    "modelPicker:increaseEffort": () => handleCycleEffort("right"),
    "modelPicker:nextProvider": () => handleCycleProvider("next"),
    "modelPicker:previousProvider": () => handleCycleProvider("previous"),
  }, { context: "ModelPicker" });

  const handleSelect = useCallback((value: string) => {
    logEvent("tengu_model_command_menu_effort", {
      effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    
    if (!skipSettingsWrite) {
      const effortLevel = resolvePickerEffortPersistence(
        effort,
        getDefaultEffortLevelForOption(value),
        getSettingsForSource("userSettings")?.effortLevel,
        hasToggledEffort
      );
      const persistable = toPersistableEffort(effortLevel);
      if (persistable !== undefined) {
        updateSettingsForSource("userSettings", { effortLevel: persistable });
      }
      setAppState(prev => ({ ...prev, effortValue: effortLevel }));
    }

    const selectedModel = resolveOptionModel(value);
    const selectedEffort = hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel) ? effort : undefined;
    
    onSelect(value === NO_PREFERENCE ? null : value, selectedEffort);
  }, [effort, hasToggledEffort, onSelect, setAppState, skipSettingsWrite]);

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold={true}>Select model</Text>
        <Text dimColor={true}>
          {headerText ?? "Switch between APEX models. Applies to this session and future APEX Code sessions. For other/previous model names, specify with --model."}
        </Text>
        {sessionModel && (
          <Text dimColor={true}>
            Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.
          </Text>
        )}
      </Box>

      {/* Provider Tabs */}
      {providers.length > 1 && (
        <Box marginBottom={1}>
          {providers.map((p, i) => (
            <Box key={p} marginRight={2}>
              <Text 
                color={p === selectedProvider ? "APEX" : undefined}
                bold={p === selectedProvider}
                underline={p === selectedProvider}
              >
                {p}
              </Text>
              {i < providers.length - 1 && <Text dimColor>  </Text>}
            </Box>
          ))}
          <Text dimColor> (Tab to switch)</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {isLoading && selectOptions.length === 0 ? (
          <Box paddingLeft={3}>
            <Spinner label="Loading dynamic models..." />
          </Box>
        ) : (
          <Box flexDirection="column">
            <Select 
              defaultValue={initialValue} 
              defaultFocusValue={initialFocusValue} 
              options={selectOptions} 
              onChange={handleSelect} 
              onFocus={handleFocus} 
              onCancel={onCancel ?? (() => {})} 
              visibleOptionCount={visibleCount} 
            />
          </Box>
        )}
        {hiddenCount > 0 && (
          <Box paddingLeft={3}>
            <Text dimColor={true}>and {hiddenCount} more…</Text>
          </Box>
        )}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        {focusedSupportsEffort ? (
          <Text dimColor={true}>
            <EffortLevelIndicator effort={displayEffort} />
            {" "}{capitalize(displayEffort)} effort
            {displayEffort === focusedDefaultEffort ? " (default)" : ""}
            {" "}<Text color="subtle">← → to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ""}
          </Text>
        )}
      </Box>

      {isFastModeEnabled() && (
        showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Fast mode is <Text bold={true}>ON</Text> and available with{" "}{FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turn off fast mode.
            </Text>
          </Box>
        ) : (isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null)
      )}

      {isStandaloneCommand && (
        <Text dimColor={true} italic={true}>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
            </Byline>
          )}
        </Text>
      )}
    </Box>
  );

  if (!isStandaloneCommand) {
    return content;
  }

  return <Pane color="permission">{content}</Pane>;
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  return value === NO_PREFERENCE ? getDefaultMainLoopModel() : parseUserSpecifiedModel(value);
}

function EffortLevelIndicator({ effort }: { effort: EffortLevel | undefined }) {
  const color = effort ? "APEX" : "subtle";
  const symbol = effortLevelToSymbol(effort ?? "low");
  return <Text color={color}>{symbol}</Text>;
}

function cycleEffortLevel(current: EffortLevel, direction: 'left' | 'right', includeMax: boolean): EffortLevel {
  const levels: EffortLevel[] = includeMax ? ['low', 'medium', 'high', 'max'] : ['low', 'medium', 'high'];
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}
