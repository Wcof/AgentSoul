"""
Tests for Entry Capability Detector
==================================
"""
import pytest
from src.entry_detect import (
    detect_environment,
    check_agentsoul_installed,
    get_injection_template,
    generate_report,
    EntryCapability,
)


class TestEntryDetection:
    """Tests for environment detection."""

    def test_detect_environment_returns_capability(self):
        """Test that detect_environment returns a valid EntryCapability."""
        cap = detect_environment()
        assert isinstance(cap, EntryCapability)
        assert isinstance(cap.environment, str)
        assert isinstance(cap.description, str)
        assert isinstance(cap.available_injection_methods, list)
        assert isinstance(cap.has_mcp, bool)
        assert isinstance(cap.has_local_files, bool)
        assert isinstance(cap.notes, str)
        # Should always detect something
        assert len(cap.environment) > 0

    def test_check_agentsoul_installed(self):
        """Test that check_agentsoul_installed detects our install."""
        installed, config_path = check_agentsoul_installed()
        # In this repo, it should be installed
        assert installed is True
        assert config_path == "config/persona.yaml"

    def test_get_injection_template_claude_code(self):
        """Test getting injection template for claude_code."""
        template = get_injection_template("claude_code")
        assert template is not None
        assert "mcp_tool_index" in template
        assert "get_persona_config" in template

    def test_get_injection_template_openai(self):
        """Test getting injection template for openai_codex."""
        template = get_injection_template("openai_codex")
        assert template is not None
        assert "OpenAI Codex" in template
        assert "persona.yaml" in template

    def test_get_injection_template_gemini(self):
        """Test getting injection template for gemini."""
        template = get_injection_template("gemini_code_assist")
        assert template is not None
        assert "Gemini Code Assist" in template
        assert "persona.yaml" in template

    def test_get_injection_template_generic(self):
        """Test getting injection template for generic."""
        template = get_injection_template("generic_local")
        assert template is not None
        assert "Generic Local Environment" in template

    def test_get_injection_template_unknown(self):
        """Test getting injection template for unknown environment returns None."""
        template = get_injection_template("unknown_environment")
        assert template is None

    def test_generate_report(self):
        """Test generate_report returns complete dict."""
        report = generate_report()
        assert "detected" in report
        assert "agentsoul_installed" in report
        assert "config_path" in report
        assert "injection_template" in report
        assert isinstance(report["detected"], EntryCapability)
        assert isinstance(report["agentsoul_installed"], bool)

    def test_module_importable(self):
        """Test that the module can be imported."""
        import src.entry_detect
        assert src.entry_detect is not None
