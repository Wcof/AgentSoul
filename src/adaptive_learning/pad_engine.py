"""
AgentSoul · PAD 情感引擎（增强版）
========================================

在基础 PADAdjuster 之上增加：
- 能量指标 (energy): 反映 Agent 的活跃程度，随交互消耗/休息恢复
- 人格漂移检测 (personality_drift): 监测 PAD 值偏离基线过远
- 事件扰动 (event_perturbation): 外部事件对情感的即时冲击
- 时间衰减回归 (decay_to_baseline): 长时间无交互时 PAD 回归基线

设计原则：
- PAD 值域 [-1.0, +1.0]
- 能量值域 [0.0, 1.0]
- 漂移阈值可配置
- 所有状态变更可持久化
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any

from common import get_project_root, log


# ============================================================================
# Data Structures
# ============================================================================

class DriftSeverity(Enum):
    """漂移严重程度"""
    NONE = "none"
    MILD = "mild"       # 轻微偏移，可自然回归
    MODERATE = "moderate"  # 中度偏移，需要关注
    SEVERE = "severe"    # 严重偏移，建议干预


class EventType(Enum):
    """情感事件类型"""
    POSITIVE = "positive"       # 正面事件（如被表扬、任务成功）
    NEGATIVE = "negative"       # 负面事件（如被批评、任务失败）
    NEUTRAL = "neutral"         # 中性事件
    SURPRISE = "surprise"       # 惊喜/意外
    STRESS = "stress"           # 压力/紧急
    RELAXATION = "relaxation"   # 放松/休息
    CONFLICT = "conflict"       # 冲突/矛盾


@dataclass
class PADEnhancedState:
    """增强版 PAD 状态"""
    pleasure: float = 0.3
    arousal: float = 0.2
    dominance: float = 0.3
    energy: float = 0.8           # 能量指标 [0.0, 1.0]
    last_updated: datetime | None = None

    # 基线值（长期稳定的人格锚点）
    baseline_pleasure: float = 0.3
    baseline_arousal: float = 0.2
    baseline_dominance: float = 0.3
    baseline_energy: float = 0.8

    # 历史统计
    total_interactions: int = 0
    total_events: int = 0
    last_interaction_at: datetime | None = None

    # 情绪历史轨迹（最近 N 条快照）
    emotion_history: list[dict[str, Any]] = field(default_factory=list)

    # 韧性指标：负向事件后回到基线的平均时间（小时），0=无数据
    resilience_hours: float = 0.0
    resilience_samples: int = 0

    # 情绪共振追踪
    recent_event_types: list[str] = field(default_factory=list)  # 最近5个事件类型


@dataclass
class DriftReport:
    """人格漂移检测报告"""
    severity: DriftSeverity
    pleasure_drift: float
    arousal_drift: float
    dominance_drift: float
    energy_drift: float
    max_drift: float
    recommendation: str
    # 新增：情绪轮廓（各维度在 PAD 空间的象限位置）
    emotion_profile: str = "neutral"  # excited/depressed/relaxed/anxious/neutral


@dataclass
class EventPerturbation:
    """事件扰动结果"""
    event_type: EventType
    delta_pleasure: float
    delta_arousal: float
    delta_dominance: float
    delta_energy: float
    new_state: PADEnhancedState
    description: str


# ============================================================================
# Event Impact Profiles
# ============================================================================

EVENT_PROFILES: dict[EventType, dict[str, float]] = {
    EventType.POSITIVE:    {"pleasure": 0.15, "arousal": 0.08, "dominance": 0.05, "energy": -0.03},
    EventType.NEGATIVE:    {"pleasure": -0.15, "arousal": -0.08, "dominance": -0.05, "energy": -0.08},
    EventType.NEUTRAL:     {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0, "energy": 0.0},
    EventType.SURPRISE:    {"pleasure": 0.05, "arousal": 0.20, "dominance": -0.03, "energy": -0.05},
    EventType.STRESS:      {"pleasure": -0.10, "arousal": 0.15, "dominance": -0.10, "energy": -0.12},
    EventType.RELAXATION:  {"pleasure": 0.08, "arousal": -0.15, "dominance": 0.03, "energy": 0.10},
    EventType.CONFLICT:    {"pleasure": -0.12, "arousal": 0.10, "dominance": -0.08, "energy": -0.10},
}


# ============================================================================
# PADEngine
# ============================================================================

class PADEngine:
    """
    增强版 PAD 情感引擎

    功能：
    1. 基础 PAD 调整（兼容 PADAdjuster 接口）
    2. 能量指标管理（交互消耗/休息恢复）
    3. 人格漂移检测（PAD 偏离基线告警）
    4. 事件扰动（外部事件即时冲击）
    5. 时间衰减回归（长时间无交互回归基线）
    6. 情绪历史轨迹（最近 N 条快照自动记录）
    7. 情绪共振（连续同类事件累加效应）
    8. 韧性指标（负向事件后恢复速度统计）
    """

    # 漂移阈值
    DRIFT_MILD_THRESHOLD = 0.3
    DRIFT_MODERATE_THRESHOLD = 0.5
    DRIFT_SEVERE_THRESHOLD = 0.7

    # 衰减率：每小时向基线回归的比例
    DECAY_RATE_PER_HOUR = 0.05

    # 能量参数
    ENERGY_INTERACTION_COST = 0.02     # 每次交互消耗
    ENERGY_RECOVERY_PER_HOUR = 0.08    # 每小时恢复
    ENERGY_MIN_FOR_AROUSAL = 0.2       # 能量过低时唤醒度受限

    # 情绪历史参数
    EMOTION_HISTORY_MAX = 50           # 最多保留 50 条历史快照
    EMOTION_HISTORY_SAMPLE_INTERVAL_MINUTES = 30  # 最小采样间隔（分钟）

    # 情绪共振参数
    RESONANCE_WINDOW = 5               # 最近 N 个事件的窗口
    RESONANCE_BOOST_FACTOR = 0.25      # 每多一个同类事件的额外加成

    def __init__(
        self,
        data_path: Path | None = None,
        learning_intensity: float = 0.3,
        drift_thresholds: dict[str, float] | None = None,
    ):
        if data_path is None:
            data_path = get_project_root() / "data" / "soul"
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.state_file = data_path / "pad_engine_state.json"
        self.learning_intensity = max(0.0, min(1.0, learning_intensity))

        # 可配置漂移阈值
        self.drift_mild = (drift_thresholds or {}).get("mild", self.DRIFT_MILD_THRESHOLD)
        self.drift_moderate = (drift_thresholds or {}).get("moderate", self.DRIFT_MODERATE_THRESHOLD)
        self.drift_severe = (drift_thresholds or {}).get("severe", self.DRIFT_SEVERE_THRESHOLD)

        self._state: PADEnhancedState
        self._load_state()

    # ---- Persistence ----

    def _load_state(self) -> None:
        if self.state_file.exists():
            try:
                with open(self.state_file, encoding="utf-8") as f:
                    data = json.load(f)
                last_updated = None
                if data.get("last_updated"):
                    last_updated = datetime.fromisoformat(data["last_updated"])
                last_interaction_at = None
                if data.get("last_interaction_at"):
                    last_interaction_at = datetime.fromisoformat(data["last_interaction_at"])

                self._state = PADEnhancedState(
                    pleasure=data.get("pleasure", 0.3),
                    arousal=data.get("arousal", 0.2),
                    dominance=data.get("dominance", 0.3),
                    energy=data.get("energy", 0.8),
                    last_updated=last_updated,
                    baseline_pleasure=data.get("baseline_pleasure", 0.3),
                    baseline_arousal=data.get("baseline_arousal", 0.2),
                    baseline_dominance=data.get("baseline_dominance", 0.3),
                    baseline_energy=data.get("baseline_energy", 0.8),
                    total_interactions=data.get("total_interactions", 0),
                    total_events=data.get("total_events", 0),
                    last_interaction_at=last_interaction_at,
                    emotion_history=data.get("emotion_history", [])[:self.EMOTION_HISTORY_MAX],
                    resilience_hours=data.get("resilience_hours", 0.0),
                    resilience_samples=data.get("resilience_samples", 0),
                    recent_event_types=data.get("recent_event_types", [])[:self.RESONANCE_WINDOW],
                )
            except Exception as e:
                log(f"PADEngine: 加载状态失败: {e}", "WARN")
                self._state = PADEnhancedState()
        else:
            self._state = PADEnhancedState()

    def _save_state(self) -> None:
        try:
            data = {
                "pleasure": self._state.pleasure,
                "arousal": self._state.arousal,
                "dominance": self._state.dominance,
                "energy": self._state.energy,
                "last_updated": self._state.last_updated.isoformat() if self._state.last_updated else None,
                "baseline_pleasure": self._state.baseline_pleasure,
                "baseline_arousal": self._state.baseline_arousal,
                "baseline_dominance": self._state.baseline_dominance,
                "baseline_energy": self._state.baseline_energy,
                "total_interactions": self._state.total_interactions,
                "total_events": self._state.total_events,
                "last_interaction_at": self._state.last_interaction_at.isoformat() if self._state.last_interaction_at else None,
                "emotion_history": self._state.emotion_history[-self.EMOTION_HISTORY_MAX:],
                "resilience_hours": self._state.resilience_hours,
                "resilience_samples": self._state.resilience_samples,
                "recent_event_types": self._state.recent_event_types[-self.RESONANCE_WINDOW:],
            }
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"PADEngine: 保存状态失败: {e}", "ERROR")

    # ---- Core: Time Decay ----

    def _apply_time_decay(self) -> None:
        """
        时间衰减：长时间无交互时 PAD 回归基线

        衰减公式：
        current = current + (baseline - current) * decay_rate * hours_elapsed
        """
        if self._state.last_updated is None:
            return

        now = datetime.now()
        elapsed_hours = (now - self._state.last_updated).total_seconds() / 3600.0
        if elapsed_hours < 0.1:  # 不到6分钟不衰减
            return

        decay_factor = min(1.0, self.DECAY_RATE_PER_HOUR * elapsed_hours)

        # PAD 向基线回归
        self._state.pleasure += (self._state.baseline_pleasure - self._state.pleasure) * decay_factor
        self._state.arousal += (self._state.baseline_arousal - self._state.arousal) * decay_factor
        self._state.dominance += (self._state.baseline_dominance - self._state.dominance) * decay_factor

        # 能量恢复（休息恢复）
        if self._state.energy < self._state.baseline_energy:
            energy_recovery = self.ENERGY_RECOVERY_PER_HOUR * elapsed_hours
            self._state.energy = min(
                self._state.baseline_energy,
                self._state.energy + energy_recovery,
            )

        self._state.pleasure = max(-1.0, min(1.0, self._state.pleasure))
        self._state.arousal = max(-1.0, min(1.0, self._state.arousal))
        self._state.dominance = max(-1.0, min(1.0, self._state.dominance))
        self._state.energy = max(0.0, min(1.0, self._state.energy))

    # ---- Core: Emotion Snapshot ----

    def _record_emotion_snapshot(self, trigger: str = "") -> None:
        """记录情绪快照到历史轨迹（采样间隔控制避免过密）"""
        now = datetime.now()
        if self._state.emotion_history:
            last_ts = self._state.emotion_history[-1].get("ts", "")
            if last_ts:
                try:
                    last_time = datetime.fromisoformat(last_ts)
                    if (now - last_time).total_seconds() < self.EMOTION_HISTORY_SAMPLE_INTERVAL_MINUTES * 60:
                        return  # 间隔太短，跳过
                except Exception:
                    pass

        snapshot = {
            "ts": now.isoformat(),
            "p": round(self._state.pleasure, 3),
            "a": round(self._state.arousal, 3),
            "d": round(self._state.dominance, 3),
            "e": round(self._state.energy, 3),
            "trigger": trigger,
        }
        self._state.emotion_history.append(snapshot)
        # 保留最近 N 条
        if len(self._state.emotion_history) > self.EMOTION_HISTORY_MAX:
            self._state.emotion_history = self._state.emotion_history[-self.EMOTION_HISTORY_MAX:]

    # ---- Core: Emotion Resonance ----

    def _compute_resonance_boost(self, event_type: EventType) -> float:
        """
        计算情绪共振加成：连续同类事件产生累加效应

        例如连续3个 positive 事件，第3个会额外增加 2*0.25=0.5 的乘数
        """
        same_count = sum(1 for t in self._state.recent_event_types if t == event_type.value)
        if same_count <= 0:
            return 1.0  # 无共振
        return 1.0 + same_count * self.RESONANCE_BOOST_FACTOR

    # ---- Core: Emotion Profile Classification ----

    @staticmethod
    def _classify_emotion_profile(pleasure: float, arousal: float, dominance: float) -> str:
        """
        基于 PAD 值分类情绪轮廓

        Returns:
            excited / relaxed / anxious / depressed / neutral
        """
        p_pos = pleasure > 0.1
        a_pos = arousal > 0.1
        d_pos = dominance > 0.1

        if p_pos and a_pos:
            return "excited"      # 高愉悦+高唤醒 = 兴奋
        elif p_pos and not a_pos:
            return "relaxed"      # 高愉悦+低唤醒 = 放松
        elif not p_pos and a_pos:
            return "anxious"      # 低愉悦+高唤醒 = 焦虑
        elif not p_pos and not a_pos:
            return "depressed"    # 低愉悦+低唤醒 = 低落
        else:
            return "neutral"

    # ---- Core: Feedback Adjustment ----

    def adjust_from_feedback(self, feedback: str = "positive") -> PADEnhancedState:
        """
        基于用户反馈调整 PAD 状态

        Args:
            feedback: "positive" / "negative" / "neutral"

        Returns:
            新的 PAD 状态
        """
        self._apply_time_decay()

        multipliers = {
            "positive": {"pleasure": 0.1, "arousal": 0.05, "dominance": 0.0},
            "negative": {"pleasure": -0.1, "arousal": -0.05, "dominance": 0.05},
            "neutral": {"pleasure": 0.0, "arousal": 0.0, "dominance": 0.0},
        }
        m = multipliers.get(feedback, multipliers["neutral"])

        self._state.pleasure = max(-1.0, min(1.0, self._state.pleasure + m["pleasure"] * self.learning_intensity))
        self._state.arousal = max(-1.0, min(1.0, self._state.arousal + m["arousal"] * self.learning_intensity))
        self._state.dominance = max(-1.0, min(1.0, self._state.dominance + m["dominance"] * self.learning_intensity))

        # 能量消耗
        self._state.energy = max(0.0, min(1.0, self._state.energy - self.ENERGY_INTERACTION_COST))

        # 低能量限制唤醒度
        if self._state.energy < self.ENERGY_MIN_FOR_AROUSAL:
            self._state.arousal = min(self._state.arousal, 0.1)

        self._state.total_interactions += 1
        self._state.last_interaction_at = datetime.now()
        self._state.last_updated = datetime.now()

        # 记录情绪快照
        self._record_emotion_snapshot(trigger=f"feedback:{feedback}")

        self._save_state()
        return self._state

    # ---- Core: Event Perturbation ----

    def apply_event(self, event_type: EventType, intensity: float = 1.0, description: str = "") -> EventPerturbation:
        """
        应用事件扰动

        Args:
            event_type: 事件类型
            intensity: 扰动强度 [0.0, 2.0]，1.0 为标准强度
            description: 事件描述

        Returns:
            EventPerturbation 包含各维度变化量和新状态
        """
        self._apply_time_decay()

        profile = EVENT_PROFILES.get(event_type, EVENT_PROFILES[EventType.NEUTRAL])
        intensity = max(0.0, min(2.0, intensity))

        # 情绪共振：连续同类事件产生累加效应
        resonance_boost = self._compute_resonance_boost(event_type)
        effective_intensity = intensity * resonance_boost

        delta_p = profile["pleasure"] * self.learning_intensity * effective_intensity
        delta_a = profile["arousal"] * self.learning_intensity * effective_intensity
        delta_d = profile["dominance"] * self.learning_intensity * effective_intensity
        delta_e = profile["energy"] * effective_intensity  # 能量消耗不受 learning_intensity 影响

        old_p, old_a, old_d, old_e = (
            self._state.pleasure,
            self._state.arousal,
            self._state.dominance,
            self._state.energy,
        )

        self._state.pleasure = max(-1.0, min(1.0, self._state.pleasure + delta_p))
        self._state.arousal = max(-1.0, min(1.0, self._state.arousal + delta_a))
        self._state.dominance = max(-1.0, min(1.0, self._state.dominance + delta_d))
        self._state.energy = max(0.0, min(1.0, self._state.energy + delta_e))

        # 低能量限制唤醒度
        if self._state.energy < self.ENERGY_MIN_FOR_AROUSAL:
            self._state.arousal = min(self._state.arousal, 0.1)

        self._state.total_events += 1
        self._state.last_updated = datetime.now()

        # 记录事件类型到共振窗口
        self._state.recent_event_types.append(event_type.value)
        if len(self._state.recent_event_types) > self.RESONANCE_WINDOW:
            self._state.recent_event_types = self._state.recent_event_types[-self.RESONANCE_WINDOW:]

        # 记录情绪快照
        self._record_emotion_snapshot(trigger=f"event:{event_type.value}")

        # 事件描述默认
        if not description:
            description = f"Event: {event_type.value} (intensity={intensity:.1f})"

        result = EventPerturbation(
            event_type=event_type,
            delta_pleasure=self._state.pleasure - old_p,
            delta_arousal=self._state.arousal - old_a,
            delta_dominance=self._state.dominance - old_d,
            delta_energy=self._state.energy - old_e,
            new_state=self._state,
            description=description,
        )

        self._save_state()
        return result

    # ---- Core: Drift Detection ----

    def detect_drift(self) -> DriftReport:
        """
        检测人格漂移

        计算当前 PAD 值与基线的偏离程度，返回漂移报告。

        Returns:
            DriftReport 包含漂移严重程度和建议
        """
        p_drift = abs(self._state.pleasure - self._state.baseline_pleasure)
        a_drift = abs(self._state.arousal - self._state.baseline_arousal)
        d_drift = abs(self._state.dominance - self._state.baseline_dominance)
        e_drift = abs(self._state.energy - self._state.baseline_energy)

        max_drift = max(p_drift, a_drift, d_drift, e_drift)

        if max_drift >= self.drift_severe:
            severity = DriftSeverity.SEVERE
            recommendation = "人格漂移严重：建议回顾近期交互，考虑重置或调整基线"
        elif max_drift >= self.drift_moderate:
            severity = DriftSeverity.MODERATE
            recommendation = "人格漂移中度：关注情感走向，必要时可通过放松事件回归"
        elif max_drift >= self.drift_mild:
            severity = DriftSeverity.MILD
            recommendation = "人格漂移轻微：正常范围，时间衰减会自然回归"
        else:
            severity = DriftSeverity.NONE
            recommendation = "人格稳定，无漂移"

        return DriftReport(
            severity=severity,
            pleasure_drift=p_drift,
            arousal_drift=a_drift,
            dominance_drift=d_drift,
            energy_drift=e_drift,
            max_drift=max_drift,
            recommendation=recommendation,
            emotion_profile=self._classify_emotion_profile(
                self._state.pleasure, self._state.arousal, self._state.dominance
            ),
        )

    # ---- Core: Baseline Management ----

    def update_baseline(self, window_hours: int = 72) -> dict[str, Any]:
        """
        基于近期交互历史更新基线值

        基线值是 PAD 的长期锚点，反映 Agent 的稳定人格特征。
        定期更新基线可以让人格自然演化。

        Args:
            window_hours: 回看窗口（小时）

        Returns:
            更新结果摘要
        """
        # 从交互记录中获取近期数据
        collector_path = get_project_root() / "data" / "learning" / "interactions.jsonl"
        if not collector_path.exists():
            return {"updated": False, "reason": "no_interaction_data"}

        try:
            cutoff = datetime.now() - timedelta(hours=window_hours)
            p_values, a_values, d_values = [], [], []

            with open(collector_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        ts = datetime.fromisoformat(data["timestamp"])
                        if ts >= cutoff:
                            pad_after = data.get("pad_after", {})
                            p_values.append(pad_after.get("pleasure", 0.3))
                            a_values.append(pad_after.get("arousal", 0.2))
                            d_values.append(pad_after.get("dominance", 0.3))
                    except Exception:
                        continue

            if len(p_values) < 5:
                return {"updated": False, "reason": "insufficient_data", "sample_count": len(p_values)}

            # 使用加权平均，近期数据权重更高
            old_baseline = {
                "pleasure": self._state.baseline_pleasure,
                "arousal": self._state.baseline_arousal,
                "dominance": self._state.baseline_dominance,
            }

            new_p = sum(p_values) / len(p_values)
            new_a = sum(a_values) / len(a_values)
            new_d = sum(d_values) / len(d_values)

            # 基线只做小幅调整（20%权重），避免突变
            self._state.baseline_pleasure = self._state.baseline_pleasure * 0.8 + new_p * 0.2
            self._state.baseline_arousal = self._state.baseline_arousal * 0.8 + new_a * 0.2
            self._state.baseline_dominance = self._state.baseline_dominance * 0.8 + new_d * 0.2

            self._save_state()

            return {
                "updated": True,
                "sample_count": len(p_values),
                "window_hours": window_hours,
                "old_baseline": old_baseline,
                "new_baseline": {
                    "pleasure": round(self._state.baseline_pleasure, 3),
                    "arousal": round(self._state.baseline_arousal, 3),
                    "dominance": round(self._state.baseline_dominance, 3),
                },
            }
        except Exception as e:
            return {"updated": False, "reason": "error", "error": str(e)}

    # ---- Core: Interaction Adjustment ----

    def adjust_from_interaction(self, user_input_length: int, response_length: int) -> PADEnhancedState:
        """
        基于交互规模调整 PAD 状态

        Args:
            user_input_length: 用户输入字符数
            response_length: 响应字符数

        Returns:
            新的 PAD 状态
        """
        self._apply_time_decay()

        total_length = user_input_length + response_length
        current_state = self._state

        # 唤醒度调整
        if total_length < 100:
            delta_arousal = -0.05
        elif total_length > 1000:
            delta_arousal = 0.05
        else:
            delta_arousal = 0.0

        actual_delta = delta_arousal * self.learning_intensity
        new_arousal = max(-1.0, min(1.0, current_state.arousal + actual_delta))

        # 能量消耗
        energy_cost = self.ENERGY_INTERACTION_COST * (1 + total_length / 2000)
        new_energy = max(0.0, min(1.0, current_state.energy - energy_cost))

        # 低能量限制唤醒度
        if new_energy < self.ENERGY_MIN_FOR_AROUSAL:
            new_arousal = min(new_arousal, 0.1)

        self._state.arousal = new_arousal
        self._state.energy = new_energy
        self._state.total_interactions += 1
        self._state.last_interaction_at = datetime.now()
        self._state.last_updated = datetime.now()

        self._save_state()
        return self._state

    # ---- Utility ----

    def get_state(self) -> PADEnhancedState:
        """获取当前状态（含时间衰减）"""
        self._apply_time_decay()
        return self._state

    def set_learning_intensity(self, intensity: float) -> None:
        self.learning_intensity = max(0.0, min(1.0, intensity))
        log(f"PADEngine: 学习强度设为 {self.learning_intensity}", "OK")

    def reset(self) -> None:
        """重置到基线状态"""
        self._state = PADEnhancedState(
            pleasure=self._state.baseline_pleasure,
            arousal=self._state.baseline_arousal,
            dominance=self._state.baseline_dominance,
            energy=self._state.baseline_energy,
            baseline_pleasure=self._state.baseline_pleasure,
            baseline_arousal=self._state.baseline_arousal,
            baseline_dominance=self._state.baseline_dominance,
            baseline_energy=self._state.baseline_energy,
            last_updated=datetime.now(),
            last_interaction_at=datetime.now(),
        )
        self._save_state()
        log("PADEngine: 状态已重置到基线", "OK")

    def full_reset(self) -> None:
        """完全重置（包括基线）"""
        self._state = PADEnhancedState(last_updated=datetime.now())
        self._save_state()
        log("PADEngine: 状态和基线已完全重置", "OK")

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典"""
        s = self._state
        return {
            "pleasure": s.pleasure,
            "arousal": s.arousal,
            "dominance": s.dominance,
            "energy": s.energy,
            "last_updated": s.last_updated.isoformat() if s.last_updated else None,
            "baseline": {
                "pleasure": s.baseline_pleasure,
                "arousal": s.baseline_arousal,
                "dominance": s.baseline_dominance,
                "energy": s.baseline_energy,
            },
            "total_interactions": s.total_interactions,
            "total_events": s.total_events,
            "last_interaction_at": s.last_interaction_at.isoformat() if s.last_interaction_at else None,
            "learning_intensity": self.learning_intensity,
            "drift": self.detect_drift().to_dict() if hasattr(self.detect_drift(), 'to_dict') else None,
        }

    def get_summary(self) -> dict[str, Any]:
        """获取摘要信息"""
        drift = self.detect_drift()
        return {
            "current": {
                "pleasure": round(self._state.pleasure, 3),
                "arousal": round(self._state.arousal, 3),
                "dominance": round(self._state.dominance, 3),
                "energy": round(self._state.energy, 3),
            },
            "baseline": {
                "pleasure": round(self._state.baseline_pleasure, 3),
                "arousal": round(self._state.baseline_arousal, 3),
                "dominance": round(self._state.baseline_dominance, 3),
                "energy": round(self._state.baseline_energy, 3),
            },
            "drift": {
                "severity": drift.severity.value,
                "max_drift": round(drift.max_drift, 3),
                "emotion_profile": drift.emotion_profile,
                "recommendation": drift.recommendation,
            },
            "resilience": {
                "avg_recovery_hours": round(self._state.resilience_hours, 2),
                "samples": self._state.resilience_samples,
            },
            "resonance": {
                "recent_events": self._state.recent_event_types[-self.RESONANCE_WINDOW:],
            },
            "history": {
                "snapshot_count": len(self._state.emotion_history),
                "latest": self._state.emotion_history[-1] if self._state.emotion_history else None,
            },
            "stats": {
                "total_interactions": self._state.total_interactions,
                "total_events": self._state.total_events,
                "learning_intensity": self.learning_intensity,
            },
        }
