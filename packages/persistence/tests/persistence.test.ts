import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REQUIRED_V2_TABLES,
  V2_SCHEMA_VERSION,
  initializeV2Database,
  inspectV2Database,
} from "@agentsoul/persistence";

describe("AgentSoul v2 persistence", () => {
  it("initializes a fresh versioned SQLite database with all v2 storage boundaries", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-db-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      const initialized = initializeV2Database(dbPath);

      assert.equal(initialized.schemaVersion, V2_SCHEMA_VERSION);
      assert.deepEqual(initialized.tables, REQUIRED_V2_TABLES);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can be initialized repeatedly without changing the schema version or table set", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-db-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);
      initializeV2Database(dbPath);
      const inspected = inspectV2Database(dbPath);

      assert.equal(inspected.schemaVersion, V2_SCHEMA_VERSION);
      assert.deepEqual(inspected.tables, REQUIRED_V2_TABLES);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
