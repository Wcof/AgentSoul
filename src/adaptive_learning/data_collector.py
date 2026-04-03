"""
AgentSoul · 交互数据收集模块
记录对话元数据、用户反馈和PAD状态变化
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
import uuid

from common import log, get_project_root, read_last_n_lines


@dataclass
class InteractionRecord:
    session_id: str
    timestamp: datetime
    pad_before: Dict[str, float]
    pad_after: Dict[str, float]
    feedback: Optional[str] = None
    response_length: Optional[int] = None
    topics: Optional[List[str]] = None
    user_input: Optional[str] = None
    agent_response: Optional[str] = None


class DataCollector:
    def __init__(self, data_path: Optional[Path] = None):
        if data_path is None:
            data_path = get_project_root() / "data" / "learning"
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.interactions_file = data_path / "interactions.jsonl"

    def record(self, record: InteractionRecord) -> None:
        try:
            record_dict = {
                "session_id": record.session_id,
                "timestamp": record.timestamp.isoformat(),
                "pad_before": record.pad_before,
                "pad_after": record.pad_after,
                "feedback": record.feedback,
                "response_length": record.response_length,
                "topics": record.topics,
                "user_input": record.user_input,
                "agent_response": record.agent_response
            }

            with open(self.interactions_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(record_dict, ensure_ascii=False) + "\n")

        except Exception as e:
            log(f"Failed to record interaction: {e}", "ERROR")

    def get_recent(self, limit: int = 100) -> List[InteractionRecord]:
        records = []

        if not self.interactions_file.exists():
            return records

        try:
            file_size = self.interactions_file.stat().st_size
            if file_size == 0:
                return records

            # For small files, read all at once
            if file_size < 100 * 1024:  # Less than 100KB
                with open(self.interactions_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                lines_to_process = lines[-limit:]
            else:
                # For large files, read from the end to avoid loading entire file
                lines_to_process = read_last_n_lines(self.interactions_file, limit)

            for line in lines_to_process:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    record = InteractionRecord(
                        session_id=data["session_id"],
                        timestamp=datetime.fromisoformat(data["timestamp"]),
                        pad_before=data["pad_before"],
                        pad_after=data["pad_after"],
                        feedback=data.get("feedback"),
                        response_length=data.get("response_length"),
                        topics=data.get("topics"),
                        user_input=data.get("user_input"),
                        agent_response=data.get("agent_response")
                    )
                    records.append(record)
                except Exception as e:
                    log(f"Failed to parse record: {e}", "WARN")
                    continue

        except Exception as e:
            log(f"Failed to read interactions: {e}", "ERROR")

        return records

    def get_statistics(self) -> Dict[str, Any]:
        records = self.get_recent(limit=1000)

        if not records:
            return {
                "total_interactions": 0,
                "positive_feedback": 0,
                "negative_feedback": 0,
                "no_feedback": 0,
                "avg_response_length": 0,
                "sessions_count": 0
            }

        positive = sum(1 for r in records if r.feedback == "positive")
        negative = sum(1 for r in records if r.feedback == "negative")
        no_feedback = sum(1 for r in records if r.feedback is None)
        response_lengths = [r.response_length for r in records if r.response_length is not None]
        sessions = set(r.session_id for r in records)

        return {
            "total_interactions": len(records),
            "positive_feedback": positive,
            "negative_feedback": negative,
            "no_feedback": no_feedback,
            "avg_response_length": sum(response_lengths) / len(response_lengths) if response_lengths else 0,
            "sessions_count": len(sessions)
        }

    def create_session(self) -> str:
        return str(uuid.uuid4())
