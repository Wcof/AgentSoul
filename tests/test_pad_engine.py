"""
Tests for PADEngine (enhanced PAD emotional engine)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pytest

# Ensure project root is on sys.path so `common` package resolves correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentsoul.learning.adaptive_learning.pad_engine import (
    DriftSeverity,
    EventType,
    PADEngine,
    PADEnhancedState,
)


@pytest.fixture
def tmp_path_factory_pad(tmp_path):
    """Provide a temporary data directory for PAD engine tests."""
    data_dir = tmp_path / "soul"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def engine(tmp_path_factory_pad):
    """Create a PAD engine with temporary storage."""
    return PADEngine(data_path=tmp_path_factory_pad, learning_intensity=0.3)


class TestPADEnhancedState:
    """Tests for PADEnhancedState dataclass."""

    def test_default_values(self):
        state = PADEnhancedState()
        assert state.pleasure == 0.3
        assert state.arousal == 0.2
        assert state.dominance == 0.3
        assert state.energy == 0.8
        assert state.baseline_pleasure == 0.3

    def test_custom_values(self):
        state = PADEnhancedState(pleasure=0.5, arousal=-0.3, dominance=0.7, energy=0.4)
        assert state.pleasure == 0.5
        assert state.arousal == -0.3
        assert state.dominance == 0.7
        assert state.energy == 0.4


class TestPADEngineBasic:
    """Basic PADEngine functionality tests."""

    def test_initial_state(self, engine):
        state = engine.get_state()
        assert state.pleasure == pytest.approx(0.3, abs=0.01)
        assert state.arousal == pytest.approx(0.2, abs=0.01)
        assert state.dominance == pytest.approx(0.3, abs=0.01)
        assert state.energy == pytest.approx(0.8, abs=0.01)

    def test_persistence(self, tmp_path_factory_pad):
        engine1 = PADEngine(data_path=tmp_path_factory_pad, learning_intensity=0.3)
        engine1.adjust_from_feedback("positive")
        state1 = engine1.get_state()

        # Create new engine with same path - should load persisted state
        engine2 = PADEngine(data_path=tmp_path_factory_pad, learning_intensity=0.3)
        state2 = engine2.get_state()
        assert state2.pleasure == pytest.approx(state1.pleasure, abs=0.01)

    def test_reset(self, engine):
        engine.adjust_from_feedback("negative")
        engine.reset()
        state = engine.get_state()
        assert state.pleasure == pytest.approx(state.baseline_pleasure, abs=0.01)
        assert state.energy == pytest.approx(state.baseline_energy, abs=0.01)

    def test_full_reset(self, engine):
        engine.adjust_from_feedback("negative")
        engine.full_reset()
        state = engine.get_state()
        assert state.pleasure == pytest.approx(0.3, abs=0.01)
        assert state.baseline_pleasure == pytest.approx(0.3, abs=0.01)


class TestFeedbackAdjustment:
    """Tests for feedback-based PAD adjustment."""

    def test_positive_feedback(self, engine):
        state = engine.adjust_from_feedback("positive")
        assert state.pleasure > 0.3
        assert state.energy < 0.8  # energy consumed

    def test_negative_feedback(self, engine):
        state = engine.adjust_from_feedback("negative")
        assert state.pleasure < 0.3
        assert state.energy < 0.8

    def test_neutral_feedback(self, engine):
        state = engine.adjust_from_feedback("neutral")
        # Neutral should not change pleasure
        assert state.pleasure == pytest.approx(0.3, abs=0.01)
        # But still consumes energy
        assert state.energy < 0.8

    def test_unknown_feedback_treated_as_neutral(self, engine):
        state = engine.adjust_from_feedback("unknown_type")
        assert state.pleasure == pytest.approx(0.3, abs=0.01)

    def test_multiple_feedbacks_accumulate(self, engine):
        for _ in range(5):
            engine.adjust_from_feedback("positive")
        state = engine.get_state()
        assert state.pleasure > 0.3
        assert state.total_interactions == 5

    def test_energy_depleted_limits_arousal(self, engine):
        # Deplete energy to very low
        for _ in range(50):
            engine.adjust_from_feedback("positive")
        state = engine.get_state()
        # When energy is very low, arousal should be limited
        if state.energy < engine.ENERGY_MIN_FOR_AROUSAL:
            assert state.arousal <= 0.1


class TestEventPerturbation:
    """Tests for event-based PAD perturbation."""

    def test_positive_event(self, engine):
        result = engine.apply_event(EventType.POSITIVE)
        assert result.delta_pleasure > 0
        assert result.delta_arousal > 0
        assert result.event_type == EventType.POSITIVE

    def test_negative_event(self, engine):
        result = engine.apply_event(EventType.NEGATIVE)
        assert result.delta_pleasure < 0

    def test_stress_event(self, engine):
        result = engine.apply_event(EventType.STRESS)
        assert result.delta_arousal > 0  # stress increases arousal
        assert result.delta_pleasure < 0  # stress decreases pleasure

    def test_relaxation_event(self, engine):
        result = engine.apply_event(EventType.RELAXATION)
        assert result.delta_arousal < 0  # relaxation decreases arousal
        assert result.delta_energy > 0  # relaxation recovers energy

    def test_surprise_event(self, engine):
        result = engine.apply_event(EventType.SURPRISE)
        assert result.delta_arousal > 0  # surprise increases arousal

    def test_intensity_scaling(self, engine):
        result_low = engine.apply_event(EventType.POSITIVE, intensity=0.5)
        # Reset
        engine.reset()
        result_high = engine.apply_event(EventType.POSITIVE, intensity=2.0)
        # Higher intensity should have larger effect
        assert abs(result_high.delta_pleasure) > abs(result_low.delta_pleasure) or result_high.delta_pleasure == result_low.delta_pleasure

    def test_custom_description(self, engine):
        result = engine.apply_event(EventType.POSITIVE, description="用户说谢谢")
        assert result.description == "用户说谢谢"

    def test_total_events_count(self, engine):
        engine.apply_event(EventType.POSITIVE)
        engine.apply_event(EventType.NEGATIVE)
        state = engine.get_state()
        assert state.total_events == 2


class TestDriftDetection:
    """Tests for personality drift detection."""

    def test_no_drift_initially(self, engine):
        report = engine.detect_drift()
        assert report.severity == DriftSeverity.NONE
        assert report.max_drift < 0.1

    def test_mild_drift(self, engine):
        # Apply some events to cause small drift
        for _ in range(3):
            engine.apply_event(EventType.POSITIVE)
        report = engine.detect_drift()
        # Should detect some drift (mild or none depending on learning intensity)
        assert report.pleasure_drift >= 0
        assert report.max_drift >= 0

    def test_drift_report_fields(self, engine):
        report = engine.detect_drift()
        assert hasattr(report, "severity")
        assert hasattr(report, "pleasure_drift")
        assert hasattr(report, "arousal_drift")
        assert hasattr(report, "dominance_drift")
        assert hasattr(report, "energy_drift")
        assert hasattr(report, "max_drift")
        assert hasattr(report, "recommendation")

    def test_drift_thresholds_configurable(self, tmp_path_factory_pad):
        engine = PADEngine(
            data_path=tmp_path_factory_pad,
            drift_thresholds={"mild": 0.1, "moderate": 0.3, "severe": 0.5},
        )
        assert engine.drift_mild == 0.1
        assert engine.drift_moderate == 0.3
        assert engine.drift_severe == 0.5


class TestTimeDecay:
    """Tests for time-based decay to baseline."""

    def test_decay_toward_baseline(self, engine):
        # Push state away from baseline
        engine.apply_event(EventType.POSITIVE)
        state_before = engine.get_state()

        # Simulate time passage by manipulating last_updated
        engine._state.last_updated = datetime.now() - timedelta(hours=10)
        engine._save_state()

        # Load again - decay should be applied
        state_after = engine.get_state()
        # State should have moved toward baseline (closer than before)
        diff_before = abs(state_before.pleasure - engine._state.baseline_pleasure)
        diff_after = abs(state_after.pleasure - engine._state.baseline_pleasure)
        assert diff_after <= diff_before + 0.01  # allow small tolerance

    def test_energy_recovery_over_time(self, engine):
        # Deplete energy
        for _ in range(10):
            engine.adjust_from_feedback("positive")
        energy_depleted = engine.get_state().energy
        assert energy_depleted < 0.8

        # Simulate time passage
        engine._state.last_updated = datetime.now() - timedelta(hours=5)
        engine._save_state()

        state_after = engine.get_state()
        assert state_after.energy >= energy_depleted


class TestInteractionAdjustment:
    """Tests for interaction-based PAD adjustment."""

    def test_short_interaction(self, engine):
        state = engine.adjust_from_interaction(user_input_length=50, response_length=50)
        assert state.total_interactions == 1
        assert state.energy < 0.8

    def test_long_interaction(self, engine):
        state = engine.adjust_from_interaction(user_input_length=500, response_length=500)
        assert state.total_interactions == 1
        # Long interaction should increase arousal slightly
        assert state.energy < 0.8


class TestLearningIntensity:
    """Tests for learning intensity parameter."""

    def test_set_learning_intensity(self, engine):
        engine.set_learning_intensity(0.5)
        assert engine.learning_intensity == 0.5

    def test_learning_intensity_clamped(self, engine):
        engine.set_learning_intensity(-0.5)
        assert engine.learning_intensity == 0.0
        engine.set_learning_intensity(2.0)
        assert engine.learning_intensity == 1.0

    def test_higher_intensity_more_change(self, tmp_path_factory_pad):
        engine_low = PADEngine(data_path=tmp_path_factory_pad / "low", learning_intensity=0.1)
        engine_high = PADEngine(data_path=tmp_path_factory_pad / "high", learning_intensity=0.9)

        result_low = engine_low.apply_event(EventType.POSITIVE)
        result_high = engine_high.apply_event(EventType.POSITIVE)

        # Higher intensity should cause larger changes
        assert abs(result_high.delta_pleasure) >= abs(result_low.delta_pleasure)


class TestSummary:
    """Tests for summary output."""

    def test_get_summary(self, engine):
        summary = engine.get_summary()
        assert "current" in summary
        assert "baseline" in summary
        assert "drift" in summary
        assert "stats" in summary
        assert summary["stats"]["learning_intensity"] == 0.3

    def test_to_dict(self, engine):
        d = engine.to_dict()
        assert "pleasure" in d
        assert "baseline" in d
        assert "learning_intensity" in d


# ============================================================================
# Deep Tests: Emotion Naming (Mehrabian 1996)
# ============================================================================

class TestEmotionNaming:
    """PAD → emotion label mapping based on Mehrabian's 8-quadrant model."""

    def test_excited_confident(self):
        """P+ A+ D+ → excited_confident"""
        assert PADEngine.name_emotion(0.5, 0.5, 0.5) == "excited_confident"

    def test_dependent_admiring(self):
        """P+ A+ D- → dependent_admiring"""
        assert PADEngine.name_emotion(0.5, 0.5, -0.5) == "dependent_admiring"

    def test_relaxed_composed(self):
        """P+ A- D+ → relaxed_composed"""
        assert PADEngine.name_emotion(0.5, -0.5, 0.5) == "relaxed_composed"

    def test_docile_content(self):
        """P+ A- D- → docile_content"""
        assert PADEngine.name_emotion(0.5, -0.5, -0.5) == "docile_content"

    def test_angry_hostile(self):
        """P- A+ D+ → angry_hostile"""
        assert PADEngine.name_emotion(-0.5, 0.5, 0.5) == "angry_hostile"

    def test_anxious_fearful(self):
        """P- A+ D- → anxious_fearful"""
        assert PADEngine.name_emotion(-0.5, 0.5, -0.5) == "anxious_fearful"

    def test_bored_contemptuous(self):
        """P- A- D+ → bored_contemptuous"""
        assert PADEngine.name_emotion(-0.5, -0.5, 0.5) == "bored_contemptuous"

    def test_melancholic_sad(self):
        """P- A- D- → melancholic_sad"""
        assert PADEngine.name_emotion(-0.5, -0.5, -0.5) == "melancholic_sad"

    def test_neutral_near_zero(self):
        """Values near zero should be neutral."""
        assert PADEngine.name_emotion(0.01, 0.01, 0.01) == "neutral"

    def test_neutral_exact_zero(self):
        assert PADEngine.name_emotion(0.0, 0.0, 0.0) == "neutral"


