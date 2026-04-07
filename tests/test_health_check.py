"""
AgentSoul · 健康检测模块测试
=========================

测试 HealthChecker 功能
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import tempfile
import unittest
from pathlib import Path

import yaml

from src import (
    HealthChecker,
    HealthIssue,
    HealthReport,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestHealthCheck(BaseTest):
    """测试健康检测器"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # 创建基础目录结构
        (self.project_root / "config").mkdir()
        (self.project_root / "data").mkdir()

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_checker_construction(self):
        """测试检测器初始化"""
        checker = HealthChecker(self.project_root)
        self.assertIsNotNone(checker)
        self.assertEqual(checker.project_root, self.project_root)

    def test_check_empty_directory(self):
        """测试在空目录上检测"""
        checker = HealthChecker(self.project_root)
        report = checker.run_check(include_memory_samples=False)
        self.assertIsNotNone(report)
        self.assertFalse(report.is_healthy)  # Missing config
        self.assertGreater(report.errors, 0)

    def test_check_with_config(self):
        """测试有配置文件时检测"""
        checker = HealthChecker(self.project_root)

        # 创建 minimal 配置
        persona_config = {
            "ai": {
                "name": "TestAgent",
                "role": "Test Assistant",
                "personality": ["friendly"],
                "core_values": ["user_first"],
            },
            "master": {
                "name": "TestUser",
            }
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        # 创建数据目录
        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

        report = checker.run_check(include_memory_samples=False)
        self.assertIsNotNone(report)

        # Should have info about missing optional directories, but no errors
        # persona exists and is valid, so config errors should be 0
        # data/soul/soul_variable exists, but no state file yet (warning only)
        errors = sum(1 for i in report.issues if i.level == "error")
        self.assertEqual(errors, 0)
        self.assertTrue(report.is_healthy)

    def test_invalid_json_soul_state(self):
        """测试无效 JSON 灵魂状态"""
        checker = HealthChecker(self.project_root)

        # 创建目录和无效 JSON
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            f.write("not a valid json {{{")

        # 创建配置
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_check(include_memory_samples=False)
        # Should have one error for invalid JSON
        errors = sum(1 for i in report.issues if i.level == "error")
        self.assertGreater(errors, 0)
        self.assertFalse(report.is_healthy)

        # Find the error
        error_found = any(
            "Invalid JSON" in issue.message
            for issue in report.issues
        )
        self.assertTrue(error_found)

    def test_out_of_range_pad_values(self):
        """测试 PAD 值超出范围 (-1 to 1)"""
        checker = HealthChecker(self.project_root)

        # 创建目录和无效状态文件
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            "pleasure": 2.5,  # Out of range
            "arousal": 0.5,
            "dominance": -0.5,
        }
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            json.dump(state, f)

        # 创建配置
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_check(include_memory_samples=False)
        errors = sum(1 for i in report.issues if i.level == "error")
        self.assertGreater(errors, 0)
        self.assertFalse(report.is_healthy)

    def test_valid_soul_state(self):
        """测试有效灵魂状态"""
        checker = HealthChecker(self.project_root)

        # 创建目录和有效状态文件
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            "version": "1.0.0",
            "pleasure": 0.3,
            "arousal": 0.2,
            "dominance": 0.3,
            "last_updated": "2024-01-01",
            "history": [],
        }
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            json.dump(state, f)

        # 创建配置
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_check(include_memory_samples=False)
        errors = sum(1 for i in report.issues if i.level == "error")
        self.assertEqual(errors, 0)
        self.assertTrue(report.is_healthy)
        self.assertEqual(report.soul_version, "1.0.0")

    def test_missing_behavior_yaml_warning(self):
        """测试缺失 behavior.yaml 只产生警告不产生错误"""
        checker = HealthChecker(self.project_root)

        # 只创建 persona
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

        report = checker.run_check(include_memory_samples=False)
        # Should be healthy (behavior.yaml is optional, warning only)
        self.assertTrue(report.is_healthy)
        # Should have a warning
        warnings = sum(1 for i in report.issues if i.level == "warning")
        self.assertGreater(warnings, 0)

    def test_issue_dataclass(self):
        """测试 HealthIssue 数据类"""
        issue = HealthIssue(
            level="error",
            category="config",
            message="test error",
            location="/path/to/file",
            fix_suggestion="fix it",
        )
        self.assertEqual(issue.level, "error")
        self.assertEqual(issue.category, "config")
        self.assertEqual(issue.message, "test error")

    def test_report_dataclass(self):
        """测试 HealthReport 数据类"""
        report = HealthReport(
            timestamp="2024-01-01T00:00:00",
            total_checks=10,
            errors=0,
            warnings=2,
            issues=[],
            is_healthy=True,
            soul_version="1.0.0",
        )
        self.assertEqual(report.total_checks, 10)
        self.assertEqual(report.errors, 0)
        self.assertTrue(report.is_healthy)
        self.assertEqual(report.soul_version, "1.0.0")

    def test_all_required_directories_reported(self):
        """测试所有必需目录都会被报告缺失"""
        checker = HealthChecker(self.project_root)
        # Only config exists from setUp
        issues = checker.check_directory_structure()
        # All data subdirectories are missing (info level since optional)
        info_issues = sum(1 for i in issues if i.level == "info")
        self.assertGreater(info_issues, 5)  # Multiple optional dirs missing

    def test_parse_date_from_filename(self):
        """测试日期解析各种格式"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)

        # YYYY-MM-DD
        parsed = checker._parse_date_from_filename(Path("2026-04-07.md"))
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.year, 2026)
        self.assertEqual(parsed.month, 4)
        self.assertEqual(parsed.day, 7)

        # YYYY-MM
        parsed = checker._parse_date_from_filename(Path("2026-04.md"))
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.year, 2026)
        self.assertEqual(parsed.month, 4)

        # YYYY
        parsed = checker._parse_date_from_filename(Path("2026.md"))
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.year, 2026)

        # Invalid
        parsed = checker._parse_date_from_filename(Path("invalid.md"))
        self.assertIsNone(parsed)

    def test_date_conversions(self):
        """测试日期转换方法"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)

        date = datetime(2026, 4, 7)
        week = checker._date_to_year_week(date)
        # 2026-04-07 is ISO week 15 of 2026
        self.assertEqual(week, "2026-15")

        month = checker._date_to_year_month(date)
        self.assertEqual(month, "2026-04")

        year = checker._date_to_year(date)
        self.assertEqual(year, "2026")

    def test_check_archival_consistency(self):
        """测试归档一致性检查"""
        from datetime import datetime, timedelta
        checker = HealthChecker(self.project_root)
        day_dir = self.project_root / "data" / "memory" / "day"
        day_dir.mkdir(parents=True)

        # Recent day - should not warn
        recent = (datetime.now()).strftime("%Y-%m-%d")
        (day_dir / f"{recent}.md").write_text("content")
        issues = checker.check_archival_consistency()
        self.assertEqual(len(issues), 0)

    def test_check_archival_consistency_old_day(self):
        """测试超期日记忆应该被归档但未归档会产生警告"""
        from datetime import datetime, timedelta
        checker = HealthChecker(self.project_root)
        day_dir = self.project_root / "data" / "memory" / "day"
        day_dir.mkdir(parents=True)

        # 8 days old - should warn
        old_date = (datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d")
        (day_dir / f"{old_date}.md").write_text("content")
        issues = checker.check_archival_consistency()
        warnings = [i for i in issues if "should be archived to weekly" in i.message]
        self.assertEqual(len(warnings), 1)

    def test_check_memory_files_empty_file(self):
        """测试空文件产生info提示"""
        checker = HealthChecker(self.project_root)
        day_dir = self.project_root / "data" / "memory" / "day"
        day_dir.mkdir(parents=True)
        (day_dir / "2026-04-07.md").write_text("   \n   ")

        issues = checker.check_memory_files(sample_limit=10)
        info_issues = [i for i in issues if i.level == "info" and "Empty memory file" in i.message]
        self.assertEqual(len(info_issues), 1)

    def test_check_permissions_config_not_writable(self):
        """测试配置目录不可写产生错误"""
        checker = HealthChecker(self.project_root)
        os.chmod(self.project_root / "config", 0o444)
        issues = checker.check_permissions()
        error_issues = [i for i in issues if i.level == "error" and "not writable" in i.message]
        self.assertEqual(len(error_issues), 1)
        os.chmod(self.project_root / "config", 0o755)


if __name__ == "__main__":
    unittest.main()
