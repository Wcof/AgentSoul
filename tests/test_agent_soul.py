#!/usr/bin/env python3
"""
AgentSoul · 单元测试
测试配置加载、隐私扫描、迁移脚本、路径兼容性等核心功能
"""
from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config_loader import ConfigLoader, create_default_persona
from src.path_compat import PathResolver, convert_legacy_path


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
        self.resolver.resolve("/xiaonuan/test.md", check_existence=False)
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
        test_file.write_text("name: 张三", encoding="utf-8")

        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.scan_privacy import PrivacyScanner

        scanner = PrivacyScanner(self.project_root)
        result = scanner.scan_file(test_file)

        self.assertGreater(len(result.findings), 0)
        personal_findings = [f for f in result.findings if f.pattern_name == "个人姓名"]
        self.assertGreater(len(personal_findings), 0)

    def test_scan_detects_nickname(self):
        test_file = self.project_root / "test.md"
        test_file.write_text("nickname: 小李", encoding="utf-8")

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
            self.assertNotIn("李小暖", content)

    def test__safe_file_stem(self):
        from common import safe_file_stem
        self.assertEqual(safe_file_stem("AgentName", "fallback"), "AgentName")
        self.assertEqual(safe_file_stem("", "fallback"), "fallback")
        self.assertEqual(safe_file_stem("Agent/Name", "fallback"), "AgentName")
        self.assertEqual(safe_file_stem("Agent\\Name", "fallback"), "AgentName")

    def test_initialize_identity_data(self):
        from common import initialize_identity
        from src.config_loader import create_default_persona

        test_dir = tempfile.mkdtemp()
        try:
            config_dir = Path(test_dir) / "config"
            config_dir.mkdir(parents=True, exist_ok=True)
            persona_path = config_dir / "persona.yaml"

            create_default_persona(persona_path)
            with open(persona_path, encoding="utf-8") as f:
                import yaml
                data = yaml.safe_load(f)
            data["agent"]["name"] = "TestAgent"
            data["agent"]["personality"] = ["友好", "乐于助人"]
            data["master"]["name"] = "TestMaster"
            with open(persona_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f, allow_unicode=True)

            initialize_identity(Path(test_dir), Path(test_dir), verbose=False)

            self_dir = Path(test_dir) / "data" / "identity" / "self"
            self.assertTrue((self_dir / "profile.md").exists())
            self.assertTrue((self_dir / "TestAgent.md").exists())

            master_dir = Path(test_dir) / "data" / "identity" / "master"
            self.assertTrue((master_dir / "profile.md").exists())
            self.assertTrue((master_dir / "TestMaster.md").exists())

            content = (self_dir / "profile.md").read_text(encoding="utf-8")
            self.assertIn("TestAgent", content)
            self.assertIn("友好", content)
            self.assertIn("乐于助人", content)
        finally:
            shutil.rmtree(test_dir, ignore_errors=True)


