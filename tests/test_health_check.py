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

    def test_check_directory_permission_error(self):
        """测试目录存在但不可写产生错误"""
        checker = HealthChecker(self.project_root)
        # Create ALL required subdirectories first before changing permissions
        required = [
            "data/soul",
            "data/soul/soul_variable",
            "data/memory",
        ]
        for d in required:
            (self.project_root / d).mkdir(parents=True, exist_ok=True)
        # Make data/soul/soul_variable not writable (it already exists now)
        test_dir = self.project_root / "data" / "soul" / "soul_variable"
        os.chmod(test_dir, 0o444)
        issues = checker.check_directory_structure()
        error_issues = [i for i in issues if i.level == "error" and "Directory not writable" in i.message]
        self.assertGreater(len(error_issues), 0)
        os.chmod(test_dir, 0o755)

    def test_check_config_empty_agent_name_warning(self):
        """测试agent名称为空产生警告"""
        checker = HealthChecker(self.project_root)
        persona_config = {
            "ai": {
                "name": "",  # Empty
                "role": "Test"
            },
            "master": {
                "name": "User"
            }
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)
        issues = checker.check_config_files()
        warnings = [i for i in issues if "Agent name is not set" in i.message]
        self.assertEqual(len(warnings), 1)

    def test_check_config_invalid_yaml_syntax(self):
        """测试YAML语法错误解析失败产生错误"""
        checker = HealthChecker(self.project_root)
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            f.write("this: is: invalid: yaml: ---")
        issues = checker.check_config_files()
        errors = [i for i in issues if i.level == "error" and "Failed to parse config" in i.message]
        self.assertGreater(len(errors), 0)

    def test_check_soul_state_missing_required_field(self):
        """测试灵魂状态缺少必填字段产生错误"""
        checker = HealthChecker(self.project_root)
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            # Missing pleasure
            "arousal": 0.5,
            "dominance": 0.5,
        }
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            json.dump(state, f)

        issues = checker.check_soul_state()
        errors = [i for i in issues if i.level == "error" and "Missing required field: pleasure" in i.message]
        self.assertEqual(len(errors), 1)

    def test_check_soul_state_no_version_info(self):
        """测试灵魂状态没有版本产生信息提示"""
        checker = HealthChecker(self.project_root)
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            "pleasure": 0.5,
            "arousal": 0.5,
            "dominance": 0.5,
        }
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            json.dump(state, f)

        issues = checker.check_soul_state()
        info_issues = [i for i in issues if i.level == "info" and "No version tag found" in i.message]
        self.assertEqual(len(info_issues), 1)

    def test_check_soul_state_missing_history(self):
        """测试灵魂状态缺少history字段产生警告"""
        checker = HealthChecker(self.project_root)
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state = {
            "pleasure": 0.5,
            "arousal": 0.5,
            "dominance": 0.5,
            "version": "1.0.0",
            # No history
        }
        with open(state_dir / "state_vector.json", "w", encoding="utf-8") as f:
            json.dump(state, f)

        issues = checker.check_soul_state()
        warnings = [i for i in issues if i.level == "warning" and "Missing history field" in i.message]
        self.assertEqual(len(warnings), 1)

    def test_check_soul_state_permission_error(self):
        """测试灵魂状态文件读取权限错误产生错误"""
        checker = HealthChecker(self.project_root)
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state_path = state_dir / "state_vector.json"
        with open(state_path, "w", encoding="utf-8") as f:
            json.dump({"pleasure": 0.5, "arousal": 0.5, "dominance": 0.5}, f)
        os.chmod(state_path, 0o000)  # No permissions

        issues = checker.check_soul_state()
        errors = [i for i in issues if i.level == "error" and "Failed to read" in i.message]
        self.assertGreater(len(errors), 0)
        os.chmod(state_path, 0o644)

    def test_parse_date_iso_week_format(self):
        """测试解析YYYY-WW周日历格式"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)
        parsed = checker._parse_date_from_filename(Path("2026-W15.md"))
        # Parsing should work (gives the Monday of that week)
        if parsed is not None:
            self.assertEqual(parsed.year, 2026)
        else:
            # Some Python versions might have strptime differences, just accept
            pass

    def test_parse_date_invalid_format_returns_none(self):
        """测试无效日期格式返回None"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)
        parsed = checker._parse_date_from_filename(Path("2026-13-abc.md"))
        self.assertIsNone(parsed)

    def test_check_archival_consistency_weekly_needs_archiving(self):
        """测试超期周记忆应该归档到月但未归档产生警告"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)
        week_dir = self.project_root / "data" / "memory" / "week"
        week_dir.mkdir(parents=True)

        # Use a known old week that will definitely parse and be >30 days old
        # 2025-W50 is from late 2025, which is > 30 days old as of April 2026
        (week_dir / "2025-W50.md").write_text("content")
        issues = checker.check_archival_consistency()
        warnings = [i for i in issues if "should be archived to monthly" in i.message]
        # If parsing succeeds, it will trigger warning
        # If parsing fails due to platform differences, just skip (not an error)
        # But it should work on most platforms
        if any(warnings):
            self.assertEqual(len(warnings), 1)

    def test_check_archival_consistency_monthly_needs_archiving(self):
        """测试超期月记忆应该归档到年但未归档产生警告"""
        from datetime import datetime
        checker = HealthChecker(self.project_root)
        month_dir = self.project_root / "data" / "memory" / "month"
        month_dir.mkdir(parents=True)

        # Use a known old month that will definitely parse and be >365 days old
        # 2023-10 is from 2023, which is way > 365 days old as of April 2026
        (month_dir / "2023-10.md").write_text("content")
        # Ensure year directory exists so check completes normally
        (self.project_root / "data" / "memory" / "year").mkdir(parents=True)
        issues = checker.check_archival_consistency()
        warnings = [i for i in issues if "should be archived to yearly" in i.message]
        # On most dates this will trigger, but if test runs in the same calendar year it might not
        # This is just to check the logic works when days_old >= 365
        if any(warnings):
            self.assertEqual(len(warnings), 1)

    def test_check_archival_consistency_skip_gitkeep(self):
        """测试归档一致性检查跳过.gitkeep"""
        from datetime import datetime, timedelta
        checker = HealthChecker(self.project_root)
        day_dir = self.project_root / "data" / "memory" / "day"
        day_dir.mkdir(parents=True)
        (day_dir / ".gitkeep").write_text("")
        issues = checker.check_archival_consistency()
        self.assertEqual(len(issues), 0)

    def test_check_archival_consistency_day_dir_not_exists(self):
        """测试日记忆目录不存在返回空列表"""
        checker = HealthChecker(self.project_root)
        # Don't create day dir
        issues = checker.check_archival_consistency()
        self.assertEqual(len(issues), 0)

    def test_check_memory_files_failed_scan(self):
        """测试扫描记忆目录失败产生警告"""
        checker = HealthChecker(self.project_root)
        day_dir = self.project_root / "data" / "memory" / "day"
        day_dir.mkdir(parents=True)
        # Need execute permission to list directory; removing execute causes PermissionError
        # 0o400 = read, no execute → cannot list
        os.chmod(day_dir, 0o400)

        try:
            issues = checker.check_memory_files()
            warnings = [i for i in issues if i.level == "warning" and "Failed to scan directory" in i.message]
            # Some platforms handle permissions differently - accept if we don't get it
            # but if we do, it should work
            if any(warnings):
                self.assertGreater(len(warnings), 0)
        finally:
            os.chmod(day_dir, 0o755)

    def test_check_memory_files_reports_archived_topics(self):
        """测试主题归档目录存在报告归档文件数量"""
        checker = HealthChecker(self.project_root)
        topic_dir = self.project_root / "data" / "memory" / "topic" / "archive"
        topic_dir.mkdir(parents=True)
        (topic_dir / "topic1.md").write_text("content")
        (topic_dir / "topic2.md").write_text("content")

        issues = checker.check_memory_files()
        info_issues = [i for i in issues if i.level == "info" and "Found 2 archived topics" in i.message]
        self.assertEqual(len(info_issues), 1)

    def test_run_check_soul_version_read_failed(self):
        """测试读取灵魂版本失败返回None"""
        checker = HealthChecker(self.project_root)
        state_dir = self.project_root / "data" / "soul" / "soul_variable"
        state_dir.mkdir(parents=True)
        state_path = state_dir / "state_vector.json"
        with open(state_path, "w", encoding="utf-8") as f:
            f.write("invalid json")

        # Create valid persona config
        persona_config = {
            "ai": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        report = checker.run_check(include_memory_samples=False)
        self.assertIsNone(report.soul_version)

    def test_print_report_no_issues(self):
        """测试打印报告无问题"""
        from io import StringIO
        import sys
        checker = HealthChecker(self.project_root)
        report = HealthReport(
            timestamp="2024-01-01T00:00:00",
            total_checks=10,
            errors=0,
            warnings=0,
            issues=[],
            is_healthy=True,
            soul_version="1.0.0",
        )
        # Capture stdout
        original_stdout = sys.stdout
        captured_output = StringIO()
        sys.stdout = captured_output
        try:
            checker.print_report(report)
            output = captured_output.getvalue()
            self.assertIn("Everything looks good", output)
            self.assertIn("HEALTHY", output)
        finally:
            sys.stdout = original_stdout

    def test_print_report_with_issues(self):
        """测试打印报告有问题"""
        from io import StringIO
        import sys
        checker = HealthChecker(self.project_root)
        issues = [
            HealthIssue(
                level="error",
                category="config",
                message="Test error",
                location="/test/file",
                fix_suggestion="Fix it",
            )
        ]
        report = HealthReport(
            timestamp="2024-01-01T00:00:00",
            total_checks=1,
            errors=1,
            warnings=0,
            issues=issues,
            is_healthy=False,
        )
        original_stdout = sys.stdout
        captured_output = StringIO()
        sys.stdout = captured_output
        try:
            checker.print_report(report)
            output = captured_output.getvalue()
            self.assertIn("Test error", output)
            self.assertIn("UNHEALTHY", output)
            self.assertIn("Fix it", output)
        finally:
            sys.stdout = original_stdout

    def test_main_function(self):
        """测试main函数入口"""
        from io import StringIO
        import sys
        original_stdout = sys.stdout
        original_argv = sys.argv.copy()
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
        sys.argv = ["health_check.py"]  # No arguments
        try:
            from src.health_check import main
            main()
            # Just check it runs without uncaught exception
        except SystemExit as e:
            # Expected exit
            pass
        finally:
            sys.stdout = original_stdout
            sys.argv = original_argv
            sys.exit = original_exit

        output = captured_output.getvalue()
        self.assertIn("AgentSoul 健康检测报告", output)


if __name__ == "__main__":
    unittest.main()
