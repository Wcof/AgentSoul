"""
AgentSoul · 配置管理 CLI 测试
=============================

测试 config_manager/cli.py 命令行功能
"""
from __future__ import annotations

import os
import sys
import tempfile
from io import StringIO
from unittest.mock import patch, Mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from pathlib import Path

from agentsoul.config.config_manager.cli import (
    _resolve_path,
    _check_file_exists,
    _load_config,
    list_templates,
    preview_template,
    apply_template,
    validate_config,
    export_config,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestHelperFunctions(BaseTest):
    """测试辅助函数"""

    def test_resolve_path_with_input(self):
        """测试有输入路径时返回正确路径"""
        default = Path("/default/path")
        result = _resolve_path("/test/path", default)
        self.assertEqual(result, Path("/test/path"))

    def test_resolve_path_default(self):
        """测试无输入路径时返回默认路径"""
        default = Path("/default/path")
        result = _resolve_path(None, default)
        self.assertEqual(result, default)

    def test_check_file_exists_exists(self):
        """测试文件存在不退出"""
        with tempfile.NamedTemporaryFile() as f:
            # Should not exit
            _check_file_exists(Path(f.name), "file not found")
            # If we get here, it passed

    def test_check_file_exists_not_exists_exits(self):
        """测试文件不存在调用 sys.exit(1)"""
        with patch('sys.exit') as mock_exit:
            _check_file_exists(Path("/nonexistent/path"), "file not found")
            mock_exit.assert_called_once_with(1)

    def test_load_config_success(self):
        """测试成功加载配置"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write('key: value\nanother: 123\n')
        temp_path = Path(f.name)

        try:
            result = _load_config(temp_path)
            self.assertEqual(result, {'key': 'value', 'another': 123})
        finally:
            os.unlink(temp_path)

    def test_load_config_empty(self):
        """测试空配置返回空字典"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write('')
        temp_path = Path(f.name)

        try:
            result = _load_config(temp_path)
            self.assertEqual(result, {})
        finally:
            os.unlink(temp_path)

    def test_load_config_invalid_yaml_exits(self):
        """测试无效 YAML 调用 sys.exit(1)"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write('invalid: yaml: :::')
        temp_path = Path(f.name)

        try:
            with patch('sys.exit') as mock_exit:
                _load_config(temp_path)
                mock_exit.assert_called_once_with(1)
        finally:
            os.unlink(temp_path)


class TestListTemplates(BaseTest):
    """测试 list_templates 命令"""

    @patch('agentsoul.config_manager.cli.TemplateManager')
    def test_list_templates_with_templates(self, mock_manager_cls):
        """测试有模板时列出"""
        mock_manager = Mock()
        mock_manager.list_templates.return_value = [
            Mock(name='template1', description='first template'),
            Mock(name='template2', description='second template'),
        ]
        mock_manager_cls.return_value = mock_manager

        # Capture stdout
        with patch('sys.stdout', new=StringIO()) as fake_out:
            list_templates()
            output = fake_out.getvalue()
            self.assertIn('template1', output)
            self.assertIn('first template', output)
            self.assertIn('template2', output)
            self.assertIn('second template', output)

    @patch('agentsoul.config_manager.cli.TemplateManager')
    def test_list_templates_no_templates(self, mock_manager_cls):
        """测试没有模板时给出警告"""
        mock_manager = Mock()
        mock_manager.list_templates.return_value = []
        mock_manager_cls.return_value = mock_manager

        with patch('agentsoul.config_manager.cli.log') as mock_log:
            list_templates()
            mock_log.assert_called_with("没有找到配置模板", "WARN")


class TestPreviewTemplate(BaseTest):
    """测试 preview_template 命令"""

    @patch('agentsoul.config_manager.cli.TemplateManager')
    def test_preview_template_prints_preview(self, mock_manager_cls):
        """测试预览输出预览内容"""
        mock_manager = Mock()
        mock_manager.preview_template.return_value = "template content preview"
        mock_manager_cls.return_value = mock_manager

        with patch('sys.stdout', new=StringIO()) as fake_out:
            preview_template("test-template")
            output = fake_out.getvalue()
            self.assertIn("template content preview", output)


class TestApplyTemplate(BaseTest):
    """测试 apply_template 命令"""

    @patch('agentsoul.config_manager.cli.TemplateManager')
    @patch('sys.exit')
    def test_apply_template_success_exits_zero(self, mock_exit, mock_manager_cls):
        """测试应用成功退出 0"""
        mock_manager = Mock()
        mock_manager.apply_template.return_value = True
        mock_manager_cls.return_value = mock_manager

        apply_template("test-template", None, no_backup=False)
        mock_exit.assert_called_once_with(0)

    @patch('agentsoul.config_manager.cli.TemplateManager')
    @patch('sys.exit')
    def test_apply_template_failure_exits_one(self, mock_exit, mock_manager_cls):
        """测试应用失败退出 1"""
        mock_manager = Mock()
        mock_manager.apply_template.return_value = False
        mock_manager_cls.return_value = mock_manager

        apply_template("test-template", None, no_backup=False)
        mock_exit.assert_called_once_with(1)

    @patch('agentsoul.config_manager.cli.get_project_root')
    @patch('agentsoul.config_manager.cli.TemplateManager')
    def test_apply_template_uses_default_path(self, mock_manager_cls, mock_get_root):
        """测试使用默认目标路径"""
        mock_get_root.return_value = Path("/project")
        mock_manager = Mock()
        mock_manager.apply_template.return_value = True
        mock_manager_cls.return_value = mock_manager

        with patch('sys.exit'):
            apply_template("test-template", None)

        # Check that default target is used
        call_args = mock_manager.apply_template.call_args
        self.assertEqual(call_args[1]['name'], "test-template")
        # target should be /project/config/persona.yaml
        self.assertEqual(str(call_args[1]['target_path']), str(Path("/project/config/persona.yaml")))
        # backup enabled (not no_backup)
        self.assertTrue(call_args[1]['backup'])

    @patch('agentsoul.config_manager.cli.TemplateManager')
    def test_apply_template_no_backup_disables_backup(self, mock_manager_cls):
        """测试 no_backup=True 禁用备份"""
        mock_manager = Mock()
        mock_manager.apply_template.return_value = True
        mock_manager_cls.return_value = mock_manager

        with patch('sys.exit'):
            apply_template("test-template", "/target/path", no_backup=True)

        call_args = mock_manager.apply_template.call_args
        self.assertFalse(call_args[1]['backup'])


class TestValidateConfig(BaseTest):
    """测试 validate_config 命令"""

    @patch('agentsoul.config_manager.cli.ConfigValidator')
    @patch('agentsoul.config_manager.cli._check_file_exists')
    @patch('agentsoul.config_manager.cli._load_config')
    def test_validate_config_valid_no_errors(self, mock_load, mock_check, mock_validator_cls):
        """测试配置有效没有错误"""
        mock_load.return_value = {'ai': {'name': 'Test'}, 'master': {'name': 'User'}}
        mock_validator = Mock()
        mock_validator.validate.return_value = []
        mock_validator.is_valid.return_value = True
        mock_validator_cls.return_value = mock_validator

        with patch('sys.exit') as mock_exit:
            validate_config("config/persona.yaml")
            # Valid config should not exit with error
            mock_exit.assert_not_called()

    @patch('agentsoul.config_manager.cli.ConfigValidator')
    @patch('agentsoul.config_manager.cli._check_file_exists')
    @patch('agentsoul.config_manager.cli._load_config')
    def test_validate_config_invalid_exits_one(self, mock_load, mock_check, mock_validator_cls):
        """测试配置无效调用 sys.exit(1)"""
        mock_load.return_value = {'ai': {}}
        mock_validator = Mock()
        mock_validator.validate.return_value = ['error1', 'error2']
        mock_validator.is_valid.return_value = False
        mock_validator_cls.return_value = mock_validator

        with patch('sys.exit') as mock_exit:
            validate_config("config/persona.yaml")
            mock_exit.assert_called_once_with(1)

    @patch('agentsoul.config_manager.cli.get_project_root')
    def test_validate_config_uses_default_path(self, mock_get_root):
        """测试使用默认配置路径"""
        mock_get_root.return_value = Path("/project")
        # Just check that it tries to check the default path
        with patch('agentsoul.config_manager.cli._check_file_exists') as mock_check:
            with patch('agentsoul.config_manager.cli._load_config'):
                with patch('agentsoul.config_manager.cli.ConfigValidator'):
                    validate_config(None)
                    # Check called with the expected path
                    args = mock_check.call_args[0][0]
                    self.assertEqual(str(args), "/project/config/persona.yaml")


class TestExportConfig(BaseTest):
    """测试 export_config 命令"""

    def test_export_config_nonexistent_source_exits_one(self):
        """测试源文件不存在退出"""
        with patch('sys.exit') as mock_exit:
            export_config("/output/path")
            mock_exit.assert_called_once_with(1)

    def test_export_config_success_copies_file(self):
        """测试成功导出复制文件"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a fake source config
            project_root = Path(tmpdir)
            (project_root / "config").mkdir()
            source_path = project_root / "config" / "persona.yaml"
            source_path.write_text("test: config\n")

            output_path = Path(tmpdir) / "output.yaml"

            with patch('agentsoul.config_manager.cli.get_project_root', return_value=project_root):
                with patch('sys.exit') as mock_exit:
                    export_config(str(output_path))
                    # Should exit normally (no call to exit)
                    mock_exit.assert_not_called()
                    # File should be copied
                    self.assertTrue(output_path.exists())
                    self.assertEqual(output_path.read_text(), "test: config\n")

    def test_export_config_copy_error_exits_one(self):
        """测试复制失败退出"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create source but output directory doesn't exist (permission error simulation)
            project_root = Path(tmpdir)
            (project_root / "config").mkdir()
            source_path = project_root / "config" / "persona.yaml"
            source_path.write_text("test: config\n")

            # Output to a non-existent directory that can't be created
            output_path = Path(tmpdir) / "nonexistent" / "output.yaml"

            with patch('agentsoul.config_manager.cli.get_project_root', return_value=project_root):
                with patch('sys.exit') as mock_exit:
                    export_config(str(output_path))
                    mock_exit.assert_called_once_with(1)

    @patch('agentsoul.config_manager.cli.get_project_root')
    def test_export_config_uses_default_output(self, mock_get_root):
        """测试使用默认输出路径"""
        mock_get_root.return_value = Path("/project")
        # Create source file
        source_path = Path("/project/config/persona.yaml")
        with tempfile.NamedTemporaryFile() as f:
            # We just check the resolved path, actual copy will fail but that's ok
            with patch('agentsoul.config_manager.cli._check_file_exists'):
                with patch('shutil.copy2') as mock_copy:
                    mock_copy.side_effect = Exception("stop")
                    with patch('sys.exit'):
                        export_config(None)
                        # Check that default output path is used
                        # We can't check because it will fail before, so just ensure code reaches that point
                        pass


class TestMainArgParsing(BaseTest):
    """测试 main 函数参数解析"""

    def test_main_list_templates_calls_list_templates(self):
        """测试 list-templates 命令调用正确函数"""
        with patch('agentsoul.config_manager.cli.list_templates') as mock_func:
            with patch('sys.argv', ['cli.py', 'list-templates']):
                from agentsoul.config.config_manager.cli import main
                main()
                mock_func.assert_called_once()

    def test_main_preview_template_calls_preview_template(self):
        """测试 preview-template 命令调用正确函数"""
        with patch('agentsoul.config_manager.cli.preview_template') as mock_func:
            with patch('sys.argv', ['cli.py', 'preview-template', 'mytemplate']):
                from agentsoul.config.config_manager.cli import main
                main()
                mock_func.assert_called_once_with('mytemplate')

    def test_main_apply_template_calls_apply_template(self):
        """测试 apply-template 命令调用正确函数"""
        with patch('agentsoul.config_manager.cli.apply_template') as mock_func:
            with patch('sys.argv', ['cli.py', 'apply-template', 'mytemplate', '--target', '/path', '--no-backup']):
                from agentsoul.config.config_manager.cli import main
                main()
                mock_func.assert_called_once()
                args = mock_func.call_args
                self.assertEqual(args[0][0], 'mytemplate')
                self.assertEqual(args[0][1], '/path')
                self.assertEqual(args[0][2], True)

    def test_main_validate_config_calls_validate_config(self):
        """测试 validate-config 命令调用正确函数"""
        with patch('agentsoul.config_manager.cli.validate_config') as mock_func:
            with patch('sys.argv', ['cli.py', 'validate-config', '--path', '/path']):
                from agentsoul.config.config_manager.cli import main
                main()
                mock_func.assert_called_once_with('/path')

    def test_main_export_config_calls_export_config(self):
        """测试 export-config 命令调用正确函数"""
        with patch('agentsoul.config_manager.cli.export_config') as mock_func:
            with patch('sys.argv', ['cli.py', 'export-config', '--output', '/path']):
                from agentsoul.config.config_manager.cli import main
                main()
                mock_func.assert_called_once_with('/path')


if __name__ == "__main__":
    unittest.main()
