"""
AgentSoul · 配置模板管理测试
=============================

测试 src/config_manager/templates.py TemplateManager
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentsoul.config.config_manager.templates import (
    ConfigTemplate,
    TemplateManager,
    get_template,
    list_templates,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestConfigTemplate(BaseTest):
    """测试 ConfigTemplate dataclass"""

    def test_template_creation(self):
        """测试创建模板对象"""
        template = ConfigTemplate(
            name="friendly",
            description="Friendly AI assistant",
            config={"ai": {"name": "Test"}},
            file_path=Path("/test/friendly.yaml")
        )
        self.assertEqual(template.name, "friendly")
        self.assertEqual(template.description, "Friendly AI assistant")
        self.assertEqual(template.config["ai"]["name"], "Test")
        self.assertEqual(template.file_path, Path("/test/friendly.yaml"))


class TestTemplateManager(BaseTest):
    """测试 TemplateManager"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        self.templates_dir = self.project_root / "config" / "templates"
        self.templates_dir.mkdir(parents=True)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_default_templates_dir(self):
        """测试默认模板目录初始化"""
        with patch('src.config_manager.templates.get_project_root', return_value=self.project_root):
            manager = TemplateManager()
            self.assertEqual(manager.templates_dir, self.project_root / "config" / "templates")

    def test_init_custom_templates_dir(self):
        """测试自定义模板目录初始化"""
        custom_dir = self.project_root / "custom-templates"
        manager = TemplateManager(templates_dir=custom_dir)
        self.assertEqual(manager.templates_dir, custom_dir)

    def test_list_templates_empty_when_no_templates(self):
        """测试没有模板返回空列表"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        templates = manager.list_templates()
        self.assertEqual(len(templates), 0)

    def test_list_templates_with_templates(self):
        """测试列出多个模板"""
        # Create two valid templates
        (self.templates_dir / "friendly.yaml").write_text("""
agent:
  name: Friendly
  role: Friendly Assistant
  personality:
    - friendly
    - helpful
""")
        (self.templates_dir / "professional.yaml").write_text("""
agent:
  name: Professional
  role: Professional Assistant
  personality:
    - professional
    - precise
""")

        manager = TemplateManager(templates_dir=self.templates_dir)
        templates = manager.list_templates()
        # Should be sorted by name
        self.assertEqual(len(templates), 2)
        self.assertEqual(templates[0].name, "friendly")
        self.assertEqual(templates[1].name, "professional")

    def test_list_templates_skips_invalid(self):
        """测试跳过无效模板文件"""
        (self.templates_dir / "valid.yaml").write_text("agent:\n  name: Valid\n")
        (self.templates_dir / "invalid.yaml").write_text("invalid: yaml: :::")

        manager = TemplateManager(templates_dir=self.templates_dir)
        with patch('src.config_manager.templates.log') as mock_log:
            templates = manager.list_templates()
            # Only valid should be loaded
            self.assertEqual(len(templates), 1)
            self.assertEqual(templates[0].name, "valid")
            # Should log a warning
            log_output = str(mock_log.call_args_list)
            self.assertTrue(
                "Failed to load template" in log_output or "Error loading template" in log_output
            )

    def test_get_template_found(self):
        """测试找到模板"""
        (self.templates_dir / "friendly.yaml").write_text("agent:\n  name: Friendly\n")
        manager = TemplateManager(templates_dir=self.templates_dir)
        template = manager.get_template("friendly")
        self.assertIsNotNone(template)
        self.assertEqual(template.name, "friendly")

    def test_get_template_not_found(self):
        """测试找不到模板返回 None"""
        (self.templates_dir / "friendly.yaml").write_text("agent:\n  name: Friendly\n")
        manager = TemplateManager(templates_dir=self.templates_dir)
        template = manager.get_template("nonexistent")
        self.assertIsNone(template)

    def test_get_template_case_insensitive(self):
        """测试模板查找大小写不敏感"""
        (self.templates_dir / "Friendly.yaml").write_text("agent:\n  name: Friendly\n")
        manager = TemplateManager(templates_dir=self.templates_dir)
        template = manager.get_template("friendly")
        self.assertIsNotNone(template)
        self.assertEqual(template.name, "Friendly")

    def test_preview_template_found(self):
        """测试预览找到的模板"""
        (self.templates_dir / "friendly.yaml").write_text("""
agent:
  name: Friendly
  role: Friendly Assistant
  personality:
    - friendly
