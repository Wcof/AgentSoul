import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkillSourceStore } from "@agentsoul/skills";

describe("Skill Source Store and Skill Installation", () => {
  it("installs Skill Packs with source metadata without deploying workspace rule files", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });

      try {
        const installed = store.installSkillPack({
          id: "tdd",
          name: "TDD",
          source: {
            kind: "local-directory",
            uri: "/Users/ldh/.agents/skills/tdd",
            revision: "2026-05-28",
          },
          description: "Test-driven development workflow",
          ruleFiles: [
            {
              client: "claude-code",
              relativePath: "CLAUDE.md",
              sourcePath: "/Users/ldh/.agents/skills/tdd/SKILL.md",
            },
          ],
          installedAt: "2026-05-28T11:10:00.000Z",
        });

        expect(installed.id).toBe("tdd");
        expect(installed.source.kind).toBe("local-directory");
        expect(installed.deploymentState.workspaceRuleDeploymentsCreated).toBe(false);

        const skillPacks = store.listSkillPacks();
        expect(skillPacks.length).toBe(1);
        expect(skillPacks[0]?.source.uri).toBe("/Users/ldh/.agents/skills/tdd");
        expect(skillPacks[0]?.ruleFiles[0]?.relativePath).toBe("CLAUDE.md");

        const db = new Database(dbPath, { readonly: true, fileMustExist: true });
        try {
          expect(readCount(db, "project_skill_activations")).toBe(0);
          expect(readCount(db, "managed_rule_files")).toBe(0);
        } finally {
          db.close();
        }
      } finally {
        store.close();
      }
    });
  });

  it("imports a representative external local Skill Pack directory without deploying rules", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });
      const externalPackPath = mkdtempSync(join(tmpdir(), "agentsoul-external-skill-"));

      try {
        writeFileSync(
          join(externalPackPath, "package.yaml"),
          [
            "name: External TDD",
            "version: 1.2.3",
            "description: Representative external agent rule pack",
          ].join("\n"),
          "utf8",
        );
        writeFileSync(join(externalPackPath, "CLAUDE.md"), "Use red-green-refactor.\n", "utf8");
        writeFileSync(join(externalPackPath, ".cursorrules"), "Cursor should use TDD.\n", "utf8");
        mkdirSync(join(externalPackPath, "nested"));
        writeFileSync(join(externalPackPath, "nested", "ignored.md"), "ignored\n", "utf8");

        const imported = store.importLocalSkillPack({
          directory: externalPackPath,
          installedAt: "2026-05-29T12:00:00.000Z",
        });

        expect(imported.id).toBe("external-tdd");
        expect(imported.name).toBe("External TDD");
        expect(imported.description).toBe("Representative external agent rule pack");
        expect(imported.source.kind).toBe("local-directory");
        expect(imported.source.uri).toBe(externalPackPath);
        expect(imported.source.revision).toBe("1.2.3");
        expect(imported.ruleFiles.map((ruleFile) => ruleFile.relativePath).sort()).toEqual([".cursorrules", "CLAUDE.md"]);
        expect(imported.deploymentState.workspaceRuleDeploymentsCreated).toBe(false);
        expect(store.listSkillPacks().length).toBe(1);
        expect(store.listManagedRuleFiles(externalPackPath).length).toBe(0);
      } finally {
        store.close();
        rmSync(externalPackPath, { recursive: true, force: true });
      }
    });
  });
});

describe("Project Skill Activation", () => {
  it("enables and disables an installed Skill Pack for one project without deploying rule files", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });

      try {
        installTddSkillPack(store, "2026-05-28T11:20:00.000Z");

        const enabled = store.setProjectSkillActivation({
          projectPath: "/workspace/app",
          skillPackId: "tdd",
          enabled: true,
          updatedAt: "2026-05-28T11:21:00.000Z",
        });
        expect(enabled.enabled).toBe(true);
        expect(enabled.deploymentState.workspaceRuleDeploymentsCreated).toBe(false);
        expect(store.getEffectiveSkillActivation({
            projectPath: "/workspace/app",
            skillPackId: "tdd",
          }).enabled).toBe(true);

        const disabled = store.setProjectSkillActivation({
          projectPath: "/workspace/app",
          skillPackId: "tdd",
          enabled: false,
          updatedAt: "2026-05-28T11:22:00.000Z",
        });
        expect(disabled.enabled).toBe(false);
        expect(store.listProjectSkillActivations("/workspace/app")[0]?.enabled).toBe(false);

        const db = new Database(dbPath, { readonly: true, fileMustExist: true });
        try {
          expect(readCount(db, "project_skill_activations")).toBe(1);
          expect(readCount(db, "managed_rule_files")).toBe(0);
        } finally {
          db.close();
        }
      } finally {
        store.close();
      }
    });
  });

  it("lets Project Skill Activation override the Global Skill Default", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });

      try {
        installTddSkillPack(store, "2026-05-28T11:30:00.000Z", true);

        expect(store.getEffectiveSkillActivation({
            projectPath: "/workspace/app",
            skillPackId: "tdd",
          }).source).toBe("global-default");
        expect(store.getEffectiveSkillActivation({
            projectPath: "/workspace/app",
            skillPackId: "tdd",
          }).enabled).toBe(true);

        store.setProjectSkillActivation({
          projectPath: "/workspace/app",
          skillPackId: "tdd",
          enabled: false,
          updatedAt: "2026-05-28T11:31:00.000Z",
        });

        const effective = store.getEffectiveSkillActivation({
          projectPath: "/workspace/app",
          skillPackId: "tdd",
        });
        expect(effective.source).toBe("project");
        expect(effective.enabled).toBe(false);
      } finally {
        store.close();
      }
    });
  });
});

