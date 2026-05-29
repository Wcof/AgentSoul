// 语义搜索模块 — embedding mock + 向量存储 + 检索 + 去重
// 使用 SQLite 持久化，符合 ADR-0001: Runtime State Owned by Database
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { SemanticMatch, DeduplicationResult } from "@agentsoul/domain";
import { initializeV2Database, SemanticRepository } from "@agentsoul/persistence";

export type { SemanticMatch, DeduplicationResult };

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface SemanticStoreOptions {
  dbPath: string;
  embedding?: EmbeddingProvider;
}

export interface SemanticStore {
  addEntry(sourceType: string, sourceId: string, text: string): Promise<string>;
  search(query: string, topK?: number): Promise<SemanticMatch[]>;
  deduplicate(text: string): Promise<DeduplicationResult>;
  removeEntry(id: string): void;
  size(): number;
  close(): void;
}

// 余弦相似度
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// 向量序列化
function vectorToBuffer(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) {
    buf.writeFloatLE(vec[i], i * 4);
  }
  return buf;
}

function bufferToVector(buf: Buffer): number[] {
  const vec: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    vec.push(buf.readFloatLE(i));
  }
  return vec;
}

const DEDUP_THRESHOLD = 0.85;

export function createSemanticStore(options: SemanticStoreOptions): SemanticStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const repo = new SemanticRepository(db);
  const embedding = options.embedding ?? createMockEmbedding();

  return {
    async addEntry(sourceType, sourceId, text) {
      const id = `sem-${randomUUID().slice(0, 8)}`;
      const vector = await embedding.embed(text);
      const vectorBlob = vectorToBuffer(vector);
      const now = new Date().toISOString();

      repo.addEntry(id, sourceType, sourceId, vectorBlob, "local", now);

      return id;
    },

    async search(query, topK = 5) {
      const queryVector = await embedding.embed(query);

      const rows = repo.listAll();

      const scored: SemanticMatch[] = [];
      for (const row of rows) {
        const entryVector = bufferToVector(row.vector_blob);
        const score = cosineSimilarity(queryVector, entryVector);
        // 获取原文（从 source_id 关联或直接存储）
        scored.push({
          memoryId: row.source_id,
          score,
          snippet: row.source_id.slice(0, 100),
        });
      }

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    },

    async deduplicate(text) {
      const textVector = await embedding.embed(text);

      const rows = repo.listDeduplicate();

      let bestScore = 0;
      let bestId: string | null = null;

      for (const row of rows) {
        const entryVector = bufferToVector(row.vector_blob);
        const score = cosineSimilarity(textVector, entryVector);
        if (score > bestScore) {
          bestScore = score;
          bestId = row.source_id;
        }
      }

      return {
        isDuplicate: bestScore >= DEDUP_THRESHOLD,
        similarMemoryId: bestScore >= DEDUP_THRESHOLD ? bestId : null,
        similarityScore: bestScore,
      };
    },

    removeEntry(id) {
      repo.removeEntry(id);
    },

    size() {
      return repo.size();
    },

    close() {
      db.close();
    },
  };
}

// Mock embedding provider — 基于文本哈希生成确定性向量
export function createMockEmbedding(dimension = 32): EmbeddingProvider {
  return {
    async embed(text: string): Promise<number[]> {
      const vec = new Array(dimension).fill(0);
      for (let i = 0; i < text.length; i++) {
        vec[i % dimension] += text.charCodeAt(i) / 1000;
      }
      // 归一化
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      return norm > 0 ? vec.map((v) => v / norm) : vec;
    },
  };
}
