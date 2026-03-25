#!/usr/bin/env python3
"""
AgentSoul · 单元测试
测试配置加载、隐私扫描、迁移脚本、路径兼容性等核心功能
"""

import unittest
import tempfile
import shutil
from pathlib import Path
from typing import List
import sys
import os

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config_loader import ConfigLoader, create_default_persona
from src.path_compat import PathResolver, resolve_path, convert_legacy_path


class TestConfigLoader(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.config_path = Path(self.test_dir) / "config" / "persona.yaml"
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_default_agent_name(self):
        create_default_persona(self.config_path)
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_agent_name(), "Agent")

    def test_custom_agent_name(self):
        config_content = """agent:
  name: "小明"
  nickname: "明明"
  role: "私人助手"
"""
        self.config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_agent_name(), "小明")
        self.assertEqual(loader.get_agent_nickname(), "明明")

    def test_empty_master_fallback(self):
        config_content = """agent:
  name: "TestAgent"
master:
  name: ""
"""
        self.config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_master_name(), "主人")
        self.assertEqual(loader.get_master_nicknames(), ["主人"])

    def test_master_with_nicknames(self):
        config_content = """agent:
  name: "TestAgent"
master:
  name: "张三"
  nickname:
    - 小三
    - 三哥
"""
        self.config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_master_name(), "张三")
        nicknames = loader.get_master_nicknames()
        self.assertIn("小三", nicknames)
        self.assertIn("三哥", nicknames)

    def test_nickname_comma_separated(self):
        config_content = """agent:
  name: "TestAgent"
master:
  name: "李四"
  nickname: "四四, 小四, 四哥"
"""
        self.config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        nicknames = loader.get_master_nicknames()
        self.assertEqual(len(nicknames), 3)
        self.assertIn("四四", nicknames)

    def test_is_config_valid(self):
        create_default_persona(self.config_path)
        loader = ConfigLoader(Path(self.test_dir))
        self.assertTrue(loader.is_config_valid())

    def test_invalid_config(self):
        loader = ConfigLoader(Path("/nonexistent/path"))
        self.assertFalse(loader.is_config_valid())


