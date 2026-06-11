# UI Visual Refresh Plan

## Objective
Refresh the visual design of the APEX CLI interface, moving from heavy bounding boxes to a clean, minimalist layout with accent lines and improved typography.

## Scope
1.  **Welcome Banner (`src/components/LogoV2/LogoV2.tsx`)**
2.  **AI Message Container (`src/components/messages/AssistantTextMessage.tsx`)**

## Implementation Steps

### 1. Update Welcome Banner (`LogoV2.tsx`)
-   **Remove the full border:** Replace the `borderStyle="round"` bounding box with a more open layout, possibly utilizing a left accent border (`borderLeft`, `borderStyle="single"`) or a subtle top/bottom divider to frame the welcome area.
-   **Refine Status Bar:** Reformat the status indicators (Connected, Online, Model, Billing) into a clean, horizontal list with bullet points (`·`) rather than heavy circle icons, using subtle pastel colors.
-   **Typography:** Enhance the gradient colors of the APEX logo and the welcome text to feel more vibrant but professional.
-   **Notices & Activity:** Clean up the alignment of notices and the current directory path, ensuring they feel integrated rather than tacked on.

### 2. Update AI Message Container (`AssistantTextMessage.tsx`)
-   **Minimalist Border:** Remove the full `round` green bounding box around AI responses.
-   **Left Accent Line:** Implement a left accent line (e.g., `borderLeft={true}`, `borderStyle="single"`, `borderColor="suggestion"`) to visually group the AI's response text.
-   **Compact Metadata:** Restyle the metadata row (model, time, tokens) at the bottom.
    -   Remove the top border of the metadata section.
    -   Use a smaller, dimmer font (`dimColor={true}`) to make it less distracting while remaining accessible.
    -   Format the separators cleanly (e.g., `·` instead of `|`).

## Verification
-   Run `bun run ./scripts/build.ts` to verify the React code compiles.
-   Launch the CLI (`bun run dev`) and observe the welcome screen.
-   Send a message (e.g., "hi") to confirm the AI response renders cleanly with the new left accent line and compact metadata.