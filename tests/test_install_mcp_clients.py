from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import install


class TestInstallMcpClients(unittest.TestCase):
    def test_remove_agentsoul_hooks_returns_count(self):
        settings = {
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": ".*",
                        "hooks": [
                            {"type": "prompt", "prompt": "=== AGENTSOUL PERSONALITY FRAMEWORK === foo"}
                        ],
                    },
                    {
                        "matcher": ".*",
                        "hooks": [{"type": "prompt", "prompt": "other hook"}],
                    },
                ]
            }
        }
        removed = install.remove_agentsoul_hooks(settings)
        self.assertEqual(removed, 1)
        self.assertEqual(install.count_remaining_agentsoul_hooks(settings), 0)
        self.assertEqual(len(settings["hooks"]["SessionStart"]), 1)

    def test_remove_agentsoul_hook_file_handles_real_path(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            settings_path = Path(temp_dir) / "settings.json"
            settings_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "SessionStart": [
                                {
                                    "matcher": ".*",
                                    "hooks": [
                                        {"type": "prompt", "prompt": "=== AGENTSOUL PERSONALITY FRAMEWORK === demo"}
                                    ],
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )
            removed, remaining = install.remove_agentsoul_hook_file(settings_path, force=True)
            self.assertEqual(removed, 1)
            self.assertEqual(remaining, 0)

    def test_ensure_agentsoul_hook_adds_once(self):
        settings: dict[str, object] = {}
        changed1 = install.ensure_agentsoul_hook(settings, install.get_agentsoul_hook_prompt())
        changed2 = install.ensure_agentsoul_hook(settings, install.get_agentsoul_hook_prompt())
        self.assertTrue(changed1)
        self.assertFalse(changed2)
        self.assertEqual(install.count_remaining_agentsoul_hooks(settings), 1)

    def test_upsert_and_remove_managed_block(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg = Path(temp_dir) / "config.toml"
            install.upsert_managed_block(
                cfg,
                '[mcp_servers.agentsoul]\ncommand = "node"\nargs = ["/tmp/a.js"]\n',
                install.AGENTSOUL_BLOCK_BEGIN,
                install.AGENTSOUL_BLOCK_END,
            )
            self.assertTrue(install.has_managed_block(cfg, install.AGENTSOUL_BLOCK_BEGIN, install.AGENTSOUL_BLOCK_END))
            removed = install.remove_managed_block(cfg, install.AGENTSOUL_BLOCK_BEGIN, install.AGENTSOUL_BLOCK_END)
            self.assertTrue(removed)
            self.assertFalse(install.has_managed_block(cfg, install.AGENTSOUL_BLOCK_BEGIN, install.AGENTSOUL_BLOCK_END))

    def test_build_codex_mcp_block_contains_agentsoul(self):
        block = install.build_codex_mcp_block(Path("/tmp/mcp_server/dist/index.js"))
        self.assertIn("[mcp_servers.agentsoul]", block)
        self.assertIn('command = "node"', block)
        self.assertIn("dist/index.js", block)

    def test_generate_client_install_markdown_contains_core_sections(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_root = install.PROJECT_ROOT
            install.PROJECT_ROOT = Path(temp_dir)
            try:
                guide = install.generate_client_install_markdown(Path("/tmp/mcp_server/dist/index.js"))
                self.assertTrue(guide.exists())
                content = guide.read_text(encoding="utf-8")
                self.assertIn("Claude CLI", content)
                self.assertIn("Codex CLI", content)
                self.assertIn("mcp__agentsoul__mcp_tool_index()", content)
                self.assertIn("entity_fact_invalidate", content)
            finally:
                install.PROJECT_ROOT = original_root

    def test_codex_scope_paths_both(self):
        paths = install.codex_scope_paths("both")
        self.assertEqual(len(paths), 2)
        self.assertTrue(any(str(p).endswith(".codex/config.toml") for p in paths))

    def test_codex_startup_markdown_contains_required_calls(self):
        content = install.codex_startup_markdown()
        self.assertIn("mcp__agentsoul__get_persona_config()", content)
        self.assertIn("mcp__agentsoul__get_mcp_usage_guide()", content)
        self.assertIn("entity_fact_invalidate", content)

    def test_codex_agents_markdown_contains_required_calls(self):
        content = install.codex_agents_markdown()
        self.assertIn("mcp__agentsoul__mcp_tool_index()", content)
        self.assertIn("write_memory_day", content)
        self.assertIn("Do not claim persistence", content)

    def test_codex_agents_md_paths_scope(self):
        self.assertEqual(install.codex_agents_md_paths("global"), [])
        self.assertEqual(len(install.codex_agents_md_paths("local")), 1)
        self.assertEqual(len(install.codex_agents_md_paths("both")), 1)

    def test_trae_scope_paths_both(self):
        paths = install.trae_scope_paths("both")
        self.assertEqual(len(paths), 2)
        self.assertTrue(any(str(p).endswith(".trae/mcp.json") for p in paths))

    def test_upsert_remove_mcp_server_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg = Path(temp_dir) / "mcp.json"
            install._upsert_mcp_server_in_json(
                cfg, "agentsoul", {"command": "node", "args": ["/tmp/a.js"]}
            )
            self.assertTrue(install._has_mcp_server_in_json(cfg, "agentsoul"))
            removed = install._remove_mcp_server_in_json(cfg, "agentsoul")
            self.assertTrue(removed)
            self.assertFalse(install._has_mcp_server_in_json(cfg, "agentsoul"))

    def test_find_project_by_name_uses_discovery(self):
        fake_projects = [Path("/tmp/foo"), Path("/tmp/bar/app-one")]
        with mock.patch.object(install, "discover_project_candidates", return_value=fake_projects):
            self.assertEqual(install.find_project_by_name("foo"), Path("/tmp/foo"))
            self.assertEqual(install.find_project_by_name("app-one"), Path("/tmp/bar/app-one"))

    def test_codex_installer_install_and_uninstall_local(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            installer = install.CodexInstaller(root)
            with mock.patch.object(installer, "detect", return_value=True):
                records = installer.install("local", Path("/tmp/mcp_server/dist/index.js"), "{}")
                self.assertTrue(any(r.get("action") == "install" for r in records))
                self.assertTrue((root / ".codex" / "config.toml").exists())
                self.assertTrue((root / ".codex" / "agentsoul-startup.md").exists())
                self.assertTrue((root / "AGENTS.md").exists())

                status_records = installer.status("local")
                self.assertTrue(any(r.get("registered") for r in status_records))

                uninstall_records = installer.uninstall("local")
                self.assertTrue(any(r.get("action") == "uninstall" for r in uninstall_records))
                self.assertFalse((root / ".codex" / "agentsoul-startup.md").exists())

    def test_trae_status_does_not_depend_on_codex_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            installer = install.TraeInstaller(root)
            # Create codex files only; trae should still report unregistered.
            (root / ".codex").mkdir(parents=True, exist_ok=True)
            (root / ".codex" / "config.toml").write_text("dummy", encoding="utf-8")
            status_before = installer.status("local")
            self.assertTrue(all(not r.get("registered", False) for r in status_before))

            installer.install("local", Path("/tmp/mcp_server/dist/index.js"), "{}")
            status_after = installer.status("local")
            self.assertTrue(any(r.get("registered", False) for r in status_after))


if __name__ == "__main__":
    unittest.main()
