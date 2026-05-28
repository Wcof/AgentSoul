"""
AgentSoul · 记忆合并管线
========================

自动完成日→周→月→年的记忆摘要合并，遵循分层记忆架构：
- Daily → Weekly: 每周自动合并当周日志为周摘要
- Weekly → Monthly: 每月自动合并当周摘要为月摘要
- Monthly → Yearly: 每年自动合并当月摘要为年摘要

设计原则：
- 摘要采用"信息密度递增"策略：越高层越精炼
- 合并时保留关键事实、情感标记和重要标签
- 支持手动触发和自动检测
- 所有操作可审计
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from common import get_project_root, log


# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class ConsolidationResult:
    """合并结果"""
    success: bool
    source_level: str        # "daily" / "weekly" / "monthly"
    target_level: str        # "weekly" / "monthly" / "yearly"
    source_count: int        # 合并的源文件数
    target_path: str         # 目标文件路径
    summary_length: int      # 摘要字符数
    key_facts: list[str]     # 提取的关键事实
    emotions: list[str]      # 检测到的情感标记
    tags: list[str]          # 合并后的标签
    skipped: list[str]       # 跳过的文件（已合并或空）
    error: str | None = None


@dataclass
class ConsolidationStatus:
    """合并管线状态"""
    last_daily_consolidation: datetime | None = None
    last_weekly_consolidation: datetime | None = None
    last_monthly_consolidation: datetime | None = None
    total_consolidations: int = 0
    pending_daily: int = 0
    pending_weekly: int = 0
    pending_monthly: int = 0


# ============================================================================
# Text Summarizer
# ============================================================================

class TextSummarizer:
    """
    文本摘要器

    不依赖 LLM，基于规则的关键信息提取：
    1. TF-IDF 加权：罕见词比常见词更重要
    2. 提取关键句（含标记词、数字、情感词的句子）
    3. 去重（Jaccard 句级相似度检测）
    4. 压缩（去除冗余修饰词）
    """

    # 关键标记词（中英文）
    IMPORTANT_MARKERS = [
        "重要", "关键", "决定", "完成", "失败", "突破", "发现",
        "important", "key", "decided", "completed", "failed", "breakthrough", "found",
        "记住", "注意", "提醒", "目标", "计划",
        "remember", "note", "remind", "goal", "plan",
    ]

    # 情感标记词
    EMOTION_MARKERS = [
        "开心", "高兴", "兴奋", "满意", "感谢", "喜欢",
        "难过", "失望", "沮丧", "焦虑", "担心", "讨厌",
        "happy", "glad", "excited", "satisfied", "grateful", "like",
        "sad", "disappointed", "frustrated", "anxious", "worried", "dislike",
    ]

    @classmethod
    def _tokenize(cls, text: str) -> list[str]:
        """简单分词：中文按字、英文按词"""
        tokens: list[str] = []
        for chunk in re.findall(r"[\u4e00-\u9fff]+|[a-zA-Z]+|\d+", text.lower()):
            if re.match(r"[\u4e00-\u9fff]+", chunk):
                tokens.extend(chunk)  # 中文逐字
            else:
                tokens.append(chunk)
        return tokens

    @classmethod
    def _compute_idf(cls, sentences: list[str]) -> dict[str, float]:
        """计算逆文档频率（IDF）"""
        n_docs = len(sentences)
        if n_docs == 0:
            return {}
        doc_freq: dict[str, int] = {}
        for sent in sentences:
            tokens = set(cls._tokenize(sent))
            for t in tokens:
                doc_freq[t] = doc_freq.get(t, 0) + 1
        idf: dict[str, float] = {}
        for token, df in doc_freq.items():
            idf[token] = math.log(n_docs / (1 + df)) + 1.0  # +1 平滑
        return idf

    @classmethod
    def summarize(cls, texts: list[str], max_length: int = 500) -> tuple[str, list[str], list[str]]:
        """
        从多条文本中提取摘要

        Args:
            texts: 原始文本列表
            max_length: 摘要最大长度（字符数）

        Returns:
            (摘要文本, 关键事实列表, 情感标记列表)
        """
        if not texts:
            return "", [], []

        # 分句
        all_sentences: list[str] = []
        for text in texts:
            sentences = re.split(r"[。！？.!?\n]+", text)
            for s in sentences:
                s = s.strip()
                if s and len(s) > 5:  # 过滤太短的片段
                    all_sentences.append(s)

        if not all_sentences:
            return "", [], []

        # TF-IDF 加权
        idf = cls._compute_idf(all_sentences)

        # 按重要性评分
        scored: list[tuple[str, float]] = []
        key_facts: list[str] = []
        emotions: list[str] = []

        for sentence in all_sentences:
            score = 0.0

            # TF-IDF 基础分：句中词的 IDF 总和
            tokens = cls._tokenize(sentence)
            tfidf_sum = sum(idf.get(t, 1.0) for t in tokens)
            score += min(tfidf_sum / max(len(tokens), 1), 5.0)  # 归一化，上限 5

            # 标记词加分
            for marker in cls.IMPORTANT_MARKERS:
                if marker in sentence.lower():
                    score += 2.0
                    if len(key_facts) < 20:  # 限制关键事实数
                        key_facts.append(sentence[:100])
                    break

            # 情感词加分
            for marker in cls.EMOTION_MARKERS:
                if marker in sentence.lower():
                    score += 1.0
                    if len(emotions) < 10:
                        emotions.append(marker)
                    break

            # 包含数字的句子加分（通常包含具体信息）
            if re.search(r"\d+", sentence):
                score += 0.5

            # 长度适中加分
            if 20 <= len(sentence) <= 100:
                score += 0.3

            scored.append((sentence, score))

        # 去重：基于 Jaccard 词重叠度
        unique_scored: list[tuple[str, float]] = []
        for sentence, score in scored:
            is_dup = False
            words_s = set(cls._tokenize(sentence))
            for existing, _ in unique_scored:
                words_e = set(cls._tokenize(existing))
                if words_s and words_e:
                    overlap = len(words_s & words_e) / max(len(words_s | words_e), 1)
                    if overlap > 0.7:
                        is_dup = True
                        break
            if not is_dup:
                unique_scored.append((sentence, score))

        # 按评分排序，取 top 摘要
        unique_scored.sort(key=lambda x: x[1], reverse=True)

        summary_parts: list[str] = []
        current_length = 0
        for sentence, _ in unique_scored:
            if current_length + len(sentence) > max_length:
                break
            summary_parts.append(sentence)
            current_length += len(sentence)

        summary = "。".join(summary_parts)
        if summary and not summary.endswith(("。", "！", "？", ".", "!", "?")):
            summary += "。"

        # 去重关键事实
        seen_facts: set[str] = set()
        unique_facts: list[str] = []
        for fact in key_facts:
            normalized = fact.strip().lower()
            if normalized not in seen_facts:
                seen_facts.add(normalized)
                unique_facts.append(fact)

        # 去重情感
        unique_emotions = list(dict.fromkeys(emotions))

        return summary, unique_facts, unique_emotions


# ============================================================================
# Memory Consolidator
# ============================================================================

class MemoryConsolidator:
    """
    记忆合并管线

    自动完成分层记忆的摘要合并：
    - Daily → Weekly
    - Weekly → Monthly
    - Monthly → Yearly
    """

    LEVEL_MAP = {
        "daily": {"dir": "day", "next": "weekly"},
        "weekly": {"dir": "week", "next": "monthly"},
        "monthly": {"dir": "month", "next": "yearly"},
        "yearly": {"dir": "year", "next": None},
    }

    def __init__(self, data_path: Path | None = None):
        if data_path is None:
            data_path = get_project_root() / "data" / "memory"
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)

        # 各级记忆目录
        self.day_dir = data_path / "day"
        self.week_dir = data_path / "week"
        self.month_dir = data_path / "month"
        self.year_dir = data_path / "year"

        for d in [self.day_dir, self.week_dir, self.month_dir, self.year_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def _read_memory(self, path: Path) -> dict[str, Any] | None:
        """安全读取记忆文件"""
        if not path.exists():
            return None
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log(f"MemoryConsolidator: 读取 {path.name} 失败: {e}", "WARN")
            return None

    def _write_memory(self, path: Path, data: dict[str, Any]) -> None:
        """安全写入记忆文件"""
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"MemoryConsolidator: 写入 {path.name} 失败: {e}", "ERROR")

    def _get_date_range_for_week(self, year: int, week: int) -> tuple[str, str]:
        """获取指定周的日期范围 (start_date, end_date)"""
        # ISO week: 周一开始
        jan4 = datetime(year, 1, 4)
        start_of_week1 = jan4 - timedelta(days=jan4.isoweekday() - 1)
        week_start = start_of_week1 + timedelta(weeks=week - 1)
        week_end = week_start + timedelta(days=6)
        return week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")

    def _get_weeks_in_month(self, year: int, month: int) -> list[int]:
        """获取指定月份包含的周数"""
        first_day = datetime(year, month, 1)
        if month == 12:
            last_day = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = datetime(year, month + 1, 1) - timedelta(days=1)

        weeks = set()
        current = first_day
        while current <= last_day:
            iso_week = current.isocalendar()[1]
            weeks.add(iso_week)
            current += timedelta(days=1)

        return sorted(weeks)

    # ---- Daily → Weekly ----

    def consolidate_daily_to_weekly(self, year: int = None, week: int = None, force: bool = False) -> ConsolidationResult:
        """
        合并日记忆为周摘要

        Args:
            year: 年份（默认当前年）
            week: 周数（默认当前周）
            force: 强制重新合并

        Returns:
            ConsolidationResult
        """
        now = datetime.now()
        year = year or now.year
        week = week or now.isocalendar()[1]

        start_date, end_date = self._get_date_range_for_week(year, week)
        target_file = self.week_dir / f"{year}-W{week:02d}.json"

        # 检查是否已合并
        if target_file.exists() and not force:
            existing = self._read_memory(target_file)
            if existing and existing.get("consolidation_status") == "complete":
                return ConsolidationResult(
                    success=True,
                    source_level="daily",
                    target_level="weekly",
                    source_count=0,
                    target_path=str(target_file),
                    summary_length=0,
                    key_facts=[],
                    emotions=[],
                    tags=[],
                    skipped=[f"already consolidated: {target_file.name}"],
                )

        # 收集源日记忆
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        source_texts: list[str] = []
        source_count = 0
        skipped: list[str] = []
        all_tags: set[str] = set()

        for i in range(7):
            date = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
            day_file = self.day_dir / f"{date}.json"
            if day_file.exists():
                data = self._read_memory(day_file)
                if data and data.get("content"):
                    source_texts.append(data["content"])
                    source_count += 1
                    all_tags.update(data.get("tags", []))
                else:
                    skipped.append(f"empty: {day_file.name}")
            else:
                skipped.append(f"missing: {date}")

        if not source_texts:
            return ConsolidationResult(
                success=False,
                source_level="daily",
                target_level="weekly",
                source_count=0,
                target_path=str(target_file),
                summary_length=0,
                key_facts=[],
                emotions=[],
                tags=[],
                skipped=skipped,
                error="no_source_data",
            )

        # 生成摘要
        summary, key_facts, emotions = TextSummarizer.summarize(source_texts, max_length=500)

        # 写入周摘要
        week_data = {
            "type": "weekly_summary",
            "year": year,
            "week": week,
            "date_range": {"start": start_date, "end": end_date},
            "content": summary,
            "key_facts": key_facts,
            "emotions": emotions,
            "tags": sorted(all_tags),
            "source_count": source_count,
            "consolidation_status": "complete",
            "consolidated_at": datetime.now().isoformat(),
        }

        self._write_memory(target_file, week_data)

        log(f"MemoryConsolidator: 日→周合并完成 {year}-W{week:02d} ({source_count} files)", "OK")

        return ConsolidationResult(
            success=True,
            source_level="daily",
            target_level="weekly",
            source_count=source_count,
            target_path=str(target_file),
            summary_length=len(summary),
            key_facts=key_facts,
            emotions=emotions,
            tags=sorted(all_tags),
            skipped=skipped,
        )

    # ---- Weekly → Monthly ----

    def consolidate_weekly_to_monthly(self, year: int = None, month: int = None, force: bool = False) -> ConsolidationResult:
        """
        合并周摘要为月摘要

        Args:
            year: 年份
            month: 月份
            force: 强制重新合并

        Returns:
            ConsolidationResult
        """
        now = datetime.now()
        year = year or now.year
        month = month or now.month

        target_file = self.month_dir / f"{year}-{month:02d}.json"

        # 检查是否已合并
        if target_file.exists() and not force:
            existing = self._read_memory(target_file)
            if existing and existing.get("consolidation_status") == "complete":
                return ConsolidationResult(
                    success=True,
                    source_level="weekly",
                    target_level="monthly",
                    source_count=0,
                    target_path=str(target_file),
                    summary_length=0,
                    key_facts=[],
                    emotions=[],
                    tags=[],
                    skipped=[f"already consolidated: {target_file.name}"],
                )

        # 收集源周摘要
        weeks = self._get_weeks_in_month(year, month)
        source_texts: list[str] = []
        source_count = 0
        skipped: list[str] = []
        all_tags: set[str] = set()

        for week in weeks:
            week_file = self.week_dir / f"{year}-W{week:02d}.json"
            if week_file.exists():
                data = self._read_memory(week_file)
                if data and data.get("content"):
                    source_texts.append(data["content"])
                    source_count += 1
                    all_tags.update(data.get("tags", []))
                else:
                    skipped.append(f"empty: {week_file.name}")
            else:
                skipped.append(f"missing: W{week:02d}")

        # 如果没有周摘要，尝试直接从日记忆合并
        if not source_texts:
            log(f"MemoryConsolidator: 无周摘要，尝试直接从日记忆合并 {year}-{month:02d}", "INFO")
            days_in_month = 31 if month in [1, 3, 5, 7, 8, 10, 12] else (30 if month in [4, 6, 9, 11] else (29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28))
            for day in range(1, days_in_month + 1):
                date_str = f"{year}-{month:02d}-{day:02d}"
                day_file = self.day_dir / f"{date_str}.json"
                if day_file.exists():
                    data = self._read_memory(day_file)
                    if data and data.get("content"):
                        source_texts.append(data["content"])
                        source_count += 1
                        all_tags.update(data.get("tags", []))

        if not source_texts:
            return ConsolidationResult(
                success=False,
                source_level="weekly",
                target_level="monthly",
                source_count=0,
                target_path=str(target_file),
                summary_length=0,
                key_facts=[],
                emotions=[],
                tags=[],
                skipped=skipped,
                error="no_source_data",
            )

        # 月摘要更精炼
        summary, key_facts, emotions = TextSummarizer.summarize(source_texts, max_length=800)

        month_data = {
            "type": "monthly_summary",
            "year": year,
            "month": month,
            "content": summary,
            "key_facts": key_facts,
            "emotions": emotions,
            "tags": sorted(all_tags),
            "source_count": source_count,
            "consolidation_status": "complete",
            "consolidated_at": datetime.now().isoformat(),
        }

        self._write_memory(target_file, month_data)

        log(f"MemoryConsolidator: 周→月合并完成 {year}-{month:02d} ({source_count} files)", "OK")

        return ConsolidationResult(
            success=True,
            source_level="weekly",
            target_level="monthly",
            source_count=source_count,
            target_path=str(target_file),
            summary_length=len(summary),
            key_facts=key_facts,
            emotions=emotions,
            tags=sorted(all_tags),
            skipped=skipped,
        )

    # ---- Monthly → Yearly ----

    def consolidate_monthly_to_yearly(self, year: int = None, force: bool = False) -> ConsolidationResult:
        """
        合并月摘要为年摘要

        Args:
            year: 年份
            force: 强制重新合并

        Returns:
            ConsolidationResult
        """
        now = datetime.now()
        year = year or now.year

        target_file = self.year_dir / f"{year}.json"

        # 检查是否已合并
        if target_file.exists() and not force:
            existing = self._read_memory(target_file)
            if existing and existing.get("consolidation_status") == "complete":
                return ConsolidationResult(
                    success=True,
                    source_level="monthly",
                    target_level="yearly",
                    source_count=0,
                    target_path=str(target_file),
                    summary_length=0,
                    key_facts=[],
                    emotions=[],
                    tags=[],
                    skipped=[f"already consolidated: {target_file.name}"],
                )

        # 收集源月摘要
        source_texts: list[str] = []
        source_count = 0
        skipped: list[str] = []
        all_tags: set[str] = set()

        for month in range(1, 13):
            month_file = self.month_dir / f"{year}-{month:02d}.json"
            if month_file.exists():
                data = self._read_memory(month_file)
                if data and data.get("content"):
                    source_texts.append(data["content"])
                    source_count += 1
                    all_tags.update(data.get("tags", []))
                else:
                    skipped.append(f"empty: {month_file.name}")
            else:
                skipped.append(f"missing: {month:02d}")

        if not source_texts:
            return ConsolidationResult(
                success=False,
                source_level="monthly",
                target_level="yearly",
                source_count=0,
                target_path=str(target_file),
                summary_length=0,
                key_facts=[],
                emotions=[],
                tags=[],
                skipped=skipped,
                error="no_source_data",
            )

        # 年摘要最精炼
        summary, key_facts, emotions = TextSummarizer.summarize(source_texts, max_length=1200)

        year_data = {
            "type": "yearly_summary",
            "year": year,
            "content": summary,
            "key_facts": key_facts,
            "emotions": emotions,
            "tags": sorted(all_tags),
            "source_count": source_count,
            "consolidation_status": "complete",
            "consolidated_at": datetime.now().isoformat(),
        }

        self._write_memory(target_file, year_data)

        log(f"MemoryConsolidator: 月→年合并完成 {year} ({source_count} files)", "OK")

        return ConsolidationResult(
            success=True,
            source_level="monthly",
            target_level="yearly",
            source_count=source_count,
            target_path=str(target_file),
            summary_length=len(summary),
            key_facts=key_facts,
            emotions=emotions,
            tags=sorted(all_tags),
            skipped=skipped,
        )

    # ---- Auto-detect and Run ----

    def auto_consolidate(self) -> list[ConsolidationResult]:
        """
        自动检测并执行需要的合并

        Returns:
            本次执行的合并结果列表
        """
        results: list[ConsolidationResult] = []
        now = datetime.now()

        # Daily → Weekly: 检查上周是否已合并
        last_week = now - timedelta(weeks=1)
        result = self.consolidate_daily_to_weekly(
            year=last_week.year,
            week=last_week.isocalendar()[1],
        )
        if result.source_count > 0 or result.error:
            results.append(result)

        # Weekly → Monthly: 检查上月是否已合并
        if now.month > 1:
            prev_month = now.month - 1
            prev_year = now.year
        else:
            prev_month = 12
            prev_year = now.year - 1

        result = self.consolidate_weekly_to_monthly(year=prev_year, month=prev_month)
        if result.source_count > 0 or result.error:
            results.append(result)

        # Monthly → Yearly: 检查去年是否已合并
        if now.year > 2020:
            result = self.consolidate_monthly_to_yearly(year=now.year - 1)
            if result.source_count > 0 or result.error:
                results.append(result)

        return results

    # ---- Status ----

    def get_status(self) -> ConsolidationStatus:
        """获取合并管线状态"""
        status = ConsolidationStatus()
        now = datetime.now()

        # 检查待合并的日记忆
        if self.day_dir.exists():
            for f in self.day_dir.glob("*.json"):
                data = self._read_memory(f)
                if data and data.get("content"):
                    status.pending_daily += 1

        # 检查待合并的周摘要
        if self.week_dir.exists():
            for f in self.week_dir.glob("*.json"):
                data = self._read_memory(f)
                if data and data.get("content"):
                    status.pending_weekly += 1

        # 检查待合并的月摘要
        if self.month_dir.exists():
            for f in self.month_dir.glob("*.json"):
                data = self._read_memory(f)
                if data and data.get("content"):
                    status.pending_monthly += 1

        # 读取最近的合并时间
        status_file = self.data_path / "consolidation_status.json"
        if status_file.exists():
            try:
                with open(status_file, encoding="utf-8") as f:
                    saved = json.load(f)
                if saved.get("last_daily_consolidation"):
                    status.last_daily_consolidation = datetime.fromisoformat(saved["last_daily_consolidation"])
                if saved.get("last_weekly_consolidation"):
                    status.last_weekly_consolidation = datetime.fromisoformat(saved["last_weekly_consolidation"])
                if saved.get("last_monthly_consolidation"):
                    status.last_monthly_consolidation = datetime.fromisoformat(saved["last_monthly_consolidation"])
                status.total_consolidations = saved.get("total_consolidations", 0)
            except Exception:
                pass

        return status
