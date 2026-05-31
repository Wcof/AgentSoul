import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { initializeV2Database } from "@agentsoul/persistence";

// ─── Audit types ───

export interface TrafficMetadata {
  gatewayEventId: string;
  clientProtocol: string;
  providerProtocol?: string;
  providerProfileId?: string;
  model?: string;
  route: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  outcome: string;
}

export interface GatewayAuditRecord {
  id: string;
  gatewayEventId: string;
  trafficMetadata: TrafficMetadata;
  estimatedCost: number;
  outcome: string;
  evidenceHash?: string;
  occurredAt: string;
}

export interface GatewayAuditRepository {
  recordAudit(input: {
    trafficMetadata: TrafficMetadata;
    estimatedCost: number;
    outcome: string;
    evidenceHash?: string;
    occurredAt?: string;
  }): GatewayAuditRecord;
  listAuditRecords(): GatewayAuditRecord[];
  summarizeCostTrends(input: {
    from: string;
    to: string;
  }): GatewayCostTrends;
  close(): void;
}

export interface GatewayCostTrends {
  dailyCosts: DailyCostTrend[];
  modelMix: CostMixEntry[];
  providerMix: ProviderCostMixEntry[];
}

export interface DailyCostTrend {
  date: string;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  averageLatencyMs: number;
}

export interface CostMixEntry {
  model: string;
  requestCount: number;
  estimatedCost: number;
}

export interface ProviderCostMixEntry {
  providerProfileId: string;
  requestCount: number;
  estimatedCost: number;
}

// ─── Audit Repository implementation ───

export function createGatewayAuditRepository(options: { dbPath: string }): GatewayAuditRepository {
  initializeV2Database(options.dbPath);

  const db = new Database(options.dbPath);

  return {
    recordAudit(input) {
      const record: GatewayAuditRecord = {
        id: randomUUID(),
        gatewayEventId: input.trafficMetadata.gatewayEventId,
        trafficMetadata: input.trafficMetadata,
        estimatedCost: input.estimatedCost,
        outcome: input.outcome,
        evidenceHash: input.evidenceHash,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
      };

      db.prepare(
        `INSERT INTO audit_records (
           id,
           gateway_event_id,
           traffic_metadata_json,
           estimated_cost,
           outcome,
           evidence_hash,
           occurred_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.id,
        record.gatewayEventId,
        JSON.stringify(record.trafficMetadata),
        record.estimatedCost,
        record.outcome,
        record.evidenceHash,
        record.occurredAt,
      );

      return record;
    },
    listAuditRecords() {
      return readAuditRecords(db);
    },
    summarizeCostTrends(input) {
      return summarizeCostTrends(readAuditRecords(db, input));
    },
    close() {
      db.close();
    },
  };
}

// ─── Internal helpers ───

function readAuditRecords(
  db: Database.Database,
  window?: { from: string; to: string },
): GatewayAuditRecord[] {
  const rows = window
    ? db
        .prepare(
          `SELECT
             id,
             gateway_event_id,
             traffic_metadata_json,
             estimated_cost,
             outcome,
             evidence_hash,
             occurred_at
           FROM audit_records
           WHERE occurred_at >= ? AND occurred_at < ?
           ORDER BY occurred_at ASC, rowid ASC`,
        )
        .all(window.from, window.to)
    : db
        .prepare(
          `SELECT
             id,
             gateway_event_id,
             traffic_metadata_json,
             estimated_cost,
             outcome,
             evidence_hash,
             occurred_at
           FROM audit_records
           ORDER BY rowid ASC`,
        )
        .all();

  return (rows as Array<{
    id: string;
    gateway_event_id: string;
    traffic_metadata_json: string;
    estimated_cost: number;
    outcome: string;
    evidence_hash: string | null;
    occurred_at: string;
  }>).map((row) => ({
    id: row.id,
    gatewayEventId: row.gateway_event_id,
    trafficMetadata: JSON.parse(row.traffic_metadata_json) as TrafficMetadata,
    estimatedCost: row.estimated_cost,
    outcome: row.outcome,
    evidenceHash: row.evidence_hash ?? undefined,
    occurredAt: row.occurred_at,
  }));
}

function summarizeCostTrends(records: GatewayAuditRecord[]): GatewayCostTrends {
  const daily = new Map<
    string,
    {
      estimatedCost: number;
      inputTokens: number;
      outputTokens: number;
      requestCount: number;
      latencyMs: number;
    }
  >();
  const modelMix = new Map<string, { requestCount: number; estimatedCost: number }>();
  const providerMix = new Map<string, { requestCount: number; estimatedCost: number }>();

  for (const record of records) {
    const date = record.occurredAt.slice(0, 10);
    const dailyEntry = daily.get(date) ?? {
      estimatedCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
      latencyMs: 0,
    };
    dailyEntry.estimatedCost += record.estimatedCost;
    dailyEntry.inputTokens += record.trafficMetadata.inputTokens;
    dailyEntry.outputTokens += record.trafficMetadata.outputTokens;
    dailyEntry.requestCount += 1;
    dailyEntry.latencyMs += record.trafficMetadata.latencyMs;
    daily.set(date, dailyEntry);

    const model = record.trafficMetadata.model ?? "unknown";
    const modelEntry = modelMix.get(model) ?? { requestCount: 0, estimatedCost: 0 };
    modelEntry.requestCount += 1;
    modelEntry.estimatedCost += record.estimatedCost;
    modelMix.set(model, modelEntry);

    const providerProfileId = record.trafficMetadata.providerProfileId ?? "unknown";
    const providerEntry = providerMix.get(providerProfileId) ?? {
      requestCount: 0,
      estimatedCost: 0,
    };
    providerEntry.requestCount += 1;
    providerEntry.estimatedCost += record.estimatedCost;
    providerMix.set(providerProfileId, providerEntry);
  }

  return {
    dailyCosts: [...daily.entries()].map(([date, entry]) => ({
      date,
      estimatedCost: roundCost(entry.estimatedCost),
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      requestCount: entry.requestCount,
      averageLatencyMs: Math.round(entry.latencyMs / entry.requestCount),
    })),
    modelMix: sortCostMix(
      [...modelMix.entries()].map(([model, entry]) => ({
        model,
        requestCount: entry.requestCount,
        estimatedCost: roundCost(entry.estimatedCost),
      })),
    ),
    providerMix: sortCostMix(
      [...providerMix.entries()].map(([providerProfileId, entry]) => ({
        providerProfileId,
        requestCount: entry.requestCount,
        estimatedCost: roundCost(entry.estimatedCost),
      })),
    ),
  };
}

function sortCostMix<T extends { estimatedCost: number }>(entries: T[]): T[] {
  return entries.sort((left, right) => right.estimatedCost - left.estimatedCost);
}

function roundCost(value: number): number {
  return Number(value.toFixed(8));
}
