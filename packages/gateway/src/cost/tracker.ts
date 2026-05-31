import type { ChannelStore, ChannelType } from "../channels/store";
import type { GatewayAuditRepository, GatewayCostTrends } from "../audit/repository";

// ─── Cost types ───

export interface CostSummary {
  totalEstimatedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byChannel: Array<{
    channelId: string;
    channelName: string;
    channelType: ChannelType;
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    successRate: number;
  }>;
  byModel: Array<{
    model: string;
    estimatedCost: number;
    requestCount: number;
  }>;
  dailyTrend: Array<{
    date: string;
    estimatedCost: number;
    requestCount: number;
  }>;
}

export interface CostTracker {
  getSummary(from?: string, to?: string): CostSummary;
  getChannelSummary(channelId: string, from?: string, to?: string): CostSummary;
  close(): void;
}

// ─── Cost utilities ───

export function normalizeTokenCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

export function estimateTrafficCost(
  active: { pricing?: { inputTokenUsd?: number; outputTokenUsd?: number } } | undefined,
  clientRequest: { tokenUsage?: { inputTokens?: number; outputTokens?: number } },
): number {
  const inputTokens = normalizeTokenCount(clientRequest.tokenUsage?.inputTokens);
  const outputTokens = normalizeTokenCount(clientRequest.tokenUsage?.outputTokens);
  const inputCost = inputTokens * (active?.pricing?.inputTokenUsd ?? 0);
  const outputCost = outputTokens * (active?.pricing?.outputTokenUsd ?? 0);

  return Number((inputCost + outputCost).toFixed(8));
}

// ─── Cost Tracker implementation ───

export function createCostTracker(options: {
  channelStore: ChannelStore;
  audit?: GatewayAuditRepository;
}): CostTracker {
  const getWindow = (from?: string, to?: string): { from: string; to: string } => ({
    from: from ?? "1970-01-01T00:00:00.000Z",
    to: to ?? "9999-12-31T23:59:59.999Z",
  });

  const getAuditTrends = (from?: string, to?: string): GatewayCostTrends => {
    if (!options.audit) {
      return { dailyCosts: [], modelMix: [], providerMix: [] };
    }
    const window = getWindow(from, to);
    return options.audit.summarizeCostTrends(window);
  };

  return {
    getSummary(from, to) {
      const channels = options.channelStore.listChannels();
      const metrics = options.channelStore.listChannelMetrics();
      const trends = getAuditTrends(from, to);

      const byChannel = channels.map(ch => {
        const m = metrics.find(m => m.channelId === ch.id);
        return {
          channelId: ch.id,
          channelName: ch.name,
          channelType: ch.type,
          estimatedCost: m?.estimatedCost || 0,
          inputTokens: m?.totalInputTokens || 0,
          outputTokens: m?.totalOutputTokens || 0,
          requestCount: m?.requestCount || 0,
          successRate: m?.successRate || 0,
        };
      });

      const totalEstimatedCost = byChannel.reduce((sum, c) => sum + c.estimatedCost, 0);
      const totalInputTokens = byChannel.reduce((sum, c) => sum + c.inputTokens, 0);
      const totalOutputTokens = byChannel.reduce((sum, c) => sum + c.outputTokens, 0);
      const totalRequests = byChannel.reduce((sum, c) => sum + c.requestCount, 0);

      return {
        totalEstimatedCost,
        totalInputTokens,
        totalOutputTokens,
        totalRequests,
        byChannel,
        byModel: trends.modelMix.map((item) => ({
          model: item.model,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
        dailyTrend: trends.dailyCosts.map((item) => ({
          date: item.date,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
      };
    },

    getChannelSummary(channelId, from, to) {
      const channel = options.channelStore.getChannel(channelId);
      if (!channel) throw new Error('Channel not found');

      const metrics = options.channelStore.getChannelMetrics(channelId);
      const trends = getAuditTrends(from, to);
      return {
        totalEstimatedCost: metrics?.estimatedCost || 0,
        totalInputTokens: metrics?.totalInputTokens || 0,
        totalOutputTokens: metrics?.totalOutputTokens || 0,
        totalRequests: metrics?.requestCount || 0,
        byChannel: [{
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          estimatedCost: metrics?.estimatedCost || 0,
          inputTokens: metrics?.totalInputTokens || 0,
          outputTokens: metrics?.totalOutputTokens || 0,
          requestCount: metrics?.requestCount || 0,
          successRate: metrics?.successRate || 0,
        }],
        byModel: trends.modelMix.map((item) => ({
          model: item.model,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
        dailyTrend: trends.dailyCosts.map((item) => ({
          date: item.date,
          estimatedCost: item.estimatedCost,
          requestCount: item.requestCount,
        })),
      };
    },

    close() {},
  };
}
