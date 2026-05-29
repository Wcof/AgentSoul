"""
AgentSoul · Fact Extractor Tests
=================================
Tests for rule-based fact extraction, fact types, confidence, and merging.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from agentsoul.memory.enhanced.fact_extractor import (
    ExtractedFact,
    FactConfidence,
    FactExtractor,
    FactMerger,
    FactType,
)


@pytest.fixture
def extractor() -> FactExtractor:
    return FactExtractor()


@pytest.fixture
def merger(tmp_path: Path) -> FactMerger:
    return FactMerger(entity_memory_path=tmp_path / "entities")


def _make_fact(**kwargs) -> ExtractedFact:
    defaults = {
        "fact_id": "f-1",
        "fact_type": FactType.PERSONALITY,
        "subject": "user",
        "attribute": "name",
        "value": "Alice",
        "confidence": FactConfidence.HIGH,
        "source_text": "My name is Alice",
        "context": "",
        "extracted_at": datetime.utcnow().isoformat(),
    }
    defaults.update(kwargs)
    return ExtractedFact(**defaults)


class TestFactType:
    def test_fact_types_exist(self) -> None:
        assert FactType.PERSONALITY.value == "personality"
        assert FactType.PREFERENCE.value == "preference"
        assert FactType.KNOWLEDGE.value == "knowledge"

    def test_all_types_are_enum(self) -> None:
        for ft in FactType:
            assert isinstance(ft.value, str)


class TestExtractedFact:
    def test_create_fact(self) -> None:
        fact = _make_fact()
        assert fact.subject == "user"
        assert fact.value == "Alice"
        assert fact.attribute == "name"

    def test_fact_to_dict(self) -> None:
        fact = _make_fact(
            fact_type=FactType.PREFERENCE,
            attribute="likes",
            value="Python",
        )
        d = fact.__dict__
        assert d["fact_type"] == FactType.PREFERENCE
        assert d["value"] == "Python"


class TestFactExtractor:
    def test_extract_from_text(self, extractor: FactExtractor) -> None:
        facts = extractor.extract_by_rules("我叫小明，我是一名开发者，我喜欢Python")
        assert isinstance(facts, list)
        for f in facts:
            assert isinstance(f, ExtractedFact)

    def test_extract_empty_text(self, extractor: FactExtractor) -> None:
        facts = extractor.extract_by_rules("")
        assert len(facts) == 0

    def test_filter_by_confidence(self, extractor: FactExtractor) -> None:
        facts = extractor.extract_by_rules("我叫小明，我是一名开发者")
        filtered = extractor.filter_facts(facts, confidence=FactConfidence.HIGH)
        assert isinstance(filtered, list)
        assert len(filtered) <= len(facts)

    def test_get_statistics(self, extractor: FactExtractor) -> None:
        facts = extractor.extract_by_rules("我叫小明，我喜欢Python")
        stats = extractor.get_fact_statistics(facts)
        assert "total_facts" in stats
        assert stats["total_facts"] == len(facts)

    def test_extract_personality(self, extractor: FactExtractor) -> None:
        facts = extractor.extract_by_rules("我性格开朗，喜欢交朋友")
        if facts:
            types = [f.fact_type for f in facts]
            assert any(t in (FactType.PERSONALITY, FactType.OTHER) for t in types)


class TestFactMerger:
    def test_check_no_conflict_different_attributes(
        self, merger: FactMerger
    ) -> None:
        existing = _make_fact(attribute="name", value="Alice")
        new_fact = _make_fact(
            fact_id="f-2",
            attribute="skill",
            value="Python",
        )
        result = merger.check_conflict(new_fact, [existing.__dict__])
        assert isinstance(result, dict)

    def test_check_conflict_same_attribute_different_value(
        self, merger: FactMerger
    ) -> None:
        existing = _make_fact(attribute="name", value="Alice")
        new_fact = _make_fact(
            fact_id="f-2",
            attribute="name",
            value="Bob",
        )
        result = merger.check_conflict(new_fact, [existing.__dict__])
        assert isinstance(result, dict)
