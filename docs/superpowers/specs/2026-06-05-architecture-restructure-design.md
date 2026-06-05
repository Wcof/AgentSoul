# Architecture Restructure Design: AgentSoul Desktop Alignment

This design document specifies the restructure of the AgentSoul Desktop application into the 4 logical modules and their respective 18 sub-items.

## Logical Architecture Target

```text
AgentSoul Desktop
│
├─ Desktop Body
│  ├─ Embodied Window
│  ├─ Appearance Pack
│  ├─ Animation State
│  ├─ Bubble Surface
│  ├─ Context Menu
│  └─ Embedded Panels
│
├─ Agent Mind
│  ├─ Interaction Turn
│  ├─ Hermes Prompt Layers
│  ├─ Autonomy Loop
│  └─ Output Strategy
│
├─ Memory
│  ├─ Soul Document
│  ├─ Master Model
│  ├─ Long-term Memory
│  └─ Correction / Forget / Confirm
│
└─ Extension Runtime
   ├─ Extension Manifest
   ├─ Capability Registry
   ├─ Tool Adapter
   └─ Runtime Events
```

## Physical Mapping Design

To match this target, we will reorganize `apps/desktop-v2/src/` to map exactly to the file structure below.

### 1. Desktop Body (`src/desktop-body/`)

*   **Embodied Window** -> `desktop-body/window.ts`
    *   Functions: `startDesktopBodyWindowDrag`, `refreshDesktopBodyRuntime`, `hideDesktopBodyWindow`.
*   **Appearance Pack** -> `desktop-body/appearance-pack.ts`
    *   Functions: `switchPetAssetPackInteractively`, `importAndApplyPetAssetPack`, `pickPetAssetPackFolderPath`, `loadPetAssetPackToSnapshot`.
*   **Animation State** -> `desktop-body/animation.ts`
    *   Functions/Classes: Canvas renderer logic and `startAnimationLoop`.
*   **Bubble Surface** -> `desktop-body/surface.ts`
    *   Functions: `renderDesktopCompanionSurface`, `bindDesktopCompanionSurface`, `showDesktopBodyStatus`.
*   **Context Menu** -> `desktop-body/menu.ts`
    *   Functions: `renderDesktopPetMenu`, `bindDesktopToolActions`.
*   **Embedded Panels** -> `desktop-body/embedded-panels.ts`
    *   Stubs/Functions: Placeholders for future panels/drawers.
*   **Other files in `desktop-body/`**:
    *   `bootstrap.ts`: Bootstraps the desktop companion body.
    *   `index.ts`: Standard barrel file exporting all public members.

### 2. Agent Mind (`src/agent-mind/`)

*   **Interaction Turn** -> `agent-mind/interaction-turn.ts`
    *   Functions: `runCompanionInteractionTurn`, `buildCompanionChatPayload`, `submitDesktopBodyInlineChat`, `applyDesktopBodyInteraction`.
*   **Hermes Prompt Layers** -> `agent-mind/prompt-layers.ts`
    *   Functions: `buildAgentMindPromptLayers`, `buildPromptLayers`.
*   **Autonomy Loop** -> `agent-mind/autonomy-loop.ts`
    *   Functions: `projectAutonomyRuntime`, `normalizeAutonomySnapshot`.
*   **Output Strategy** -> `agent-mind/output-strategy.ts`
    *   Functions: Output behavior strategy resolution based on presence and mode.

### 3. Memory (`src/memory/`)

*   **Soul Document** -> `memory/soul-document.ts`
    *   Functions: Core soul metadata/document definitions.
*   **Master Model** -> `memory/master-model.ts`
    *   Functions/Classes: `createDefaultMasterModelForSnapshot`.
*   **Long-term Memory** -> `memory/memory-store.ts`
    *   Functions: Memory querying, storage, and persistence mapping for the app.
*   **Correction / Forget / Confirm** -> `memory/correction.ts`
    *   Functions: `applyMasterModelCommand`, `applyMasterModelEdit`.

### 4. Extension Runtime (`src/extension-runtime/`)

*   **Extension Manifest** -> `extension-runtime/manifest.ts`
    *   Types/Functions: `ExtensionManifest`, `normalizeRegistration`.
*   **Capability Registry** -> `extension-runtime/registry.ts`
    *   Types/Functions: `ExtensionCapability`, `createExtensionRuntime` registry routines.
*   **Tool Adapter** -> `extension-runtime/adapter.ts`
    *   Types: `ExtensionCapabilityAdapter`, `ExtensionCapabilityHandler`.
*   **Runtime Events** -> `extension-runtime/events.ts`
    *   Types/Functions: `ExtensionRuntimeEvent`, event emission helper methods.

---

## Verification Plan

### Automated Verification
*   Run the full test suite with `npx vitest run` and verify all 209 tests pass.
*   Run typescript typechecks with `npm run v2:typecheck`.

### Manual Verification
*   Run `npm run dev` to verify the Tauri desktop app boots and functions correctly without runtime errors.
