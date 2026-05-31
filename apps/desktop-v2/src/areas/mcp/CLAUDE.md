# MCP Area

## Interface

- `render.ts` -- `renderMcpArea(snapshot)` returns the MCP tab HTML with server list, connection status indicators, and tool index
- `bind.ts` -- `bindMcpArea(ctx)` wires all MCP event listeners; `bindMcpControls(target, snapshot, controller, controlClient)` handles server connect/disconnect, tool invocation, and server management
- `types.ts` -- Exports `McpAreaViewModel` interface
- `style.css` -- BEM CSS (227 lines)

## Constraints

- Only import from `../../shared/utils`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- MCP protocol conversion logic lives in `@agentsoul/mcp-adapter`, not in this area
- Server view models (`McpServerViewModel`) imported from `../../types`
