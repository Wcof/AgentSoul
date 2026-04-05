"""
AgentSoul · PAD渐进式调整模块
根据用户反馈微调PAD情感状态
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import json

from common import log, get_project_root


@dataclass
class PADState:
    pleasure: float = 0.3
    arousal: float = 0.2
    dominance: float = 0.3
    last_updated: Optional[datetime] = None


class PADAdjuster:
    def __init__(self, data_path: Optional[Path] = None, learning_intensity: float = 0.3):
        if data_path is None:
            data_path = get_project_root() / "data" / "learning"
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.state_file = data_path / "pad_state.json"
        self.learning_intensity = max(0.0, min(1.0, learning_intensity))
        self._state: PADState
        self._load_state()

    def _load_state(self) -> None:
        if self.state_file.exists():
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    last_updated = None
                    if data.get("last_updated"):
                        last_updated = datetime.fromisoformat(data["last_updated"])
                    self._state = PADState(
                        pleasure=data.get("pleasure", 0.3),
                        arousal=data.get("arousal", 0.2),
                        dominance=data.get("dominance", 0.3),
                        last_updated=last_updated
                    )
            except Exception as e:
                log(f"Failed to load PAD state: {e}", "WARN")
                self._state = PADState()
        else:
            self._state = PADState()

    def _save_state(self) -> None:
        try:
            data = {
                "pleasure": self._state.pleasure,
                "arousal": self._state.arousal,
                "dominance": self._state.dominance,
                "last_updated": self._state.last_updated.isoformat() if self._state.last_updated else None
            }
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"Failed to save PAD state: {e}", "ERROR")

    def adjust_from_feedback(self, current_state: Optional[PADState] = None, feedback: str = "positive") -> PADState:
        if current_state is None:
            current_state = self._state

        feedback_multipliers = {
            "positive": {"pleasure": 0.1, "arousal": 0.05, "dominance": 0.0},
            "negative": {"pleasure": -0.1, "arousal": -0.05, "dominance": 0.05},
            "neutral": {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0}
        }

        multiplier = feedback_multipliers.get(feedback, feedback_multipliers["neutral"])
        delta_p = multiplier["pleasure"] * self.learning_intensity
        delta_a = multiplier["arousal"] * self.learning_intensity
        delta_d = multiplier["dominance"] * self.learning_intensity

        new_state = PADState(
            pleasure=max(-1.0, min(1.0, current_state.pleasure + delta_p)),
            arousal=max(-1.0, min(1.0, current_state.arousal + delta_a)),
            dominance=max(-1.0, min(1.0, current_state.dominance + delta_d)),
            last_updated=datetime.now()
        )

        self._state = new_state
        self._save_state()
        return new_state

    def get_current_state(self) -> PADState:
        return self._state

    def set_learning_intensity(self, intensity: float) -> None:
        self.learning_intensity = max(0.0, min(1.0, intensity))
        log(f"Learning intensity set to {self.learning_intensity}", "OK")

    def reset(self) -> None:
        self._state = PADState(last_updated=datetime.now())
        self._save_state()
        log("PAD state reset to defaults", "OK")

    def adjust_from_interaction(self, user_input_length: int, response_length: int) -> PADState:
        """Automatically adjust PAD state based on interaction size.

        Longer interactions increase arousal slightly to reflect engagement.
        Very short interactions keep arousal neutral.

        Args:
            user_input_length: Character count of user input
            response_length: Character count of agent response

        Returns:
            New adjusted PAD state
        """
        total_length = user_input_length + response_length
        current_state = self._state

        # Adjust arousal based on interaction length
        # - Very short (< 100 chars): small decrease
        # - Medium (100-1000 chars): no change
        # - Long (> 1000 chars): small increase
        if total_length < 100:
            delta_arousal = -0.05
        elif total_length > 1000:
            delta_arousal = 0.05
        else:
            delta_arousal = 0.0

        actual_delta = delta_arousal * self.learning_intensity
        new_arousal = max(-1.0, min(1.0, current_state.arousal + actual_delta))

        # Only save if something actually changed
        if new_arousal == current_state.arousal and actual_delta == 0:
            return current_state

        new_state = PADState(
            pleasure=current_state.pleasure,
            arousal=new_arousal,
            dominance=current_state.dominance,
            last_updated=datetime.now()
        )

        self._state = new_state
        self._save_state()
        return new_state

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pleasure": self._state.pleasure,
            "arousal": self._state.arousal,
            "dominance": self._state.dominance,
            "last_updated": self._state.last_updated.isoformat() if self._state.last_updated else None,
            "learning_intensity": self.learning_intensity
        }
