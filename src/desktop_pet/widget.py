"""
AgentSoul · Desktop Pet Widget
==============================

A borderless, transparent desktop pet client using PySide6.
Includes:
- Vector-based QPainter animations (breathing, blinking, jumping, expressions)
- System tray menu & right-click actions (Feed, Play, Rest, Switch Character)
- Speech bubble dialogue and permission approval UI
- TCP Socket IPC server listening for runtime state events and approval requests from coding assistants.
"""
from __future__ import annotations

import json
import math
import os
import socket
import sys
import threading
from pathlib import Path
from typing import Any

from PySide6.QtCore import QPoint, QRectF, Qt, QTimer, Signal, Slot
from PySide6.QtGui import (
    QAction,
    QColor,
    QCursor,
    QFont,
    QGradient,
    QIcon,
    QLinearGradient,
    QPainter,
    QPainterPath,
    QPen,
    QRadialGradient,
)
from PySide6.QtWidgets import (
    QApplication,
    QHBoxLayout,
    QLabel,
    QMenu,
    QPushButton,
    QSystemTrayIcon,
    QVBoxLayout,
    QWidget,
)

# Calculate project root manually before importing
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from common import log
from src.config_loader import ConfigLoader, PersonaConfig
from src.storage.db import DatabaseManager
from src.desktop_pet.renderers import PainterFactory
from src.desktop_pet.ipc_server import IpcServer


class ApprovalWindow(QWidget):
    """Floating Desktop Card to Approve or Deny AI agent actions."""
    response_signal = Signal(str, str)  # request_id, decision

    def __init__(self, parent: QWidget, request_id: str, title: str, message: str):
        super().__init__(None)
        self.request_id = request_id
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.SubWindow
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        
        # UI Styling (Glassmorphism card)
        self.setStyleSheet("""
            QWidget#MainCard {
                background-color: rgba(30, 30, 40, 0.95);
                border: 2px solid rgba(255, 100, 150, 0.5);
                border-radius: 12px;
            }
            QLabel {
                color: #ffffff;
                font-family: "Outfit", "Inter", "Segoe UI";
            }
            QLabel#Title {
                font-size: 14px;
                font-weight: bold;
                color: #ff6496;
            }
            QLabel#Message {
                font-size: 12px;
                color: #e0e0e0;
            }
            QPushButton {
                border-radius: 6px;
                font-weight: bold;
                font-size: 11px;
                padding: 6px 12px;
            }
            QPushButton#Approve {
                background-color: #ff6496;
                color: white;
                border: none;
            }
            QPushButton#Approve:hover {
                background-color: #ff80a8;
            }
            QPushButton#Deny {
                background-color: rgba(255, 255, 255, 0.1);
                color: #e0e0e0;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            QPushButton#Deny:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }
        """)

        # Layout
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        card = QWidget(self)
        card.setObjectName("MainCard")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(15, 12, 15, 12)
        card_layout.setSpacing(10)

        title_lbl = QLabel(title, card)
        title_lbl.setObjectName("Title")
        card_layout.addWidget(title_lbl)

        msg_lbl = QLabel(message, card)
        msg_lbl.setObjectName("Message")
        msg_lbl.setWordWrap(True)
        card_layout.addWidget(msg_lbl)

        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)

        deny_btn = QPushButton("拒绝 Deny", card)
        deny_btn.setObjectName("Deny")
        deny_btn.clicked.connect(self.on_deny)
        btn_layout.addWidget(deny_btn)

        approve_btn = QPushButton("同意 Approve", card)
        approve_btn.setObjectName("Approve")
        approve_btn.clicked.connect(self.on_approve)
        btn_layout.addWidget(approve_btn)

        card_layout.addLayout(btn_layout)
        main_layout.addWidget(card)

        self.setFixedSize(260, 140)

        # Position right above the pet parent
        pos = parent.geometry().topLeft()
        self.move(pos.x() - 30, pos.y() - 150)

    def on_approve(self) -> None:
        self.response_signal.emit(self.request_id, "approve")
        self.close()

    def on_deny(self) -> None:
        self.response_signal.emit(self.request_id, "deny")
        self.close()


