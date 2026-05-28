"""
AgentSoul · Skills Mapping Tests
================================

Verifies multi-dimensional deployment of prompt rule skills (global/software/project)
and priority-based conflict resolution.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
import pytest
from src.storage.db import DatabaseManager
from src.skills.skills_manager import SkillsManager


@pytest.fixture
def test_db(temp_dir):
    """Fixture to initialize a temporary test database."""
    db_path = temp_dir / "test_agentsoul.db"
    db = DatabaseManager(db_path)
    return db


def test_skills_mapping_precedence(temp_dir, test_db):
    workspace = temp_dir / "workspace"
    workspace.mkdir()

    # Create dummy skill directories with rules files
    global_skill_dir = temp_dir / "global_skill"
    global_skill_dir.mkdir()
    (global_skill_dir / "CLAUDE.md").write_text("global content")

    software_skill_dir = temp_dir / "software_skill"
    software_skill_dir.mkdir()
    (software_skill_dir / "CLAUDE.md").write_text("software content")
    (software_skill_dir / ".cursorrules").write_text("software cursorrules")

    project_skill_dir = temp_dir / "project_skill"
    project_skill_dir.mkdir()
    (project_skill_dir / "CLAUDE.md").write_text("project content")

    # Instantiate manager
    manager = SkillsManager(test_db)

    # 1. Register skills in DB
    manager.register_skill("GlobalSkill", "Global Desc", str(global_skill_dir), ["CLAUDE.md"])
    manager.register_skill("SoftwareSkill", "Software Desc", str(software_skill_dir), ["CLAUDE.md", ".cursorrules"])
    manager.register_skill("ProjectSkill", "Project Desc", str(project_skill_dir), ["CLAUDE.md"])

    # 2. Add mappings with different dimensions and enable them
    manager.add_skill_mapping("GlobalSkill", "global", "all", True)
    manager.add_skill_mapping("SoftwareSkill", "software", "cursor", True)
    manager.add_skill_mapping("ProjectSkill", "project", str(workspace), True)

    # 3. Deploy to workspace with active software "cursor"
    deployed = manager.deploy_skills_to_workspace(workspace, software="cursor")

    # Check which files got deployed
    claude_dest = workspace / "CLAUDE.md"
    cursorrules_dest = workspace / ".cursorrules"

    assert claude_dest.exists()
    assert cursorrules_dest.exists()

    # Precedence check: Project (ProjectSkill) > Software (SoftwareSkill) > Global (GlobalSkill)
    # CLAUDE.md is present in all three, so it must contain "project content"
    assert claude_dest.read_text() == "project content"

    # .cursorrules is present only in SoftwareSkill, so it must contain "software cursorrules"
    assert cursorrules_dest.read_text() == "software cursorrules"

    # 4. Clean workspace
    manager.clean_workspace_skills(workspace, software="cursor")
    assert not claude_dest.exists()
    # Note: .cursorrules is a symlink, so cleaning it should delete it.
    assert not cursorrules_dest.exists()
