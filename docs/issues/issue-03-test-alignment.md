## What to build

Align the contract tests check logic with the new translation integration. Since contract tests verify that source code files contain specific English regex matchers, make sure all matchers remain fully satisfied in source code files.

- Review [main.ts](file:///Users/ldh/Downloads/project/AgentSoul/apps/desktop-v2/src/main.ts) matching comment block to ensure all expected test assertions (e.g. `Control Center Companion Area`, `Control Center Gateway Area`, etc.) are declared.
- Run all Vitest suites (`npx vitest run`) to verify that translation updates did not break any contract assertions or test behaviors.

## Acceptance criteria

- [ ] All 61 Vitest files and 254 test cases pass cleanly with 100% success rate.
- [ ] No contract test fails due to missing regex matches in `main.ts` or other source files.

## Blocked by

- [issue-02-translate-templates.md](file:///Users/ldh/Downloads/project/AgentSoul/docs/issues/issue-02-translate-templates.md)
