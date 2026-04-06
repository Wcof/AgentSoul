"""
AgentSoul · 测试 config_manager/cli.py
=============================

单元测试用于 config_manager CLI 模块
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from typing import Any
from io import StringIO

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config_manager import cli


class TestConfigManagerCli:
    """测试 config_manager/cli.py 模块"""

    def test__resolve_path(self):
        """测试 _resolve_path 函数"""
        default = Path("/default/path")

        # 提供路径时返回对应 Path
        result = cli._resolve_path("/test/path", default)
        assert result == Path("/test/path")

        # 不提供路径时返回默认
        result = cli._resolve_path(None, default)
        assert result == default

    def test__check_file_exists_exists(self, capsys):
        """测试 _check_file_exists 文件存在"""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.close()
            try:
                # 文件存在不应退出
                cli._check_file_exists(Path(f.name), "test error")
                # 到达这里说明没有 sys.exit
                assert True
            finally:
                Path(f.name).unlink()

    def test__load_config_success(self):
        """测试 _load_config 成功读取 yaml"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "test.yaml"
            config_data = {"key": "value", "number": 42}
            import yaml
            with open(config_path, "w", encoding="utf-8") as f:
                yaml.dump(config_data, f)

            result = cli._load_config(config_path)
            assert result == config_data

    def test_module_importable(self):
        """测试模块可导入"""
        from src.config_manager.cli import main
        assert main is not None
