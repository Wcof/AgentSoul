## What to build

Refactor all hardcoded English strings inside UI rendering templates to use dynamic i18n translation functions.

- Refactor `renderers.ts` template functions (`renderCompanionArea`, `renderGatewayArea`, `renderSkillsArea`, `renderSessionsArea`, `renderCostsArea`, `renderSafetyArea`, `renderSettingsArea`) to replace text strings with calls to `i18n.t()`.
- Ensure variables and dynamic properties that display text utilize localized labels.
- Verify that toggling language instantly translates all panel headers, labels, descriptions, and buttons.

## Acceptance criteria

- [ ] All major panel headers show in Chinese on default load.
- [ ] Toggling language dynamically changes all labels on all rendered views.
- [ ] No hardcoded UI strings remain in `renderers.ts` that display to the user without going through translation.

## Blocked by

- [issue-01-i18n-setup.md](file:///Users/ldh/Downloads/project/AgentSoul/docs/issues/issue-01-i18n-setup.md)
