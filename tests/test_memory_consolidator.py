"""
Tests for MemoryConsolidator and TextSummarizer
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Ensure project root is on sys.path so `common` package resolves correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentsoul.memory.enhanced.memory_consolidator import (
    ConsolidationResult,
    ConsolidationStatus,
    MemoryConsolidator,
    TextSummarizer,
)


@pytest.fixture
def tmp_data(tmp_path):
    """Provide a temporary memory data directory."""
    data_dir = tmp_path / "memory"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def consolidator(tmp_data):
    """Create a consolidator with temporary storage."""
    return MemoryConsolidator(data_path=tmp_data)


def _create_day_memory(day_dir: Path, date: str, content: str, tags: list[str] | None = None):
    """Helper to create a daily memory file."""
    day_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "content": content,
        "tags": tags or ["test"],
        "priority": "medium",
    }
    with open(day_dir / f"{date}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def _create_week_memory(week_dir: Path, filename: str, content: str, tags: list[str] | None = None):
    """Helper to create a weekly summary file."""
    week_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "type": "weekly_summary",
        "content": content,
        "tags": tags or ["test"],
        "consolidation_status": "complete",
    }
    with open(week_dir / filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def _create_month_memory(month_dir: Path, filename: str, content: str, tags: list[str] | None = None):
    """Helper to create a monthly summary file."""
    month_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "type": "monthly_summary",
        "content": content,
        "tags": tags or ["test"],
        "consolidation_status": "complete",
    }
    with open(month_dir / filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


class TestTextSummarizer:
    """Tests for rule-based text summarizer."""

    def test_empty_input(self):
        summary, facts, emotions = TextSummarizer.summarize([])
        assert summary == ""
        assert facts == []
        assert emotions == []

    def test_single_text(self):
        texts = ["今天完成了重要的项目里程碑。客户非常满意。"]
        summary, facts, emotions = TextSummarizer.summarize(texts)
        assert len(summary) > 0
        assert "重要" in summary or "完成" in summary

    def test_multiple_texts(self):
        texts = [
            "今天完成了重要任务1。",
            "遇到了关键技术问题需要记住。",
            "和客户沟通了需求，客户满意。",
        ]
        summary, facts, emotions = TextSummarizer.summarize(texts, max_length=300)
        assert len(summary) > 0
        assert len(facts) > 0

    def test_max_length_respected(self):
        texts = ["这是一段很长的文本。" * 50]
        summary, _, _ = TextSummarizer.summarize(texts, max_length=100)
        assert len(summary) <= 120  # allow some overflow for sentence boundaries

    def test_emotion_detection(self):
        texts = ["今天非常开心，完成了任务！但是有些焦虑明天的截止日期。"]
        _, _, emotions = TextSummarizer.summarize(texts)
        assert "开心" in emotions
        assert "焦虑" in emotions

    def test_deduplication(self):
        texts = [
            "完成了重要任务A。",
            "完成了重要任务A。",  # duplicate
            "完成了重要任务B。",
        ]
        summary, facts, _ = TextSummarizer.summarize(texts)
        # Should not contain exact duplicates
        assert len(summary) > 0

    def test_chinese_and_english(self):
        texts = [
            "This is an important discovery about the project.",
            "这是一个关键的发现。",
        ]
        summary, facts, _ = TextSummarizer.summarize(texts)
        assert len(summary) > 0


class TestDailyToWeeklyConsolidation:
    """Tests for daily → weekly consolidation."""

    def test_basic_consolidation(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        for i in range(1, 4):
            _create_day_memory(day_dir, f"2025-01-0{i}", f"1月{i}日的日志，完成了重要任务{i}。")

        result = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert result.success
        assert result.source_count == 3
        assert result.source_level == "daily"
        assert result.target_level == "weekly"
        assert result.summary_length > 0

    def test_output_file_created(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "测试内容")

        consolidator.consolidate_daily_to_weekly(year=2025, week=1)

        target = tmp_data / "week" / "2025-W01.json"
        assert target.exists()
        with open(target, encoding="utf-8") as f:
            data = json.load(f)
        assert data["type"] == "weekly_summary"
        assert data["consolidation_status"] == "complete"

    def test_no_source_data(self, consolidator):
        result = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert not result.success
        assert result.error == "no_source_data"

    def test_already_consolidated_skipped(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "测试内容")

        # First consolidation
        result1 = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert result1.success
        assert result1.source_count == 1

        # Second consolidation without force
        result2 = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert result2.success
        assert result2.source_count == 0  # skipped

    def test_force_reconsolidation(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "测试内容")

        consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        result = consolidator.consolidate_daily_to_weekly(year=2025, week=1, force=True)
        assert result.success
        assert result.source_count == 1

    def test_tags_merged(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "内容1", tags=["工作", "重要"])
        _create_day_memory(day_dir, "2025-01-02", "内容2", tags=["学习", "重要"])

        result = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert "工作" in result.tags
        assert "学习" in result.tags
        assert "重要" in result.tags

    def test_empty_memory_skipped(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "")  # empty content
        _create_day_memory(day_dir, "2025-01-02", "有内容")

        result = consolidator.consolidate_daily_to_weekly(year=2025, week=1)
        assert result.success
        assert result.source_count == 1
        assert len(result.skipped) >= 1  # one empty file skipped


class TestWeeklyToMonthlyConsolidation:
    """Tests for weekly → monthly consolidation."""

    def test_basic_consolidation(self, consolidator, tmp_data):
        week_dir = tmp_data / "week"
        _create_week_memory(week_dir, "2025-W01.json", "第一周摘要内容")
        _create_week_memory(week_dir, "2025-W02.json", "第二周摘要内容")

        result = consolidator.consolidate_weekly_to_monthly(year=2025, month=1)
        assert result.success
        assert result.source_count >= 1
        assert result.source_level == "weekly"
        assert result.target_level == "monthly"

    def test_fallback_to_daily(self, consolidator, tmp_data):
        # No weekly summaries, but daily memories exist
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "日记忆内容")

        result = consolidator.consolidate_weekly_to_monthly(year=2025, month=1)
        assert result.success
        assert result.source_count >= 1

    def test_no_source_data(self, consolidator):
        result = consolidator.consolidate_weekly_to_monthly(year=2025, month=6)
        assert not result.success

    def test_output_file_created(self, consolidator, tmp_data):
        week_dir = tmp_data / "week"
        _create_week_memory(week_dir, "2025-W01.json", "周摘要")

        consolidator.consolidate_weekly_to_monthly(year=2025, month=1)

        target = tmp_data / "month" / "2025-01.json"
        assert target.exists()


class TestMonthlyToYearlyConsolidation:
    """Tests for monthly → yearly consolidation."""

    def test_basic_consolidation(self, consolidator, tmp_data):
        month_dir = tmp_data / "month"
        for m in range(1, 4):
            _create_month_memory(month_dir, f"2025-{m:02d}.json", f"{m}月摘要")

        result = consolidator.consolidate_monthly_to_yearly(year=2025)
        assert result.success
        assert result.source_count == 3
        assert result.source_level == "monthly"
        assert result.target_level == "yearly"

    def test_output_file_created(self, consolidator, tmp_data):
        month_dir = tmp_data / "month"
        _create_month_memory(month_dir, "2025-01.json", "月摘要")

        consolidator.consolidate_monthly_to_yearly(year=2025)

        target = tmp_data / "year" / "2025.json"
        assert target.exists()
        with open(target, encoding="utf-8") as f:
            data = json.load(f)
        assert data["type"] == "yearly_summary"

    def test_no_source_data(self, consolidator):
        result = consolidator.consolidate_monthly_to_yearly(year=2025)
        assert not result.success


class TestAutoConsolidation:
    """Tests for auto-detect consolidation."""

    def test_auto_consolidate_no_data(self, consolidator):
        results = consolidator.auto_consolidate()
        # Should not crash even with no data
        assert isinstance(results, list)


class TestConsolidationStatus:
    """Tests for consolidation status tracking."""

    def test_get_status(self, consolidator, tmp_data):
        status = consolidator.get_status()
        assert isinstance(status, ConsolidationStatus)
        assert hasattr(status, "pending_daily")
        assert hasattr(status, "pending_weekly")
        assert hasattr(status, "pending_monthly")

    def test_status_counts_pending(self, consolidator, tmp_data):
        day_dir = tmp_data / "day"
        _create_day_memory(day_dir, "2025-01-01", "内容1")
        _create_day_memory(day_dir, "2025-01-02", "内容2")

        status = consolidator.get_status()
        assert status.pending_daily >= 2
