"""
AgentSoul · Skills & Prompts Manager
====================================

Manages custom skills registry (saved in SQLite) and automates
the deployment (symlink or copy) of prompt rules (CLAUDE.md, .cursorrules, etc.)
into active development workspaces.
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

# Calculate project root manually before importing
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from common import log
from src.storage.db import DatabaseManager


class SkillsManager:
    def __init__(self, db_mgr: DatabaseManager | None = None):
        self.db_mgr = db_mgr or DatabaseManager()

    def register_skill(self, name: str, description: str, path: str, prompt_files: list[str] | None = None) -> None:
        """Register a new skill in the SQLite database."""
        if prompt_files is None:
            # Auto-detect prompt files in the directory
            prompt_files = []
            skill_path = Path(path)
            if skill_path.exists() and skill_path.is_dir():
                candidates = ["CLAUDE.md", "AGENTS.md", ".cursorrules", ".windsurfrules", "prompt.md"]
                for c in candidates:
                    if (skill_path / c).exists():
                        prompt_files.append(c)

        self.db_mgr.register_skill(name, description, path, prompt_files)
        log(f"Skill '{name}' registered in database (path: {path}, rules: {prompt_files})", "OK")

    def toggle_skill(self, name: str, enabled: bool) -> bool:
        """Enable or disable a skill globally (backward compatibility)."""
        success = self.db_mgr.toggle_skill(name, enabled)
        if success:
            log(f"Skill '{name}' status updated: {'ENABLED' if enabled else 'DISABLED'}", "OK")
            # Sync to global mapping table as well
            if enabled:
                self.add_skill_mapping(name, "global", "all", True)
            else:
                self.remove_skill_mapping(name, "global", "all")
        else:
            log(f"Failed to update skill '{name}' status", "ERROR")
        return success

    def list_skills(self) -> list[dict[str, Any]]:
        """List all registered skills."""
        return self.db_mgr.get_all_skills()

    # --- Multi-dimensional Mapping Methods ---

    def add_skill_mapping(self, skill_name: str, target_type: str, target_value: str, enabled: bool = True) -> None:
        """Add or update a skill mapping."""
        self.db_mgr.add_skill_mapping(skill_name, target_type, target_value, enabled)
        log(f"Skill mapping added: {skill_name} -> [{target_type}] {target_value} (enabled: {enabled})", "OK")

    def remove_skill_mapping(self, skill_name: str, target_type: str, target_value: str) -> None:
        """Remove a skill mapping."""
        self.db_mgr.remove_skill_mapping(skill_name, target_type, target_value)
        log(f"Skill mapping removed: {skill_name} -> [{target_type}] {target_value}", "OK")

    def get_skill_mappings(self) -> list[dict[str, Any]]:
        """Get all skill mappings."""
        return self.db_mgr.get_skill_mappings()

    def _detect_software(self, workspace_path: Path) -> str | None:
        """Helper to auto-detect the active software client for a workspace."""
        # 1. Search session cache
        try:
            with self.db_mgr._get_connection() as conn:
                row = conn.execute(
                    "SELECT provider FROM sessions_cache WHERE project_dir = ? OR project_dir = ?",
                    (str(workspace_path), str(workspace_path.resolve()))
                ).fetchone()
                if row:
                    return row["provider"]
        except Exception:
            pass

        # 2. File fallback
        if (workspace_path / ".cursorrules").exists() or (workspace_path / ".vscode").exists():
            return "cursor"
        if (workspace_path / "CLAUDE.md").exists():
            return "claude_code"
        return None

    def deploy_skills_to_workspace(self, workspace_path: str | Path, software: str | None = None) -> list[str]:
        """
        Deploy mapped skills' prompt rules into the specified workspace,
        resolving conflicts according to: Project > Software > Global.

        Returns a list of successfully deployed file paths.
        """
        workspace = Path(workspace_path).resolve()
        if not workspace.exists() or not workspace.is_dir():
            log(f"Invalid workspace path: {workspace_path}", "ERROR")
            return []

        # Auto-detect software if not provided
        if not software:
            software = self._detect_software(workspace)

        log(f"Deploying skills to workspace {workspace} (Active Software: {software or 'None'})", "STEP")

        # 1. Load all skills from DB
        skills = self.list_skills()
        skills_by_name = {s["name"]: s for s in skills}

        # 2. Gather active mappings
        active_mappings: list[tuple[str, int]] = []  # List of (skill_name, priority)

        # 2a. Check explicit mappings in skills_mapping table
        mappings = self.get_skill_mappings()
        for m in mappings:
            if m.get("enabled") != 1:
                continue
            s_name = m["skill_name"]
            t_type = m["target_type"]
            t_val = m["target_value"]

            if t_type == "global" and t_val == "all":
                active_mappings.append((s_name, 1))
            elif t_type == "software" and software and t_val.lower() == software.lower():
                active_mappings.append((s_name, 2))
            elif t_type == "project" and Path(t_val).resolve() == workspace:
                active_mappings.append((s_name, 3))

        # 2b. Backward compatibility: treat skills with enabled=1 in skills table as global
        for s in skills:
            if s.get("enabled") == 1:
                # Add as global priority if not already mapped at higher level
                if not any(item[0] == s["name"] and item[1] >= 1 for item in active_mappings):
                    active_mappings.append((s["name"], 1))

        # 3. Resolve conflicts (precedence: Project [3] > Software [2] > Global [1])
        # Mapping: filename -> (src_file_path, priority, skill_name)
        files_to_deploy: dict[str, tuple[Path, int, str]] = {}

        # Sort mappings by priority ASC, so higher priority overwrites lower priority
        active_mappings.sort(key=lambda x: x[1])

        for skill_name, priority in active_mappings:
            skill = skills_by_name.get(skill_name)
            if not skill:
                continue

            skill_dir = Path(skill["path"])
            if not skill_dir.exists():
                log(f"Skill path does not exist: {skill['path']}", "WARN")
                continue

            for filename in skill["prompt_files"]:
                src_file = skill_dir / filename
                if not src_file.exists():
                    log(f"Rule file not found in skill: {src_file}", "WARN")
                    continue

                # Precedence check (higher overwrites lower)
                if filename not in files_to_deploy or files_to_deploy[filename][1] < priority:
                    files_to_deploy[filename] = (src_file, priority, skill_name)

        # 4. Perform deployment
        deployed_paths = []
        for filename, (src_file, priority, s_name) in files_to_deploy.items():
            dest_file = workspace / filename

            # If destination already exists, clean it up or back it up
            if dest_file.exists() or dest_file.is_symlink():
                try:
                    if dest_file.is_symlink():
                        dest_file.unlink()
                    else:
                        backup = dest_file.with_suffix(f"{dest_file.suffix}.bak")
                        if backup.exists():
                            backup.unlink()
                        dest_file.rename(backup)
                        log(f"Backup created for existing rule file: {backup}", "INFO")
                except OSError as e:
                    log(f"Failed to prepare destination {dest_file}: {e}", "WARN")
                    continue

            # Symlink with fallback copy
            try:
                os.symlink(src_file, dest_file)
                deployed_paths.append(str(dest_file))
                log(f"[{s_name}] Created symlink (priority {priority}): {dest_file} -> {src_file}", "OK")
            except OSError:
                try:
                    shutil.copy2(src_file, dest_file)
                    deployed_paths.append(str(dest_file))
                    log(f"[{s_name}] Created copy (priority {priority}, fallback): {dest_file}", "OK")
                except OSError as e:
                    log(f"Failed to copy rule file {filename} to workspace: {e}", "ERROR")

        return deployed_paths

    def clean_workspace_skills(self, workspace_path: str | Path, software: str | None = None) -> None:
        """Remove deployed symlinks/copies of prompt rules from the workspace."""
        workspace = Path(workspace_path).resolve()
        if not workspace.exists() or not workspace.is_dir():
            return

        if not software:
            software = self._detect_software(workspace)

        # Find all files that might have been deployed by listing all skills
        skills = self.list_skills()
        for skill in skills:
            for filename in skill["prompt_files"]:
                target_file = workspace / filename
                if target_file.exists() or target_file.is_symlink():
                    try:
                        if target_file.is_symlink():
                            target_file.unlink()
                            log(f"Removed symlink: {target_file}", "OK")
                        else:
                            # Only remove if it was copied (for safety, we check if it is still identical or skip)
                            log(f"Found static copy at {target_file}, skipping automatic deletion for safety", "INFO")
                    except OSError as e:
                        log(f"Error removing {target_file}: {e}", "ERROR")


if __name__ == "__main__":
    import json
    manager = SkillsManager()
    if len(sys.argv) > 2:
        cmd = sys.argv[1]
        path = sys.argv[2]
        if cmd == "deploy":
            deployed = manager.deploy_skills_to_workspace(path)
            print(json.dumps({"success": True, "deployed": deployed}, ensure_ascii=False))
        elif cmd == "clean":
            manager.clean_workspace_skills(path)
            print(json.dumps({"success": True}, ensure_ascii=False))

