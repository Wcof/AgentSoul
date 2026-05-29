// Match: managed_rule_files
import Database from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { SkillPackId } from "@agentsoul/domain";
import { initializeV2Database, SkillRepository } from "@agentsoul/persistence";

export type SkillSourceKind = "local-directory" | "git-repository" | "archive";

export interface SkillSourceMetadata {
  kind: SkillSourceKind;
  uri: string;
  revision?: string;
}

export interface SkillRuleFile {
  client: string;
  relativePath: string;
  sourcePath: string;
}

export interface InstallSkillPackInput {
  id: SkillPackId | string;
  name: string;
  source: SkillSourceMetadata;
  description?: string;
  globalDefaultEnabled?: boolean;
  ruleFiles?: SkillRuleFile[];
  installedAt: string;
}

export interface ImportLocalSkillPackInput {
  directory: string;
  id?: SkillPackId | string;
  globalDefaultEnabled?: boolean;
  installedAt: string;
}

export interface InstalledSkillPack {
  id: string;
  name: string;
  source: SkillSourceMetadata;
  description?: string;
  globalDefaultEnabled: boolean;
  ruleFiles: SkillRuleFile[];
  installedAt: string;
  deploymentState: {
    workspaceRuleDeploymentsCreated: false;
  };
}

export interface SetProjectSkillActivationInput {
  projectPath: string;
  skillPackId: SkillPackId | string;
  enabled: boolean;
  updatedAt: string;
}

export interface ProjectSkillActivation {
  id: string;
  projectPath: string;
  skillPackId: string;
  enabled: boolean;
  updatedAt: string;
  deploymentState: {
    workspaceRuleDeploymentsCreated: false;
  };
}

export interface EffectiveSkillActivation {
  projectPath: string;
  skillPackId: string;
  enabled: boolean;
  source: "project" | "global-default";
}

export type WorkspaceRuleDeploymentMethod = "symlink" | "copy";

export interface DeployWorkspaceRulesInput {
  projectPath: string;
  skillPackId: SkillPackId | string;
  method: WorkspaceRuleDeploymentMethod;
  deployedAt: string;
}

export interface ManagedRuleFile {
  id: string;
  projectPath: string;
  targetPath: string;
  sourcePath: string;
  skillPackId: string;
  deploymentMethod: WorkspaceRuleDeploymentMethod;
  contentHash?: string;
  createdAt: string;
}

export interface WorkspaceRuleDeploymentResult {
  status: "deployed";
  managedRuleFiles: ManagedRuleFile[];
}

export interface WorkspaceRuleDeploymentConflict {
  targetPath: string;
  reason: "user-authored-file";
}

export interface WorkspaceRuleDeploymentApprovalRequired {
  status: "approval-required";
  conflicts: WorkspaceRuleDeploymentConflict[];
  managedRuleFiles: [];
}

export type DeployWorkspaceRulesResult =
  | WorkspaceRuleDeploymentResult
  | WorkspaceRuleDeploymentApprovalRequired;

export interface CleanupWorkspaceRulesResult {
  removed: ManagedRuleFile[];
}

export interface SkillSourceStore {
  installSkillPack(input: InstallSkillPackInput): InstalledSkillPack;
  importLocalSkillPack(input: ImportLocalSkillPackInput): InstalledSkillPack;
  listSkillPacks(): InstalledSkillPack[];
  setProjectSkillActivation(input: SetProjectSkillActivationInput): ProjectSkillActivation;
  listProjectSkillActivations(projectPath: string): ProjectSkillActivation[];
  getEffectiveSkillActivation(input: {
    projectPath: string;
    skillPackId: SkillPackId | string;
  }): EffectiveSkillActivation;
  deployWorkspaceRules(input: DeployWorkspaceRulesInput): DeployWorkspaceRulesResult;
  listManagedRuleFiles(projectPath: string): ManagedRuleFile[];
  cleanupWorkspaceRules(input: {
    projectPath: string;
    skillPackId: SkillPackId | string;
  }): CleanupWorkspaceRulesResult;
  close(): void;
}

