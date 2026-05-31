# Costs Area

## Interface

- `render.ts` -- `renderCostsArea(snapshot)` returns the main Costs tab HTML; `renderKeyTrendChart(trend)` renders the key trend line chart; `renderModelStatsChart(stats)` renders the model stats bar chart
- `bind.ts` -- `bindCostsArea(ctx)` wires all Costs event listeners; `bindChartControls(...)` handles chart duration toggle and view switching
- `types.ts` -- Exports `ChannelCostRowViewModel` interface; `CostsViewModel` extends `CostsAreaSnapshot`; re-exports `KeyTrendSnapshot`, `ModelStatsSnapshot` types
- `style.css` -- BEM CSS (340 lines)

## Constraints

- Only import from `../../shared/utils`, `../../shared/components`, `../../utils/modal`, `../../types`
- No cross-area imports (US-101)
- All ViewModel types derived from `@agentsoul/domain`
- CSS uses BEM naming convention
- Charts are rendered as inline SVG, not via a charting library
- `formatMix()` and `formatNumber()` from `../../shared/utils` handle cost display formatting
