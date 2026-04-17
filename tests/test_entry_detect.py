"""
Tests for Entry Capability Detector
==================================
"""
import os
import pytest
from agentsoul.runtime.entry_detect import (
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
        assert config_path is not None
        # Should end with config/persona.yaml regardless of working directory
        assert config_path.endswith("config/persona.yaml")

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
        import agentsoul.runtime.entry_detect
        assert src.entry_detect is not None

    def test_main_help_flag(self):
        """Test main function with --help flag exits with 0."""
        import agentsoul.runtime.entry_detect
        import sys
        original_argv = sys.argv
        try:
            sys.argv = ["entry_detect.py", "--help"]
            with pytest.raises(SystemExit) as excinfo:
                src.entry_detect.main()
            assert excinfo.value.code == 0
        finally:
            sys.argv = original_argv

    def test_main_no_args(self):
        """Test main function without arguments runs print_report."""
        import agentsoul.runtime.entry_detect
        import sys
        original_argv = sys.argv
        try:
            sys.argv = ["entry_detect.py"]
            # Just check it doesn't crash - output goes to stdout
            src.entry_detect.main()
            # If we get here, it succeeded
            assert True
        finally:
            sys.argv = original_argv


class TestEnvironmentDetectionBranches:
    """Tests for specific environment detection branches."""

    def test_detect_git_dir_env(self, monkeypatch):
        """Test detection when GIT_DIR is set (Claude Code)."""
        monkeypatch.setenv("GIT_DIR", ".git")
        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "claude_code"
        assert cap.has_mcp is True
        assert cap.has_local_files is True
        assert "mcp" in cap.available_injection_methods

    def test_detect_mcp_server_env(self, monkeypatch):
        """Test detection when MCP_SERVER_NAME is set."""
        monkeypatch.setenv("MCP_SERVER_NAME", "agentsoul")
        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "mcp_server"
        assert cap.has_mcp is True
        assert cap.has_local_files is True

    def test_detect_openai_api_key_env(self, monkeypatch):
        """Test detection when OPENAI_API_KEY is set but not CODER."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        # Clear CODER
        if "CODER" in os.environ:
            monkeypatch.delenv("CODER")
        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "openai_codex"
        assert cap.has_mcp is False
        assert cap.has_local_files is True

    def test_detect_gemini_credentials_env(self, monkeypatch):
        """Test detection when GOOGLE_APPLICATION_CREDENTIALS is set."""
        monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/path/to/creds.json")
        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "gemini_code_assist"
        assert cap.has_mcp is False
        assert cap.has_local_files is True

    def test_detect_gemini_api_key_env(self, monkeypatch):
        """Test detection when GEMINI_API_KEY is set."""
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")
        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "gemini_code_assist"
        assert cap.has_mcp is False
        assert cap.has_local_files is True

    def test_detect_generic_local_dir_list_exception(self, monkeypatch):
        """Test generic detection when os.listdir fails (no permission)."""
        # Clear all specific env vars to fall back to generic
        for env_var in ["GIT_DIR", "MCP_SERVER_NAME", "OPENAI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GEMINI_API_KEY"]:
            if env_var in os.environ:
                monkeypatch.delenv(env_var)

        # Monkeypatch os.listdir to raise exception
        original_listdir = os.listdir
        def mock_listdir(_):
            raise PermissionError("Permission denied")

        monkeypatch.setattr(os, "listdir", mock_listdir)

        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.environment == "generic_local"
        assert cap.has_local_files is False
        assert "local-files" in cap.available_injection_methods
        assert "markdown-injection" not in cap.available_injection_methods

    def test_check_agentsoul_not_installed(self, tmp_path, monkeypatch):
        """Test check_agentsoul_installed when not installed."""
        # Change to temp directory with no config
        import os
        original_cwd = os.getcwd()
        os.chdir(tmp_path)
        try:
            from agentsoul.runtime.entry_detect import check_agentsoul_installed
            installed, config_path = check_agentsoul_installed()
            assert installed is False
            assert config_path is None
        finally:
            os.chdir(original_cwd)

    def test_generic_local_no_local_files(self, monkeypatch):
        """Test generic local when has_local_files is false - available methods should not include markdown-injection."""
        # Clear all specific env vars
        for env_var in ["GIT_DIR", "MCP_SERVER_NAME", "OPENAI_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GEMINI_API_KEY"]:
            if env_var in os.environ:
                monkeypatch.delenv(env_var)

        # Make os.listdir fail
        original_listdir = os.listdir
        def mock_listdir(_):
            raise PermissionError("Permission denied")
        monkeypatch.setattr(os, "listdir", mock_listdir)

        from agentsoul.runtime.entry_detect import detect_environment
        cap = detect_environment()
        assert cap.has_local_files is False
        assert cap.available_injection_methods == ["local-files"]
        assert "markdown-injection" not in cap.available_injection_methods
