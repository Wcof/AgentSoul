"""
AgentSoul · API Gateway Proxy
=============================

A zero-dependency local HTTP proxy server that:
1. Intercepts LLM API calls from Cursor, Claude Code, etc.
2. Performs hot-switching (ccswitch) of provider/credentials/model.
3. Audits request/response token usage and costs.
4. Feeds back token consumption into pet growth stats (fatigue/XP).
"""
from __future__ import annotations

import json
import re
import sys
import threading
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# Calculate project root manually before importing
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from common import log
from src.config_loader import ConfigLoader
from src.storage.db import DatabaseManager
from src.gateway.detectors import identify_client


def estimate_tokens(text: str) -> int:
    """Heuristic token estimator for multi-lingual texts (1 token/Chinese char, 1 token/4 ASCII chars)."""
    non_ascii = sum(1 for c in text if ord(c) > 127)
    ascii_chars = len(text) - non_ascii
    return non_ascii + (ascii_chars + 3) // 4


def calculate_cost(tokens_in: int, tokens_out: int, model: str) -> float:
    """Rough cost estimation ($ per million tokens)."""
    model_lower = model.lower()
    if "claude-3-5-sonnet" in model_lower:
        # Input $3/M, Output $15/M
        return (tokens_in * 3.0 + tokens_out * 15.0) / 1_000_000.0
    elif "deepseek" in model_lower:
        # Input $0.14/M, Output $0.28/M (Cache miss)
        return (tokens_in * 0.14 + tokens_out * 0.28) / 1_000_000.0
    elif "gpt-4o" in model_lower:
        # Input $2.5/M, Output $10/M
        return (tokens_in * 2.5 + tokens_out * 10.0) / 1_000_000.0
    # Default fallback rate
    return (tokens_in * 1.0 + tokens_out * 3.0) / 1_000_000.0


import socket

