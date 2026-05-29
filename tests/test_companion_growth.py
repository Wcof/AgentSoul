"""
AgentSoul · Companion Growth Tests
====================================
Verifies growth rules, derived vitals, fatigue states, XP dampening,
offline decay caps, and repository persistence.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from agentsoul.companion.models import (
    CompanionVitals,
    FatigueState,
    GrowthEvent,
    Mood,
)
from agentsoul.companion.repository import CompanionRepository
from agentsoul.companion.growth import GrowthEngine
from agentsoul.companion.vitals import VitalCalculator
from agentsoul.storage.db import DatabaseManager


@pytest.fixture
def db(temp_dir: Path) -> DatabaseManager:
    return DatabaseManager(temp_dir / "agentsoul.db")


@pytest.fixture
def repo(db: DatabaseManager) -> CompanionRepository:
    return CompanionRepository(db)


@pytest.fixture
def engine() -> GrowthEngine:
    return GrowthEngine()


class TestCompanionVitals:
    """CompanionVitals data model defaults."""

    def test_default_vitals(self) -> None:
        v = CompanionVitals()
        assert v.level == 1
        assert v.xp == 0
        assert v.companion_energy == 100.0
        assert v.hunger == 50.0
        assert v.intimacy == 0.0

    def test_mood_default_is_neutral(self) -> None:
        v = CompanionVitals()
        assert v.mood == Mood.NEUTRAL


class TestGrowthEngine:
    """Growth rules convert interactions and events into vitals changes."""

    def test_feed_increases_hunger_and_intimacy(
        self, engine: GrowthEngine
    ) -> None:
        v = CompanionVitals(hunger=30.0, intimacy=10.0)
        event = engine.apply_interaction(v, "feed")
        assert v.hunger > 30.0
        assert v.intimacy > 10.0
        assert event.source_type == "interaction"
        assert event.event_data["interaction"] == "feed"

    def test_play_blocked_when_energy_below_20(
        self, engine: GrowthEngine
    ) -> None:
        v = CompanionVitals(companion_energy=15.0)
        event = engine.apply_interaction(v, "play")
        assert v.companion_energy == 15.0  # Energy unchanged
        assert v.fatigue == FatigueState.FATIGUED
        assert event.event_data.get("blocked") is True

    def test_play_consumes_energy_when_sufficient(
        self, engine: GrowthEngine
    ) -> None:
        v = CompanionVitals(companion_energy=80.0, intimacy=5.0, xp=0)
        engine.apply_interaction(v, "play")
        assert v.companion_energy < 80.0
        assert v.intimacy > 5.0
        assert v.xp > 0

    def test_pet_increases_intimacy_and_xp(
        self, engine: GrowthEngine
    ) -> None:
        v = CompanionVitals(intimacy=0.0, xp=0)
        engine.apply_interaction(v, "pet")
        assert v.intimacy > 0.0
        assert v.xp > 0

    def test_sleep_restores_energy(self, engine: GrowthEngine) -> None:
        v = CompanionVitals(companion_energy=30.0)
        engine.apply_interaction(v, "sleep")
        assert v.companion_energy > 30.0

    def test_gateway_success_produces_xp(
        self, engine: GrowthEngine
    ) -> None:
        v = CompanionVitals(xp=0, companion_energy=100.0)
        event = engine.apply_gateway_event(
            v,
            success=True,
            tokens_in=500,
            tokens_out=200,
        )
        assert v.xp > 0
        assert v.companion_energy < 100.0
        assert event.source_type == "gateway"

    def test_gateway_failure_no_xp(self, engine: GrowthEngine) -> None:
        v = CompanionVitals(xp=50, companion_energy=80.0)
        engine.apply_gateway_event(v, success=False, tokens_in=100, tokens_out=0)
        assert v.xp == 50  # XP unchanged

    def test_xp_dampening_at_low_energy(self, engine: GrowthEngine) -> None:
        """Low energy reduces XP gain but does not zero it."""
        v_full = CompanionVitals(companion_energy=100.0, xp=0)
        v_low = CompanionVitals(companion_energy=10.0, xp=0)
        engine.apply_gateway_event(v_full, success=True, tokens_in=500, tokens_out=200)
        engine.apply_gateway_event(v_low, success=True, tokens_in=500, tokens_out=200)
        assert v_low.xp > 0  # Not zero
        assert v_low.xp < v_full.xp  # But reduced


class TestVitalCalculator:
    """Derived vitals use system time, offline decay caps, and clock anomaly detection."""

    def test_hunger_increases_over_time(self) -> None:
        v = CompanionVitals(hunger=50.0)
        last_update = datetime.utcnow() - timedelta(hours=2)
        calc = VitalCalculator()
        new_hunger = calc.derive_hunger(v.hunger, last_update)
        assert new_hunger > 50.0

    def test_offline_decay_cap_limits_hunger(self) -> None:
        """Being away for a very long time should not max out hunger."""
        v = CompanionVitals(hunger=50.0)
        last_update = datetime.utcnow() - timedelta(days=30)
        calc = VitalCalculator()
        new_hunger = calc.derive_hunger(v.hunger, last_update)
        assert new_hunger <= calc.max_hunger
        # Should not be astronomical
        assert new_hunger < 100.0 + calc.offline_decay_cap

    def test_energy_rest_recovery(self) -> None:
        """Energy should recover during inactivity."""
        v = CompanionVitals(companion_energy=30.0)
        last_update = datetime.utcnow() - timedelta(hours=3)
        calc = VitalCalculator()
        new_energy = calc.derive_energy(v.companion_energy, last_update)
        assert new_energy > 30.0

    def test_clock_anomaly_backward_jump_ignored(self) -> None:
        """A backward clock jump should not increase hunger."""
        v = CompanionVitals(hunger=50.0)
        last_update = datetime.utcnow() + timedelta(hours=2)  # Future timestamp
        calc = VitalCalculator()
        new_hunger = calc.derive_hunger(v.hunger, last_update)
        assert new_hunger == pytest.approx(50.0)  # Should not change


class TestCompanionRepository:
    """Repository persists and retrieves companion state from SQLite."""

    def test_save_and_load_vitals(self, repo: CompanionRepository) -> None:
        v = CompanionVitals(level=3, xp=150, companion_energy=75.0, hunger=40.0, intimacy=25.0)
        repo.save_vitals(v)
        loaded = repo.load_vitals()
        assert loaded is not None
        assert loaded.level == 3
        assert loaded.xp == 150
        assert loaded.companion_energy == 75.0

    def test_load_vitals_returns_none_when_empty(
        self, repo: CompanionRepository
    ) -> None:
        assert repo.load_vitals() is None

    def test_append_growth_event(self, repo: CompanionRepository) -> None:
        event = GrowthEvent(
            source_type="interaction",
            source_id="feed-1",
            event_data={"interaction": "feed", "hunger_delta": 30},
            growth_rule_version="v1",
        )
        repo.append_growth_event(event)
        events = repo.get_growth_events()
        assert len(events) == 1
        assert events[0].source_type == "interaction"
        assert events[0].event_data["hunger_delta"] == 30

    def test_growth_events_ordered_by_time(
        self, repo: CompanionRepository
    ) -> None:
        for i in range(5):
            event = GrowthEvent(
                source_type="gateway",
                source_id=f"req-{i}",
                event_data={"xp": i * 10},
                growth_rule_version="v1",
            )
            repo.append_growth_event(event)
        events = repo.get_growth_events()
        assert len(events) == 5
        assert events[0].event_data["xp"] == 0
        assert events[-1].event_data["xp"] == 40

    def test_update_mood(self, repo: CompanionRepository) -> None:
        v = CompanionVitals(mood=Mood.HAPPY)
        repo.save_vitals(v)
        loaded = repo.load_vitals()
        assert loaded is not None
        assert loaded.mood == Mood.HAPPY
