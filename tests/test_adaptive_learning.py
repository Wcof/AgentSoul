"""
AgentSoul · 自适应学习模块测试
=============================

测试 src/adaptive_learning/ 三个核心模块：
- data_collector.py - 交互数据收集
- pad_adjuster.py - PAD情感状态渐进调整
- preference_learner.py - 用户偏好学习
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.adaptive_learning.data_collector import (
    InteractionRecord,
    DataCollector,
)
from src.adaptive_learning.pad_adjuster import (
    PADState,
    PADAdjuster,
)
from src.adaptive_learning.preference_learner import (
    UserPreferences,
    PreferenceLearner,
    EMOJI_RANGES,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestInteractionRecord(BaseTest):
    """测试 InteractionRecord dataclass"""

    def test_record_creation(self):
        """测试创建交互记录"""
        record = InteractionRecord(
            session_id="test-session",
            timestamp=datetime.now(),
            pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
            pad_after={"pleasure": 0.4, "arousal": 0.25, "dominance": 0.3},
            feedback="positive",
            response_length=150,
            topics=["memory", "planning"],
            user_input="Hello",
            agent_response="Hi there!"
        )
        self.assertEqual(record.session_id, "test-session")
        self.assertEqual(record.feedback, "positive")
        self.assertEqual(record.response_length, 150)
        self.assertEqual(len(record.topics), 2)
        self.assertEqual(record.user_input, "Hello")

    def test_record_creation_minimal(self):
        """测试创建最小化交互记录（可选字段为空）"""
        record = InteractionRecord(
            session_id="test-session",
            timestamp=datetime.now(),
            pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
            pad_after={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
        )
        self.assertIsNone(record.feedback)
        self.assertIsNone(record.response_length)
        self.assertIsNone(record.topics)


class TestDataCollector(BaseTest):
    """测试 DataCollector"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.collector = DataCollector(data_path=self.data_dir)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_creates_directory(self):
        """测试初始化创建目录"""
        self.assertTrue(self.data_dir.exists())
        self.assertEqual(self.collector.data_path, self.data_dir)

    def test_record_interaction(self):
        """测试记录交互"""
        record = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
            pad_after={"pleasure": 0.4, "arousal": 0.25, "dominance": 0.3},
            feedback="positive",
        )
        self.collector.record(record)
        self.assertTrue(self.collector.interactions_file.exists())
        content = self.collector.interactions_file.read_text()
        self.assertIn("session-1", content)
        self.assertIn("positive", content)

    def test_get_recent_empty_when_no_file(self):
        """测试没有文件时返回空列表"""
        records = self.collector.get_recent()
        self.assertEqual(len(records), 0)

    def test_get_recent_returns_records(self):
        """测试获取最近记录"""
        # Add 3 records
        for i in range(3):
            record = InteractionRecord(
                session_id=f"session-{i}",
                timestamp=datetime.now(),
                pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                pad_after={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
            )
            self.collector.record(record)

        records = self.collector.get_recent()
        self.assertEqual(len(records), 3)

    def test_get_recent_respects_limit(self):
        """测试获取最近记录遵守限制"""
        # Add 10 records
        for i in range(10):
            record = InteractionRecord(
                session_id=f"session-{i}",
                timestamp=datetime.now(),
                pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                pad_after={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
            )
            self.collector.record(record)

        records = self.collector.get_recent(limit=5)
        self.assertEqual(len(records), 5)

    def test_get_statistics_empty(self):
        """测试统计空数据"""
        stats = self.collector.get_statistics()
        self.assertEqual(stats["total_interactions"], 0)
        self.assertEqual(stats["positive_feedback"], 0)

    def test_get_statistics_with_data(self):
        """测试统计有数据"""
        # Add mixed feedback
        for feedback in ["positive", "positive", "negative", None]:
            record = InteractionRecord(
                session_id="session-1",
                timestamp=datetime.now(),
                pad_before={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                pad_after={"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3},
                feedback=feedback,
                response_length=100 if feedback else None,
            )
            self.collector.record(record)

        stats = self.collector.get_statistics()
        self.assertEqual(stats["total_interactions"], 4)
        self.assertEqual(stats["positive_feedback"], 2)
        self.assertEqual(stats["negative_feedback"], 1)
        self.assertEqual(stats["no_feedback"], 1)
        self.assertEqual(stats["sessions_count"], 1)

    def test_get_statistics_skips_corrupted_lines(self):
        """测试统计跳过损坏的行"""
        # Write invalid JSON
        self.collector.interactions_file.parent.mkdir(exist_ok=True)
        self.collector.interactions_file.write_text(
            '{"session_id": "valid", "timestamp": "' + datetime.now().isoformat() + '", "pad_before": {}, "pad_after": {}}\n'
            'this is not valid json\n'
            '{"session_id": "valid2", "timestamp": "' + datetime.now().isoformat() + '", "pad_before": {}, "pad_after": {}}\n'
        )

        with patch('src.adaptive_learning.data_collector.log') as mock_log:
            records = self.collector.get_recent()
            self.assertEqual(len(records), 2)
            self.assertTrue(any("Failed to parse record" in str(call) for call in mock_log.call_args_list))

    def test_create_session(self):
        """测试创建会话 ID 是 UUID"""
        session_id = self.collector.create_session()
        self.assertNotEmpty(session_id)
        # UUID should be 36 chars
        self.assertEqual(len(session_id), 36)


class TestPADState(BaseTest):
    """测试 PADState dataclass"""

    def test_default_values(self):
        """测试默认值"""
        state = PADState()
        self.assertEqual(state.pleasure, 0.3)
        self.assertEqual(state.arousal, 0.2)
        self.assertEqual(state.dominance, 0.3)
        self.assertIsNone(state.last_updated)

    def test_custom_values(self):
        """测试自定义值"""
        dt = datetime.now()
        state = PADState(pleasure=0.5, arousal=0.4, dominance=0.6, last_updated=dt)
        self.assertEqual(state.pleasure, 0.5)
        self.assertEqual(state.arousal, 0.4)
        self.assertEqual(state.dominance, 0.6)
        self.assertEqual(state.last_updated, dt)


class TestPADAdjuster(BaseTest):
    """测试 PADAdjuster"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.adjuster = PADAdjuster(data_path=self.data_dir, learning_intensity=0.3)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_default_state(self):
        """测试初始化默认状态"""
        state = self.adjuster.get_current_state()
        self.assertEqual(state.pleasure, 0.3)
        self.assertEqual(state.arousal, 0.2)
        self.assertEqual(state.dominance, 0.3)

    def test_init_clamps_learning_intensity(self):
        """测试初始化限制学习强度在 0-1"""
        adjuster = PADAdjuster(data_path=self.data_dir, learning_intensity=1.5)
        self.assertEqual(adjuster.learning_intensity, 1.0)

        adjuster2 = PADAdjuster(data_path=self.data_dir, learning_intensity=-0.5)
        self.assertEqual(adjuster2.learning_intensity, 0.0)

    def test_load_from_file_corrupted_uses_default(self):
        """测试损坏的文件使用默认值"""
        self.adjuster.state_file.write_text("this is not valid json")

        with patch('src.adaptive_learning.pad_adjuster.log') as mock_log:
            adjuster = PADAdjuster(data_path=self.data_dir)
            state = adjuster.get_current_state()
            self.assertEqual(state.pleasure, 0.3)  # default
            self.assertTrue(any("Failed to load PAD state" in str(call) for call in mock_log.call_args_list))

    def test_adjust_from_positive_feedback(self):
        """测试正向反馈调整"""
        new_state = self.adjuster.adjust_from_feedback(feedback="positive")
        # Positive should increase pleasure
        self.assertGreater(new_state.pleasure, 0.3)
        # should be clamped within [-1, 1]
        self.assertGreaterEqual(new_state.pleasure, -1.0)
        self.assertLessEqual(new_state.pleasure, 1.0)
        # should have last_updated
        self.assertIsNotNone(new_state.last_updated)

    def test_adjust_from_negative_feedback(self):
        """测试负向反馈调整"""
        new_state = self.adjuster.adjust_from_feedback(feedback="negative")
        # Negative should decrease pleasure
        self.assertLess(new_state.pleasure, 0.3)
        # Dominance should increase slightly
        self.assertGreater(new_state.dominance, 0.3)

    def test_adjust_from_neutral_feedback(self):
        """测试中性反馈不改变"""
        before = self.adjuster.get_current_state()
        new_state = self.adjuster.adjust_from_feedback(feedback="neutral")
        self.assertEqual(new_state.pleasure, before.pleasure)
        self.assertEqual(new_state.arousal, before.arousal)
        self.assertEqual(new_state.dominance, before.dominance)

    def test_adjust_from_unknown_feedback_treats_as_neutral(self):
        """测试未知反馈当作中性"""
        before = self.adjuster.get_current_state()
        new_state = self.adjuster.adjust_from_feedback(feedback="unknown")
        self.assertEqual(new_state.pleasure, before.pleasure)

    def test_set_learning_intensity_clamps(self):
        """测试设置学习强度限制范围"""
        self.adjuster.set_learning_intensity(2.0)
        self.assertEqual(self.adjuster.learning_intensity, 1.0)

        self.adjuster.set_learning_intensity(-1.0)
        self.assertEqual(self.adjuster.learning_intensity, 0.0)

        self.adjuster.set_learning_intensity(0.5)
        self.assertEqual(self.adjuster.learning_intensity, 0.5)

    def test_reset_returns_to_defaults(self):
        """测试重置返回默认值"""
        # First change it
        self.adjuster.adjust_from_feedback(feedback="positive")
        changed = self.adjuster.get_current_state()
        self.assertNotEqual(changed.pleasure, 0.3)

        # Reset
        self.adjuster.reset()
        reset = self.adjuster.get_current_state()
        self.assertEqual(reset.pleasure, 0.3)
        self.assertEqual(reset.arousal, 0.2)
        self.assertEqual(reset.dominance, 0.3)
        self.assertIsNotNone(reset.last_updated)

    def test_adjust_from_interaction_short_decreases_arousal(self):
        """测试短交互减少唤醒"""
        before = self.adjuster.get_current_state().arousal
        self.adjuster.adjust_from_interaction(user_input_length=10, response_length=20)
        after = self.adjuster.get_current_state().arousal
        # total 30 < 100 → should decrease
        self.assertLess(after, before)

    def test_adjust_from_interaction_long_increases_arousal(self):
        """测试长交互增加唤醒"""
        before = self.adjuster.get_current_state().arousal
        self.adjuster.adjust_from_interaction(user_input_length=500, response_length=600)
        after = self.adjuster.get_current_state().arousal
        # total 1100 > 1000 → should increase
        self.assertGreater(after, before)

    def test_adjust_from_interaction_medium_no_change(self):
        """测试中等交互不改变唤醒"""
        before = self.adjuster.get_current_state().arousal
        self.adjuster.adjust_from_interaction(user_input_length=200, response_length=300)
        after = self.adjuster.get_current_state().arousal
        # total 500 between 100-1000 → no change
        self.assertEqual(after, before)

    def test_to_dict_returns_correct_values(self):
        """测试转换为字典"""
        result = self.adjuster.to_dict()
        self.assertIn("pleasure", result)
        self.assertIn("arousal", result)
        self.assertIn("dominance", result)
        self.assertIn("learning_intensity", result)
        self.assertEqual(result["learning_intensity"], 0.3)

    def test_save_and_load_persists_state(self):
        """测试保存加载持久化状态"""
        # Adjust and save
        self.adjuster.adjust_from_feedback(feedback="positive")
        adjusted_pleasure = self.adjuster.get_current_state().pleasure

        # Create new adjuster loading from same file
        new_adjuster = PADAdjuster(data_path=self.data_dir)
        new_pleasure = new_adjuster.get_current_state().pleasure
        self.assertEqual(new_pleasure, adjusted_pleasure)


class TestUserPreferences(BaseTest):
    """测试 UserPreferences dataclass"""

    def test_default_values(self):
        """测试默认值"""
        prefs = UserPreferences()
        self.assertEqual(prefs.preferred_tone, "neutral")
        self.assertEqual(prefs.preferred_response_length, 0)
        self.assertEqual(prefs.preferred_emoji_freq, "minimal")
        self.assertEqual(len(prefs.preferred_topics), 0)

    def test_custom_values(self):
        """测试自定义值"""
        prefs = UserPreferences(
            preferred_tone="friendly",
            preferred_response_length=200,
            preferred_emoji_freq="moderate",
            preferred_topics=["tech", "coding"],
            learning_confidence={"tone": 0.8}
        )
        self.assertEqual(prefs.preferred_tone, "friendly")
        self.assertEqual(prefs.preferred_response_length, 200)
        self.assertEqual(prefs.preferred_emoji_freq, "moderate")
        self.assertEqual(prefs.learning_confidence["tone"], 0.8)


class TestPreferenceLearner(BaseTest):
    """测试 PreferenceLearner"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.learner = PreferenceLearner(data_path=self.data_dir)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_default_preferences(self):
        """测试初始化默认偏好"""
        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_tone, "neutral")
        self.assertEqual(prefs.preferred_emoji_freq, "minimal")

    def test_load_corrupted_uses_default(self):
        """测试加载损坏文件使用默认值"""
        self.learner.preferences_file.write_text("not valid json")

        with patch('src.adaptive_learning.preference_learner.log') as mock_log:
            learner = PreferenceLearner(data_path=self.data_dir)
            prefs = learner.get_preferences()
            self.assertEqual(prefs.preferred_tone, "neutral")
            self.assertTrue(any("Failed to load preferences" in str(call) for call in mock_log.call_args_list))

    def test_learn_from_positive_feedback_updates_confidence(self):
        """测试正向反馈更新置信度 - 需要多次学习超过阈值才更新偏好"""
        interaction = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            feedback="positive",
            response_length=200,
            topics=["memory"],
        )

        # First interaction: confidence becomes 0.1, still below 0.5 threshold
        self.learner.learn_from_feedback(interaction, "positive")
        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_response_length, 0)  # Not updated yet
        self.assertIn("memory", prefs.preferred_topics)
        self.assertEqual(prefs.learning_confidence["response_length"], 0.1)

        # After 6 interactions: 0.6 > 0.5 → preference updated
        for _ in range(5):
            self.learner.learn_from_feedback(interaction, "positive")

        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_response_length, 200)
        self.assertGreater(prefs.learning_confidence["response_length"], 0.5)

    def test_learn_from_negative_feedback_reduces_confidence(self):
        """测试负向反馈降低置信度"""
        # First add positive
        interaction = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            response_length=200,
            topics=["memory"],
        )
        self.learner.learn_from_feedback(interaction, "positive")

        # Then negative on the same topic
        interaction2 = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            topics=["memory"],
        )
        self.learner.learn_from_feedback(interaction2, "negative")

        prefs = self.learner.get_preferences()
        self.assertNotIn("memory", prefs.preferred_topics)

    def test_set_tone_preference_valid(self):
        """测试设置有效语气偏好"""
        self.learner.set_tone_preference("friendly")
        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_tone, "friendly")
        self.assertEqual(prefs.learning_confidence["tone"], 1.0)

    def test_learn_from_response_detects_frequent_emoji(self):
        """测试从响应学习检测高频emoji - 需要多次学习超过置信度阈值"""
        interaction = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            agent_response="Hello 😊 how are you 🎉 today is nice 👍👍"
        )
        # 4 emoji → should be moderate classification
        # Need 11 interactions to get confidence > 0.5 (each adds 0.05)
        for _ in range(11):
            self.learner.learn_from_response(interaction)

        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_emoji_freq, "moderate")

    def test_learn_from_response_detects_minimal_emoji(self):
        """测试从响应学习检测低频emoji"""
        interaction = InteractionRecord(
            session_id="session-1",
            timestamp=datetime.now(),
            pad_before={},
            pad_after={},
            agent_response="Hello how are you today"
        )
        self.learner.learn_from_response(interaction)
        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_emoji_freq, "minimal")

    def test_emoji_ranges_covers_expected_codepoints(self):
        """测试emoji范围常量定义正确"""
        # Just check we have some ranges defined
        self.assertGreater(len(EMOJI_RANGES), 0)
        for start, end in EMOJI_RANGES:
            self.assertLess(start, end)

    def test_reset_clears_preferences(self):
        """测试重置清空偏好"""
        self.learner.set_tone_preference("friendly")
        self.learner.reset()
        prefs = self.learner.get_preferences()
        self.assertEqual(prefs.preferred_tone, "neutral")

    def test_get_confidence_summary(self):
        """测试获取置信度摘要"""
        self.learner.set_tone_preference("friendly")
        summary = self.learner.get_confidence_summary()
        self.assertEqual(summary["tone"], 1.0)

    def test_save_and_load_persists_preferences(self):
        """测试保存加载持久化偏好"""
        self.learner.set_tone_preference("casual")
        self.learner.get_preferences().preferred_topics.append("testing")

        # New instance loads from file
        new_learner = PreferenceLearner(data_path=self.data_dir)
        prefs = new_learner.get_preferences()
        self.assertEqual(prefs.preferred_tone, "casual")


if __name__ == "__main__":
    unittest.main()
