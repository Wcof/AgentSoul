import Database from "better-sqlite3";

export class SkillRepository {
  constructor(private db: Database.Database) {}

  upsertSkillPack(id: string, skillJson: string, installedAt: string): void {
    this.db.prepare(
      `INSERT INTO skill_packs (id, skill_json, installed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         skill_json = excluded.skill_json,
         installed_at = excluded.installed_at`
    ).run(id, skillJson, installedAt);
  }

  getSkillPack(id: string): any {
    return this.db.prepare(`SELECT skill_json FROM skill_packs WHERE id = ?`).get(id);
  }

  listSkillPacks(): any[] {
    return this.db.prepare(`SELECT skill_json FROM skill_packs`).all();
  }

  upsertActivation(id: string, projectPath: string, skillPackId: string, enabled: number, updatedAt: string): void {
    this.db.prepare(
      `INSERT INTO project_skill_activations (id, project_path, skill_pack_id, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_path, skill_pack_id) DO UPDATE SET
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`
    ).run(id, projectPath, skillPackId, enabled, updatedAt);
  }

  listActivations(): any[] {
    return this.db.prepare(`SELECT project_path, skill_pack_id, enabled FROM project_skill_activations`).all();
  }

  upsertManagedRuleFile(id: string, projectPath: string, targetPath: string, sourcePath: string, skillPackId: string, deploymentMethod: string, contentHash: string | null, createdAt: string): void {
    this.db.prepare(
      `INSERT INTO managed_rule_files (id, project_path, target_path, source_path, skill_pack_id, deployment_method, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_path, target_path) DO UPDATE SET
         source_path = excluded.source_path,
         skill_pack_id = excluded.skill_pack_id,
         deployment_method = excluded.deployment_method,
         content_hash = excluded.content_hash,
         created_at = excluded.created_at`
    ).run(id, projectPath, targetPath, sourcePath, skillPackId, deploymentMethod, contentHash, createdAt);
  }

  listManagedRuleFiles(): any[] {
    return this.db.prepare(
      `SELECT project_path, target_path, source_path, skill_pack_id, deployment_method, content_hash, created_at
       FROM managed_rule_files`
    ).all();
  }

  deleteManagedRuleFile(projectPath: string, targetPath: string): void {
    this.db.prepare(
      `DELETE FROM managed_rule_files WHERE project_path = ? AND target_path = ?`
    ).run(projectPath, targetPath);
  }
}