""")
        manager = TemplateManager(templates_dir=self.templates_dir)
        preview = manager.preview_template("friendly")
        self.assertIn("=== 模板: friendly ===", preview)
        self.assertIn("Friendly Assistant", preview)
        self.assertIn("friendly", preview)

    def test_preview_template_not_found(self):
        """测试预览不存在的模板"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        preview = manager.preview_template("nonexistent")
        self.assertIn("not found", preview)

    def test_apply_template_success(self):
        """测试成功应用模板"""
        (self.templates_dir / "test.yaml").write_text("""
agent:
  name: TestAgent
  role: Test Assistant
""")
        manager = TemplateManager(templates_dir=self.templates_dir)

        target_dir = self.project_root / "config"
        target_dir.mkdir(exist_ok=True)
        target_path = target_dir / "persona.yaml"

        result = manager.apply_template("test", target_path, backup=False)
        self.assertTrue(result)
        self.assertTrue(target_path.exists())
        content = target_path.read_text()
        self.assertIn("TestAgent", content)

    def test_apply_template_with_backup(self):
        """测试应用模板创建备份"""
        (self.templates_dir / "test.yaml").write_text("agent:\n  name: New\n")
        manager = TemplateManager(templates_dir=self.templates_dir)

        target_dir = self.project_root / "config"
        target_dir.mkdir(exist_ok=True)
        target_path = target_dir / "persona.yaml"
        target_path.write_text("original content")

        result = manager.apply_template("test", target_path, backup=True)
        self.assertTrue(result)
        # Backup should exist
        backup_files = list(target_dir.glob("*.backup.*"))
        self.assertEqual(len(backup_files), 1)

    def test_apply_template_not_found(self):
        """测试应用不存在的模板返回 False"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        result = manager.apply_template("nonexistent", Path("/target/path"))
        self.assertFalse(result)

    def test_invalidate_cache_clears_cache(self):
        """测试清除缓存"""
        (self.templates_dir / "test.yaml").write_text("agent:\n  name: Test\n")
        manager = TemplateManager(templates_dir=self.templates_dir)
        # First load caches
        manager.list_templates()
        self.assertIsNotNone(manager._templates_cache)
        # Invalidate
        manager.invalidate_cache()
        self.assertIsNone(manager._templates_cache)

    def test_refresh_cache_calls_invalidate(self):
        """测试refresh_cache 别名调用 invalidate"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        with patch.object(manager, 'invalidate_cache') as mock_invalidate:
            manager.refresh_cache()
            mock_invalidate.assert_called_once()

    def test__extract_description_with_personality(self):
        """测试提取描述带个性"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        config = {
            "agent": {
                "role": "Friendly Assistant",
                "personality": ["friendly", "helpful"]
            }
        }
        desc = manager._extract_description(config)
        self.assertEqual(desc, "Friendly Assistant - friendly, helpful")

    def test__extract_description_no_personality(self):
        """测试提取描述不带个性"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        config = {
            "agent": {
                "role": "Professional Assistant"
            }
        }
        desc = manager._extract_description(config)
        self.assertEqual(desc, "Professional Assistant")

    def test__load_template_success(self):
        """测试成功加载模板"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        yaml_path = self.templates_dir / "test.yaml"
        yaml_path.write_text("""
agent:
  name: Test
  role: Test Assistant
""")
        template = manager._load_template(yaml_path)
        self.assertIsNotNone(template)
        self.assertEqual(template.name, "test")
        self.assertEqual(template.config["agent"]["name"], "Test")

    def test__load_template_file_not_exists(self):
        """测试加载不存在文件返回 None"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        template = manager._load_template(Path(self.templates_dir / "nonexistent.yaml"))
        self.assertIsNone(template)

    def test__load_template_exception_returns_none(self):
        """测试加载异常返回 None"""
        manager = TemplateManager(templates_dir=self.templates_dir)
        yaml_path = self.templates_dir / "invalid.yaml"
        yaml_path.write_text("invalid: : yaml")
        with patch('src.config_manager.templates.log') as mock_log:
            template = manager._load_template(yaml_path)
            self.assertIsNone(template)
            self.assertTrue(any("Error loading template" in str(call) for call in mock_log.call_args_list))

    def test_cache_returns_cached_when_valid(self):
        """测试缓存有效时返回缓存"""
        (self.templates_dir / "test.yaml").write_text("agent:\n  name: Test\n")
        manager = TemplateManager(templates_dir=self.templates_dir)
        # First call
        first = manager.list_templates(use_cache=True)
        # Second call should use cache
        second = manager.list_templates(use_cache=True)
        self.assertEqual(len(first), len(second))


class TestConvenienceFunctions(BaseTest):
    """测试便利函数"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        self.templates_dir = self.project_root / "config" / "templates"
        self.templates_dir.mkdir(parents=True)
        (self.templates_dir / "friendly.yaml").write_text("agent:\n  name: Friendly\n")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_get_template_convenience(self):
        """测试便利函数 get_template"""
        with patch('src.config_manager.templates.get_project_root', return_value=self.project_root):
            template = get_template("friendly")
            self.assertIsNotNone(template)
            self.assertEqual(template.name, "friendly")

    def test_list_templates_convenience_updates_global(self):
        """测试便利函数 list_templates 更新全局变量"""
        import agentsoul.config.config_manager.templates as templates_module
        with patch('src.config_manager.templates.get_project_root', return_value=self.project_root):
            # Clear global for test
            templates_module.PERSONA_TEMPLATES.clear()

            templates = list_templates()
            self.assertEqual(len(templates), 1)
            self.assertEqual(len(templates_module.PERSONA_TEMPLATES), 1)
            self.assertEqual(templates_module.PERSONA_TEMPLATES[0], "friendly")


if __name__ == "__main__":
    unittest.main()
