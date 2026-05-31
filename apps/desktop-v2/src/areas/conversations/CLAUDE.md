# Conversations Area

## Interface

- `render.ts` -- `renderConversationsArea(snapshot)` returns the main Conversations tab HTML; `renderConversationDashboard(dashboard)` renders the conversation dashboard with kind filter and search
- `bind.ts` -- `bindConversationsArea(ctx)` wires all Conversations event listeners; `bindConversationDashboardControls(...)` handles kind filter, search, and conversation actions
- `types.ts` -- Re-exports `ConversationInfo`, `ConversationKind`, `ConversationStatus`, `ConversationDashboardSnapshot` types from `../../types`
- `style.css` -- BEM CSS (238 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Conversation kinds include: `direct`, `gateway`, `mcp`, `session`
