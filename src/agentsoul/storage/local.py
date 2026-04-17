"""
AgentSoul · 本地文件系统存储实现
=============================

实现统一抽象接口的本地文件存储，用于：
- OpenAI 链路直接存储
- 独立运行模式存储
- 向后兼容传统文件布局
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from agentsoul.common import get_project_root, log
from agentsoul.runtime.paths import resolve_var_data_root
from agentsoul.abstract import (
    BaseMemoryStorage,
    BasePersonaStorage,
    BaseSkillStorage,
    BaseSoulStateStorage,
    MemoryConflict,
    SoulVersion,
)


class LocalPersonaStorage(BasePersonaStorage):
    """本地文件系统人格存储实现"""

    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or get_project_root()
        self.config_path = self.project_root / "config" / "persona.yaml"
        self._version_cache: SoulVersion | None = None

    def read_persona_config(self) -> dict[str, Any]:
        """读取人格配置"""
        if not self.config_path.exists():
            log(f"Persona config not found at {self.config_path}, using defaults", level="WARNING")
            return {
                "ai": {
                    "name": "Agent",
                    "nickname": "",
                    "naming_mode": "default",
                    "role": "AI Assistant",
                    "personality": [],
                    "core_values": [],
                    "interaction_style": {},
                },
                "master": {
                    "name": "",
                    "nickname": [],
                    "timezone": "Asia/Shanghai",
                    "labels": [],
                },
            }

        with open(self.config_path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def write_persona_config(self, config: dict[str, Any]) -> bool:
        """写入人格配置，带原子保证"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            # 原子写入：先写临时文件再重命名
            temp_path = f"{self.config_path}.tmp.{int(datetime.now().timestamp())}"
            with open(temp_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, allow_unicode=True, sort_keys=False)
            os.replace(temp_path, self.config_path)
            # 版本缓存失效
            self._version_cache = None
            return True
        except Exception as e:
            log(f"Failed to write persona config: {e}", level="ERROR")
            return False

    def get_version(self) -> SoulVersion:
        """获取当前人格版本，基于文件内容哈希"""
        if self._version_cache is not None:
            return self._version_cache

        if not self.config_path.exists():
            self._version_cache = SoulVersion(
                version="0.0.0",
                timestamp=datetime.now().isoformat(),
                checksum=None,
                description="Empty/default configuration"
            )
            return self._version_cache

        # 计算内容哈希作为版本标识
        try:
            with open(self.config_path, "rb") as f:
                content = f.read()
            checksum = hashlib.md5(content).hexdigest()[:8]
            mtime = datetime.fromtimestamp(self.config_path.stat().st_mtime)

            self._version_cache = SoulVersion(
                version=f"1.0.{int(mtime.timestamp())}",
                timestamp=mtime.isoformat(),
                checksum=checksum,
                description=f"Persona config modified at {mtime}"
            )
            return self._version_cache
        except Exception as e:
            log(f"Failed to read persona config for version checking: {e}, using default version", level="WARNING")
            self._version_cache = SoulVersion(
                version="0.0.0",
                timestamp=datetime.now().isoformat(),
                checksum=None,
                description=f"Failed to read config: {e}"
            )
            return self._version_cache


