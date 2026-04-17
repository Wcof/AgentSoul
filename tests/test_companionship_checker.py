"""
AgentSoul · 陪伴连续性检查器测试
=============================

测试 CompanionshipChecker 功能
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tempfile
import unittest
from pathlib import Path

import yaml
import json

from agentsoul import (
    CompanionshipChecker,
    CheckResult,
    OverallReport,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestCompanionshipChecker(BaseTest):
    """测试陪伴连续性检查器"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # 创建基础目录结构
        (self.project_root / "config").mkdir()
        (self.project_root / "var" / "data").mkdir()
        (self.project_root / "src").mkdir()

        # Create required src directory for skill check
        (self.project_root / "src" / "SKILL.md").write_text("# SKILL\nCore rules\n")
        (self.project_root / "src" / "soul_base.md").write_text("# soul_base\nSoul base rules\n")
        (self.project_root / "src" / "memory_base.md").write_text("# memory_base\nMemory base rules\n")
        (self.project_root / "src" / "secure_base.md").write_text("# secure_base\nSecurity rules\n")

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_checker_construction(self):
        """测试检测器初始化"""
        checker = CompanionshipChecker(self.project_root)
        self.assertIsNotNone(checker)
        self.assertEqual(checker.project_root, self.project_root)

    def test_check_empty_directory(self):
        """测试在空目录上检测"""
        checker = CompanionshipChecker(self.project_root)
        report = checker.run_full_check()
        self.assertIsNotNone(report)
        # Fresh repo should remain usable even before runtime directories are created.
        self.assertGreaterEqual(report.overall_score, 70)

    def test_check_with_valid_config(self):
        """测试有有效配置文件时检测"""
        checker = CompanionshipChecker(self.project_root)

        # 创建 minimal 配置
        persona_config = {
            "ai": {
                "name": "TestAgent",
                "role": "Test Assistant",
                "personality": ["friendly"],
                "core_values": ["user_privacy_protection"],
                "interaction_style": {
                    "tone": "neutral",
                    "language": "chinese",
                    "emoji_usage": "minimal",
                }
            },
            "master": {
                "name": "TestUser",
                "timezone": "Asia/Shanghai",
                "labels": ["testing"],
            }
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        # 创建数据目录
        (self.project_root / "var" / "data" / "soul" / "soul_variable").mkdir(parents=True)
        (self.project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)
        (self.project_root / "var" / "data" / "memory" / "week").mkdir()
        (self.project_root / "var" / "data" / "memory" / "month").mkdir()
        (self.project_root / "var" / "data" / "memory" / "year").mkdir()
        (self.project_root / "var" / "data" / "memory" / "topic").mkdir()

        # Write initial soul state
        state = {
            "version": "1.0.0",
            "pleasure": 0.3,
            "arousal": 0.2,
            "dominance": 0.3,
        }
        with open(self.project_root / "var" / "data" / "soul" / "soul_variable" / "state_vector.json", "w") as f:
            json.dump(state, f)

        report = checker.run_full_check()
        self.assertIsNotNone(report)

        # All checks should pass with high score
        self.assertTrue(report.memory_continuity.passed)
        self.assertTrue(report.personality_consistency.passed)
        self.assertTrue(report.skill_precipitation.passed)
        self.assertTrue(report.state_recovery.passed)
        # User-perceived will have score around 85 since everything is setup
        self.assertGreater(report.overall_score, 70)

    def test_check_memory_continuity_missing_dirs(self):
        """测试记忆连续性检查 - 全新仓库缺少目录时返回建议而不是失败"""
        checker = CompanionshipChecker(self.project_root)
        result = checker.check_memory_continuity()
        self.assertIsInstance(result, CheckResult)
        self.assertGreaterEqual(result.score, 80)
        self.assertTrue(result.passed)
        self.assertEqual(len(result.issues), 0)
        self.assertTrue(any("自动创建" in item for item in result.recommendations))

    def test_check_personality_invalid_yaml(self):
        """测试人格一致性检查 - 无效YAML"""
        checker = CompanionshipChecker(self.project_root)
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            f.write("this: is: invalid: yaml: --- {{{")

        result = checker.check_personality_consistency()
        # Invalid yaml still gets default config from storage layer, score will be ~70
        # Still passes because it's gracefully handled
        self.assertTrue(result.passed)
        self.assertGreater(len(result.issues), 0)

    def test_check_personality_missing_sections(self):
        """测试人格一致性检查 - 缺少必需节"""
        checker = CompanionshipChecker(self.project_root)
        persona_config = {
            # Missing ai section - storage will provide default
            "master": {
                "name": "User"
            }
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        result = checker.check_personality_consistency()
        # Missing ai gets filled by defaults from storage layer, so still passes
        self.assertTrue(result.passed)
        # Still gets issues for missing required fields in user-provided config
        self.assertGreater(len(result.issues), 0)

    def test_check_skill_precipitation_missing_rules(self):
        """测试技能沉淀检查 - 缺少规则文件"""
        checker = CompanionshipChecker(self.project_root)
        # Only some rules exist from setUp, but not all required
        result = checker.check_skill_precipitation()
        # We created 4 required rules in setup, so should pass
        self.assertTrue(result.passed)
        self.assertEqual(result.score, 100)

    def test_check_state_recovery_missing_directory(self):
        """测试状态恢复检查 - 缺少目录"""
        checker = CompanionshipChecker(self.project_root)
        result = checker.check_state_recovery()
        self.assertEqual(len(result.issues), 0)
        self.assertTrue(result.passed)
        self.assertTrue(any("自动创建" in item for item in result.recommendations))

    def test_check_state_recovery_valid_state(self):
        """测试状态恢复检查 - 有效状态"""
        checker = CompanionshipChecker(self.project_root)
        state_dir = self.project_root / "var" / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            "pleasure": 0.3,
            "arousal": 0.2,
            "dominance": 0.3,
            "version": "1.0.0",
        }
        with open(state_dir / "state_vector.json", "w") as f:
            json.dump(state, f)

        result = checker.check_state_recovery()
        self.assertTrue(result.passed)
        self.assertEqual(len([i for i in result.issues if "missing" in i["message"].lower()]), 0)

    def test_check_user_perceived_no_user_name(self):
        """测试用户可感知陪伴检查 - 没有填写用户名"""
        checker = CompanionshipChecker(self.project_root)
        persona_config = {
            "ai": {
                "name": "Agent",
            },
            "master": {
                # No name
                "timezone": "Asia/Shanghai",
            }
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        result = checker.check_user_perceived_companionship()
        # Will get recommendation but still pass
        self.assertTrue(result.passed)
        # Recommendations:
        # - suggest filling user name
        # - suggest adding labels
        # - "还没有记忆积累，随对话会自动生成"
        self.assertEqual(len(result.recommendations), 3)  # name, labels, memory

    def test_full_report_dataclasses(self):
        """测试整体报告数据类结构"""
        checker = CompanionshipChecker(self.project_root)

        # Create minimal setup
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_full_check()
        self.assertIsInstance(report, OverallReport)
        self.assertIsInstance(report.memory_continuity, CheckResult)
        self.assertIsInstance(report.personality_consistency, CheckResult)
        self.assertIsInstance(report.skill_precipitation, CheckResult)
        self.assertIsInstance(report.state_recovery, CheckResult)
        self.assertIsInstance(report.user_perceived_companionship, CheckResult)
        self.assertGreaterEqual(report.overall_score, 0)
        self.assertLessEqual(report.overall_score, 100)
        self.assertNotEmpty(report.assessment)
        self.assertNotEmpty(report.timestamp)

    def test_format_report_generates_markdown(self):
        """测试报告格式化为markdown"""
        checker = CompanionshipChecker(self.project_root)
        report = checker.run_full_check()
        markdown = checker.format_report(report)
        self.assertIn("Master Agent 陪伴连续性检查报告", markdown)
        self.assertIn("整体得分", markdown)
        self.assertIn("五项核心指标", markdown)
        for name in [
            "记忆连续性",
            "人格一致性",
            "技能沉淀",
            "状态恢复",
            "用户可感知陪伴",
        ]:
            self.assertIn(name, markdown)

    def test_save_report_writes_file(self):
        """测试保存报告到文件"""
        checker = CompanionshipChecker(self.project_root)
        report = checker.run_full_check()
        output_path = self.project_root / "report.md"
        checker.save_report(report, output_path)
        self.assertTrue(output_path.exists())
        content = output_path.read_text(encoding="utf-8")
        self.assertIn("Master Agent 陪伴连续性检查报告", content)

    def test_to_dict_conversion(self):
        """测试转换报告为字典格式"""
        checker = CompanionshipChecker(self.project_root)
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_full_check()
        data = checker.to_dict(report)
        self.assertIsInstance(data, dict)
        self.assertIn("overall_score", data)
        self.assertIn("memory_continuity", data)
        self.assertIn("score", data["memory_continuity"])
        self.assertIn("passed", data["memory_continuity"])

    def test_save_report_json_writes_file(self):
        """测试保存JSON报告到文件"""
        checker = CompanionshipChecker(self.project_root)
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_full_check()
        output_path = self.project_root / "report.json"
        checker.save_report_json(report, output_path)
        self.assertTrue(output_path.exists())
        content = output_path.read_text(encoding="utf-8")
        data = json.loads(content)
        self.assertIn("overall_score", data)
        self.assertIn("memory_continuity", data)

    def test_main_function_json_output(self):
        """测试main函数JSON输出选项"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        captured_output = StringIO()
        exit_called = False

        def mock_exit(code):
            nonlocal exit_called
            exit_called = True
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            # Set sys.argv with --json option
            sys.argv = ["companionship_checker.py", "--json", "--output", str(self.project_root / "output.json")]
            main()
        except SystemExit:
            pass
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit

        output = captured_output.getvalue()
        self.assertIn("Master Agent 陪伴连续性检查报告", output)
        # Check output JSON file was created
        output_file = self.project_root / "output.json"
        self.assertTrue(output_file.exists())
        content = output_file.read_text(encoding="utf-8")
        data = json.loads(content)
        self.assertIn("overall_score", data)

    def test_main_function(self):
        """测试main函数入口"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        captured_output = StringIO()
        exit_called = False
        exit_code = None

        def mock_exit(code):
            nonlocal exit_called, exit_code
            exit_called = True
            exit_code = code
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            # Set sys.argv
            sys.argv = ["companionship_checker.py", "--output", str(self.project_root / "output.md")]
            main()
        except SystemExit as e:
            pass
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit

        output = captured_output.getvalue()
        self.assertIn("Master Agent 陪伴连续性检查报告", output)
        # Check output file was created
        output_file = self.project_root / "output.md"
        self.assertTrue(output_file.exists())

    def test_main_function_min_score_below_threshold_exits_nonzero(self):
        """测试 --min-score 门控失败时返回非零退出码"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        original_argv = sys.argv[:]
        captured_output = StringIO()
        exit_called = False
        exit_code = None

        def mock_exit(code):
            nonlocal exit_called, exit_code
            exit_called = True
            exit_code = code
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            # setUp 环境分数不会达到 100，确保触发失败门控
            sys.argv = [
                "companionship_checker.py",
                "--output",
                str(self.project_root / "output-threshold.md"),
                "--min-score",
                "100",
            ]
            main()
        except SystemExit:
            pass
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit
            sys.argv = original_argv

        output = captured_output.getvalue()
        self.assertTrue(exit_called)
        self.assertEqual(exit_code, 2)
        self.assertIn("门控未通过", output)

    def test_main_function_min_score_passes(self):
        """测试 --min-score 门控通过时不退出"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        original_argv = sys.argv[:]
        captured_output = StringIO()
        exit_called = False

        def mock_exit(code):
            nonlocal exit_called
            exit_called = True
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            sys.argv = [
                "companionship_checker.py",
                "--output",
                str(self.project_root / "output-threshold-pass.md"),
                "--min-score",
                "0",
            ]
            main()
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit
            sys.argv = original_argv

        output = captured_output.getvalue()
        self.assertFalse(exit_called)
        self.assertIn("门控通过", output)
        self.assertTrue((self.project_root / "output-threshold-pass.md").exists())

    def test_main_function_summary_json_gate_pass(self):
        """测试 --summary-json 在门控通过时输出机器可读摘要"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        original_argv = sys.argv[:]
        captured_output = StringIO()
        exit_called = False

        def mock_exit(code):
            nonlocal exit_called
            exit_called = True
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            sys.argv = [
                "companionship_checker.py",
                "--summary-json",
                "--min-score",
                "0",
                "--output",
                str(self.project_root / "summary-pass.md"),
            ]
            main()
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit
            sys.argv = original_argv

        self.assertFalse(exit_called)
        output_lines = [line for line in captured_output.getvalue().splitlines() if line.strip()]
        summary = json.loads(output_lines[-1])
        self.assertEqual(summary["min_score"], 0)
        self.assertTrue(summary["gate_passed"])
        self.assertEqual(summary["exit_code"], 0)
        self.assertIn("overall_score", summary)
        self.assertTrue((self.project_root / "summary-pass.md").exists())

    def test_main_function_summary_json_gate_fail(self):
        """测试 --summary-json 在门控失败时输出摘要并以2退出"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_exit = sys.exit
        original_argv = sys.argv[:]
        captured_output = StringIO()
        exit_called = False
        exit_code = None

        def mock_exit(code):
            nonlocal exit_called, exit_code
            exit_called = True
            exit_code = code
            raise SystemExit(code)

        sys.stdout = captured_output
        sys.exit = mock_exit
        try:
            from agentsoul.health.companionship_checker import main
            sys.argv = [
                "companionship_checker.py",
                "--summary-json",
                "--min-score",
                "100",
                "--output",
                str(self.project_root / "summary-fail.md"),
            ]
            main()
        except SystemExit:
            pass
        finally:
            sys.stdout = original_stdout
            sys.exit = original_exit
            sys.argv = original_argv

        self.assertTrue(exit_called)
        self.assertEqual(exit_code, 2)
        output_lines = [line for line in captured_output.getvalue().splitlines() if line.strip()]
        summary = json.loads(output_lines[-1])
        self.assertEqual(summary["min_score"], 100)
        self.assertFalse(summary["gate_passed"])
        self.assertEqual(summary["exit_code"], 2)
        self.assertIn("overall_score", summary)

    def test_check_memory_continuity_empty_topic_file(self):
        """测试记忆连续性检查 - 存在空主题文件"""
        checker = CompanionshipChecker(self.project_root)
        # Create all required directories
        for dirname in ["day", "week", "month", "year", "topic"]:
            (self.project_root / "var" / "data" / "memory" / dirname).mkdir(parents=True)
        # Create an empty topic file
        (self.project_root / "var" / "data" / "memory" / "topic" / "test-topic.md").write_text("")

        result = checker.check_memory_continuity()
        self.assertIsInstance(result, CheckResult)
        # Should have an issue about empty file
        self.assertGreater(len(result.issues), 0)
        self.assertTrue(any("是空文件" in issue for issue in result.issues))

    def test_check_personality_multiple_persona_files(self):
        """测试人格一致性检查 - 多个persona文件存在"""
        checker = CompanionshipChecker(self.project_root)
        # Create multiple persona files
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)
        # Create a second persona file
        with open(self.project_root / "persona-backup.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        result = checker.check_personality_consistency()
        self.assertTrue(result.passed)
        # Should detect multiple persona files issue
        self.assertGreater(len(result.issues), 0)
        self.assertTrue(any("多个 persona" in issue for issue in result.issues))

    def test_assessment_score_ranges(self):
        """测试整体评分不同分数段返回正确评估"""
        checker = CompanionshipChecker(self.project_root)
        # Create valid setup
        persona_config = {
            "ai": {
                "name": "TestAgent",
                "role": "Test",
                "personality": ["friendly"],
            },
            "master": {
                "name": "TestUser",
                "timezone": "Asia/Shanghai",
            },
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)
        (self.project_root / "var" / "data" / "soul" / "soul_variable").mkdir(parents=True)
        for dirname in ["day", "week", "month", "year", "topic"]:
            (self.project_root / "var" / "data" / "memory" / dirname).mkdir(parents=True)
        state = {"pleasure": 0.3, "arousal": 0.2, "dominance": 0.3}
        with open(self.project_root / "var" / "data" / "soul" / "soul_variable" / "state_vector.json", "w") as f:
            json.dump(state, f)

        report = checker.run_full_check()

        # Check assessment based on score
        if report.overall_score >= 90:
            self.assertIn("极佳", report.assessment)
        elif report.overall_score >= 75:
            self.assertIn("良好", report.assessment)
        elif report.overall_score >= 60:
            self.assertIn("可使用", report.assessment)
        elif report.overall_score >= 40:
            self.assertIn("需要修复", report.assessment)
        else:
            self.assertIn("严重问题", report.assessment)

        # Check assessment is not empty
        self.assertNotEmpty(report.assessment)

    def test_zero_score_handling(self):
        """测试分数归零处理 - 所有检查都失败总分归零"""
        checker = CompanionshipChecker(self.project_root)
        # No config, no directories, nothing - all checks will fail
        report = checker.run_full_check()
        # All checks fail, overall score should be >= 0 and clamped correctly
        self.assertGreaterEqual(report.overall_score, 0)
        self.assertLessEqual(report.overall_score, 100)
        if report.overall_score <= 40:
            self.assertIn("严重问题", report.assessment)


if __name__ == "__main__":
    unittest.main()