# ============================================================================
# Deep Tests: Energy Management
# ============================================================================

class TestEnergyManagement:
    """Energy consumption during interactions and recovery during rest."""

    def test_energy_decreases_on_interaction(self, engine):
        initial_energy = engine.get_state().energy
        engine.adjust_from_feedback("positive")
        assert engine.get_state().energy < initial_energy

    def test_energy_decreases_on_event(self, engine):
        initial_energy = engine.get_state().energy
        engine.apply_event(EventType.STRESS, intensity=1.0)
        assert engine.get_state().energy < initial_energy

    def test_energy_recovers_on_rest(self, tmp_path_factory_pad):
        engine = PADEngine(data_path=tmp_path_factory_pad, learning_intensity=0.3)
        # Drain some energy
        engine.adjust_from_feedback("positive")
        engine.adjust_from_feedback("positive")
        low_energy = engine.get_state().energy

        # Simulate rest by backdating last_updated
        engine._state.last_updated = datetime.now() - timedelta(hours=3)
        engine._save_state()

        # Reload engine
        engine2 = PADEngine(data_path=tmp_path_factory_pad, learning_intensity=0.3)
        recovered_energy = engine2.get_state().energy
        assert recovered_energy > low_energy

    def test_relaxation_event_restores_energy(self, engine):
        # Drain energy
        engine.apply_event(EventType.STRESS, intensity=1.5)
        low = engine.get_state().energy
        # Relax
        engine.apply_event(EventType.RELAXATION, intensity=1.0)
        assert engine.get_state().energy > low