def send_pet_event(event_name: str, state_val: str | None = None) -> None:
    """Send a state change or other event to the desktop pet IPC server."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect(("127.0.0.1", 8081))
            payload = {"event": event_name}
            if state_val:
                payload["state"] = state_val
            s.sendall((json.dumps(payload) + "\n").encode("utf-8"))
    except Exception:
        pass


class ProxyRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress default request logger to keep console clean
        pass

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api_get()
            return
            
        # Serve static Web UI
        if self.path in ["/", "/index.html"]:
            self.serve_static_file()
            return
            
        self.send_error(404, "Not Found")

    def serve_static_file(self) -> None:
        try:
            ui_path = project_root / "web-ui" / "index.html"
            if not ui_path.exists():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Web UI file not found")
                return
                
            content = ui_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def handle_api_get(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        try:
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            path = parsed_url.path

            if path == "/api/status":
                config_loader = ConfigLoader(project_root)
                config_loader.invalidate_cache()
                persona_config = config_loader.load_persona_config()
                
                active_char = persona_config.active_character
                characters = {}
                for char_id, char_cfg in persona_config.characters.items():
                    characters[char_id] = {
                        "name": char_cfg.name,
                        "species": char_cfg.species,
                        "stage": char_cfg.stage,
                        "level": char_cfg.level,
                        "xp": char_cfg.xp,
                        "hunger": char_cfg.hunger,
                        "energy": char_cfg.energy,
                        "intimacy": char_cfg.intimacy,
                        "active_skin": char_cfg.active_skin,
                        "unlocked_skins": char_cfg.unlocked_skins,
                        "unlocked_skills": char_cfg.unlocked_skills,
                    }
                
                resp = {
                    "active_character": active_char,
                    "character": characters.get(active_char, {}),
                    "all_characters": characters
                }
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

            elif path == "/api/skills":
                db_mgr = DatabaseManager()
                skills = db_mgr.get_all_skills()
                self.wfile.write(json.dumps(skills, ensure_ascii=False).encode("utf-8"))

            elif path == "/api/sessions":
                try:
                    from src.sessions.session_scanner import SessionScanner
                    scanner = SessionScanner()
                    scanner.scan_claude_sessions()
                except Exception as e:
                    log(f"Session scanning error in proxy: {e}", "WARN")

                db_mgr = DatabaseManager()
                provider = query_params.get("provider", [None])[0]
                sessions = db_mgr.get_cached_sessions(provider)
                self.wfile.write(json.dumps(sessions, ensure_ascii=False).encode("utf-8"))

            elif path == "/api/token_stats":
                days = int(query_params.get("days", [7])[0])
                db_mgr = DatabaseManager()
                stats = db_mgr.get_token_stats(days)
                self.wfile.write(json.dumps(stats, ensure_ascii=False).encode("utf-8"))

            else:
                self.wfile.write(json.dumps({"error": "Unknown endpoint"}, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8"))

    def handle_api_post(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            req_body = self.rfile.read(content_length)
            req_data = json.loads(req_body.decode("utf-8")) if req_body else {}
            path = self.path

            if path == "/api/interact":
                action = req_data.get("action")
                if not action:
                    self.wfile.write(json.dumps({"success": False, "error": "Missing action"}, ensure_ascii=False).encode("utf-8"))
                    return

                config_loader = ConfigLoader(project_root)
                config_loader.invalidate_cache()
                persona_config = config_loader.load_persona_config()
                char = persona_config.ai

                msg = ""

                if action == "feed":
                    char.hunger = min(100, char.hunger + 30)
                    char.intimacy = min(100, char.intimacy + 5)
                    msg = f"你喂了 {char.name} 🍖，饱食度上升！"
                    send_pet_event("state_change", "eating")
                elif action == "play":
                    if char.energy < 20:
                        msg = f"{char.name} 太累了，玩不动了，需要休息 💤"
                    else:
                        char.energy = max(0, char.energy - 20)
                        char.intimacy = min(100, char.intimacy + 15)
                        char.xp += 15
                        msg = f"你和 {char.name} 玩了会球 🎾，它很开心！"
                        send_pet_event("state_change", "success")
                elif action == "pet":
                    char.intimacy = min(100, char.intimacy + 10)
                    char.xp += 5
                    msg = f"你摸了摸 {char.name} ❤️，亲密度上升！"
                    send_pet_event("state_change", "success")
                elif action == "sleep":
                    char.energy = min(100, char.energy + 40)
                    msg = f"{char.name} 去睡觉了 💤，精力值恢复！"
                    send_pet_event("state_change", "sleeping")

                xp_needed = char.level * 100
                if char.xp >= xp_needed:
                    char.xp -= xp_needed
                    char.level += 1
                    msg += f" 🎉 升级啦！当前等级: {char.level}"

                config_loader.save_persona_config(persona_config)
                threading.Timer(3.0, lambda: send_pet_event("state_change", "idle")).start()

                resp = {
                    "success": True,
                    "message": msg,
                    "character": {
                        "name": char.name,
                        "species": char.species,
                        "stage": char.stage,
                        "level": char.level,
                        "xp": char.xp,
                        "hunger": char.hunger,
                        "energy": char.energy,
                        "intimacy": char.intimacy
                    }
                }
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

            elif path == "/api/toggle_skill":
                name = req_data.get("name")
                enabled = req_data.get("enabled", False)
                if not name:
                    self.wfile.write(json.dumps({"success": False, "error": "Missing skill name"}, ensure_ascii=False).encode("utf-8"))
                    return

                from src.skills.skills_manager import SkillsManager
                manager = SkillsManager()
                success = manager.toggle_skill(name, enabled)
                if success:
                    if enabled:
                        manager.deploy_skills_to_workspace(project_root)
                    else:
                        manager.clean_workspace_skills(project_root)
                self.wfile.write(json.dumps({"success": success}, ensure_ascii=False).encode("utf-8"))


            elif path == "/api/ccswitch":
                char_id = req_data.get("character_id")
                if not char_id:
                    self.wfile.write(json.dumps({"success": False, "error": "Missing character_id"}, ensure_ascii=False).encode("utf-8"))
                    return

                config_loader = ConfigLoader(project_root)
                config_loader.invalidate_cache()
                persona_config = config_loader.load_persona_config()

                if char_id not in persona_config.characters:
                    self.wfile.write(json.dumps({"success": False, "error": f"Character {char_id} not found"}, ensure_ascii=False).encode("utf-8"))
                    return

                persona_config.active_character = char_id
                config_loader.save_persona_config(persona_config)

                send_pet_event("state_change", "idle")

                self.wfile.write(json.dumps({
                    "success": True,
                    "active_character": char_id,
                    "name": persona_config.characters[char_id].name
                }, ensure_ascii=False).encode("utf-8"))

            elif path == "/api/launch_session":
                session_id = req_data.get("session_id")
                project_dir = req_data.get("project_dir")
                terminal = req_data.get("terminal", "Terminal")
                if not session_id or not project_dir:
                    self.wfile.write(json.dumps({"success": False, "error": "Missing session_id or project_dir"}, ensure_ascii=False).encode("utf-8"))
                    return

                from src.sessions.session_launcher import launch_session_in_terminal
                t = threading.Thread(target=launch_session_in_terminal, args=(session_id, project_dir, terminal))
                t.start()

                self.wfile.write(json.dumps({"success": True}, ensure_ascii=False).encode("utf-8"))

            else:
                self.wfile.write(json.dumps({"error": "Unknown endpoint"}, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode("utf-8"))

    def do_POST(self) -> None:
        """Handle incoming POST requests (LLM completions)."""
        if self.path.startswith("/api/"):
            self.handle_api_post()
            return

        send_pet_event("state_change", "thinking")

        content_length = int(self.headers.get("Content-Length", 0))
        req_body = self.rfile.read(content_length)


        # 1. Invalidate config cache and read active character
        config_loader = ConfigLoader(project_root)
        config_loader.invalidate_cache()
        persona_config = config_loader.load_persona_config()
        active_char_id = persona_config.active_character
        char = persona_config.ai

        # Determine target details
        target_api_url = char.api_url or "https://api.openai.com/v1"
        target_api_key = char.api_key
        target_model = char.model

        # Parse request path to decide downstream URL
        path = self.path
        if not target_api_url.endswith("/v1") and path.startswith("/v1/"):
            # Strip /v1/ if API URL doesn't have it
            dest_url = target_api_url.rstrip("/") + "/" + path[4:]
        else:
            dest_url = target_api_url.rstrip("/") + "/" + path.lstrip("/")

        # Parse request body to count input tokens and rewrite model
        is_stream = False
        try:
            req_data = json.loads(req_body.decode("utf-8"))
            is_stream = req_data.get("stream", False)
            original_model = req_data.get("model", "")
            
            # Rewrite model if configured in active pet character
            if target_model:
                req_data["model"] = target_model
                req_body = json.dumps(req_data).encode("utf-8")
            
            # Estimate input tokens
            messages_str = json.dumps(req_data.get("messages", []))
            tokens_in = estimate_tokens(messages_str)
        except Exception:
            tokens_in = estimate_tokens(req_body.decode("utf-8", errors="ignore"))
            req_data = {}

        # Identify client software
        client_name = identify_client(self.path, dict(self.headers), req_data)
        log(f"[Proxy] Identified client: {client_name}", "INFO")

        # Prepare target headers
        target_headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ["host", "content-length", "authorization"]:
                target_headers[k] = v

        if target_api_key:
            target_headers["Authorization"] = f"Bearer {target_api_key}"
        elif "Authorization" in self.headers:
            target_headers["Authorization"] = self.headers["Authorization"]

        target_headers["Content-Length"] = str(len(req_body))

        # Forward request
        log(f"[Proxy] Forwarding to {dest_url} (Stream={is_stream})", "INFO")
        start_time = urllib.request.time.time()
        
        req = urllib.request.Request(
            dest_url,
            data=req_body,
            headers=target_headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as res:
                self.send_response(res.status)
                # Copy response headers
                for k, v in res.getheaders():
                    if k.lower() not in ["transfer-encoding", "content-encoding", "connection"]:
                        self.send_header(k, v)
                self.end_headers()

                tokens_out = 0
                accumulated_text = []

                if is_stream:
                    # Stream mode
                    buffer = b""
                    while True:
                        chunk = res.read(1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()

                        # Parse stream chunk to estimate output tokens
                        buffer += chunk
                        while b"\n" in buffer:
                            line, buffer = buffer.split(b"\n", 1)
                            line_str = line.decode("utf-8", errors="ignore").strip()
                            if line_str.startswith("data:"):
                                data_content = line_str[5:].strip()
                                if data_content == "[DONE]":
                                    continue
                                try:
                                    data_json = json.loads(data_content)
                                    # OpenAI delta format
                                    choices = data_json.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            accumulated_text.append(content)
                                    # Anthropic content_block delta format
                                    elif "delta" in data_json:
                                        text = data_json["delta"].get("text", "")
                                        if text:
                                            accumulated_text.append(text)
                                except Exception:
                                    pass
                else:
                    # Block mode
                    res_body = res.read()
                    self.wfile.write(res_body)
                    try:
                        res_json = json.loads(res_body.decode("utf-8"))
                        choices = res_json.get("choices", [])
                        if choices:
                            message = choices[0].get("message", {})
                            content = message.get("content", "")
                            if content:
                                accumulated_text.append(content)
                        elif "content" in res_json:
                            # Anthropic full response
                            for content_block in res_json["content"]:
                                if content_block.get("type") == "text":
                                    accumulated_text.append(content_block.get("text", ""))
                    except Exception:
                        pass

                latency = urllib.request.time.time() - start_time
                full_output_text = "".join(accumulated_text)
                tokens_out = estimate_tokens(full_output_text)

                # Save stats to SQLite
                db_mgr = DatabaseManager()
                session_id = req_data.get("user", "default_session")
                current_model = target_model or req_data.get("model", "unknown")
                cost = calculate_cost(tokens_in, tokens_out, current_model)

                db_mgr.log_token_usage(
                    session_id=session_id,
                    character_id=active_char_id,
                    provider=target_api_url,
                    model=current_model,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    latency=latency,
                    cost=cost
                )

                # Feed stats back to update pet growth
                self._update_pet_growth(config_loader, persona_config, active_char_id, tokens_in, tokens_out)
                
                log(f"[Proxy] Success: Model={current_model}, Tokens In/Out={tokens_in}/{tokens_out}, Latency={latency:.2f}s, Cost=${cost:.6f}", "OK")
                
                send_pet_event("state_change", "success")
                threading.Timer(3.0, lambda: send_pet_event("state_change", "idle")).start()

        except urllib.error.HTTPError as e:
            # Handle standard error status propagation
            self.send_response(e.code)
            for k, v in e.headers.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(e.read())
            log(f"[Proxy] HTTPError {e.code} forwarding request: {e.reason}", "ERROR")
            
            send_pet_event("state_change", "error")
            threading.Timer(3.0, lambda: send_pet_event("state_change", "idle")).start()
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            err_msg = json.dumps({"error": {"message": f"Proxy forwarding error: {str(e)}"}}).encode("utf-8")
            self.wfile.write(err_msg)
            log(f"[Proxy] Exception forwarding request: {e}", "ERROR")
            
            send_pet_event("state_change", "error")
            threading.Timer(3.0, lambda: send_pet_event("state_change", "idle")).start()

    def _update_pet_growth(
        self,
        loader: ConfigLoader,
        config: PersonaConfig,
        char_id: str,
        tokens_in: int,
        tokens_out: int
    ) -> None:
        """Update pet stats (XP, energy, hunger) based on token consumption."""
        char = config.characters[char_id]
        
        # Calculate growth metrics
        total_tokens = tokens_in + tokens_out
        xp_gain = max(1, total_tokens // 500)  # 1 XP per 500 tokens
        energy_drain = max(1, total_tokens // 1000)  # 1 Energy drain per 1000 tokens
        hunger_drain = max(1, total_tokens // 1500)  # 1 Hunger drain per 1500 tokens

        char.xp += xp_gain
        char.energy = max(0, char.energy - energy_drain)
        char.hunger = max(0, char.hunger - hunger_drain)

        # Level up logic
        xp_needed = char.level * 100
        while char.xp >= xp_needed:
            char.xp -= xp_needed
            char.level += 1
            log(f"🎉 宠物 {char.name} 升级了！当前等级: {char.level}", "OK")
            xp_needed = char.level * 100

        # Save configuration
        loader.save_persona_config(config)


def start_proxy_server(port: int = 8000) -> ThreadingHTTPServer:
    """Start the proxy server in a background thread."""
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, ProxyRequestHandler)
    
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    log(f"Local API Proxy Gateway listening on http://127.0.0.1:{port}", "OK")
    return httpd


if __name__ == "__main__":
    # If run directly, run blockingly
    server_address = ("127.0.0.1", 8000)
    try:
        httpd = ThreadingHTTPServer(server_address, ProxyRequestHandler)
        print("Starting Proxy Server at http://127.0.0.1:8000...")
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Proxy Server...")
