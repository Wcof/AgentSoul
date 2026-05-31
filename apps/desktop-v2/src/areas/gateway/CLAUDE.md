# Gateway Area

## Interface

- `render.ts` -- `renderGatewayArea(snapshot)` returns the main Gateway tab HTML; `renderActivityWaveform(requestCount, successRate, barCount)` renders the activity waveform SVG; `renderChannelLogsDialog(channelName, logs)` renders channel log dialog; `renderCapabilityTestDialog(job)` renders capability test dialog; `renderGlobalStatsChart(stats)` renders global stats chart
- `bind.ts` -- `bindGatewayArea(ctx)` wires all Gateway event listeners; `bindChannelControls(...)` handles channel card interactions (add, edit, delete, reorder, test)
- `types.ts` -- Exports `ChannelListItemViewModel`, `DashboardStatsSnapshot`, `ChannelLogEntry`, `CapabilityTestJob`, `GlobalStatsSnapshot`, `GatewayViewModel` interfaces
- `style.css` -- BEM CSS (428 lines)

## Constraints

- Only import from `../../shared/utils`, `../../shared/components`, `../../utils/modal`, `../../utils/contextMenu`, `../../utils/dragReorder`, `../../utils/channelModal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Channel drag-reorder uses `enableChannelDragReorder()` from `../../utils/dragReorder`
- Add/edit channel modals use `openAddChannelModal()` / `openEditChannelModal()` from `../../utils/channelModal`