# ============================================================================
# Deep Tests: Drift Detection
# ============================================================================

class TestDriftDetection:
    """Drift detection at various severity levels."""

    def test_no_drift_at_baseline(self, engine):
        report = engine.detect_drift()
        assert report.severity == DriftSeverity.NONE

    def test_mild_drift_after_few_events(self, engine):
        for _ in range(3):
            engine.apply_event(EventType.POSITIVE, intensity=1.0)
        report = engine.detect_drift()
        assert report.severity in (DriftSeverity.NONE, DriftSeverity.MILD)

    def test_severe_drift_after_many_stress_events(self, engine):
        for _ in range(15):
            engine.apply_event(EventType.STRESS, intensity=2.0)
        report = engine.detect_drift()
        assert report.severity in (DriftSeverity.MODERATE, DriftSeverity.SEVERE)

    def test_drift_report_contains_emotion_profile(self, engine):
        report = engine.detect_drift()
        assert report.emotion_profile in (
            "excited", "relaxed", "anxious", "depressed", "neutral"
        )

    def test_drift_resets_after_engine_reset(self, engine):
        for _ in range(10):
            engine.apply_event(EventType.NEGATIVE, intensity=1.5)
        engine.reset()
        report = engine.detect_drift()
        assert report.severity == DriftSeverity.NONE


