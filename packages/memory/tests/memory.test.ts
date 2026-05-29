import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStore } from "@agentsoul/memory";

describe("Layered Memory", () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentsoul-memory-"));
    dbPath = join(tempDir, "agentsoul.sqlite");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("写入和读取记忆", () => {
    const store = createMemoryStore({ dbPath });
    try {
      const entry = store.write({
        layer: "day",
        content: "今天学习了 TypeScript",
        priority: "medium",
        tags: ["学习", "TypeScript"],
      });

      expect(entry.id).toBeDefined();
      expect(entry.layer).toBe("day");
      expect(entry.content).toBe("今天学习了 TypeScript");

      const retrieved = store.get(entry.id);
      expect(retrieved).toEqual(entry);
    } finally {
      store.close();
    }
  });

  it("按层查询记忆", () => {
    const store = createMemoryStore({ dbPath });
    try {
      store.write({ layer: "day", content: "日记忆", priority: "low", tags: [] });
      store.write({ layer: "week", content: "周记忆", priority: "low", tags: [] });
      store.write({ layer: "day", content: "另一条日记忆", priority: "low", tags: [] });

      const dayMemories = store.query({ layer: "day" });
      expect(dayMemories).toHaveLength(2);
      expect(dayMemories.every((m) => m.layer === "day")).toBe(true);
    } finally {
      store.close();
    }
  });

  it("按优先级过滤", () => {
    const store = createMemoryStore({ dbPath });
    try {
      store.write({ layer: "day", content: "低优先级", priority: "low", tags: [] });
      store.write({ layer: "day", content: "中优先级", priority: "medium", tags: [] });
      store.write({ layer: "day", content: "高优先级", priority: "high", tags: [] });

      const highPriority = store.query({ minPriority: "high" });
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].priority).toBe("high");

      const mediumAndAbove = store.query({ minPriority: "medium" });
      expect(mediumAndAbove).toHaveLength(2);
    } finally {
      store.close();
    }
  });

  it("按标签查询", () => {
    const store = createMemoryStore({ dbPath });
    try {
      store.write({ layer: "day", content: "A", priority: "low", tags: ["重要"] });
      store.write({ layer: "day", content: "B", priority: "low", tags: ["普通"] });
      store.write({ layer: "day", content: "C", priority: "low", tags: ["重要", "紧急"] });

      const important = store.query({ tags: ["重要"] });
      expect(important).toHaveLength(2);
    } finally {
      store.close();
    }
  });

  it("更新记忆", () => {
    const store = createMemoryStore({ dbPath });
    try {
      const entry = store.write({ layer: "day", content: "原始内容", priority: "low", tags: ["a"] });
      
      store.update(entry.id, { content: "更新后内容", priority: "high" });
      
      const updated = store.get(entry.id);
      expect(updated!.content).toBe("更新后内容");
      expect(updated!.priority).toBe("high");
      expect(updated!.tags).toEqual(["a"]); // 未更新的字段保持不变
    } finally {
      store.close();
    }
  });

  it("删除记忆", () => {
    const store = createMemoryStore({ dbPath });
    try {
      const entry = store.write({ layer: "day", content: "待删除", priority: "low", tags: [] });
      expect(store.get(entry.id)).toBeTruthy();
      
      store.delete(entry.id);
      expect(store.get(entry.id)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("列出所有记忆层", () => {
    const store = createMemoryStore({ dbPath });
    try {
      store.write({ layer: "day", content: "A", priority: "low", tags: [] });
      store.write({ layer: "week", content: "B", priority: "low", tags: [] });
      store.write({ layer: "topic", content: "C", priority: "low", tags: [] });

      const layers = store.listLayers();
      expect(layers).toContain("day");
      expect(layers).toContain("week");
      expect(layers).toContain("topic");
    } finally {
      store.close();
    }
  });

  it("持久化到 SQLite — 重启后数据不丢失", () => {
    let store = createMemoryStore({ dbPath });
    const entry = store.write({ layer: "day", content: "持久化测试", priority: "high", tags: ["test"] });
    store.close();

    // 重新打开
    store = createMemoryStore({ dbPath });
    try {
      const retrieved = store.get(entry.id);
      expect(retrieved).toBeTruthy();
      expect(retrieved!.content).toBe("持久化测试");
      expect(retrieved!.priority).toBe("high");
    } finally {
      store.close();
    }
  });
});