export function createSkillSourceStore(options: { dbPath: string }): SkillSourceStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const repo = new SkillRepository(db);

  return {
    installSkillPack(input) {
      const skillPack = normalizeSkillPack(input);
      repo.upsertSkillPack(skillPack.id, JSON.stringify(skillPack), skillPack.installedAt);

      return readSkillPack(repo, skillPack.id);
    },
    importLocalSkillPack(input) {
      return this.installSkillPack(readLocalSkillPack(input));
    },
    listSkillPacks() {
      return listSkillPacks(repo);
    },
    setProjectSkillActivation(input) {
      readSkillPack(repo, String(input.skillPackId));
      const activation = normalizeProjectSkillActivation(input);
      repo.upsertActivation(
        activation.id,
        activation.projectPath,
        activation.skillPackId,
        activation.enabled ? 1 : 0,
        activation.updatedAt,
      );

      return readProjectSkillActivation(repo, activation.projectPath, activation.skillPackId);
    },
    listProjectSkillActivations(projectPath) {
      return listProjectSkillActivations(repo, projectPath);
    },
    getEffectiveSkillActivation(input) {
      const skillPack = readSkillPack(repo, String(input.skillPackId));
      const projectActivation = maybeReadProjectSkillActivation(
        repo,
        input.projectPath,
        String(input.skillPackId),
      );

      if (projectActivation) {
        return {
          projectPath: input.projectPath,
          skillPackId: String(input.skillPackId),
          enabled: projectActivation.enabled,
          source: "project",
        };
      }

      return {
        projectPath: input.projectPath,
        skillPackId: String(input.skillPackId),
        enabled: skillPack.globalDefaultEnabled,
        source: "global-default",
      };
    },
    deployWorkspaceRules(input) {
      const skillPack = readSkillPack(repo, String(input.skillPackId));
      const activation = this.getEffectiveSkillActivation({
        projectPath: input.projectPath,
        skillPackId: input.skillPackId,
      });

      if (!activation.enabled) {
        throw new Error(`Project Skill Activation is disabled: ${input.projectPath} / ${input.skillPackId}`);
      }

      const conflicts = skillPack.ruleFiles
        .map((ruleFile): WorkspaceRuleDeploymentConflict | undefined => {
          const targetPath = join(input.projectPath, ruleFile.relativePath);
          const existingManagedRule = maybeReadManagedRuleFile(repo, input.projectPath, targetPath);

          if (existsSync(targetPath) && !existingManagedRule) {
            return {
              targetPath,
              reason: "user-authored-file",
            };
          }

          return undefined;
        })
        .filter((conflict): conflict is WorkspaceRuleDeploymentConflict => Boolean(conflict));

      if (conflicts.length > 0) {
        return {
          status: "approval-required",
          conflicts,
          managedRuleFiles: [],
        };
      }

      const managedRuleFiles = skillPack.ruleFiles.map((ruleFile) => {
        const targetPath = join(input.projectPath, ruleFile.relativePath);
        mkdirSync(dirname(targetPath), { recursive: true });
        if (existsSync(targetPath)) {
          rmSync(targetPath, { force: true });
        }

        if (input.method === "symlink") {
          symlinkSync(ruleFile.sourcePath, targetPath);
        } else {
          copyFileSync(ruleFile.sourcePath, targetPath);
        }

        const managedRuleFile: ManagedRuleFile = {
          id: `managed-rule:${input.projectPath}:${targetPath}`,
          projectPath: input.projectPath,
          targetPath,
          sourcePath: ruleFile.sourcePath,
          skillPackId: String(input.skillPackId),
          deploymentMethod: input.method,
          createdAt: input.deployedAt,
        };
        recordManagedRuleFile(repo, managedRuleFile);
        return managedRuleFile;
      });

      return {
        status: "deployed",
        managedRuleFiles,
      };
    },
    listManagedRuleFiles(projectPath) {
      return listManagedRuleFiles(repo, projectPath);
    },
    cleanupWorkspaceRules(input) {
      const managedRuleFiles = listManagedRuleFiles(repo, input.projectPath).filter(
        (file) => file.skillPackId === String(input.skillPackId),
      );

      for (const file of managedRuleFiles) {
        if (existsSync(file.targetPath)) {
          rmSync(file.targetPath, { force: true });
        }
        deleteManagedRuleFile(repo, file.projectPath, file.targetPath);
      }

      return {
        removed: managedRuleFiles,
      };
    },
    close() {
      db.close();
    },
  };
}

