# Settings Area

## Interface

- `render.ts` -- `renderSettingsArea(snapshot)` returns the Settings tab HTML with General/Appearance/Proxy sub-tabs; `renderDeepLinkImportDialog(importState)` renders the deep link import dialog
- `bind.ts` -- `bindSettingsArea(ctx)` wires all Settings event listeners; `bindLocaleToggle(target, controller)` handles locale switching; `bindPersonaSelection(target, snapshot)` handles persona selection; `bindDeepLinkImportControls(...)` handles deep link import flow
- `types.ts` -- Exports `SettingsViewModel` extending `SettingsAreaSnapshot`; re-exports `DeepLinkImportSnapshot` type
- `style.css` -- BEM CSS (194 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Sub-tab routing uses `data-active-settings-subtab` attribute
- Deep link types (`DeepLinkType`) imported from `../../types`