class LocalSoulStateStorage(BaseSoulStateStorage):
    """本地文件系统灵魂状态存储实现"""

    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or get_project_root()
        data_root = resolve_var_data_root(self.project_root)
        self.state_path = data_root / "soul" / "soul_variable" / "state_vector.json"
        # 版本历史存储在同目录
        self.history_dir = data_root / "soul" / "versions"

    def read_soul_state(self) -> dict[str, Any]:
        """读取灵魂状态"""
        if not self.state_path.exists():
            # 返回默认状态
            return {
                "version": "1.0.0",
                "pleasure": 0.3,
                "arousal": 0.2,
                "dominance": 0.3,
                "last_updated": None,
                "history": [],
            }

        try:
            with open(self.state_path, encoding="utf-8") as f:
                result: dict[str, Any] = json.load(f)
                return result
        except Exception as e:
            log(f"Failed to read soul state: {e}, using defaults", level="ERROR")
            return {
                "version": "1.0.0",
                "pleasure": 0.3,
                "arousal": 0.2,
                "dominance": 0.3,
                "last_updated": None,
                "history": [],
            }

    def write_soul_state(self, state: dict[str, Any]) -> bool:
        """写入灵魂状态，带原子保证和版本快照"""
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)

            # 确保版本字段存在
            if "version" not in state:
                state["version"] = "1.0.0"

            # 原子写入
            temp_path = f"{self.state_path}.tmp.{int(datetime.now().timestamp())}"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2, ensure_ascii=False)
            os.replace(temp_path, self.state_path)

            # 可选：保存版本快照用于回滚
            self._save_version_snapshot(state)

            return True
        except Exception as e:
            log(f"Failed to write soul state: {e}", level="ERROR")
            return False

    def _save_version_snapshot(self, state: dict[str, Any]) -> None:
        """保存版本快照用于回滚"""
        try:
            self.history_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            version = state.get("version", "1.0.0")
            snapshot_path = self.history_dir / f"{timestamp}_v{version}.json"
            with open(snapshot_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2, ensure_ascii=False)
            # 只保留最近 50 个版本
            snapshots = sorted(self.history_dir.glob("*.json"))
            if len(snapshots) > 50:
                for old in snapshots[:-50]:
                    old.unlink()
        except Exception as e:
            log(f"Failed to save version snapshot: {e}", level="DEBUG")

    def list_versions(self) -> list[SoulVersion]:
        """列出所有可用版本"""
        versions: list[SoulVersion] = []
        if not self.history_dir.exists():
            return versions

        for snap in self.history_dir.glob("*.json"):
            try:
                mtime = datetime.fromtimestamp(snap.stat().st_mtime)
                name_parts = snap.stem.split("_v")
                version = name_parts[-1] if len(name_parts) > 1 else "unknown"
                versions.append(SoulVersion(
                    version=version,
                    timestamp=mtime.isoformat(),
                    checksum=None,
                    description=f"Snapshot from {mtime}"
                ))
            except Exception:
                continue

        return sorted(versions, key=lambda v: v.timestamp, reverse=True)

    def rollback(self, to_version: str) -> bool:
        """回滚到指定版本"""
        if not self.history_dir.exists():
            log("No version history found", level="ERROR")
            return False

        # 查找匹配的版本快照
        found: Path | None = None
        for snap in self.history_dir.glob("*.json"):
            if to_version in snap.name:
                found = snap
                break

        if found is None:
            log(f"Version {to_version} not found", level="ERROR")
            return False

        try:
            with open(found, encoding="utf-8") as f:
                state = json.load(f)
            return self.write_soul_state(state)
        except Exception as e:
            log(f"Failed to rollback: {e}", level="ERROR")
            return False