describe("Workspace Rule Deployment", () => {
  it("deploys activated Skill Pack rule files as managed symlinks and cleans up only recorded files", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });
      const workspacePath = mkdtempSync(join(tmpdir(), "agentsoul-v2-workspace-"));
      const sourcePath = join(workspacePath, "source-SKILL.md");

      try {
        writeFileSync(sourcePath, "Use TDD.\n", "utf8");
        store.installSkillPack({
          id: "tdd",
          name: "TDD",
          source: {
            kind: "local-directory",
            uri: "/Users/ldh/.agents/skills/tdd",
          },
          ruleFiles: [
            {
              client: "claude-code",
              relativePath: "CLAUDE.md",
              sourcePath,
            },
          ],
          installedAt: "2026-05-28T11:40:00.000Z",
        });
        store.setProjectSkillActivation({
          projectPath: workspacePath,
          skillPackId: "tdd",
          enabled: true,
          updatedAt: "2026-05-28T11:41:00.000Z",
        });

        const deployment = store.deployWorkspaceRules({
          projectPath: workspacePath,
          skillPackId: "tdd",
          method: "symlink",
          deployedAt: "2026-05-28T11:42:00.000Z",
        });
        const targetPath = join(workspacePath, "CLAUDE.md");

        expect(deployment.status).toBe("deployed");
        expect(lstatSync(targetPath).isSymbolicLink()).toBe(true);
        expect(readlinkSync(targetPath)).toBe(sourcePath);
        expect(store.listManagedRuleFiles(workspacePath)[0]?.targetPath).toBe(targetPath);

        const cleanup = store.cleanupWorkspaceRules({
          projectPath: workspacePath,
          skillPackId: "tdd",
        });

        expect(cleanup.removed.length).toBe(1);
        expect(existsSync(targetPath)).toBe(false);
        expect(store.listManagedRuleFiles(workspacePath).length).toBe(0);
      } finally {
        store.close();
        rmSync(workspacePath, { recursive: true, force: true });
      }
    });
  });

  it("copies managed rule files and refuses to overwrite user-authored files without approval", () => {
    withSkillStore((dbPath) => {
      const store = createSkillSourceStore({ dbPath });
      const workspacePath = mkdtempSync(join(tmpdir(), "agentsoul-v2-workspace-"));
      const sourcePath = join(workspacePath, "source-SKILL.md");

      try {
        writeFileSync(sourcePath, "Use TDD.\n", "utf8");
        store.installSkillPack({
          id: "tdd",
          name: "TDD",
          source: {
            kind: "local-directory",
            uri: "/Users/ldh/.agents/skills/tdd",
          },
          ruleFiles: [
            {
              client: "claude-code",
              relativePath: "CLAUDE.md",
              sourcePath,
            },
          ],
          installedAt: "2026-05-28T11:50:00.000Z",
        });
        store.setProjectSkillActivation({
          projectPath: workspacePath,
          skillPackId: "tdd",
          enabled: true,
          updatedAt: "2026-05-28T11:51:00.000Z",
        });

        const deployment = store.deployWorkspaceRules({
          projectPath: workspacePath,
          skillPackId: "tdd",
          method: "copy",
          deployedAt: "2026-05-28T11:52:00.000Z",
        });
        const targetPath = join(workspacePath, "CLAUDE.md");

        expect(deployment.status).toBe("deployed");
        expect(readFileSync(targetPath, "utf8")).toBe("Use TDD.\n");
        expect(store.listManagedRuleFiles(workspacePath)[0]?.deploymentMethod).toBe("copy");

        store.cleanupWorkspaceRules({
          projectPath: workspacePath,
          skillPackId: "tdd",
        });
        writeFileSync(targetPath, "user-authored rules\n", "utf8");

        const conflict = store.deployWorkspaceRules({
          projectPath: workspacePath,
          skillPackId: "tdd",
          method: "copy",
          deployedAt: "2026-05-28T11:53:00.000Z",
        });

        expect(conflict.status).toBe("approval-required");
        expect(conflict.conflicts[0]?.targetPath).toBe(targetPath);
        expect(conflict.conflicts[0]?.reason).toBe("user-authored-file");
        expect(readFileSync(targetPath, "utf8")).toBe("user-authored rules\n");
        expect(store.listManagedRuleFiles(workspacePath).length).toBe(0);
      } finally {
        store.close();
        rmSync(workspacePath, { recursive: true, force: true });
      }
    });
  });
});

function withSkillStore(assertions: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-skills-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    assertions(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

function installTddSkillPack(
  store: ReturnType<typeof createSkillSourceStore>,
  installedAt: string,
  globalDefaultEnabled = false,
): void {
  store.installSkillPack({
    id: "tdd",
    name: "TDD",
    source: {
      kind: "local-directory",
      uri: "/Users/ldh/.agents/skills/tdd",
    },
    globalDefaultEnabled,
    ruleFiles: [
      {
        client: "claude-code",
        relativePath: "CLAUDE.md",
        sourcePath: "/Users/ldh/.agents/skills/tdd/SKILL.md",
      },
    ],
    installedAt,
  });
}
