"""
AgentSoul · 用户偏好学习模块
学习用户偏好的响应长度、语气、emoji使用等
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any
import json

from common import log, get_project_root
from .data_collector import InteractionRecord

# Unicode emoji ranges (covers most common emoji) - constant defined once at module level
EMOJI_RANGES = [
    (0x1F600, 0x1F64F),  # Emoticons
    (0x1F300, 0x1F5FF),  # Miscellaneous Symbols and Pictographs
    (0x1F680, 0x1F6FF),  # Transport and Map Symbols
    (0x1F900, 0x1F9FF),  # Supplemental Symbols and Pictographs
    (0x2600, 0x26FF),    # Miscellaneous Symbols
    (0x2700, 0x27BF),    # Dingbats
    (0x1F1E6, 0x1F1FF),  # Regional Indicator Symbols (flags)
]


@dataclass
class UserPreferences:
    preferred_tone: str = "neutral"
    preferred_response_length: int = 0
    preferred_emoji_freq: str = "minimal"
    preferred_topics: List[str] = field(default_factory=list)
    learning_confidence: Dict[str, float] = field(default_factory=dict)


class PreferenceLearner:
    def __init__(self, data_path: Optional[Path] = None):
        if data_path is None:
            data_path = get_project_root() / "data" / "learning"
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.preferences_file = data_path / "preferences.json"
        self._preferences: UserPreferences
        self._load_preferences()

    def _load_preferences(self) -> None:
        if self.preferences_file.exists():
            try:
                with open(self.preferences_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._preferences = UserPreferences(
                        preferred_tone=data.get("preferred_tone", "neutral"),
                        preferred_response_length=data.get("preferred_response_length", 0),
                        preferred_emoji_freq=data.get("preferred_emoji_freq", "minimal"),
                        preferred_topics=data.get("preferred_topics", []),
                        learning_confidence=data.get("learning_confidence", {})
                    )
            except Exception as e:
                log(f"Failed to load preferences: {e}", "WARN")
                self._preferences = UserPreferences()
        else:
            self._preferences = UserPreferences()

    def _save_preferences(self) -> None:
        try:
            data = {
                "preferred_tone": self._preferences.preferred_tone,
                "preferred_response_length": self._preferences.preferred_response_length,
                "preferred_emoji_freq": self._preferences.preferred_emoji_freq,
                "preferred_topics": self._preferences.preferred_topics,
                "learning_confidence": self._preferences.learning_confidence
            }
            with open(self.preferences_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"Failed to save preferences: {e}", "ERROR")

    def learn_from_feedback(self, interaction: InteractionRecord, feedback: str) -> None:
        if feedback == "positive":
            if interaction.response_length:
                current_confidence = self._preferences.learning_confidence.get("response_length", 0.0)
                new_confidence = min(1.0, current_confidence + 0.1)
                self._preferences.learning_confidence["response_length"] = new_confidence

                if new_confidence > 0.5:
                    self._preferences.preferred_response_length = interaction.response_length

            if interaction.topics:
                for topic in interaction.topics:
                    if topic not in self._preferences.preferred_topics:
                        self._preferences.preferred_topics.append(topic)

        elif feedback == "negative":
            current_confidence = self._preferences.learning_confidence.get("response_length", 0.0)
            self._preferences.learning_confidence["response_length"] = max(0.0, current_confidence - 0.1)

            if interaction.topics:
                for topic in interaction.topics:
                    if topic in self._preferences.preferred_topics:
                        self._preferences.preferred_topics.remove(topic)

        self._save_preferences()

    def learn_from_response(self, interaction: InteractionRecord) -> None:
        """Learn emoji usage preference from agent response.

        Counts all Unicode emoji characters in the response to determine
        the overall frequency of emoji usage.
        """
        if interaction.agent_response:
            emoji_count = 0
            for char in interaction.agent_response:
                code = ord(char)
                for start, end in EMOJI_RANGES:
                    if start <= code <= end:
                        emoji_count += 1
                        break

            if emoji_count > 5:
                self._update_emoji_preference("frequent")
            elif emoji_count > 2:
                self._update_emoji_preference("moderate")
            else:
                self._update_emoji_preference("minimal")

    def _update_emoji_preference(self, freq: str) -> None:
        current_confidence = self._preferences.learning_confidence.get("emoji_freq", 0.0)
        self._preferences.learning_confidence["emoji_freq"] = min(1.0, current_confidence + 0.05)

        if self._preferences.learning_confidence["emoji_freq"] > 0.5:
            self._preferences.preferred_emoji_freq = freq

        self._save_preferences()

    def set_tone_preference(self, tone: str) -> None:
        valid_tones = ["neutral", "friendly", "professional", "casual"]
        if tone in valid_tones:
            self._preferences.preferred_tone = tone
            self._preferences.learning_confidence["tone"] = 1.0
            self._save_preferences()

    def get_preferences(self) -> UserPreferences:
        assert self._preferences is not None
        return self._preferences

    def reset(self) -> None:
        self._preferences = UserPreferences()
        self._save_preferences()
        log("Preferences reset to defaults", "OK")

    def get_confidence_summary(self) -> Dict[str, float]:
        return self._preferences.learning_confidence.copy()
