"""
AgentSoul · Gateway Audit Tests
================================
Verifies GatewayEvent/TrafficMetadata models, metadata-only audit records,
provider profile resolution, and adapter interface.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from agentsoul.storage.db import DatabaseManager
from gateway.events import GatewayEvent, TrafficMetadata
from gateway.audit import AuditWriter, AuditReader
from gateway.providers import ProviderProfile, ProviderActivationMode, resolve_active_profile
from gateway.adapters.base import ProviderAdapter, UnsupportedRouteError
from gateway.adapters.openai_chat import OpenAIChatAdapter


@pytest.fixture
def db(temp_dir: Path) -> DatabaseManager:
    return DatabaseManager(temp_dir / "agentsoul.db")


@pytest.fixture
def audit_writer(db: DatabaseManager) -> AuditWriter:
    return AuditWriter(db)


@pytest.fixture
def audit_reader(db: DatabaseManager) -> AuditReader:
    return AuditReader(db)


class TestGatewayEvent:
    """GatewayEvent represents a factual observation of traffic."""

    def test_create_event_with_metadata(self) -> None:
        meta = TrafficMetadata(
            client_protocol="claude_messages",
            provider_profile_id="openai-default",
            model="gpt-4",
            tokens_in=150,
            tokens_out=80,
            latency_ms=1200,
        )
        event = GatewayEvent(
            event_id="evt-001",
            occurred_at=datetime.utcnow(),
            metadata=meta,
            outcome="success",
        )
        assert event.event_id == "evt-001"
        assert event.metadata.model == "gpt-4"
        assert event.metadata.tokens_in == 150

    def test_traffic_metadata_no_body_by_default(self) -> None:
        meta = TrafficMetadata(
            client_protocol="claude_messages",
            provider_profile_id="openai-default",
            model="gpt-4",
            tokens_in=100,
            tokens_out=50,
            latency_ms=800,
        )
        # TrafficMetadata should not carry request/response bodies
        assert not hasattr(meta, "request_body") or meta.request_body is None
        assert not hasattr(meta, "response_body") or meta.response_body is None


class TestAuditWriter:
    """Audit writer persists metadata-only records."""

    def test_write_metadata_only_record(
        self, audit_writer: AuditWriter, audit_reader: AuditReader
    ) -> None:
        meta = TrafficMetadata(
            client_protocol="claude_messages",
            provider_profile_id="openai-default",
            model="gpt-4",
            tokens_in=200,
            tokens_out=100,
            latency_ms=950,
        )
        event = GatewayEvent(
            event_id="evt-100",
            occurred_at=datetime.utcnow(),
            metadata=meta,
            outcome="success",
            estimated_cost=0.006,
        )
        audit_writer.write(event)

        records = audit_reader.list_records()
        assert len(records) == 1
        assert records[0]["gateway_event_id"] == "evt-100"
        stored_meta = json.loads(records[0]["traffic_metadata_json"])
        assert stored_meta["model"] == "gpt-4"

    def test_bodies_not_persisted_by_default(
        self, audit_writer: AuditWriter, db: DatabaseManager
    ) -> None:
        meta = TrafficMetadata(
            client_protocol="openai_chat",
            provider_profile_id="default",
            model="gpt-3.5-turbo",
            tokens_in=50,
            tokens_out=30,
            latency_ms=400,
        )
        event = GatewayEvent(
            event_id="evt-200",
            occurred_at=datetime.utcnow(),
            metadata=meta,
            outcome="success",
        )
        audit_writer.write(event)

        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT traffic_metadata_json FROM audit_records WHERE gateway_event_id = 'evt-200'"
            ).fetchone()

        stored = json.loads(row[0])
        assert "request_body" not in stored
        assert "response_body" not in stored

    def test_evidence_hash_stored_when_present(
        self, audit_writer: AuditWriter, audit_reader: AuditReader
    ) -> None:
        meta = TrafficMetadata(
            client_protocol="openai_chat",
            provider_profile_id="default",
            model="gpt-4",
            tokens_in=100,
            tokens_out=50,
            latency_ms=600,
        )
        event = GatewayEvent(
            event_id="evt-300",
            occurred_at=datetime.utcnow(),
            metadata=meta,
            outcome="success",
            evidence_hash="sha256:abcdef1234567890",
        )
        audit_writer.write(event)

        records = audit_reader.list_records()
        assert records[0]["evidence_hash"] == "sha256:abcdef1234567890"

    def test_estimated_cost_stored(
        self, audit_writer: AuditWriter, audit_reader: AuditReader
    ) -> None:
        meta = TrafficMetadata(
            client_protocol="openai_chat",
            provider_profile_id="default",
            model="gpt-4",
            tokens_in=500,
            tokens_out=200,
            latency_ms=1500,
        )
        event = GatewayEvent(
            event_id="evt-400",
            occurred_at=datetime.utcnow(),
            metadata=meta,
            outcome="success",
            estimated_cost=0.021,
        )
        audit_writer.write(event)

        records = audit_reader.list_records()
        assert records[0]["estimated_cost"] == pytest.approx(0.021)


class TestProviderProfiles:
    """Provider profile resolution and activation modes."""

    def test_gateway_route_is_default(self) -> None:
        profile = ProviderProfile(
            profile_id="openai",
            name="OpenAI",
            activation_mode=ProviderActivationMode.GATEWAY_ROUTE,
        )
        assert profile.activation_mode == ProviderActivationMode.GATEWAY_ROUTE

    def test_direct_client_config_as_fallback(self) -> None:
        profile = ProviderProfile(
            profile_id="local-ollama",
            name="Ollama",
            activation_mode=ProviderActivationMode.DIRECT_CLIENT_CONFIG,
        )
        assert profile.activation_mode == ProviderActivationMode.DIRECT_CLIENT_CONFIG

    def test_resolve_active_profile_returns_first_enabled(self) -> None:
        profiles = [
            ProviderProfile("p1", "OpenAI", ProviderActivationMode.GATEWAY_ROUTE, enabled=False),
            ProviderProfile("p2", "Claude", ProviderActivationMode.GATEWAY_ROUTE, enabled=True),
        ]
        active = resolve_active_profile(profiles)
        assert active is not None
        assert active.profile_id == "p2"

    def test_resolve_returns_none_when_all_disabled(self) -> None:
        profiles = [
            ProviderProfile("p1", "OpenAI", ProviderActivationMode.GATEWAY_ROUTE, enabled=False),
        ]
        assert resolve_active_profile(profiles) is None


class TestProviderAdapter:
    """Provider adapter interface and unsupported route handling."""

    def test_openai_chat_adapter_implements_interface(self) -> None:
        adapter = OpenAIChatAdapter()
        assert isinstance(adapter, ProviderAdapter)

    def test_adapter_has_translate_method(self) -> None:
        adapter = OpenAIChatAdapter()
        assert hasattr(adapter, "translate_request")
        assert hasattr(adapter, "translate_response")

    def test_unsupported_route_raises_error(self) -> None:
        adapter = OpenAIChatAdapter()
        with pytest.raises(UnsupportedRouteError):
            adapter.translate_request(
                client_protocol="gemini",
                provider_config={"model": "gemini-pro"},
                messages=[{"role": "user", "content": "hello"}],
            )