class SpeechBubble(QWidget):
    """Floating speech bubble dialogue widget."""
    def __init__(self, parent: QWidget, text: str):
        super().__init__(None)
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.SubWindow
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        
        self.setStyleSheet("""
            QWidget#BubbleCard {
                background-color: rgba(255, 255, 255, 0.95);
                border: 2px solid #ff6496;
                border-radius: 10px;
            }
            QLabel {
                color: #222222;
                font-family: "Inter", "Segoe UI";
                font-size: 11px;
                padding: 4px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        card = QWidget(self)
        card.setObjectName("BubbleCard")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(10, 8, 10, 8)

        self.lbl = QLabel(text, card)
        self.lbl.setWordWrap(True)
        card_layout.addWidget(self.lbl)
        
        layout.addWidget(card)
        self.setFixedWidth(160)

        # Adjust height based on text
        self.adjustSize()

        # Position above parent
        pos = parent.geometry().topLeft()
        self.move(pos.x() + 10, pos.y() - self.height() - 10)

        # Auto close timer
        self.close_timer = QTimer(self)
        self.close_timer.setSingleShot(True)
        self.close_timer.timeout.connect(self.close)
        self.close_timer.start(4000)  # show for 4 seconds


class DesktopPet(QWidget):
    # Signals for thread-safe UI updates from socket thread
    state_changed_signal = Signal(str)
    permission_requested_signal = Signal(str, str, str)  # req_id, title, msg

    def __init__(self) -> None:
        super().__init__()
        
        # Load active pet configurations
        self.config_loader = ConfigLoader(project_root)
        self.config = self.config_loader.load_persona_config()
        
        # Vector animation properties
        self.pet_state = "idle"  # idle, thinking, success, error, eating, sleeping
        self.time_phase = 0.0
        self.drag_position = QPoint()
        self.blinking = False
        self.blink_timer = 0
        
        # Init SQLite connection (for statistics)
        self.db_mgr = DatabaseManager()

        # Window styling
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.SubWindow
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(180, 180)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        # Start vector animation loop (60 FPS)
        self.anim_timer = QTimer(self)
        self.anim_timer.timeout.connect(self.update_animation)
        self.anim_timer.start(16)  # ~62 FPS

        # System Tray setup
        self._init_tray()

        # UI signals connections
        self.state_changed_signal.connect(self.set_pet_state)
        self.permission_requested_signal.connect(self.show_approval_card)

        # Start socket IPC server
        self.ipc_server = IpcServer(
            host="127.0.0.1",
            port=8081,
            on_state_change=self.state_changed_signal.emit,
            on_permission_request=self.permission_requested_signal.emit,
        )
        self.ipc_server.start()

        # Place pet at bottom-right corner of screen
        screen = QApplication.primaryScreen().geometry()
        self.move(screen.width() - 220, screen.height() - 260)
        self.show()

        # Bubble greeting
        QTimer.singleShot(1000, lambda: self.show_speech(f"你好呀，主人！我是 {self.config.ai.name}，今天一起加油吧！"))

    def _init_tray(self) -> None:
        """Initialize taskbar tray and menus."""
        self.tray_icon = QSystemTrayIcon(self)
        # Create a basic colorful circle as tray icon
        pix = QPixmap(16, 16)
        pix.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pix)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setBrush(QColor("#ff6496"))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(0, 0, 16, 16)
        painter.end()
        
        self.tray_icon.setIcon(QIcon(pix))
        self.tray_icon.setToolTip(f"AgentSoul: {self.config.ai.name}")

        # Tray Menu
        menu = QMenu(self)

        feed_act = QAction("🍖 喂食 (Feed)", self)
        feed_act.triggered.connect(self.on_feed)
        menu.addAction(feed_act)

        play_act = QAction("🎾 玩耍 (Play)", self)
        play_act.triggered.connect(self.on_play)
        menu.addAction(play_act)

        rest_act = QAction("💤 休息 (Rest)", self)
        rest_act.triggered.connect(self.on_rest)
        menu.addAction(rest_act)

        menu.addSeparator()

        # Character switcher menu
        switch_menu = QMenu("🔄 切换宠物 (Switch)", self)
        for char_id, char in self.config.characters.items():
            act = QAction(f"{char.name} ({char.species})", self)
            # Use default capture parameter to pass correct char_id to lambda
            act.triggered.connect(lambda checked=False, cid=char_id: self.on_switch_character(cid))
            switch_menu.addAction(act)
        menu.addMenu(switch_menu)

        menu.addSeparator()

        exit_act = QAction("❌ 退出 (Exit)", self)
        exit_act.triggered.connect(self.on_exit)
        menu.addAction(exit_act)

        self.tray_icon.setContextMenu(menu)
        self.tray_icon.show()

    def update_animation(self) -> None:
        """Oscillate geometry calculations to perform vector animations."""
        self.time_phase += 0.05
        if self.time_phase > 2 * math.pi:
            self.time_phase -= 2 * math.pi

        # Blinking logic (blink randomly)
        self.blink_timer += 1
        if self.blinking:
            if self.blink_timer > 6:
                self.blinking = False
                self.blink_timer = 0
        else:
            if self.blink_timer > 180 and math.sin(self.time_phase) > 0.8:
                self.blinking = True
                self.blink_timer = 0

        self.update()  # Trigger paintEvent

    def paintEvent(self, event: Any) -> None:
        """Render the vector pet based on active character species and state."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        char = self.config.ai
        species = char.species.lower()

        # Calculate coordinates inside the widget bounds
        center_x = self.width() / 2
        center_y = self.height() - 60
        
        # Breathing breathing oscillation
        breath_scale_y = 1.0 + 0.04 * math.sin(self.time_phase)
        breath_scale_x = 1.0 - 0.02 * math.sin(self.time_phase)

        # Handle animations overrides
        if self.pet_state == "thinking":
            # Rapid trembling
            breath_scale_y = 1.0 + 0.06 * math.sin(self.time_phase * 3.0)
            breath_scale_x = 1.0 - 0.04 * math.cos(self.time_phase * 3.0)
        elif self.pet_state == "success":
            # Jumping animation
            jump_offset = abs(25 * math.sin(self.time_phase * 2.0))
            center_y -= jump_offset
            breath_scale_y = 0.95 if jump_offset < 5 else 1.05
            breath_scale_x = 1.05 if jump_offset < 5 else 0.95
        elif self.pet_state == "error":
            # Trembling
            center_x += 2 * math.sin(self.time_phase * 5.0)

        # 1. Render Shadow
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(0, 0, 0, 40))
        shadow_w = 70 * breath_scale_x
        shadow_h = 10
        painter.drawEllipse(QRectF(self.width() / 2 - shadow_w / 2, self.height() - 35, shadow_w, shadow_h))

        # 2. Render Pet Body
        painter_delegate = PainterFactory.get_painter(species)
        painter_delegate.draw_body(
            painter,
            center_x,
            center_y,
            breath_scale_x,
            breath_scale_y,
            self.pet_state,
            self.blinking
        )

        # 3. Render Status Indicators (thinking icons)
        if self.pet_state == "thinking":
            # Floating light bulb
            painter.setPen(QPen(QColor("#ffd700"), 2))
            painter.setBrush(QColor("#fff7c2"))
            painter.drawEllipse(int(center_x + 35), int(center_y - 70 + 4 * math.sin(self.time_phase * 2)), 16, 16)
        elif self.pet_state == "waiting":
            # Exclamation
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor("#ff0000"))
            ex_rect = QRectF(center_x + 35, center_y - 70 + 3 * math.sin(self.time_phase * 2), 6, 16)
            painter.drawRoundedRect(ex_rect, 2, 2)
            painter.drawEllipse(QRectF(center_x + 35, center_y - 50 + 3 * math.sin(self.time_phase * 2), 6, 6))

        painter.end()

    # Drawing methods delegated to PainterFactory renderers.

    # --- Mouse interactions (dragging) ---

    def mousePressEvent(self, event: Any) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event: Any) -> None:
        if event.buttons() == Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()

    def mouseDoubleClickEvent(self, event: Any) -> None:
        """Double click to trigger a conversation bubble."""
        self.show_speech(f"嗨！我的当前饱食度是 {self.config.ai.hunger}%, 精力值是 {self.config.ai.energy}%！")

    def show_speech(self, text: str) -> None:
        """Spawn a speech bubble above the pet."""
        bubble = SpeechBubble(self, text)
        bubble.show()

    def show_approval_card(self, request_id: str, title: str, message: str) -> None:
        """Spawn a floating permission card above the pet (CodeIsland mode)."""
        self.set_pet_state("waiting")
        approval = ApprovalWindow(self, request_id, title, message)
        approval.response_signal.connect(self.on_approval_response)
        approval.show()

    def on_approval_response(self, request_id: str, decision: str) -> None:
        """Send the user's approval decision back to the MCP socket."""
        self.set_pet_state("idle")
        self.ipc_server.send_response(request_id, decision)

    # --- State and IPC Server ---

    @Slot(str)
    def set_pet_state(self, state: str) -> None:
        """Set the pet state and update graphics."""
        self.pet_state = state
        self.update()

    # --- Tray Menu Handlers ---

    def on_feed(self) -> None:
        """Feed the pet."""
        self.set_pet_state("eating")
        QTimer.singleShot(2000, lambda: self.set_pet_state("idle"))
        
        char = self.config.ai
        char.hunger = min(100, char.hunger + 30)
        char.intimacy = min(100, char.intimacy + 5)
        self.config_loader.save_persona_config(self.config)
        self.show_speech("嚼嚼嚼... 饱食度提升了！谢谢主人！❤️")

    def on_play(self) -> None:
        """Play with the pet."""
        char = self.config.ai
        if char.energy < 20:
            self.show_speech("呜呜...我好累呀，需要睡一会觉。💤")
            return
            
        self.set_pet_state("success")
        QTimer.singleShot(2500, lambda: self.set_pet_state("idle"))
        
        char.energy = max(0, char.energy - 20)
        char.intimacy = min(100, char.intimacy + 15)
        char.xp += 10
        
        # Level up check
        xp_needed = char.level * 100
        if char.xp >= xp_needed:
            char.xp -= xp_needed
            char.level += 1
            log(f"🎉 宠物 {char.name} 升级了！当前等级: {char.level}", "OK")

        self.config_loader.save_persona_config(self.config)
        self.show_speech("太好玩啦！我们真有默契！亲密度和经验上升！✨")

    def on_rest(self) -> None:
        """Let the pet rest."""
        self.set_pet_state("sleeping")
        QTimer.singleShot(4000, lambda: self.set_pet_state("idle"))
        
        char = self.config.ai
        char.energy = min(100, char.energy + 40)
        self.config_loader.save_persona_config(self.config)
        self.show_speech("呼呼... 精力值回复了！")

    def on_switch_character(self, character_id: str) -> None:
        """ccswitch handler: Swaps the active character."""
        self.config.active_character = character_id
        self.config_loader.save_persona_config(self.config)
        
        # Reload configs
        self.config_loader.invalidate_cache()
        self.config = self.config_loader.load_persona_config()
        
        # Update tray tooltips and greeting
        self.tray_icon.setToolTip(f"AgentSoul: {self.config.ai.name}")
        self.show_speech(f"嗖！角色切换成功！我是 {self.config.ai.name} ({self.config.ai.species})，请多指教！")

    def on_exit(self) -> None:
        self.ipc_active = False
        if self.client_socket:
            self.client_socket.close()
        self.tray_icon.hide()
        QApplication.quit()


def main() -> None:
    # Setup test run flags
    is_test_run = "--test-run" in sys.argv
    
    app = QApplication(sys.argv)
    pet = DesktopPet()
    
    if is_test_run:
        # Exit immediately after 2 seconds to pass CI tests
        QTimer.singleShot(2000, QApplication.quit)
        
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