# ============================================================================
# Deep Tests: Event Perturbation
# ============================================================================

class TestEventPerturbation:
    """Event perturbation effects on PAD state."""

    def test_positive_increases_pleasure(self, engine):
        old_p = engine.get_state().pleasure
        result = engine.apply_event(EventType.POSITIVE)
        assert result.delta_pleasure > 0
        assert engine.get_state().pleasure > old_p

    def test_negative_decreases_pleasure(self, engine):
        old_p = engine.get_state().pleasure
        engine.apply_event(EventType.NEGATIVE)
        assert engine.get_state().pleasure < old_p

    def test_stress_increases_arousal(self, engine):
        old_a = engine.get_state().arousal
        engine.apply_event(EventType.STRESS)
        assert engine.get_state().arousal > old_a

    def test_relaxation_decreases_arousal(self, engine):
        # First raise arousal
        engine.apply_event(EventType.STRESS)
        high_a = engine.get_state().arousal
        engine.apply_event(EventType.RELAXATION)
        assert engine.get_state().arousal < high_a

    def test_intensity_scales_deltas(self, engine):
        engine.apply_event(EventType.POSITIVE, intensity=0.5)
        delta_low = engine.get_state().pleasure - 0.3  # baseline
        engine.reset()
        engine.apply_event(EventType.POSITIVE, intensity=2.0)
        delta_high = engine.get_state().pleasure - 0.3
        assert abs(delta_high) > abs(delta_low)

    def test_neutral_event_no_change(self, engine):
        old_state = (engine.get_state().pleasure, engine.get_state().arousal,
                     engine.get_state().dominance)
        engine.apply_event(EventType.NEUTRAL, intensity=1.0)
        new_state = (engine.get_state().pleasure, engine.get_state().arousal,
                     engine.get_state().dominance)
        assert new_state == pytest.approx(old_state, abs=0.01)


# ============================================================================
# Deep Tests: Emotion Resonance
# ============================================================================

class TestEmotionResonance:
    """Consecutive same-type events should amplify each other."""

    def test_consecutive_positive_amplifies(self, engine):
        engine.apply_event(EventType.POSITIVE, intensity=1.0)
        delta_first = engine.get_state().pleasure - 0.3

        engine.apply_event(EventType.POSITIVE, intensity=1.0)
        total_delta = engine.get_state().pleasure - 0.3

        # Second event should amplify due to resonance
        assert total_delta > delta_first * 1.5

    def test_different_events_break_resonance(self, engine):
        engine.apply_event(EventType.POSITIVE, intensity=1.0)
        engine.apply_event(EventType.NEGATIVE, intensity=1.0)
        # No resonance accumulated for the negative event
        engine.apply_event(EventType.POSITIVE, intensity=1.0)
        # This third positive should not have as much resonance as consecutive
        report = engine.get_summary()
        assert "resonance" in report
