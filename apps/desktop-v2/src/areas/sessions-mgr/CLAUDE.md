# Sessions-Mgr Area

## Interface

- `render.ts` -- `renderSessionsMgrArea(snapshot)` returns the Session Manager dashboard HTML with session list and management controls
- `bind.ts` -- `bindSessionsMgrArea(ctx)` wires all Session Manager event listeners
- `types.ts` -- Exports `SessionsMgrViewModel` interface
- `style.css` -- BEM CSS (234 lines)

## Constraints

- Only import from `../../shared/utils`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- This is the administrative session manager (CRUD), distinct from the `sessions` area which is the user-facing session list
