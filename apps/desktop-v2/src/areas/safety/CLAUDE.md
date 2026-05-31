# Safety Area

## Interface

- `render.ts` -- `renderSafetyArea(snapshot)` returns the main Safety tab HTML; `renderApprovalRequired(pendingApproval)` renders the approval request card; `renderRiskNotices(riskNotices)` renders the risk notice list
- `bind.ts` -- `bindSafetyArea(ctx)` wires all Safety event listeners; `bindApprovalControls(...)` handles approve/reject actions; `bindSafetyControls(...)` handles trust authorization and policy toggles
- `types.ts` -- Re-exports `DesktopApprovalRequest`, `DesktopRiskNotice` types; exports `SafetyViewModel` extending `SafetyAreaSnapshot`
- `style.css` -- BEM CSS (247 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Approval decisions use `DesktopApprovalDecisionKind` from `../../types`
- Safety policy engine logic lives in `@agentsoul/safety`, not in this area
