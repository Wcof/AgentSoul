# Prompts Area

## Interface

- `render.ts` -- `renderPromptsArea(snapshot)` returns the Prompts tab HTML with template list and editing controls
- `bind.ts` -- `bindPromptsArea(ctx)` wires all Prompts event listeners; `bindPromptControls(target, snapshot, controller, controlClient)` handles template create, edit, delete, and activation
- `types.ts` -- Exports `PromptsAreaViewModel` interface
- `style.css` -- BEM CSS (213 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Template view models (`PromptTemplateViewModel`) imported from `../../types`
