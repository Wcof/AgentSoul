from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
import argparse
from pathlib import Path
from unittest import mock

import install


class TestInstallMcpClients(unittest.TestCase):
    def test_parse_clients_csv(self):
        self.assertEqual(install.parse_clients_csv("all"), ["claude", "codex", "trae"])
        self.assertEqual(install.parse_clients_csv("codex,claude"), ["claude", "codex"])
        with self.assertRaises(ValueError):
            install.parse_clients_csv("foo")

    def test_build_install_plan_profile_and_override_priority(self):
        plan = install.build_install_plan(
            profile="project",
            scope="global",
            clients_csv="codex",
            project_selector=None,
            run_after=False,
        )
        self.assertEqual(plan.matrix.scope, "global")
        self.assertEqual(plan.matrix.clients, ["codex"])

    def test_resolve_project_selector_strict_ambiguous(self):
        metas = [
            {"name": "app-one", "path": "/tmp/a/app-one", "markers": ["AGENTS.md"]},
            {"name": "app-two", "path": "/tmp/b/app-two", "markers": ["AGENTS.md"]},
        ]
        with mock.patch.object(install, "discover_project_metadata", return_value=metas):
            with self.assertRaises(ValueError):
                install.resolve_project_selector("app", "local", "custom", strict=True)

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
        block = install.build_codex_mcp_block(Path("/tmp/apps/mcp-server/dist/index.js"))
        self.assertIn("[mcp_servers.agentsoul]", block)
        self.assertIn('command = "node"', block)
        self.assertIn("dist/index.js", block)

    def test_generate_client_install_markdown_contains_core_sections(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_root = install.PROJECT_ROOT
            install.PROJECT_ROOT = Path(temp_dir)
            try:
                guide = install.generate_client_install_markdown(Path("/tmp/apps/mcp-server/dist/index.js"))
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

    def test_codex_scope_paths_respect_codex_home_env(self):
        root = Path("/tmp/project")
        with mock.patch.dict("os.environ", {"CODEX_HOME": "/tmp/custom-codex-home"}, clear=False):
            paths = install.codex_scope_paths("global", root)
        self.assertEqual(paths, [Path("/tmp/custom-codex-home") / "config.toml"])

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

    def test_trae_scope_paths_include_windows_appdata(self):
        root = Path("/tmp/my-project")
        with mock.patch.dict("os.environ", {"APPDATA": "C:/Users/test/AppData/Roaming"}, clear=False):
            paths = install.trae_scope_paths("global", root)
        self.assertTrue(any("AppData" in str(p) and "Trae" in str(p) for p in paths))

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

    def test_upsert_mcp_server_json_backs_up_invalid_json(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg = Path(temp_dir) / "mcp.json"
            cfg.write_text('{"mcpServers":', encoding="utf-8")
            install._upsert_mcp_server_in_json(
                cfg, "agentsoul", {"command": "node", "args": ["/tmp/a.js"]}
            )
            backups = list(Path(temp_dir).glob("mcp.json.corrupt-*.bak"))
            self.assertTrue(backups)
            self.assertTrue(install._has_mcp_server_in_json(cfg, "agentsoul"))

    def test_find_project_by_name_uses_discovery(self):
        fake_projects = [Path("/tmp/foo"), Path("/tmp/bar/app-one")]
        with mock.patch.object(install, "discover_project_candidates", return_value=fake_projects):
            self.assertEqual(install.find_project_by_name("foo"), Path("/tmp/foo"))
            self.assertEqual(install.find_project_by_name("app-one"), Path("/tmp/bar/app-one"))

    def test_path_scope_label_exact_match(self):
        home = Path.home()
        global_cfg = home / ".codex" / "config.toml"
        local_cfg = home / "Downloads" / "project" / "x" / ".codex" / "config.toml"
        self.assertEqual(install.path_scope_label(global_cfg, global_cfg), "global")
        self.assertEqual(install.path_scope_label(local_cfg, global_cfg), "local")

    def test_claude_mcp_json_paths_include_project_local(self):
        root = Path("/tmp/my-project")
        paths = install.claude_mcp_json_paths("local", root)
        self.assertIn(root / ".mcp.json", paths)

    def test_claude_mcp_json_paths_include_windows_appdata(self):
        root = Path("/tmp/my-project")
        with mock.patch.dict("os.environ", {"APPDATA": "C:/Users/test/AppData/Roaming"}, clear=False):
            paths = install.claude_mcp_json_paths("global", root)
        self.assertTrue(any("AppData" in str(p) and "Claude" in str(p) for p in paths))

    def test_ask_install_mode_default_quick(self):
        with mock.patch("builtins.input", return_value=""):
            self.assertEqual(install.ask_install_mode("quick"), "quick")

    def test_ask_install_mode_select_global(self):
        with mock.patch("builtins.input", return_value="3"):
            self.assertEqual(install.ask_install_mode("quick"), "global")

    def test_selected_client_names(self):
        self.assertEqual(install.selected_client_names("all"), ["claude", "codex", "trae"])
        self.assertEqual(install.selected_client_names("claude"), ["claude"])

    def test_codex_installer_install_and_uninstall_local(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            installer = install.CodexInstaller(root)
            with mock.patch.object(installer, "detect", return_value=True):
                records = installer.install("local", Path("/tmp/apps/mcp-server/dist/index.js"), "{}")
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

            installer.install("local", Path("/tmp/apps/mcp-server/dist/index.js"), "{}")
            status_after = installer.status("local")
            self.assertTrue(any(r.get("registered", False) for r in status_after))

    def test_claude_status_global_fallback_to_user_config(self):
        installer = install.ClaudeInstaller(Path("/tmp/test-project"))
        with mock.patch.object(
            install,
            "run_cli_command_with_fallback",
            return_value=(False, "unknown option --scope"),
        ), mock.patch.object(
            install, "has_claude_user_mcp_server", return_value=True
        ), mock.patch.object(
            install, "load_settings", return_value={}
        ):
            records = installer.status("global")
            self.assertEqual(len(records), 1)
            self.assertTrue(records[0].get("registered"))

    def test_claude_uninstall_auto_fix_config_when_cli_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            installer = install.ClaudeInstaller(root)
            local_cfg = root / ".mcp.json"
            install._upsert_mcp_server_in_json(local_cfg, "agentsoul", {"command": "node", "args": ["/tmp/a.js"]})

            with mock.patch.object(installer, "detect", return_value=True), mock.patch.object(
                install,
                "run_cli_command_with_fallback",
                return_value=(False, "cli failed"),
            ):
                records = installer.uninstall("local")
                self.assertTrue(records[0]["success"])
                self.assertFalse(install._has_mcp_server_in_json(local_cfg, "agentsoul"))

    def test_uninstall_mcp_respects_scope_and_target(self):
        with mock.patch.object(
            install, "uninstall_selected_clients", return_value=[]
        ) as mocked_uninstall, mock.patch.object(
            install, "status_selected_clients", return_value=[{"registered": False}]
        ) as mocked_status:
            ok = install.uninstall_mcp(
                Path("/tmp/project"),
                scope="global",
                target="trae",
            )
            self.assertTrue(ok)
            mocked_uninstall.assert_called_once_with("global", "trae", Path("/tmp/project"))
            mocked_status.assert_called_once_with("global", "trae", Path("/tmp/project"))

    def test_uninstall_mcp_fails_when_uninstall_action_fails(self):
        with mock.patch.object(
            install,
            "uninstall_selected_clients",
            return_value=[{"success": False, "client": "Claude CLI"}],
        ), mock.patch.object(
            install, "status_selected_clients", return_value=[{"registered": False}]
        ):
            ok = install.uninstall_mcp(Path("/tmp/project"), "both", "all")
            self.assertFalse(ok)

    def test_uninstall_mcp_fails_when_registered_still_exists(self):
        with mock.patch.object(
            install,
            "uninstall_selected_clients",
            return_value=[{"success": True, "client": "Codex CLI"}],
        ), mock.patch.object(
            install, "status_selected_clients", return_value=[{"registered": True}]
        ):
            ok = install.uninstall_mcp(Path("/tmp/project"), "both", "all")
            self.assertFalse(ok)

    def test_handle_mcp_install_register_only_requires_dist(self):
        args = argparse.Namespace(
            mcp_command="install",
            profile="custom",
            scope="local",
            clients="claude",
            project=None,
            run=False,
            prepare_only=False,
            register_only=True,
            log=None,
        )
        with mock.patch.object(install, "get_mcp_dist_index", return_value=Path("/tmp/not-exists/index.js")):
            rc = install.handle_mcp_subcommand(args)
            self.assertEqual(rc, 1)

    def test_discover_project_metadata_filters_noise_and_prefers_root(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            repo = root / "real-project"
            repo.mkdir()
            (repo / ".git").mkdir()
            (repo / "pyproject.toml").write_text("[project]\nname='demo'\n", encoding="utf-8")
            (repo / "README.md").write_text("# demo\n", encoding="utf-8")
            nested = repo / "docs" / "child"
            nested.mkdir(parents=True)
            (nested / "AGENTS.md").write_text("child\n", encoding="utf-8")
            noisy = root / ".backup" / "template"
            noisy.mkdir(parents=True)
            (noisy / "AGENTS.md").write_text("ignore\n", encoding="utf-8")

            metas = install._discover_project_metadata(max_depth=4, max_results=20, roots=[root])
            paths = [item["path"] for item in metas]

            self.assertIn(str(repo.resolve()), paths)
            self.assertNotIn(str(nested.resolve()), paths)
            self.assertNotIn(str(noisy.resolve()), paths)

    def test_summarize_component_status_uses_stable_shape(self):
        records = [
            {"client": "Claude CLI", "scope": "local", "registered": True, "detail": "/tmp/.mcp.json"},
            {"client": "Codex CLI", "scope": "global", "registered": False, "detail": "/tmp/config.toml"},
        ]
        components = install.summarize_component_status(records)
        self.assertTrue(all(set(["component", "scope", "status", "checks", "recommended_fix"]).issubset(item.keys()) for item in components))
        self.assertEqual(components[0]["component"], "Claude")

    def test_summarize_component_checks_uses_runtime_component(self):
        checks = [
            {"id": "node", "client": "system", "scope": "global", "status": "ok", "detail": "v20"},
            {"id": "registration", "client": "Trae", "scope": "local", "status": "warn", "detail": "/tmp/.trae/mcp.json"},
        ]
        components = install.summarize_component_checks(checks)
        names = {item["component"] for item in components}
        self.assertIn("Runtime", names)
        self.assertIn("Trae", names)

    def test_cli_help_contracts(self):
        commands = [
            [sys.executable, "install.py", "--help"],
            [sys.executable, "install.py", "mcp", "--help"],
            [sys.executable, "install.py", "mcp", "install", "--help"],
        ]
        for command in commands:
            result = subprocess.run(
                command,
                cwd=install.PROJECT_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("usage:", result.stdout.lower())

    def test_workflow_smoke_contract(self):
        tests_yml = (install.PROJECT_ROOT / ".github" / "workflows" / "tests.yml").read_text(encoding="utf-8")
        health_yml = (install.PROJECT_ROOT / ".github" / "workflows" / "health-check.yml").read_text(encoding="utf-8")
        companionship_yml = (install.PROJECT_ROOT / ".github" / "workflows" / "companionship-check.yml").read_text(encoding="utf-8")

        self.assertIn("actions/checkout@v5", tests_yml)
        self.assertIn("actions/setup-python@v6", tests_yml)
        self.assertIn("fail-fast: false", tests_yml)
        self.assertLess(tests_yml.index("Build MCP server"), tests_yml.index("Test with pytest"))
        self.assertIn("python src/health_check.py --summary-json > health-summary.json", health_yml)
        self.assertIn("python src/companionship_checker.py --summary-json > companionship-summary.json", companionship_yml)


if __name__ == "__main__":
    unittest.main()
