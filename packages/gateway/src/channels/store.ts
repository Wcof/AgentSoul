import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { initializeV2Database } from "@agentsoul/persistence";

// ─── Channel types ───

export type ChannelType = "claude" | "codex" | "openai" | "gemini";
export type ChannelStatus = "active" | "suspended" | "disabled" | "healthy" | "error";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority: number;
  status: ChannelStatus;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMetrics {
  channelId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  lastRequestAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  circuitState: "closed" | "open" | "half_open";
  consecutiveFailures: number;
}

export interface ChannelCreateInput {
  name: string;
  type: ChannelType;
  baseUrl: string;
  apiKeys: string[];
  description?: string;
  priority?: number;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
}

export interface ChannelUpdateInput {
  name?: string;
  baseUrl?: string;
  apiKeys?: string[];
  description?: string;
  priority?: number;
  status?: ChannelStatus;
  supportedModels?: string[];
  modelMapping?: Record<string, string>;
  customHeaders?: Record<string, string>;
  proxyUrl?: string;
}

export interface ChannelStore {
  createChannel(input: ChannelCreateInput): Channel;
  getChannel(id: string): Channel | null;
  listChannels(type?: ChannelType): Channel[];
  updateChannel(id: string, input: ChannelUpdateInput): Channel;
  deleteChannel(id: string): void;
  getChannelMetrics(id: string): ChannelMetrics | null;
  listChannelMetrics(): ChannelMetrics[];
  recordRequest(channelId: string, input: {
    success: boolean;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    failoverThreshold?: number;
  }): void;
  close(): void;
}

// ─── Internal helpers ───

function rowToChannel(row: any): Channel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    apiKeys: JSON.parse(row.api_keys || '[]'),
    description: row.description,
    priority: row.priority,
    status: row.status,
    supportedModels: JSON.parse(row.supported_models || '[]'),
    modelMapping: JSON.parse(row.model_mapping || '{}'),
    customHeaders: JSON.parse(row.custom_headers || '{}'),
    proxyUrl: row.proxy_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMetrics(row: any): ChannelMetrics {
  return {
    channelId: row.channel_id,
    requestCount: row.request_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    successRate: row.request_count > 0 ? (row.success_count / row.request_count) * 100 : 0,
    averageLatencyMs: row.request_count > 0 ? row.total_latency_ms / row.request_count : 0,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    estimatedCost: row.estimated_cost,
    lastRequestAt: row.last_request_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    circuitState: row.circuit_state,
    consecutiveFailures: row.consecutive_failures,
  };
}

// ─── Channel Store implementation ───

export function createChannelStore(options: { dbPath: string }): ChannelStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);

  // Create channels table
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_keys TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      supported_models TEXT,
      model_mapping TEXT,
      custom_headers TEXT,
      proxy_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create channel metrics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_metrics (
      channel_id TEXT PRIMARY KEY,
      request_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      total_latency_ms INTEGER DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      estimated_cost REAL DEFAULT 0,
      last_request_at TEXT,
      last_success_at TEXT,
      last_failure_at TEXT,
      circuit_state TEXT DEFAULT 'closed',
      consecutive_failures INTEGER DEFAULT 0,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    )
  `);

  return {
    createChannel(input) {
      const id = `ch-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO channels (id, name, type, base_url, api_keys, description, priority, status, supported_models, model_mapping, custom_headers, proxy_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.name, input.type, input.baseUrl,
        JSON.stringify(input.apiKeys), input.description || null,
        input.priority || 0, JSON.stringify(input.supportedModels || []),
        JSON.stringify(input.modelMapping || {}), JSON.stringify(input.customHeaders || {}),
        input.proxyUrl || null, now, now
      );

      // Initialize metrics
      db.prepare(`
        INSERT INTO channel_metrics (channel_id) VALUES (?)
      `).run(id);

      return this.getChannel(id)!;
    },

    getChannel(id) {
      const row = db.prepare(`
        SELECT * FROM channels WHERE id = ?
      `).get(id);

      if (!row) return null;
      return rowToChannel(row);
    },

    listChannels(type) {
      let sql = 'SELECT * FROM channels';
      if (type) {
        sql += ' WHERE type = ?';
        const rows = db.prepare(sql).all(type);
        return rows.map(r => rowToChannel(r));
      }
      const rows = db.prepare(sql).all();
      return rows.map(r => rowToChannel(r));
    },

    updateChannel(id, input) {
      const channel = this.getChannel(id);
      if (!channel) throw new Error('Channel not found');

      const updates = [];
      const params = [];

      if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
      if (input.baseUrl !== undefined) { updates.push('base_url = ?'); params.push(input.baseUrl); }
      if (input.apiKeys !== undefined) { updates.push('api_keys = ?'); params.push(JSON.stringify(input.apiKeys)); }
      if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
      if (input.priority !== undefined) { updates.push('priority = ?'); params.push(input.priority); }
      if (input.status !== undefined) { updates.push('status = ?'); params.push(input.status); }
      if (input.supportedModels !== undefined) { updates.push('supported_models = ?'); params.push(JSON.stringify(input.supportedModels)); }
      if (input.modelMapping !== undefined) { updates.push('model_mapping = ?'); params.push(JSON.stringify(input.modelMapping)); }
      if (input.customHeaders !== undefined) { updates.push('custom_headers = ?'); params.push(JSON.stringify(input.customHeaders)); }
      if (input.proxyUrl !== undefined) { updates.push('proxy_url = ?'); params.push(input.proxyUrl); }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      db.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return this.getChannel(id)!;
    },

    deleteChannel(id) {
      db.prepare('DELETE FROM channel_metrics WHERE channel_id = ?').run(id);
      db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    },

    getChannelMetrics(id) {
      const row = db.prepare('SELECT * FROM channel_metrics WHERE channel_id = ?').get(id);
      if (!row) return null;
      return rowToMetrics(row);
    },

    listChannelMetrics() {
      const rows = db.prepare('SELECT * FROM channel_metrics').all();
      return rows.map(r => rowToMetrics(r));
    },

    recordRequest(channelId, input) {
      const now = new Date().toISOString();
      const metrics = this.getChannelMetrics(channelId);
      if (!metrics) return;
      const failoverThreshold = Math.max(1, Number(input.failoverThreshold ?? 5));

      const newRequestCount = metrics.requestCount + 1;
      const newSuccessCount = metrics.successCount + (input.success ? 1 : 0);
      const newFailureCount = metrics.failureCount + (input.success ? 0 : 1);
      const newConsecutiveFailures = input.success ? 0 : metrics.consecutiveFailures + 1;
      const newCircuitState = newConsecutiveFailures >= failoverThreshold ? 'open' : 'closed';

      db.prepare(`
        UPDATE channel_metrics SET
          request_count = ?, success_count = ?, failure_count = ?,
          total_latency_ms = total_latency_ms + ?,
          total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          estimated_cost = estimated_cost + ?,
          last_request_at = ?,
          last_${input.success ? 'success' : 'failure'}_at = ?,
          circuit_state = ?, consecutive_failures = ?
        WHERE channel_id = ?
      `).run(
        newRequestCount, newSuccessCount, newFailureCount,
        input.latencyMs, input.inputTokens, input.outputTokens,
        input.estimatedCost, now, now, newCircuitState, newConsecutiveFailures,
        channelId
      );
    },

    close() {
      db.close();
    },
  };
}
