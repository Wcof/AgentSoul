# Settings-Full Area

## Interface

- `render.ts` -- `renderSettingsFullArea(snapshot)` returns the full settings HTML from a runtime snapshot; `renderFullSettingsArea(settings)` renders from an `AppSettingsSnapshot` with backup/WebDAV sections
- `bind.ts` -- `bindSettingsFullArea(ctx)` wires all full settings event listeners; `bindSettingsTabs(target, snapshot, controlClient)` handles sub-tab switching; `sanitizeImportedAppSettings(imported, current)` sanitizes and merges imported settings
- `types.ts` -- Re-exports `AppSettingsSnapshot` type
- `style.css` -- BEM CSS (222 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- `sanitizeImportedAppSettings()` is a pure function, safe to call without DOM
- WebDAV backup/restore logic is orchestrated here but storage lives in `@agentsoul/persistence`
