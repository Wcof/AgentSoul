"""
AgentSoul · Safety Policy Tests
================================
Verifies risk classification, approval lifecycle, timeout/unavailable deny,
trust grants, and distinction between Approval Required and Risk Notice.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from agentsoul.safety.models import (
    ActionRiskClass,
    ApprovalDecision,
    ApprovalRequest,
    ApprovalStatus,
    RiskNotice,
    ScopedTrustGrant,
)
from agentsoul.safety.policy import SafetyPolicy
from agentsoul.safety.repository import SafetyRepository
from agentsoul.storage.db import DatabaseManager


@pytest.fixture
def db(temp_dir: Path) -> DatabaseManager:
    return DatabaseManager(temp_dir / "agentsoul.db")


@pytest.fixture
def policy() -> SafetyPolicy:
    return SafetyPolicy()


@pytest.fixture
def repo(db: DatabaseManager) -> SafetyRepository:
    return SafetyRepository(db)


class TestActionRiskClass:
    """Risk classification hierarchy."""

    def test_safe_action_does_not_require_approval(self) -> None:
        assert ActionRiskClass.SAFE.requires_approval is False

    def test_sensitive_action_requires_notice(self) -> None:
        assert ActionRiskClass.SENSITIVE.requires_notice is True

    def test_high_risk_requires_approval(self) -> None:
        assert ActionRiskClass.HIGH_RISK.requires_approval is True

    def test_critical_requires_stronger_confirmation(self) -> None:
        assert ActionRiskClass.CRITICAL.requires_approval is True
        assert ActionRiskClass.CRITICAL.requires_stronger_confirmation is True


class TestSafetyPolicy:
    """Policy decisions based on risk class and context."""

    def test_safe_action_returns_risk_notice(
        self, policy: SafetyPolicy
    ) -> None:
        decision = policy.evaluate(
            action="read_status",
            risk_class=ActionRiskClass.SAFE,
        )
        assert decision.kind == "risk_notice"
        assert decision.requires_user_response is False

    def test_high_risk_action_requires_approval(
        self, policy: SafetyPolicy
    ) -> None:
        decision = policy.evaluate(
            action="write_file",
            risk_class=ActionRiskClass.HIGH_RISK,
        )
        assert decision.kind == "approval_required"
        assert decision.requires_user_response is True

    def test_critical_action_requires_approval(
        self, policy: SafetyPolicy
    ) -> None:
        decision = policy.evaluate(
            action="delete_all",
            risk_class=ActionRiskClass.CRITICAL,
        )
        assert decision.kind == "approval_required"
        assert decision.requires_stronger_confirmation is True

    def test_fully_authorized_client_produces_risk_notice(
        self, policy: SafetyPolicy
    ) -> None:
        """When client is fully authorized, high-risk actions produce Risk Notice, not Approval Required."""
        decision = policy.evaluate(
            action="write_file",
            risk_class=ActionRiskClass.HIGH_RISK,
            client_authorization_mode="fully_authorized",
        )
        assert decision.kind == "risk_notice"

    def test_trusted_grant_skips_approval(
        self, policy: SafetyPolicy
    ) -> None:
        grant = ScopedTrustGrant(
            grant_id="g1",
            action_class="write_file",
            scope={"project": "/my/project"},
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        decision = policy.evaluate(
            action="write_file",
            risk_class=ActionRiskClass.HIGH_RISK,
            context={"project": "/my/project"},
            active_grants=[grant],
        )
        assert decision.kind == "trusted"

    def test_expired_grant_does_not_skip(
        self, policy: SafetyPolicy
    ) -> None:
        grant = ScopedTrustGrant(
            grant_id="g1",
            action_class="write_file",
            scope={"project": "/my/project"},
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        decision = policy.evaluate(
            action="write_file",
            risk_class=ActionRiskClass.HIGH_RISK,
            context={"project": "/my/project"},
            active_grants=[grant],
        )
        assert decision.kind == "approval_required"


class TestApprovalRequest:
    """Approval request lifecycle."""

    def test_new_request_is_pending(self) -> None:
        req = ApprovalRequest(
            request_id="apr-1",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
            context={"path": "/etc/hosts"},
        )
        assert req.status == ApprovalStatus.PENDING

    def test_approve_request(self) -> None:
        req = ApprovalRequest(
            request_id="apr-2",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
        )
        req.decide(ApprovalDecision.ALLOW)
        assert req.status == ApprovalStatus.APPROVED

    def test_deny_request(self) -> None:
        req = ApprovalRequest(
            request_id="apr-3",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
        )
        req.decide(ApprovalDecision.DENY)
        assert req.status == ApprovalStatus.DENIED

    def test_timeout_produces_timeout_denied(self) -> None:
        req = ApprovalRequest(
            request_id="apr-4",
            created_at=datetime.utcnow() - timedelta(seconds=60),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
            timeout_seconds=30,
        )
        result = req.check_timeout()
        assert result is True
        assert req.status == ApprovalStatus.TIMEOUT_DENIED

    def test_not_timed_out_within_window(self) -> None:
        req = ApprovalRequest(
            request_id="apr-5",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
            timeout_seconds=30,
        )
        assert req.check_timeout() is False
        assert req.status == ApprovalStatus.PENDING


class TestSafetyRepository:
    """Repository persists approval requests and trust grants."""

    def test_save_and_load_approval(self, repo: SafetyRepository) -> None:
        req = ApprovalRequest(
            request_id="apr-10",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="deploy_skill",
        )
        repo.save_request(req)
        loaded = repo.get_request("apr-10")
        assert loaded is not None
        assert loaded.action == "deploy_skill"
        assert loaded.status == ApprovalStatus.PENDING

    def test_update_approval_status(self, repo: SafetyRepository) -> None:
        req = ApprovalRequest(
            request_id="apr-11",
            created_at=datetime.utcnow(),
            action_risk_class=ActionRiskClass.HIGH_RISK,
            action="write_file",
        )
        repo.save_request(req)
        req.decide(ApprovalDecision.ALLOW)
        repo.save_request(req)
        loaded = repo.get_request("apr-11")
        assert loaded is not None
        assert loaded.status == ApprovalStatus.APPROVED
