"""
AgentSoul · Desktop Pet IPC Server
==================================

A multi-threaded TCP socket server running in the background.
Listens for state changes and permission approval requests from AI coding tools
and routes user approvals back to the respective client socket.
"""
from __future__ import annotations

import json
import socket
import threading
from typing import Any, Callable

from common import log


class IpcServer:
    """Multi-threaded TCP server for Desktop Pet IPC communication."""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8081,
        on_state_change: Callable[[str], None] | None = None,
        on_permission_request: Callable[[str, str, str], None] | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.on_state_change = on_state_change
        self.on_permission_request = on_permission_request

        self.server_socket: socket.socket | None = None
        self.is_running = False
        self.server_thread: threading.Thread | None = None

        # Lock to protect shared dictionary
        self._lock = threading.Lock()
        # Maps request_id -> client socket connection
        self._active_requests: dict[str, socket.socket] = {}
        # Track connections to clean up on shutdown
        self._connections: set[socket.socket] = set()

    def start(self) -> None:
        """Start the IPC socket server in a background thread."""
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(5)
            self.is_running = True
            log(f"Mascot IPC Server listening on {self.host}:{self.port}...", "OK")
        except Exception as e:
            log(f"Failed to bind Mascot IPC Server: {e}", "ERROR")
            self.is_running = False
            return

        self.server_thread = threading.Thread(target=self._accept_loop, daemon=True)
        self.server_thread.start()

    def stop(self) -> None:
        """Stop the server and close all client connections."""
        self.is_running = False
        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass

        with self._lock:
            for conn in list(self._connections):
                try:
                    conn.close()
                except Exception:
                    pass
            self._connections.clear()
            self._active_requests.clear()

    def send_response(self, request_id: str, decision: str) -> bool:
        """
        Send approval/denial response back to the client socket that initiated the request.
        """
        with self._lock:
            conn = self._active_requests.pop(request_id, None)

        if not conn:
            log(f"No active connection found for request_id: {request_id}", "WARN")
            return False

        try:
            response = {"response": decision, "request_id": request_id}
            conn.sendall((json.dumps(response) + "\n").encode("utf-8"))
            return True
        except Exception as e:
            log(f"Failed to send approval response to client: {e}", "ERROR")
            return False

    def _accept_loop(self) -> None:
        """Loop to accept incoming connections."""
        while self.is_running:
            try:
                conn, addr = self.server_socket.accept()
                with self._lock:
                    self._connections.add(conn)
                client_thread = threading.Thread(
                    target=self._handle_client,
                    args=(conn, addr),
                    daemon=True,
                )
                client_thread.start()
            except Exception:
                break

    def _handle_client(self, conn: socket.socket, addr: tuple[str, int]) -> None:
        """Thread worker to handle a single client connection."""
        buffer = ""
        try:
            while self.is_running:
                data = conn.recv(4096)
                if not data:
                    break
                buffer += data.decode("utf-8")
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    self._handle_message(conn, line.strip())
        except Exception:
            pass
        finally:
            with self._lock:
                self._connections.discard(conn)
                # Clean up any requests registered under this connection
                keys_to_remove = [k for k, v in self._active_requests.items() if v == conn]
                for k in keys_to_remove:
                    self._active_requests.pop(k, None)
            try:
                conn.close()
            except Exception:
                pass

    def _handle_message(self, conn: socket.socket, message: str) -> None:
        """Parse and route incoming messages."""
        if not message:
            return
        try:
            data = json.loads(message)
            msg_type = data.get("event")
            if msg_type == "state_change":
                state = data.get("state", "idle")
                if self.on_state_change:
                    self.on_state_change(state)
            elif msg_type == "permission_request":
                req_id = data.get("request_id")
                title = data.get("title", "Permission Request")
                msg = data.get("message", "Authorize action?")
                if req_id:
                    with self._lock:
                        self._active_requests[req_id] = conn
                    if self.on_permission_request:
                        self.on_permission_request(req_id, title, msg)
        except Exception as e:
            log(f"IPC message parsing error: {e}", "ERROR")
