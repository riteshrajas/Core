# Provider-First Model Picker Flow Implementation Plan

## Objective
Refactor the model picker flow (`/model`) to a two-step process:
1.  **Provider Selection:** The user selects a provider (e.g., Anthropic, Google, OpenAI, APEX Infrastructure) via tabs at the top of the picker.
2.  **Model Selection:** The model list below the tabs is filtered to only show models belonging to the selected provider.

## Key Files & Context
-   `src/utils/model/modelOptions.ts`: Defines `ModelOption` type and functions that construct available models.
-   `src/services/apexInfrastructure/9router.ts`: Fetches dynamic models from the 9Router API.
-   `src/components/ModelPicker.tsx`: The UI component currently rendering the model list. It contains React Compiler output which will be rewritten into clean, uncompiled React code to make these UI changes maintainable.
-   `src/keybindings/schema.ts` & `src/keybindings/defaultBindings.ts`: Where keyboard shortcuts are registered. We will add `modelPicker:nextProvider` and `modelPicker:previousProvider` bound to `tab` and `shift+tab`.

## Implementation Steps

### 1. Update Data Structures
-   Modify `ModelOption` in `src/utils/model/modelOptions.ts` to include a `provider?: string` property.
-   Update all static model definitions in `modelOptions.ts` to include their respective provider (e.g., Anthropic, OpenAI, Local Ollama).
-   Update `modelToOption` in `src/services/apexInfrastructure/9router.ts` to map the `owned_by` field from the API to the `provider` property.

### 2. Add Keybindings for Tabs
-   Add `modelPicker:nextProvider` and `modelPicker:previousProvider` to `src/keybindings/schema.ts`.
-   Bind them to `tab` and `shift+tab` in `src/keybindings/defaultBindings.ts` under the `ModelPicker` context.

### 3. Rewrite and Enhance `ModelPicker.tsx`
-   Rewrite the compiled React code in `src/components/ModelPicker.tsx` into standard React to safely apply UI changes.
-   Add logic to extract a unique list of available providers from the `modelOptions` list.
-   Add a new state variable `selectedProvider` to track the currently active tab.
-   Render a tab bar above the `Select` component displaying the providers. The active provider will be highlighted.
-   Filter the `optionsWithInitial` list passed to the `Select` component so it only contains models matching `selectedProvider`.
-   Handle the `modelPicker:nextProvider` and `modelPicker:previousProvider` keybindings to cycle through the `selectedProvider` state.

## Verification & Testing
-   Run a build (`bun run ./scripts/build.ts`) to ensure the uncompiled `ModelPicker.tsx` compiles and integrates seamlessly.
-   Run the CLI (`bun run dev`) and test the `/model` command.
-   Verify that pressing `Tab` and `Shift+Tab` cycles between provider tabs.
-   Verify that the model list correctly updates to show only models for the selected provider.
-   Ensure that existing features (effort selection using Left/Right arrows, Fast mode notice) continue to work properly.