const WORKSPACE_RULE_FILE_NAMES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".windsurfrules",
] as const;

function readLocalSkillPack(input: ImportLocalSkillPackInput): InstallSkillPackInput {
  if (!existsSync(input.directory)) {
    throw new Error(`Local Skill Pack directory not found: ${input.directory}`);
  }

  const manifestPath = join(input.directory, "package.yaml");
  const manifest = existsSync(manifestPath)
    ? parseSimpleYaml(readFileSync(manifestPath, "utf8"))
    : {};
  const name = manifest.name ?? lastPathSegment(input.directory);
  const id = input.id ? String(input.id) : slugify(name);
  const ruleFiles = WORKSPACE_RULE_FILE_NAMES.filter((relativePath) =>
    existsSync(join(input.directory, relativePath)),
  ).map((relativePath): SkillRuleFile => ({
    client: clientForRuleFile(relativePath),
    relativePath,
    sourcePath: join(input.directory, relativePath),
  }));

  return {
    id,
    name,
    description: manifest.description,
    globalDefaultEnabled: input.globalDefaultEnabled,
    source: {
      kind: "local-directory",
      uri: input.directory,
      revision: manifest.version,
    },
    ruleFiles,
    installedAt: input.installedAt,
  };
}

function parseSimpleYaml(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of source.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    result[key] = rawValue.replace(/^["']|["']$/g, "");
  }

  return result;
}

function lastPathSegment(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? "skill-pack";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clientForRuleFile(relativePath: string): string {
  if (relativePath === ".cursorrules") {
    return "cursor";
  }
  if (relativePath === ".windsurfrules") {
    return "windsurf";
  }
  if (relativePath === "CLAUDE.md") {
    return "claude-code";
  }
  return "agent";
}

function normalizeSkillPack(input: InstallSkillPackInput): InstalledSkillPack {
  return {
    id: String(input.id),
    name: input.name,
    source: input.source,
    description: input.description,
    globalDefaultEnabled: input.globalDefaultEnabled ?? false,
    ruleFiles: input.ruleFiles ?? [],
    installedAt: input.installedAt,
    deploymentState: {
      workspaceRuleDeploymentsCreated: false,
    },
  };
}

function normalizeProjectSkillActivation(
  input: SetProjectSkillActivationInput,
): ProjectSkillActivation {
  return {
    id: `project-skill:${input.projectPath}:${String(input.skillPackId)}`,
    projectPath: input.projectPath,
    skillPackId: String(input.skillPackId),
    enabled: input.enabled,
    updatedAt: input.updatedAt,
    deploymentState: {
      workspaceRuleDeploymentsCreated: false,
    },
  };
}

function listSkillPacks(repo: SkillRepository): InstalledSkillPack[] {
  const rows = repo.listSkillPacks() as Array<{ skill_json: string }>;
  return rows.map(parseSkillPack);
}

function readSkillPack(repo: SkillRepository, id: string): InstalledSkillPack {
  const row = repo.getSkillPack(id) as { skill_json: string } | undefined;

  if (!row) {
    throw new Error(`Skill Pack not found: ${id}`);
  }

  return parseSkillPack(row);
}

function parseSkillPack(row: {
  skill_json: string;
}): InstalledSkillPack {
  const skillPack = JSON.parse(row.skill_json) as InstalledSkillPack;

  return {
    ...skillPack,
    globalDefaultEnabled: skillPack.globalDefaultEnabled ?? false,
    deploymentState: {
      workspaceRuleDeploymentsCreated: false,
    },
  };
}

function listProjectSkillActivations(
  repo: SkillRepository,
  projectPath: string,
): ProjectSkillActivation[] {
  const activations = repo.listActivations();
  const rows = activations.filter((r: any) => r.project_path === projectPath) as ProjectSkillActivationRow[];

  return rows.map(parseProjectSkillActivation);
}

function readProjectSkillActivation(
  repo: SkillRepository,
  projectPath: string,
  skillPackId: string,
): ProjectSkillActivation {
  const activation = maybeReadProjectSkillActivation(repo, projectPath, skillPackId);

  if (!activation) {
    throw new Error(`Project Skill Activation not found: ${projectPath} / ${skillPackId}`);
  }

  return activation;
}

function maybeReadProjectSkillActivation(
  repo: SkillRepository,
  projectPath: string,
  skillPackId: string,
): ProjectSkillActivation | undefined {
  const activations = repo.listActivations();
  const row = activations.find(
    (r: any) => r.project_path === projectPath && r.skill_pack_id === skillPackId,
  ) as ProjectSkillActivationRow | undefined;

  return row ? parseProjectSkillActivation(row) : undefined;
}

interface ProjectSkillActivationRow {
  id: string;
  project_path: string;
  skill_pack_id: string;
  enabled: number;
  updated_at: string;
}

function parseProjectSkillActivation(row: ProjectSkillActivationRow): ProjectSkillActivation {
  return {
    id: row.id || `project-skill:${row.project_path}:${row.skill_pack_id}`,
    projectPath: row.project_path,
    skillPackId: row.skill_pack_id,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
    deploymentState: {
      workspaceRuleDeploymentsCreated: false,
    },
  };
}

function recordManagedRuleFile(repo: SkillRepository, file: ManagedRuleFile): void {
  repo.upsertManagedRuleFile(
    file.id,
    file.projectPath,
    file.targetPath,
    file.sourcePath,
    file.skillPackId,
    file.deploymentMethod,
    file.contentHash ?? null,
    file.createdAt,
  );
}

function listManagedRuleFiles(repo: SkillRepository, projectPath: string): ManagedRuleFile[] {
  const rows = repo.listManagedRuleFiles() as ManagedRuleFileRow[];
  return rows
    .filter((row: any) => row.project_path === projectPath)
    .map(parseManagedRuleFile);
}

function maybeReadManagedRuleFile(
  repo: SkillRepository,
  projectPath: string,
  targetPath: string,
): ManagedRuleFile | undefined {
  const files = repo.listManagedRuleFiles() as ManagedRuleFileRow[];
  const row = files.find(
    (r: any) => r.project_path === projectPath && r.target_path === targetPath,
  );

  return row ? parseManagedRuleFile(row) : undefined;
}

function deleteManagedRuleFile(
  repo: SkillRepository,
  projectPath: string,
  targetPath: string,
): void {
  repo.deleteManagedRuleFile(projectPath, targetPath);
}

interface ManagedRuleFileRow {
  id?: string;
  project_path: string;
  target_path: string;
  source_path: string;
  skill_pack_id: string;
  deployment_method: WorkspaceRuleDeploymentMethod;
  content_hash: string | null;
  created_at: string;
}

function parseManagedRuleFile(row: ManagedRuleFileRow): ManagedRuleFile {
  return {
    id: row.id || `managed-rule:${row.project_path}:${row.target_path}`,
    projectPath: row.project_path,
    targetPath: row.target_path,
    sourcePath: row.source_path,
    skillPackId: row.skill_pack_id,
    deploymentMethod: row.deployment_method,
    contentHash: row.content_hash ?? undefined,
    createdAt: row.created_at,
  };
}
