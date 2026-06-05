# Legacy Module Deletion Backlog

This backlog tracks modules that are no longer part of the Desktop Body-first product path. They may still exist in the worktree while tests and replacement paths are migrated.

## Default Path Status

The default startup path is:

```text
src/main.ts
  -> src/desktop-body/index.ts
  -> src/desktop-body/bootstrap.ts
```

The default path must not import:

```text
src/shared/shell.ts
src/shared/app-controller.ts
src/utils/localControlClient.ts
src/areas/gateway
src/areas/costs
src/areas/sessions
src/areas/sessions-mgr
src/areas/skills
src/areas/mcp
src/areas/prompts
src/areas/safety
src/areas/conversations
src/areas/settings-full
```

## Deletion Candidates

| Module | Current status | Replacement direction |
| --- | --- | --- |
| `areas/gateway` | Legacy Control Center area | Agent Mind `model-transport` or Extension Runtime capability |
| `areas/costs` | Legacy Control Center area | Optional extension/developer inspector |
| `areas/sessions` | Legacy Control Center area | Optional external tool session extension |
| `areas/sessions-mgr` | Legacy Control Center area | Optional external tool session extension |
| `areas/skills` | Legacy Control Center area | Extension Runtime manifest/capability registry |
| `areas/mcp` | Legacy Control Center area | Extension Runtime tool adapter |
| `areas/prompts` | Legacy Control Center area | Agent Mind prompt layers or extension-provided prompt packs |
| `areas/safety` | Legacy Control Center area | Desktop Body inline approval panels plus Extension Runtime risk events |
| `areas/conversations` | Legacy Control Center area | Memory-backed embedded panel |
| `areas/settings-full` | Legacy Control Center area | Desktop Body preferences panel plus extension settings |
| `shared/nav.ts` | Legacy Control Center navigation | Delete after old shell tests are removed |
| `shared/shell.ts` | Legacy Control Center shell plus compatibility renderer | Split remaining Desktop Body helpers, then delete legacy shell renderer |
| `shared/app-controller.ts` | Legacy Control Center controller | Delete after remaining tests use Desktop Body bootstrap |
| `utils/localControlClient.ts` | Legacy local control client | Delete or move behind Extension Runtime after legacy area tests are retired |

## Next Deletion Gate

Before deleting a module, verify:

```bash
rtk rg -n "from \"\\.\\./areas|from \"\\.\\/areas|localControlClient|renderAgentSoulShell|createDesktopCompanionController" apps/desktop-v2/src/main.ts apps/desktop-v2/src/desktop-body apps/desktop-v2/src/agent-mind apps/desktop-v2/src/memory apps/desktop-v2/src/extension-runtime
```

Expected: no matches.

Then migrate or delete tests that assert old Control Center behavior. Historical ADRs may remain, but current product docs and Desktop Body tests must not require old modules.
