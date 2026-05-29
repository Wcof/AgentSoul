## What to build

Set up the i18n translation framework integration in the desktop-v2 app renderer. Ensure the default locale is locked to Chinese ("zh") on application bootstrap.

- Integrate the initialized `i18n` instance (from `src/i18n`) into `src/renderers.ts` and `src/controller.ts`.
- Ensure language changes in `App.tsx` via `i18n.changeLanguage()` correctly trigger a re-render of the `renderAgentSoulShell` inside `containerRef`.
- Complete/expand translation files (`src/i18n/zh.json` and `src/i18n/en.json`) to include all keys needed by the control center areas (Vitals, XP, Gateway, Safety, Settings).

## Acceptance criteria

- [ ] `i18n.language` defaults to `"zh"` on initial load.
- [ ] Translation resource files contain all keys for sub-components (companion, gateway, skills, sessions, costs, safety, settings).
- [ ] Clicking the toggle locale button successfully forces a UI re-render through the controller.

## Blocked by

None - can start immediately
