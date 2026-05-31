import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStore } from "@agentsoul/memory";

describe("Entity Memory", () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentsoul-entity-"));
    dbPath = join(tempDir, "agentsoul.sqlite");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("创建和读取实体", () => {
    const store = createEntityStore({ dbPath });
    try {
      const entity = store.createEntity("张三", "person");
      expect(entity.id).toBeDefined();
      expect(entity.name).toBe("张三");
      expect(entity.type).toBe("person");
      expect(entity.facts).toEqual([]);

      const retrieved = store.getEntity(entity.id);
      expect(retrieved).toEqual(entity);
    } finally {
      store.close();
    }
  });

  it("按名称搜索", () => {
    const store = createEntityStore({ dbPath });
    try {
      store.createEntity("张三", "person");
      store.createEntity("李四", "person");
      store.createEntity("张三的项目", "project");

      const results = store.findByName("张三");
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toContain("张三");
      expect(results.map((r) => r.name)).toContain("张三的项目");
    } finally {
      store.close();
    }
  });

  it("按类型搜索", () => {
    const store = createEntityStore({ dbPath });
    try {
      store.createEntity("张三", "person");
      store.createEntity("MacBook", "hardware");
      store.createEntity("李四", "person");

      const people = store.findByType("person");
      expect(people).toHaveLength(2);
      expect(people.every((p) => p.type === "person")).toBe(true);
    } finally {
      store.close();
    }
  });

  it("upsert 事实 — 新增和更新", () => {
    const store = createEntityStore({ dbPath });
    try {
      const entity = store.createEntity("张三", "person");

      // 新增事实
      const fact1 = store.upsertFact(entity.id, {
        attribute: "role",
        value: "工程师",
        confidence: "high",
        source: "对话记录",
      });
      expect(fact1.attribute).toBe("role");
      expect(fact1.value).toBe("工程师");

      // 更新同一属性的事实
      const fact2 = store.upsertFact(entity.id, {
        attribute: "role",
        value: "高级工程师",
        confidence: "high",
        source: "晋升通知",
      });
      expect(fact2.value).toBe("高级工程师");

      // 验证只有一条 role 事实
      const retrieved = store.getEntity(entity.id)!;
      const roleFacts = retrieved.facts.filter((f) => f.attribute === "role");
      expect(roleFacts).toHaveLength(1);
      expect(roleFacts[0].value).toBe("高级工程师");
    } finally {
      store.close();
    }
  });

  it("删除实体", () => {
    const store = createEntityStore({ dbPath });
    try {
      const entity = store.createEntity("张三", "person");
      store.upsertFact(entity.id, { attribute: "age", value: "30", confidence: "medium", source: "guess" });

      expect(store.getEntity(entity.id)).toBeTruthy();
      store.deleteEntity(entity.id);
      expect(store.getEntity(entity.id)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("持久化到 SQLite — 重启后数据不丢失", () => {
    let store = createEntityStore({ dbPath });
    const entity = store.createEntity("持久化测试", "concept");
    store.upsertFact(entity.id, { attribute: "key", value: "value", confidence: "high", source: "test" });
    store.close();

    store = createEntityStore({ dbPath });
    try {
      const retrieved = store.getEntity(entity.id);
      expect(retrieved).toBeTruthy();
      expect(retrieved!.name).toBe("持久化测试");
      expect(retrieved!.facts).toHaveLength(1);
      expect(retrieved!.facts[0].value).toBe("value");
    } finally {
      store.close();
    }
  });
});
