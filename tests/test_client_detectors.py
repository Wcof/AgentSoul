"""
AgentSoul · Client Detector Tests
=================================

Verifies HTTP request client detectors (ClaudeCodeDetector, CursorDetector,
and DetectorRegistry) correctly calculate confidence scores.
"""
from __future__ import annotations

import pytest
from src.gateway.detectors import identify_client
from src.gateway.detectors.base import BaseClientDetector
from src.gateway.detectors.claude import ClaudeCodeDetector
from src.gateway.detectors.cursor import CursorDetector


def test_claude_code_detector():
    detector = ClaudeCodeDetector()

    # 1. Strong signal: anthropic-version header
    score = detector.detect(
        path="/v1/messages",
        headers={"anthropic-version": "2023-06-01", "user-agent": "some-agent"},
        payload={},
    )
    assert score >= 0.9

    # 2. Strong signal: User-Agent contains claude-code
    score_ua = detector.detect(
        path="/v1/messages",
        headers={"user-agent": "claude-code/0.1.0"},
        payload={},
    )
    assert score_ua >= 0.9

    # 3. Medium signal: messages path and claude model payload
    score_payload = detector.detect(
        path="/v1/messages",
        headers={"user-agent": "generic-client"},
        payload={"model": "claude-3-5-sonnet-20241022"},
    )
    assert score_payload >= 0.6

    # 4. No signal
    score_none = detector.detect(
        path="/v1/chat/completions",
        headers={"user-agent": "generic-client"},
        payload={"model": "gpt-4"},
    )
    assert score_none == 0.0


def test_cursor_detector():
    detector = CursorDetector()

    # 1. Strong signal: User-Agent contains cursor
    score = detector.detect(
        path="/v1/chat/completions",
        headers={"user-agent": "cursor/0.45.0"},
        payload={},
    )
    assert score >= 0.9

    # 2. Medium signal: chat completions and model GPT/Claude
    score_payload = detector.detect(
        path="/v1/chat/completions",
        headers={"user-agent": "generic-client"},
        payload={"model": "gpt-4o"},
    )
    assert score_payload >= 0.5

    # 3. No signal
    score_none = detector.detect(
        path="/v1/messages",
        headers={"user-agent": "generic-client"},
        payload={"model": "claude-3"},
    )
    assert score_none == 0.0


def test_identify_client_registry():
    # 1. Identify Claude
    name_claude = identify_client(
        path="/v1/messages",
        headers={"anthropic-version": "2023-06-01"},
        payload={},
    )
    assert name_claude == "claude_code"

    # 2. Identify Cursor
    name_cursor = identify_client(
        path="/v1/chat/completions",
        headers={"user-agent": "Cursor/0.40"},
        payload={},
    )
    assert name_cursor == "cursor"

    # 3. Unknown client
    name_unknown = identify_client(
        path="/v1/completions",
        headers={"user-agent": "curl/7.68.0"},
        payload={},
    )
    assert name_unknown == "unknown"
