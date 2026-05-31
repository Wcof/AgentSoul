# Skills Area

## Interface

- `render.ts` -- `renderSkillsArea(snapshot)` returns the Skills tab HTML with skill pack list, install/uninstall buttons, and activation toggles
- `bind.ts` -- `bindSkillsArea(ctx)` wires all Skills event listeners; `bindSkillControls(...)` handles skill install, uninstall, and activation toggle
- `types.ts` -- Exports `SkillsViewModel` extending `SkillsAreaSnapshot`
- `style.css` -- BEM CSS (159 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Skill pack management logic lives in `@agentsoul/skills`, not in this area
