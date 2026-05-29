import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSemanticStore, createMockEmbedding } from "@agentsoul/semantic";

describe("Semantic Search", () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentsoul-semantic-"));
    dbPath = join(tempDir, "agentsoul.sqlite");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("写入和检索", async () => {
    const store = createSemanticStore({ dbPath });
    try {
      await store.addEntry("memory", "mem-1", "今天学习了 TypeScript 类型系统");
      await store.addEntry("memory", "mem-2", "明天计划学习 Rust 所有权");

      const results = await store.search("TypeScript 类型");
      expect(results.length).toBeGreaterThan(0);
      // 结果应包含 mem-1（与 TypeScript 相关）
      const memoryIds = results.map(r => r.memoryId);
      expect(memoryIds).toContain("mem-1");
    } finally {
      store.close();
    }
  });

  it("按相关性排序", async () => {
    const store = createSemanticStore({ dbPath });
    try {
      await store.addEntry("memory", "mem-1", "TypeScript 泛型和高级类型");
      await store.addEntry("memory", "mem-2", "Python 数据分析");
      await store.addEntry("memory", "mem-3", "TypeScript 装饰器和元编程");

      const results = await store.search("TypeScript 类型", 2);
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    } finally {
      store.close();
    }
  });

  it("去重检测", async () => {
    const store = createSemanticStore({ dbPath });
    try {
      await store.addEntry("memory", "mem-1", "今天学习了 TypeScript");

      // 几乎相同的内容
      const dedup = await store.deduplicate("今天学习了 TypeScript");
      expect(dedup.isDuplicate).toBe(true);
      expect(dedup.similarMemoryId).toBe("mem-1");
      expect(dedup.similarityScore).toBeGreaterThan(0.8);

      // 完全不同的内容
      const nonDup = await store.deduplicate("量子计算和人工智能");
      expect(nonDup.isDuplicate).toBe(false);
    } finally {
      store.close();
    }
  });

  it("非重复内容", async () => {
    const store = createSemanticStore({ dbPath });
    try {
      await store.addEntry("memory", "mem-1", "TypeScript 类型系统");
      await store.addEntry("memory", "mem-2", "Rust 所有权模型");

      const dedup = await store.deduplicate("Go 语言并发编程");
      expect(dedup.isDuplicate).toBe(false);
      expect(dedup.similarMemoryId).toBeNull();
    } finally {
      store.close();
    }
  });

  it("删除条目", async () => {
    const store = createSemanticStore({ dbPath });
    try {
      const id = await store.addEntry("memory", "mem-1", "待删除的条目");
      expect(store.size()).toBe(1);

      store.removeEntry(id);
      expect(store.size()).toBe(0);
    } finally {
      store.close();
    }
  });

  it("持久化到 SQLite — 重启后数据不丢失", async () => {
    let store = createSemanticStore({ dbPath });
    await store.addEntry("memory", "mem-1", "持久化测试内容");
    store.close();

    store = createSemanticStore({ dbPath });
    try {
      expect(store.size()).toBe(1);
      const results = await store.search("持久化测试");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memoryId).toBe("mem-1");
    } finally {
      store.close();
    }
  });
});