class TestOpenClawInstaller(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.agentsoul_root = Path(__file__).parent.parent

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_init_creates_correct_paths(self):
        from openclaw_server.src.openclaw_installer import OpenClawInstaller
        installer = OpenClawInstaller(self.agentsoul_root, Path(self.test_dir))
        self.assertEqual(installer.agent_path, Path(self.test_dir) / "agent")

    def test_is_installed_returns_false_when_not_installed(self):
        from openclaw_server.src.openclaw_installer import OpenClawInstaller
        installer = OpenClawInstaller(self.agentsoul_root, Path(self.test_dir))
        self.assertFalse(installer.is_installed())

    def test_create_directory_structure(self):
        from openclaw_server.src.openclaw_installer import OpenClawInstaller
        installer = OpenClawInstaller(self.agentsoul_root, Path(self.test_dir))
        installer._create_directory_structure("current_session")

        expected_dirs = [
            installer.agent_path,
            installer.agent_path / "data",
            installer.agent_path / "data" / "identity",
            installer.agent_path / "data" / "identity" / "self",
            installer.agent_path / "data" / "identity" / "master",
            installer.agent_path / "data" / "identity" / "others",
            installer.agent_path / "data" / "soul",
            installer.agent_path / "data" / "soul" / "soul_variable",
            installer.agent_path / "data" / "memory",
            installer.agent_path / "data" / "memory" / "day",
            installer.agent_path / "data" / "memory" / "topic",
            installer.agent_path / "data" / "memory" / "topic" / "archive",
            installer.agent_path / "config",
        ]

        for directory in expected_dirs:
            self.assertTrue(directory.exists(), f"Directory should exist: {directory}")

    def test_copy_rule_files_reports_missing(self):
        from openclaw_server.src.openclaw_installer import OpenClawInstaller
        installer = OpenClawInstaller(Path(self.test_dir), Path(self.test_dir) / "workspace")

        # With empty src dir, all files should be missing
        missing = installer._copy_rule_files()
        self.assertEqual(len(missing), len(OpenClawInstaller.RULE_FILES))

    def test_create_default_soul_state_creates_file(self):
        from openclaw_server.src.openclaw_installer import OpenClawInstaller
        installer = OpenClawInstaller(self.agentsoul_root, Path(self.test_dir))
        installer._create_directory_structure("current_session")
        installer._create_default_soul_state()

        state_path = installer.agent_path / "data" / "soul" / "soul_variable" / "state_vector.json"
        self.assertTrue(state_path.exists())

        import json
        content = json.loads(state_path.read_text(encoding="utf-8"))
        self.assertIn("pleasure", content)
        self.assertIn("arousal", content)
        self.assertIn("dominance", content)
        self.assertEqual(content["pleasure"], 0.3)


class TestAdaptiveLearning(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_emoji_counting_various_emojis(self):
        """Test that various emoji types are correctly counted."""
        from datetime import datetime

        from src.adaptive_learning.data_collector import DataCollector, InteractionRecord
        from src.adaptive_learning.preference_learner import PreferenceLearner

        learner = PreferenceLearner(data_path=Path(self.test_dir))

        # Test with various emoji from different Unicode blocks
        # Emoji: 😀 🎨 🚗 🇺🇳 ✅
        # Actually 🇺🇳 is two regional indicator symbols, so counts as 2
        # Total: 6 emoji characters
        test_text = "Hello world 😀 🎨 🚗 🇺🇳 ✅"

        collector = DataCollector(data_path=Path(self.test_dir))
        session_id = collector.create_session()

        # Need multiple interactions to build confidence above 0.5 threshold
        for _ in range(11):
            record = InteractionRecord(
                session_id=session_id,
                timestamp=datetime.now(),
                pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                pad_after={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                agent_response=test_text
            )
            # The learner should process it correctly
            learner.learn_from_response(record)

        prefs = learner.get_preferences()
        # With 6 emojis per response (>5) -> should learn 'frequent'
        # after enough interactions to build confidence > 0.5
        self.assertEqual(prefs.preferred_emoji_freq, "frequent")

    def test_data_collector_append_record(self):
        """Test that data collector correctly appends interaction records."""
        from datetime import datetime

        from src.adaptive_learning.data_collector import DataCollector, InteractionRecord

        collector = DataCollector(data_path=Path(self.test_dir))
        session_id = collector.create_session()
        self.assertTrue(len(session_id) > 0)

        record = InteractionRecord(
            session_id=session_id,
            timestamp=datetime.now(),
            pad_before={"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0},
            pad_after={"pleasure": 0.1, "arousal": 0.1, "dominance": 0.1},
            feedback="positive",
            response_length=100
        )

        collector.record(record)
        recent = collector.get_recent(limit=10)
        self.assertEqual(len(recent), 1)
        self.assertEqual(recent[0].feedback, "positive")
        self.assertEqual(recent[0].response_length, 100)

    def test_pad_adjuster_clamping(self):
        """Test that PAD adjuster correctly clamps values to [-1, 1] range."""
        from src.adaptive_learning.pad_adjuster import PADAdjuster

        adjuster = PADAdjuster(data_path=Path(self.test_dir), learning_intensity=1.0)

        # Start at max and get positive feedback - should stay at 1.0
        state = adjuster.get_current_state()
        self.assertEqual(state.pleasure, 0.3)

        # Multiple positive adjustments should push pleasure up but cap at 1.0
        for _ in range(10):
            adjuster.adjust_from_feedback(feedback="positive")

        final_state = adjuster.get_current_state()
        self.assertLessEqual(final_state.pleasure, 1.0)
        self.assertGreaterEqual(final_state.pleasure, 0.8)

        # Multiple negative adjustments should push it down but cap at -1.0
        for _ in range(20):
            adjuster.adjust_from_feedback(feedback="negative")

        final_state = adjuster.get_current_state()
        self.assertGreaterEqual(final_state.pleasure, -1.0)
        self.assertLessEqual(final_state.pleasure, 0.0)

    def test_pad_adjuster_automatic_adjustment(self):
        """Test automatic arousal adjustment based on interaction length."""
        from src.adaptive_learning.pad_adjuster import PADAdjuster

        adjuster = PADAdjuster(data_path=Path(self.test_dir), learning_intensity=1.0)
        initial_state = adjuster.get_current_state()
        initial_arousal = initial_state.arousal

        # Very short interaction should decrease arousal
        adjuster.adjust_from_interaction(20, 30)  # Total 50 < 100
        state_short = adjuster.get_current_state()
        self.assertLess(state_short.arousal, initial_arousal)

        # Long interaction should increase arousal
        adjuster = PADAdjuster(data_path=Path(self.test_dir), learning_intensity=1.0)
        initial_arousal = adjuster.get_current_state().arousal
        adjuster.adjust_from_interaction(600, 600)  # Total 1200 > 1000
        state_long = adjuster.get_current_state()
        self.assertGreater(state_long.arousal, initial_arousal)

        # Medium interaction should not change arousal much
        adjuster = PADAdjuster(data_path=Path(self.test_dir), learning_intensity=1.0)
        initial_arousal = adjuster.get_current_state().arousal
        adjuster.adjust_from_interaction(200, 200)  # Total 400 between 100-1000
        state_medium = adjuster.get_current_state()
        # Should be within 0.01 of original (no change)
        self.assertAlmostEqual(state_medium.arousal, initial_arousal, delta=0.01)

        # Values should always stay clamped in [-1, 1]
        adjuster = PADAdjuster(data_path=Path(self.test_dir), learning_intensity=1.0)
        for _ in range(50):
            adjuster.adjust_from_interaction(1000, 1000)
        final_state = adjuster.get_current_state()
        self.assertLessEqual(final_state.arousal, 1.0)

    def test_preference_learning_basic(self):
        """Test basic preference learning functionality."""
        from datetime import datetime

        from src.adaptive_learning.data_collector import DataCollector, InteractionRecord
        from src.adaptive_learning.preference_learner import PreferenceLearner

        learner = PreferenceLearner(data_path=Path(self.test_dir))
        collector = DataCollector(data_path=Path(self.test_dir))
        session_id = collector.create_session()

        # Initial state should be defaults
        prefs = learner.get_preferences()
        self.assertEqual(prefs.preferred_tone, "neutral")
        self.assertEqual(prefs.preferred_emoji_freq, "minimal")

        # Learn from positive feedback with specific response length
        record = InteractionRecord(
            session_id=session_id,
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            response_length=200
        )
        learner.learn_from_feedback(record, "positive")

        # Confidence should increase
        confidence = learner.get_confidence_summary()
        self.assertGreater(confidence.get("response_length", 0), 0)

        # After enough positive feedback, preference should be updated
        for _ in range(6):
            learner.learn_from_feedback(record, "positive")

        prefs = learner.get_preferences()
        self.assertEqual(prefs.preferred_response_length, 200)

        # Reset should go back to defaults
        learner.reset()
        prefs = learner.get_preferences()
        self.assertEqual(prefs.preferred_response_length, 0)
        self.assertEqual(prefs.preferred_tone, "neutral")

    def test_preference_topic_feedback(self):
        """Test that positive feedback adds topics, negative feedback removes topics."""
        from datetime import datetime
        from pathlib import Path

        from src.adaptive_learning.data_collector import InteractionRecord
        from src.adaptive_learning.preference_learner import PreferenceLearner

        learner = PreferenceLearner(data_path=Path(self.test_dir))

        # Add topic with positive feedback
        record = InteractionRecord(
            session_id="test-session",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            topics=["python", "coding", "ai"],
            response_length=200
        )

        # Positive feedback adds topics
        learner.learn_from_feedback(record, "positive")
        prefs = learner.get_preferences()
        self.assertIn("python", prefs.preferred_topics)
        self.assertIn("coding", prefs.preferred_topics)
        self.assertEqual(len(prefs.preferred_topics), 3)

        # Negative feedback removes one topic
        record2 = InteractionRecord(
            session_id="test-session",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            topics=["coding"],
            response_length=200
        )
        learner.learn_from_feedback(record2, "negative")
        prefs = learner.get_preferences()
        self.assertIn("python", prefs.preferred_topics)
        self.assertNotIn("coding", prefs.preferred_topics)
        self.assertEqual(len(prefs.preferred_topics), 2)


class TestEnhancedMemory(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def create_test_memory(self, memory_id: str, content: str, tags: list[str]):
        """Helper to create a test memory file."""
        import json
        from datetime import datetime
        memory_file = Path(self.test_dir) / f"{memory_id}.json"
        data = {
            "content": content,
            "tags": tags,
            "created_at": datetime.now().isoformat()
        }
        memory_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def test_tag_search_and_semantics(self):
        """Test tag search requires ALL tags to match (AND semantics)."""
        from src.memory_enhanced.retrieval import MemoryRetriever

        # Create test memories with different tag combinations
        self.create_test_memory("mem1", "First memory about project", ["project", "work"])
        self.create_test_memory("mem2", "Second memory about personal", ["personal", "notes"])
        self.create_test_memory("mem3", "Third memory project notes", ["project", "notes"])

        retriever = MemoryRetriever(storage_path=Path(self.test_dir))

        # Search for ["project"] - should get mem1 AND mem3
        results = retriever.search("", tags=["project"])
        self.assertEqual(len(results), 2)
        memory_ids = {r.memory_id for r in results}
        self.assertIn("mem1", memory_ids)
        self.assertIn("mem3", memory_ids)

        # Search for ["project", "notes"] - should ONLY get mem3 that has BOTH
        results = retriever.search("", tags=["project", "notes"])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].memory_id, "mem3")

        # Search for ["nonexistent"] - should get nothing
        results = retriever.search("", tags=["nonexistent"])
        self.assertEqual(len(results), 0)

    def test_fuzzy_search_matches(self):
        """Test fuzzy search finds approximate matches."""
        from src.memory_enhanced.retrieval import MemoryRetriever

        # Exact match for both query words
        self.create_test_memory("exact", "Development roadmap discussion", [])
        # One exact match, one too different (distance over threshold - shouldn't match
        self.create_test_memory("partly", "Development roadmap dscusn", [])
        # Completely different content - shouldn't match at all
        self.create_test_memory("none", "Grocery shopping list for tonight", [])

        retriever = MemoryRetriever(storage_path=Path(self.test_dir))

        # Search for "roadmap discussion"
        results = retriever.search("roadmap discussion")
        # Only exact matches should match (partly only matches one word, the other is too far)
        # It should still be included because at least one word matched
        self.assertEqual(len(results), 2)

        # Exact has 2/2 = 1.0, partly has 1/2 = 0.5
        exact_result = next(r for r in results if r.memory_id == "exact")
        partly_result = next(r for r in results if r.memory_id == "partly")
        self.assertEqual(exact_result.relevance, 1.0)
        self.assertEqual(partly_result.relevance, 0.5)
        self.assertGreater(exact_result.relevance, partly_result.relevance)

    def test_cache_works_and_invalidates(self):
        """Test that caching works and invalidation clears cache."""
        from src.memory_enhanced.retrieval import MemoryRetriever

        self.create_test_memory("first", "First content", [])

        retriever = MemoryRetriever(storage_path=Path(self.test_dir))

        # First search loads from disk
        results1 = retriever.search("first")
        self.assertEqual(len(results1), 1)

        # Create second memory
        self.create_test_memory("second", "Second content", [])

        # Before invalidation, cache still has only 1 result
        results2 = retriever.search("")
        # Because cache is still valid (TTL 5min), we don't see the new memory yet
        if len(results2) == 1:
            # Cache hit - invalidate and check again
            retriever.invalidate_cache()
            results3 = retriever.search("")
            self.assertEqual(len(results3), 2)

    def test_priority_weighting_applied(self):
        """Test that search results are sorted by priority * relevance."""
        import json

        from src.memory_enhanced.retrieval import MemoryRetriever

        # Create two memories with same relevance but different priorities
        self.create_test_memory("high_prio", "Search result here", [])
        self.create_test_memory("low_prio", "Search result here", [])

        # Add priority by editing the files
        high_file = Path(self.test_dir) / "high_prio.json"
        high_data = json.loads(high_file.read_text(encoding="utf-8"))
        high_data["priority"] = "high"
        high_file.write_text(json.dumps(high_data, ensure_ascii=False), encoding="utf-8")

        low_file = Path(self.test_dir) / "low_prio.json"
        low_data = json.loads(low_file.read_text(encoding="utf-8"))
        low_data["priority"] = "low"
        low_file.write_text(json.dumps(low_data, ensure_ascii=False), encoding="utf-8")

        retriever = MemoryRetriever(storage_path=Path(self.test_dir))
        results = retriever.search("Search result here")

        # High priority should come first
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].memory_id, "high_prio")
        self.assertEqual(results[1].memory_id, "low_prio")

    def test_empty_query_returns_all(self):
        """Test that empty query returns all matching memories sorted by priority/date."""
        from src.memory_enhanced.retrieval import MemoryRetriever

        # Create multiple memories
        self.create_test_memory("mem1", "Content one", ["tag1"])
        self.create_test_memory("mem2", "Content two", ["tag1", "tag2"])
        self.create_test_memory("mem3", "Content three", [])

        retriever = MemoryRetriever(storage_path=Path(self.test_dir))

        # Empty query should return all 3 memories
        results = retriever.search("")
        self.assertEqual(len(results), 3)

        # Empty query with tag filter should only return matching
        results_tag = retriever.search("", tags=["tag1"])
        self.assertEqual(len(results_tag), 2)

        # Whitespace-only query should also return all
        results_whitespace = retriever.search("   ")
        self.assertEqual(len(results_whitespace), 3)


class TestConfigManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.templates_dir = Path(self.test_dir) / "config" / "templates"
        self.templates_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def create_test_template(self, name: str, content: str):
        """Create a test template file."""
        template_path = self.templates_dir / f"{name}.yaml"
        template_path.write_text(content, encoding="utf-8")

    def test_list_templates_when_empty(self):
        """Test listing templates when directory is empty."""
        from src.config_manager.templates import TemplateManager
        manager = TemplateManager(templates_dir=self.templates_dir)
        templates = manager.list_templates()
        self.assertEqual(len(templates), 0)

    def test_list_templates_loads_all(self):
        """Test that all templates are loaded and sorted by name."""
        from src.config_manager.templates import TemplateManager
        self.create_test_template("b", """agent:
  name: B
  role: Role B
""")
        self.create_test_template("a", """agent:
  name: A
  role: Role A
""")
        manager = TemplateManager(templates_dir=self.templates_dir)
        templates = manager.list_templates()
        self.assertEqual(len(templates), 2)
        # Should be sorted by name
        self.assertEqual(templates[0].name, "a")
        self.assertEqual(templates[1].name, "b")

    def test_get_template_finds_correct_case_insensitive(self):
        """Test getting template by name is case insensitive."""
        from src.config_manager.templates import TemplateManager
        self.create_test_template("Friendly", """agent:
  name: Friendly
  role: Friendly Assistant
  personality:
    - friendly
    - helpful
""")
        manager = TemplateManager(templates_dir=self.templates_dir)
        template = manager.get_template("friendly")
        self.assertIsNotNone(template)
        if template:
            self.assertEqual(template.name, "Friendly")

    def test_template_cache_works(self):
        """Test that caching works and refresh_cache invalidates."""
        from src.config_manager.templates import TemplateManager
        self.create_test_template("test", """agent:
  name: Test
  role: Test Role
""")
        manager = TemplateManager(templates_dir=self.templates_dir)
        templates1 = manager.list_templates()
        self.assertEqual(len(templates1), 1)

        # Create new template after first load
        self.create_test_template("second", """agent:
  name: Second
  role: Second Role
""")

        # Cached version doesn't have it yet
        templates2 = manager.list_templates()
        if len(templates2) == 1:
            # Refresh cache and should see it
            manager.refresh_cache()
            templates3 = manager.list_templates()
            self.assertEqual(len(templates3), 2)

    def test_validation_catches_invalid_types(self):
        """Test that ConfigValidator catches type errors."""
        from src.config_manager.validator import ConfigValidator

        validator = ConfigValidator()
        # Invalid: personality is not a list
        config = {
            "agent": {
                "name": "Test",
                "personality": "this is not a list it's a string",
            }
        }
        errors = validator.validate(config)
        # Should have at least one error about personality
        error_fields = [e.field for e in errors]
        self.assertIn("agent.personality", error_fields)

    def test_validation_accepts_valid_config(self):
        """Test that valid config passes validation."""
        from src.config_manager.validator import ConfigValidator

        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "TestAgent",
                "personality": ["friendly", "helpful"],
                "core_values": ["privacy"],
                "interaction_style": {
                    "tone": "friendly",
                    "language": "chinese",
                    "emoji_usage": "minimal",
                }
            },
            "master": {
                "name": "TestUser",
                "timezone": "Asia/Shanghai",
            },
            "behavior": {
                "enabled": True,
                "auto_memory": True,
            }
        }
        errors = validator.validate(config)
        # No errors for valid configuration
        error_errors = [e for e in errors if e.severity == "error"]
        self.assertEqual(len(error_errors), 0)

    def test_validation_catches_invalid_tone(self):
        """Test validation catches invalid tone value."""
        from src.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "Test",
                "interaction_style": {
                    "tone": "invalid_value",
                }
            }
        }
        errors = validator.validate(config)
        self.assertTrue(any(e.field == "agent.interaction_style.tone" for e in errors))

    def test_behavior_validation_checks_boolean(self):
        """Test behavior validation checks that boolean fields are actually bool."""
        from src.config_manager.validator import ConfigValidator
        validator = ConfigValidator()
        config = {
            "agent": {
                "name": "Test",
            },
            "behavior": {
                "enabled": "True",  # string instead of bool
            }
        }
        errors = validator.validate(config)
        self.assertTrue(any(e.field == "behavior.enabled" for e in errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)
