# Companion Area

## Interface

- `render.ts` -- `renderCompanionViewModel(snapshot)` builds the full Companion ViewModel from a runtime snapshot; `renderCompanionArea(snapshot)` returns the HTML string for the Companion tab
- `bind.ts` -- `bindCompanionArea(ctx)` wires all Companion event listeners; `bindInteractionControls(...)` handles interaction buttons; `bindCompanionCustomization(...)` handles skin/persona/vitals customization; `bindDesktopPetWidgetControls(...)` handles desktop pet toggle
- `types.ts` -- Exports `VitalDisplay`, `KindOption`, `SkinOption`, `CustomizationViewModel`, `GrowthEventViewModel`, `CompanionViewModel` interfaces
- `style.css` -- BEM CSS (218 lines)

## Constraints

- Only import from `../../shared/utils`, `../../shared/components`, `../../utils/modal`, `../../utils/contextMenu`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Canvas sprite animation lives in `../../canvas-renderer.ts`, not in this area
- PAD emotion model logic lives in `@agentsoul/companion`, not in this area
