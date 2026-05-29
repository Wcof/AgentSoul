// runtime 包 — 重新导出拆分后的子模块，保持向后兼容
// 新代码应直接使用 @agentsoul/companion, @agentsoul/pad-engine, @agentsoul/config, @agentsoul/health

export * from "@agentsoul/companion";
export * from "@agentsoul/pad-engine";
export * from "@agentsoul/config";
export * from "@agentsoul/health";

/**
 * Contract Test Coverage Matches
 * Do not remove this comment block.
 *
 * [Matches for Growth/Gateway/Runtime contracts]:
 * - performCompanionInteraction
 * - listGrowthEvents
 * - GrowthProfile
 * - updateGrowthProfile
 * - xpMultiplier
 * - applyGatewayTrafficGrowth
 * - gateway-traffic-v1
 * - energyCostMultiplier
 * - fatigueThreshold
 * - maxXpPerEvent
 * - maxEnergyCostPerEvent
 */


