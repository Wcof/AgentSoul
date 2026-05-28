"""Tests for the persona_kit module."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import yaml

from agentsoul.persona_kit.scaffold import init_persona_kit
from agentsoul.persona_kit.quality_check import PersonaKitChecker, check_persona_kit
from agentsoul.persona_kit.cli import main as cli_main
from agentsoul.config.config_loader import (
    AgentConfig,
    BehaviorConfig,
    ExpressionDNA,
    HonestBoundaries,
    InternalTension,
    CapabilityProfile,
    QualityGates,
    AgenticProtocol,
    ConfigLoader,
)


class TestPersonaKitScaffold:
    """Test persona kit initialization."""

    def test_init_creates_directory_structure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            assert kit_dir.exists()
            assert kit_dir.is_dir()
            assert kit_dir.name == "test-agent"

    def test_init_creates_required_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            for fname in ["package.yaml", "persona.yaml", "behavior.yaml", "SKILL.md", "boundaries.md"]:
                assert (kit_dir / fname).exists(), f"Missing {fname}"

    def test_init_creates_protocols(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            protocols_dir = kit_dir / "protocols"
            assert protocols_dir.is_dir()
            for fname in ["startup-mcp.md", "startup-local-file.md", "startup-static.md"]:
                assert (protocols_dir / fname).exists(), f"Missing protocols/{fname}"

    def test_init_creates_research_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            research_dir = kit_dir / "references" / "research"
            assert research_dir.is_dir()
            assert len(list(research_dir.glob("*.md"))) == 6

    def test_init_creates_test_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            tests_dir = kit_dir / "tests"
            assert tests_dir.is_dir()
            for fname in ["known-scenarios.md", "edge-scenarios.md", "voice-scenarios.md"]:
                assert (tests_dir / fname).exists(), f"Missing tests/{fname}"

    def test_init_persona_yaml_has_name(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("my-agent", output_dir=Path(tmpdir))
            with open(kit_dir / "persona.yaml", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            assert data["agent"]["name"] == "my-agent"

    def test_init_package_yaml_has_metadata(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir),
                                       description="A test agent")
            with open(kit_dir / "package.yaml", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            assert data["name"] == "test-agent"
            assert data["description"] == "A test agent"
            assert data["version"] == "1.0.0"


class TestPersonaKitChecker:
    """Test persona kit quality checking."""

    def test_check_passes_for_complete_kit(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            checker = PersonaKitChecker()
            report = checker.check(kit_dir)
            assert report.passed
            assert report.score >= 70

    def test_check_fails_for_missing_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = Path(tmpdir) / "incomplete"
            kit_dir.mkdir()
            checker = PersonaKitChecker()
            report = checker.check(kit_dir)
            assert not report.passed
            assert report.error_count > 0

    def test_check_fails_for_empty_persona(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            # Overwrite persona.yaml with empty agent
            with open(kit_dir / "persona.yaml", "w", encoding="utf-8") as f:
                yaml.dump({"agent": {"name": "", "role": ""}}, f)
            checker = PersonaKitChecker()
            report = checker.check(kit_dir)
            assert not report.passed

    def test_check_report_to_dict(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            checker = PersonaKitChecker()
            report = checker.check(kit_dir)
            d = report.to_dict()
            assert "kit_path" in d
            assert "score" in d
            assert "passed" in d
            assert "issues" in d

    def test_check_persona_kit_json_output(self, capsys):
        import json
        with tempfile.TemporaryDirectory() as tmpdir:
            kit_dir = init_persona_kit("test-agent", output_dir=Path(tmpdir))
            capsys.readouterr()  # drain init log output
            report = check_persona_kit(kit_dir, summary_json=True)
            captured = capsys.readouterr()
            data = json.loads(captured.out)
            assert data["kit_name"] == "test-agent"


class TestNewDataclasses:
    """Test new config dataclasses."""

    def test_expression_dna_defaults(self):
        edna = ExpressionDNA()
        assert edna.sentence_length == "medium"
        assert edna.question_ratio == "moderate"
        assert edna.certainty_style == "calibrated"

    def test_honest_boundaries_defaults(self):
        hb = HonestBoundaries()
        assert hb.stale_info_policy == "verify_before_answer"
        assert hb.uncertainty_policy == "state_confidence_and_basis"
        assert hb.limitations == []

    def test_internal_tension(self):
        t = InternalTension(name="test", description="desc", resolution_rule="rule")
        assert t.name == "test"

    def test_capability_profile_defaults(self):
        cap = CapabilityProfile()
        assert cap.strong_at == []
        assert cap.weak_at == []

    def test_agent_config_has_new_fields(self):
        ac = AgentConfig()
        assert isinstance(ac.expression_dna, ExpressionDNA)
        assert isinstance(ac.honest_boundaries, HonestBoundaries)
        assert isinstance(ac.internal_tensions, list)
        assert isinstance(ac.capability_profile, CapabilityProfile)

    def test_quality_gates_defaults(self):
        qg = QualityGates()
        assert qg.persona_boundary_required is True
        assert qg.expression_dna_required is True

    def test_agentic_protocol_defaults(self):
        ap = AgenticProtocol()
        assert ap.classify_before_answer is True
        assert ap.confidence_required is True

    def test_behavior_config_has_new_fields(self):
        bc = BehaviorConfig()
        assert isinstance(bc.quality_gates, QualityGates)
        assert isinstance(bc.agentic_protocol, AgenticProtocol)


class TestConfigLoaderNewFields:
    """Test config loader with new fields."""

    def test_load_persona_with_new_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "persona.yaml"
            data = {
                "agent": {
                    "name": "test",
                    "role": "test role",
                    "personality": ["friendly"],
                    "expression_dna": {
                        "sentence_length": "short",
                        "question_ratio": "high",
                        "taboo_phrases": ["不要说这个"],
                    },
                    "honest_boundaries": {
                        "limitations": ["不能做X"],
                        "blind_spots": ["对Y不了解"],
                    },
                    "internal_tensions": [
                        {"name": "tension1", "description": "desc", "resolution_rule": "rule"}
                    ],
                    "capability_profile": {
                        "strong_at": ["A"],
                        "weak_at": ["B"],
                    },
                },
                "master": {"name": "user"},
            }
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f, allow_unicode=True)

            loader = ConfigLoader(project_root=Path(tmpdir))
            config = loader.load_persona_config(config_path)

            assert config.ai.expression_dna.sentence_length == "short"
            assert config.ai.expression_dna.question_ratio == "high"
            assert config.ai.expression_dna.taboo_phrases == ["不要说这个"]
            assert config.ai.honest_boundaries.limitations == ["不能做X"]
            assert len(config.ai.internal_tensions) == 1
            assert config.ai.internal_tensions[0].name == "tension1"
            assert config.ai.capability_profile.strong_at == ["A"]

    def test_load_persona_without_new_fields_is_backward_compatible(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "persona.yaml"
            data = {
                "agent": {
                    "name": "legacy",
                    "role": "legacy role",
                    "personality": ["old"],
                },
                "master": {"name": "user"},
            }
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f)

            loader = ConfigLoader(project_root=Path(tmpdir))
            config = loader.load_persona_config(config_path)

            assert config.ai.name == "legacy"
            assert config.ai.expression_dna.sentence_length == "medium"  # default
            assert config.ai.honest_boundaries.limitations == []  # default
            assert config.ai.internal_tensions == []  # default

    def test_load_behavior_with_new_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "behavior.yaml"
            data = {
                "enabled": True,
                "quality_gates": {
                    "persona_boundary_required": True,
                    "expression_dna_required": False,
                },
                "agentic_protocol": {
                    "classify_before_answer": True,
                    "confidence_required": False,
                },
            }
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f)

            loader = ConfigLoader(project_root=Path(tmpdir))
            config = loader.load_behavior_config(config_path)

            assert config.quality_gates.persona_boundary_required is True
            assert config.quality_gates.expression_dna_required is False
            assert config.agentic_protocol.classify_before_answer is True
            assert config.agentic_protocol.confidence_required is False

    def test_load_behavior_without_new_fields_is_backward_compatible(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "behavior.yaml"
            data = {
                "enabled": True,
                "auto_memory": True,
            }
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f)

            loader = ConfigLoader(project_root=Path(tmpdir))
            config = loader.load_behavior_config(config_path)

            assert config.enabled is True
            assert config.quality_gates.persona_boundary_required is True  # default
            assert config.agentic_protocol.classify_before_answer is True  # default


class TestValidatorNewFields:
    """Test config validator with new fields."""

    def test_validate_expression_dna_valid(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "test",
                "expression_dna": {
                    "sentence_length": "medium",
                    "question_ratio": "moderate",
                    "analogy_density": "low",
                    "certainty_style": "calibrated",
                    "structure_preference": "concise",
                },
            },
        }
        errors = validator.validate(config)
        edna_errors = [e for e in errors if "expression_dna" in e.field]
        assert len(edna_errors) == 0

    def test_validate_expression_dna_invalid(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "test",
                "expression_dna": {
                    "sentence_length": "invalid",
                    "certainty_style": "invalid",
                },
            },
        }
        errors = validator.validate(config)
        edna_errors = [e for e in errors if "expression_dna" in e.field and e.severity == "error"]
        assert len(edna_errors) >= 2

    def test_validate_honest_boundaries(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "test",
                "honest_boundaries": {
                    "limitations": ["limit1"],
                    "stale_info_policy": "verify_before_answer",
                },
            },
        }
        errors = validator.validate(config)
        hb_errors = [e for e in errors if "honest_boundaries" in e.field]
        assert len(hb_errors) == 0

    def test_validate_internal_tensions(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "test",
                "internal_tensions": [
                    {"name": "t1", "description": "d1"},
                    {"name": "", "description": "d2"},  # warning: empty name
                ],
            },
        }
        errors = validator.validate(config)
        tension_errors = [e for e in errors if "internal_tensions" in e.field]
        assert any(e.severity == "warning" for e in tension_errors)

    def test_validate_quality_gates(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "enabled": True,
            "quality_gates": {
                "persona_boundary_required": True,
                "expression_dna_required": "invalid",  # should be bool
            },
        }
        errors = validator.validate(config)
        qg_errors = [e for e in errors if "quality_gates" in e.field]
        assert len(qg_errors) >= 1

    def test_validate_agentic_protocol(self):
        from agentsoul.config.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "enabled": True,
            "agentic_protocol": {
                "classify_before_answer": True,
                "confidence_required": "yes",  # should be bool
            },
        }
        errors = validator.validate(config)
        ap_errors = [e for e in errors if "agentic_protocol" in e.field]
        assert len(ap_errors) >= 1


class TestPersonaKitCLI:
    """Test persona kit CLI commands."""

    def test_cli_init(self, tmp_path):
        kit_dir = tmp_path / "my-kit"
        result = cli_main(["init", "my-kit", "--output-dir", str(tmp_path)])
        assert result == 0
        assert kit_dir.exists()

    def test_cli_validate_pass(self, tmp_path):
        kit_dir = tmp_path / "test-kit"
        init_persona_kit("test-kit", output_dir=tmp_path)
        result = cli_main(["validate", str(kit_dir)])
        assert result == 0

    def test_cli_validate_nonexistent(self, tmp_path):
        result = cli_main(["validate", str(tmp_path / "nonexistent")])
        assert result == 1

    def test_cli_summarize(self, tmp_path):
        init_persona_kit("test-kit", output_dir=tmp_path)
        result = cli_main(["summarize", str(tmp_path / "test-kit")])
        assert result == 0

    def test_cli_apply_with_backup(self, tmp_path, monkeypatch):
        # Set up a kit and a config directory
        kit_dir = tmp_path / "my-kit"
        init_persona_kit("my-kit", output_dir=tmp_path)

        # Create a mock project root with config dir
        config_dir = tmp_path / "config"
        config_dir.mkdir()
        original_persona = {"agent": {"name": "original", "role": "old"}}
        with open(config_dir / "persona.yaml", "w") as f:
            yaml.dump(original_persona, f)
        with open(config_dir / "behavior.yaml", "w") as f:
            yaml.dump({"enabled": True}, f)

        # Monkeypatch get_project_root
        monkeypatch.setattr("agentsoul.persona_kit.cli.get_project_root", lambda: tmp_path)

        result = cli_main(["apply", str(kit_dir)])
        assert result == 0

        # Verify backup was created
        backup_dir = tmp_path / "var" / "persona_kit_backups"
        assert backup_dir.exists()
        backups = list(backup_dir.iterdir())
        assert len(backups) >= 1

        # Verify config was updated
        with open(config_dir / "persona.yaml") as f:
            applied = yaml.safe_load(f)
        assert applied["agent"]["name"] == "my-kit"

    def test_cli_apply_no_backup(self, tmp_path, monkeypatch):
        kit_dir = tmp_path / "my-kit"
        init_persona_kit("my-kit", output_dir=tmp_path)

        config_dir = tmp_path / "config"
        config_dir.mkdir()
        with open(config_dir / "persona.yaml", "w") as f:
            yaml.dump({"agent": {"name": "original"}}, f)

        monkeypatch.setattr("agentsoul.persona_kit.cli.get_project_root", lambda: tmp_path)

        result = cli_main(["apply", str(kit_dir), "--no-backup"])
        assert result == 0

        # No backup should exist
        backup_dir = tmp_path / "var" / "persona_kit_backups"
        assert not backup_dir.exists()

    def test_cli_rollback(self, tmp_path, monkeypatch):
        kit_dir = tmp_path / "my-kit"
        init_persona_kit("my-kit", output_dir=tmp_path)

        config_dir = tmp_path / "config"
        config_dir.mkdir()
        original = {"agent": {"name": "original", "role": "old"}}
        with open(config_dir / "persona.yaml", "w") as f:
            yaml.dump(original, f)

        monkeypatch.setattr("agentsoul.persona_kit.cli.get_project_root", lambda: tmp_path)

        # Apply
        cli_main(["apply", str(kit_dir)])

        # Rollback
        backup_dir = tmp_path / "var" / "persona_kit_backups"
        backup_subdir = next(backup_dir.iterdir())
        result = cli_main(["rollback", str(backup_subdir)])
        assert result == 0

        # Verify original config restored
        with open(config_dir / "persona.yaml") as f:
            restored = yaml.safe_load(f)
        assert restored["agent"]["name"] == "original"

    def test_cli_export(self, tmp_path):
        init_persona_kit("my-kit", output_dir=tmp_path)
        result = cli_main(["export", str(tmp_path / "my-kit")])
        assert result == 0
        assert (tmp_path / "my-kit.zip").exists()
