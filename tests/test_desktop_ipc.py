"""
AgentSoul · IPC Server Tests
============================

Verifies that the multi-threaded IPC socket server starts, accepts connections,
triggers callbacks on incoming events, and routes approval responses correctly.
"""
from __future__ import annotations

import json
import socket
import time
from typing import Any
import pytest
from src.desktop_pet.ipc_server import IpcServer


def test_ipc_server_lifecycle_and_messages():
    state_changes = []
    permission_requests = []

    def on_state_change(state: str) -> None:
        state_changes.append(state)

    def on_permission_request(req_id: str, title: str, msg: str) -> None:
        permission_requests.append((req_id, title, msg))

    # 1. Initialize and start server on a test port
    server = IpcServer(
        host="127.0.0.1",
        port=8089,
        on_state_change=on_state_change,
        on_permission_request=on_permission_request,
    )
    server.start()
    time.sleep(0.1)  # Allow port binding

    try:
        # 2. Connect client socket
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("127.0.0.1", 8089))
        time.sleep(0.1)

        # 3. Send state change event
        payload1 = json.dumps({"event": "state_change", "state": "thinking"}) + "\n"
        client.sendall(payload1.encode("utf-8"))
        time.sleep(0.1)

        assert "thinking" in state_changes

        # 4. Send permission request event
        req_id = "test-req-123"
        payload2 = (
            json.dumps(
                {
                    "event": "permission_request",
                    "request_id": req_id,
                    "title": "Execute Command",
                    "message": "Run pytest?",
                }
            )
            + "\n"
        )
        client.sendall(payload2.encode("utf-8"))
        time.sleep(0.1)

        assert len(permission_requests) == 1
        assert permission_requests[0] == (req_id, "Execute Command", "Run pytest?")

        # 5. Send approval response back
        server.send_response(req_id, "approve")
        time.sleep(0.1)

        # Read client response
        data = client.recv(1024).decode("utf-8")
        resp = json.loads(data.strip())
        assert resp["request_id"] == req_id
        assert resp["response"] == "approve"

        # 6. Close client
        client.close()

    finally:
        server.stop()