class LocalMemoryStorage(BaseMemoryStorage):
    """本地文件系统分层记忆存储实现"""

    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or get_project_root()
        self.base_dir = resolve_var_data_root(self.project_root) / "memory"

    def _get_path(self, period: str, identifier: str) -> Path:
        """获取记忆文件路径"""
        return self.base_dir / period / f"{identifier}.md"

    def _ensure_parent(self, path: Path) -> None:
        """确保父目录存在"""
        path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _sanitize_topic(topic: str) -> str:
        """净化主题名称，移除危险字符"""
        return "".join(c for c in topic if c.isalnum() or c in "-_")

    def read_daily_memory(self, date: str) -> str | None:
        path = self._get_path("day", date)
        if not path.exists():
            return None
        try:
            with open(path, encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            log(f"Failed to read daily memory for {date}: {e}", level="ERROR")
            return None

    @staticmethod
    def _parse_date(date: str) -> tuple[int, int, int] | None:
        """Parse date string to year, month, day components."""
        match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', date)
        if not match:
            return None
        try:
            year = int(match.group(1))
            month = int(match.group(2))
            day = int(match.group(3))
            if 1 <= month <= 12 and 1 <= day <= 31:
                # Verify the date actually exists (e.g., not February 30)
                date_obj = datetime(year, month, day)
                if date_obj.year == year and date_obj.month == month and date_obj.day == day:
                    return (year, month, day)
            return None
        except ValueError:
            return None

    def _date_to_year_week(self, date: str) -> str | None:
        """Convert YYYY-MM-DD date to YYYY-WW format."""
        parsed = self._parse_date(date)
        if not parsed:
            return None
        year, month, day = parsed
        date_obj = datetime(year, month, day)
        start_of_year = datetime(year, 1, 1)
        day_of_year = (date_obj - start_of_year).days + 1
        week = (day_of_year - 1) // 7 + 1
        return f"{year}-{week:02d}"

    def _date_to_year_month(self, date: str) -> str | None:
        """Convert YYYY-MM-DD date to YYYY-MM format."""
        parsed = self._parse_date(date)
        if not parsed:
            return None
        year, month, _ = parsed
        return f"{year}-{month:02d}"

    def _date_to_year(self, date: str) -> str | None:
        """Convert YYYY-MM-DD date to YYYY format."""
        parsed = self._parse_date(date)
        if not parsed:
            return None
        return f"{parsed[0]}"

    def _should_archive_day_to_week(self, current_date: str, archived_date: str) -> bool:
        """Check if archived_date is old enough to be archived to week."""
        current_parsed = self._parse_date(current_date)
        archived_parsed = self._parse_date(archived_date)
        if not current_parsed or not archived_parsed:
            return False

        # If different week, should archive
        current_week = self._date_to_year_week(current_date)
        archived_week = self._date_to_year_week(archived_date)
        if current_week != archived_week:
            return True

        # Same week but more than 7 days ago
        current_dt = datetime(*current_parsed)
        archived_dt = datetime(*archived_parsed)
        days_diff = (current_dt - archived_dt).days
        return days_diff >= 7

    def _should_archive_week_to_month(self, year_week: str) -> bool:
        """Check if week should be archived to month."""
        today = datetime.now()
        current_year = today.year
        current_week = (today.timetuple().tm_yday - 1) // 7 + 1
        try:
            year, week = map(int, year_week.split('-'))
            if year < current_year:
                return True
            if year > current_year:
                return False
            return week < current_week - 1
        except ValueError:
            return False

    def _should_archive_month_to_year(self, year_month: str) -> bool:
        """Check if month should be archived to year."""
        today = datetime.now()
        current_year = today.year
        current_month = today.month
        try:
            year, month = map(int, year_month.split('-'))
            if year < current_year:
                return True
            if year > current_year:
                return False
            return month < current_month
        except ValueError:
            return False

    def _aggregate_daily_to_weekly(self, year_week: str) -> str | None:
        """Aggregate all daily memories for a week into weekly content."""
        day_dir = self.base_dir / "day"
        if not day_dir.exists():
            return None

        aggregated = f"# Weekly Aggregation: {year_week}\n\n"
        has_content = False

        for file in day_dir.glob("*.md"):
            date = file.stem
            file_week = self._date_to_year_week(date)
            if file_week == year_week:
                content = self.read_daily_memory(date)
                if content and content.strip():
                    aggregated += f"## {date}\n\n{content.strip()}\n\n---\n\n"
                    has_content = True

        return aggregated if has_content else None

    def _aggregate_weekly_to_monthly(self, year_month: str) -> str | None:
        """Aggregate all weekly memories for a month into monthly content."""
        week_dir = self.base_dir / "week"
        if not week_dir.exists():
            return None

        aggregated = f"# Monthly Aggregation: {year_month}\n\n"
        has_content = False

        for file in week_dir.glob("*.md"):
            year_week = file.stem
            if year_week.startswith(year_month[:7]):
                content = self.read_weekly_memory(year_week)
                if content and content.strip():
                    aggregated += f"## {year_week}\n\n{content.strip()}\n\n---\n\n"
                    has_content = True

        return aggregated if has_content else None

    def _aggregate_monthly_to_yearly(self, year: str) -> str | None:
        """Aggregate all monthly memories for a year into yearly content."""
        month_dir = self.base_dir / "month"
        if not month_dir.exists():
            return None

        aggregated = f"# Yearly Aggregation: {year}\n\n"
        has_content = False
        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        for file in month_dir.glob("*.md"):
            year_month = file.stem
            if year_month.startswith(year):
                content = self.read_monthly_memory(year_month)
                if content and content.strip():
                    month_num = int(year_month.split('-')[1])
                    month_name = month_names[month_num - 1] if 1 <= month_num <= 12 else str(month_num)
                    aggregated += f"## {month_name} {year}\n\n{content.strip()}\n\n---\n\n"
                    has_content = True

        return aggregated if has_content else None

    def _trigger_automatic_archiving(self, current_date: str) -> None:
        """Trigger automatic hierarchical archiving after writing a new daily memory."""
        try:
            day_dir = self.base_dir / "day"
            if not day_dir.exists():
                return

            # Step 1: Archive past days to weeks
            archived_weeks = set()
            for file in day_dir.glob("*.md"):
                day_date = file.stem
                if self._should_archive_day_to_week(current_date, day_date):
                    year_week = self._date_to_year_week(day_date)
                    if year_week:
                        archived_weeks.add(year_week)

            # Aggregate each completed week
            for year_week in archived_weeks:
                aggregated = self._aggregate_daily_to_weekly(year_week)
                if aggregated:
                    self.write_weekly_memory(year_week, aggregated)
                    log(f"[AutoArchive] Aggregated daily memories to week {year_week}", "DEBUG")

            # Step 2: Archive past weeks to months
            week_dir = self.base_dir / "week"
            if not week_dir.exists():
                return

            archived_months = set()
            for file in week_dir.glob("*.md"):
                year_week = file.stem
                if self._should_archive_week_to_month(year_week):
                    try:
                        # Extract year and get month by calculating the date of the first day of this week
                        # This gives a more accurate month mapping than week_num // 4
                        year_str, week_str = year_week.split('-')
                        year = int(year_str)
                        week = int(week_str)
                        # Calculate approximate date of the first day of this week
                        # January 1 is day 1 of week 1
                        first_day = datetime(year, 1, 1 + (week - 1) * 7)
                        month = first_day.month
                        year_month = f"{year}-{month:02d}"
                        archived_months.add(year_month)
                    except ValueError:
                        continue

            for year_month in archived_months:
                if self._should_archive_week_to_month(year_month):
                    aggregated = self._aggregate_weekly_to_monthly(year_month)
                    if aggregated:
                        self.write_monthly_memory(year_month, aggregated)
                        log(f"[AutoArchive] Aggregated weekly memories to month {year_month}", "DEBUG")

            # Step 3: Archive past months to year
            month_dir = self.base_dir / "month"
            if not month_dir.exists():
                return

            archived_years: set[str] = set()
            for file in month_dir.glob("*.md"):
                year_month = file.stem
                if self._should_archive_month_to_year(year_month):
                    year_str = year_month.split('-')[0]
                    archived_years.add(year_str)

            for year_str in archived_years:
                aggregated = self._aggregate_monthly_to_yearly(year_str)
                if aggregated:
                    self.write_yearly_memory(year_str, aggregated)
                    log(f"[AutoArchive] Aggregated monthly memories to year {year_str}", "DEBUG")

        except Exception as e:
            # Don't fail the write if auto-archiving fails
            log(f"Error during automatic archiving: {e}", "WARNING")

    def write_daily_memory(self, date: str, content: str, append: bool = False) -> bool:
        path = self._get_path("day", date)
        success = self._atomic_write(path, content, append)
        if success:
            # Trigger automatic hierarchical archiving
            self._trigger_automatic_archiving(date)
        return success

    def read_weekly_memory(self, year_week: str) -> str | None:
        path = self._get_path("week", year_week)
        if not path.exists():
            return None
        try:
            with open(path, encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            log(f"Failed to read weekly memory for {year_week}: {e}", level="ERROR")
            return None

    def write_weekly_memory(self, year_week: str, content: str, append: bool = False) -> bool:
        path = self._get_path("week", year_week)
        return self._atomic_write(path, content, append)

    def read_monthly_memory(self, year_month: str) -> str | None:
        path = self._get_path("month", year_month)
        if not path.exists():
            return None
        try:
            with open(path, encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            log(f"Failed to read monthly memory for {year_month}: {e}", level="ERROR")
            return None

    def write_monthly_memory(self, year_month: str, content: str, append: bool = False) -> bool:
        path = self._get_path("month", year_month)
        return self._atomic_write(path, content, append)

    def read_yearly_memory(self, year: str) -> str | None:
        path = self._get_path("year", year)
        if not path.exists():
            return None
        try:
            with open(path, encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            log(f"Failed to read yearly memory for {year}: {e}", level="ERROR")
            return None

    def write_yearly_memory(self, year: str, content: str, append: bool = False) -> bool:
        path = self._get_path("year", year)
        return self._atomic_write(path, content, append)

    def read_topic_memory(self, topic: str) -> str | None:
        # 先试活跃目录，再试归档
        sanitized = self._sanitize_topic(topic)
        path = self.base_dir / "topic" / f"{sanitized}.md"
        if path.exists():
            try:
                with open(path, encoding="utf-8") as f:
                    return f.read()
            except Exception as e:
                log(f"Failed to read topic memory for {topic}: {e}", level="ERROR")
        # 试归档
        archive_path = self.base_dir / "topic" / "archive" / f"{sanitized}.md"
        if archive_path.exists():
            try:
                with open(archive_path, encoding="utf-8") as f:
                    return f.read()
            except Exception as e:
                log(f"Failed to read archived topic memory for {topic}: {e}", level="ERROR")
        return None

    def write_topic_memory(self, topic: str, content: str, append: bool = False) -> bool:
        sanitized = self._sanitize_topic(topic)
        path = self.base_dir / "topic" / f"{sanitized}.md"
        return self._atomic_write(path, content, append)

    def _atomic_write(self, path: Path, content: str, append: bool) -> bool:
        """原子写入，支持追加模式"""
        try:
            self._ensure_parent(path)
            temp_path = f"{path}.tmp.{int(datetime.now().timestamp())}"

            if append and path.exists():
                with open(path, encoding="utf-8") as f:
                    existing = f.read()
                content = existing + "\n\n" + content

            with open(temp_path, "w", encoding="utf-8") as f:
                f.write(content)
            os.replace(temp_path, path)
            return True
        except Exception as e:
            log(f"Failed to write {path}: {e}", level="ERROR")
            return False

    def list_topics(self, status: str = "active") -> list[dict[str, str]]:
        results: list[dict[str, str]] = []

        if status in ["active", "all"]:
            active_dir = self.base_dir / "topic"
            if active_dir.exists():
                try:
                    for file in active_dir.glob("*.md"):
                        try:
                            if file.name != "archive":
                                results.append({
                                    "name": file.stem,
                                    "status": "active",
                                    "path": str(file)
                                })
                        except Exception:
                            # Skip unreadable files
                            continue
                except Exception as e:
                    log(f"Failed to list active topics: {e}", level="ERROR")

        if status in ["archived", "all"]:
            archive_dir = self.base_dir / "topic" / "archive"
            if archive_dir.exists():
                try:
                    for file in archive_dir.glob("*.md"):
                        try:
                            results.append({
                                "name": file.stem,
                                "status": "archived",
                                "path": str(file)
                            })
                        except Exception:
                            # Skip unreadable files
                            continue
                except Exception as e:
                    log(f"Failed to list archived topics: {e}", level="ERROR")

        return sorted(results, key=lambda x: x["name"])

    def archive_topic(self, topic: str) -> bool:
        sanitized = self._sanitize_topic(topic)
        active_path = self.base_dir / "topic" / f"{sanitized}.md"
        archive_path = self.base_dir / "topic" / "archive" / f"{sanitized}.md"

        if not active_path.exists():
            log(f"Topic {topic} not found", level="ERROR")
            return False

        try:
            archive_path.parent.mkdir(parents=True, exist_ok=True)
            if archive_path.exists():
                archive_path.unlink()
            os.rename(active_path, archive_path)
            return True
        except Exception as e:
            log(f"Failed to archive topic: {e}", level="ERROR")
            return False

    def detect_conflict(self, topic: str, new_content: str) -> MemoryConflict | None:
        """检测记忆冲突"""
        existing = self.read_topic_memory(topic)
        if existing is None or len(existing.strip()) == 0:
            return None  # 不存在，不冲突

        # 简单冲突检测策略：
        # 1. 如果新内容长度是现有内容的 10x+，可能是误覆盖
        if len(new_content) > len(existing) * 10:
            return MemoryConflict(
                topic=topic,
                existing_content=existing[:200] + ("..." if len(existing) > 200 else ""),
                new_content=new_content[:200] + ("..." if len(new_content) > 200 else ""),
                conflict_type="size_mismatch",
                resolution=None
            )

        # 2. 检查时间戳冲突（如果内容中包含 ISO 日期）
        # 简单检测：如果现有有日期，新内容也有，但不同
        # 这个检测比较启发式，主要防止手滑覆盖不同日期的对话
        import re
        date_pattern = r'\d{4}-\d{2}-\d{2}'
        existing_dates = re.findall(date_pattern, existing)
        new_dates = re.findall(date_pattern, new_content)
        if existing_dates and new_dates and existing_dates[0] != new_dates[0]:
            return MemoryConflict(
                topic=topic,
                existing_content=existing,
                new_content=new_content,
                conflict_type="timestamp_mismatch",
                resolution=None
            )

        return None

    def resolve_conflict(self, conflict: MemoryConflict, resolution: str) -> bool:
        """解决记忆冲突
        resolution: "keep_existing", "overwrite", "merge_append"
        """
        if resolution == "keep_existing":
            # 什么都不做，保留原有
            return True
        elif resolution == "overwrite":
            # 直接覆盖
            return self.write_topic_memory(conflict.topic, conflict.new_content, append=False)
        elif resolution == "merge_append":
            # 追加合并
            existing = self.read_topic_memory(conflict.topic) or ""
            merged = existing + "\n\n---\n" + conflict.new_content
            return self.write_topic_memory(conflict.topic, merged, append=False)
        else:
            log(f"Unknown resolution strategy: {resolution}", level="ERROR")
            return False


class LocalSkillStorage(BaseSkillStorage):
    """本地文件系统技能规则存储实现"""

    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or get_project_root()
        self.rules_dir = self.project_root / "src" / "agentsoul" / "templates"

    def read_base_rule(self, name: str) -> str | None:
        """读取基础规则，name 是文件名（不带 .md）"""
        path = self.rules_dir / f"{name}.md"
        if not path.exists():
            return None
        with open(path, encoding="utf-8") as f:
            return f.read()

    def list_available_rules(self) -> list[str]:
        """列出所有可用基础规则"""
        rules: list[str] = []
        for file in self.rules_dir.glob("*.md"):
            if file.stem in ["SKILL", "soul_base", "memory_base", "master_base", "secure_base", "skills_base", "tasks_base"]:
                rules.append(file.stem)
        return sorted(rules)