class TestConfigLoaderEdgeCases(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_whitespace_name_fallback(self):
        config_content = """agent:
  name: "   "
  nickname: ""
"""
        config_path = Path(self.test_dir) / "config" / "persona.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_agent_name(), "Agent")

    def test_none_name_fallback(self):
        config_content = """agent:
  name:
  nickname:
"""
        config_path = Path(self.test_dir) / "config" / "persona.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_agent_name(), "Agent")

    def test_legacy_format_compatibility(self):
        config_content = """ai:
  name: "旧格式Agent"
  role: "测试角色"
master:
  name: "旧用户"
"""
        config_path = Path(self.test_dir) / "config" / "persona.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(config_content, encoding="utf-8")
        loader = ConfigLoader(Path(self.test_dir))
        self.assertEqual(loader.get_agent_name(), "旧格式Agent")


class TestPathCompat(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.resolver = PathResolver(Path(self.test_dir))

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_legacy_path_conversion(self):
        result = self.resolver.resolve("/xiaonuan/data/memory_bank/test.md", check_existence=False)
        self.assertEqual(result.source_path, "/agent/data/memory_bank/test.md")
        self.assertTrue(result.is_legacy)

    def test_new_path_unchanged(self):
        result = self.resolver.resolve("/agent/data/memory_bank/test.md", check_existence=False)
        self.assertEqual(result.source_path, "/agent/data/memory_bank/test.md")
        self.assertFalse(result.is_legacy)

    def test_relative_path_conversion(self):
        result = self.resolver.resolve("xiaonuan/config/persona.yaml", check_existence=False)
        self.assertEqual(result.source_path, "agent/config/persona.yaml")
        self.assertTrue(result.is_legacy)

    def test_convert_legacy_path(self):
        converted = convert_legacy_path("/xiaonuan/src/SKILL.md")
        self.assertEqual(converted, "/agent/src/SKILL.md")

    def test_no_mapping_unchanged(self):
        result = self.resolver.resolve("data/memory_bank/test.md", check_existence=False)
        self.assertEqual(result.source_path, "data/memory_bank/test.md")
        self.assertFalse(result.is_legacy)

    def test_fallback_to_legacy_when_new_not_exist(self):
        legacy_dir = Path(self.test_dir) / "xiaonuan" / "data"
        legacy_dir.mkdir(parents=True, exist_ok=True)
        legacy_file = legacy_dir / "test.md"
        legacy_file.write_text("test", encoding="utf-8")

        result = self.resolver.resolve("xiaonuan/data/test.md", check_existence=True)
        self.assertTrue(result.found)
        self.assertTrue(result.fallback_used)

    def test_resolve_many(self):
        paths = [
            "/xiaonuan/memory_bank/test1.md",
            "/agent/memory_bank/test2.md",
            "xiaonuan/config/test3.yaml",
        ]
        results = self.resolver.resolve_many(paths)

        self.assertEqual(len(results), 3)
        self.assertTrue(results["/xiaonuan/memory_bank/test1.md"].is_legacy)
        self.assertFalse(results["/agent/memory_bank/test2.md"].is_legacy)

    def test_cache_cleared(self):
        result1 = self.resolver.resolve("/xiaonuan/test.md", check_existence=False)
        self.assertIn("/xiaonuan/test.md", self.resolver._cache)

        self.resolver.clear_cache()
        self.assertNotIn("/xiaonuan/test.md", self.resolver._cache)


class TestMigrationScript(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.source_dir = Path(self.test_dir) / "source"
        self.source_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_convert_persona_config_renames_ai(self):
        from scripts.migrate_from_xiaonuan import XiaonuanMigrator

        source_config = self.source_dir / "persona.yaml"
        source_config.write_text("""persona:
  ai:
    name: "测试Agent"
    nickname: "测"
    role: "测试角色"
  master:
    name: "测试用户"
""", encoding="utf-8")

        migrator = XiaonuanMigrator(self.source_dir)
        converted, warnings = migrator.convert_persona_config(source_config)

        self.assertEqual(converted["agent"]["name"], "测试Agent")
        self.assertEqual(converted["master"]["name"], "测试用户")

    def test_convert_persona_config_resets_xiaonuan_name(self):
        from scripts.migrate_from_xiaonuan import XiaonuanMigrator

        source_config = self.source_dir / "persona.yaml"
        source_config.write_text("""persona:
  ai:
    name: "李小暖"
  master:
    name: "李燈辉"
""", encoding="utf-8")

        migrator = XiaonuanMigrator(self.source_dir)
        converted, warnings = migrator.convert_persona_config(source_config)

        self.assertEqual(converted["agent"]["name"], "Agent")
        self.assertEqual(converted["master"]["name"], "")

        has_warnings = any("李小暖" in w or "李燈辉" in w for w in warnings)
        self.assertTrue(has_warnings)


class TestPrivacyScanner(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.project_root = Path(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_scan_detects_personal_name(self):
        test_file = self.project_root / "test.md"
        test_file.write_text("李燈辉是某人的名字", encoding="utf-8")

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.scan_privacy import PrivacyScanner

        scanner = PrivacyScanner(self.project_root)
        result = scanner.scan_file(test_file)

        self.assertGreater(len(result.findings), 0)
        personal_findings = [f for f in result.findings if f.pattern_name == "个人姓名"]
        self.assertGreater(len(personal_findings), 0)

    def test_scan_detects_nickname(self):
        test_file = self.project_root / "test.md"
        test_file.write_text("辉辉宝宝小暖", encoding="utf-8")

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.scan_privacy import PrivacyScanner

        scanner = PrivacyScanner(self.project_root)
        result = scanner.scan_file(test_file)

        nickname_findings = [f for f in result.findings if f.pattern_name == "昵称/称呼"]
        self.assertGreater(len(nickname_findings), 0)

    def test_scan_clean_file(self):
        test_file = self.project_root / "clean.md"
        test_file.write_text("这是一个干净的测试文件，不包含任何敏感信息。", encoding="utf-8")

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.scan_privacy import PrivacyScanner

        scanner = PrivacyScanner(self.project_root)
        result = scanner.scan_file(test_file)

        self.assertEqual(len(result.findings), 0)


class TestInstallScript(unittest.TestCase):
    def test_install_no_hardcoded_name(self):
        install_path = Path(__file__).parent.parent / "install.py"
        if install_path.exists():
            content = install_path.read_text(encoding="utf-8")
            self.assertNotIn("李燈辉", content)
            self.assertNotIn("辉辉", content)
            self.assertNotIn("宝宝", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)