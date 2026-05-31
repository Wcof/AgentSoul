# Sessions Area

## Interface

- `render.ts` -- `renderSessionsArea(snapshot)` returns the Sessions tab HTML with session list, search, and resume controls
- `bind.ts` -- `bindSessionsArea(ctx)` wires all Sessions event listeners; `bindSessionControls(...)` handles session search, resume, and delete actions
- `types.ts` -- Exports `SessionsViewModel` extending `SessionsAreaSnapshot`
- `style.css` -- BEM CSS (160 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Session resume feedback resolved via `resolveSessionResumeFeedback()` from `../../shared/utils`
