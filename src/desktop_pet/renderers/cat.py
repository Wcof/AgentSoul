"""
AgentSoul · Cat Pet Painter
===========================

Renders the Cat desktop pet character using PySide6 vector graphics.
"""
from __future__ import annotations

from PySide6.QtCore import QRectF, Qt
from PySide6.QtGui import (
    QColor,
    QLinearGradient,
    QPainter,
    QPainterPath,
    QPen,
)
from .base import BasePetPainter


class CatPainter(BasePetPainter):
    """Painter implementation for the Cat character."""

    def draw_body(
        self,
        painter: QPainter,
        cx: float,
        cy: float,
        sx: float,
        sy: float,
        pet_state: str,
        blinking: bool = False,
    ) -> None:
        """Draw animated Cat vector graphics."""
        w = 95 * sx
        h = 75 * sy
        x = cx - w / 2
        y = cy - h

        # Body gradient (cute purple-lavender cat)
        grad = QLinearGradient(x, y, x + w, y + h)
        grad.setColorAt(0.0, QColor("#e8dbfc"))
        grad.setColorAt(0.7, QColor("#b197fc"))
        grad.setColorAt(1.0, QColor("#7048e8"))
        painter.setBrush(grad)
        painter.setPen(QPen(QColor("#5f3dc4"), 2))

        # Body path
        path = QPainterPath()
        path.moveTo(x + w * 0.1, y + h)
        # Left side and Left Ear
        path.lineTo(x, y + h * 0.5)
        path.lineTo(x + w * 0.15, y + h * 0.1)
        path.lineTo(x + w * 0.3, y + h * 0.35)
        # Head top and Right Ear
        path.lineTo(x + w * 0.7, y + h * 0.35)
        path.lineTo(x + w * 0.85, y + h * 0.1)
        path.lineTo(x + w, y + h * 0.5)
        # Right side and base
        path.lineTo(x + w * 0.9, y + h)
        path.lineTo(x + x + w * 0.1, y + h)
        painter.drawPath(path)

        # Blush inside ears
        painter.setBrush(QColor("#ffa8b6"))
        painter.setPen(Qt.PenStyle.NoPen)

        # Left Ear inner
        left_ear = QPainterPath()
        left_ear.moveTo(x + w * 0.05, y + h * 0.4)
        left_ear.lineTo(x + w * 0.14, y + h * 0.18)
        left_ear.lineTo(x + w * 0.22, y + h * 0.36)
        painter.drawPath(left_ear)

        # Right Ear inner
        right_ear = QPainterPath()
        right_ear.moveTo(x + w * 0.95, y + h * 0.4)
        right_ear.lineTo(x + w * 0.86, y + h * 0.18)
        right_ear.lineTo(x + w * 0.78, y + h * 0.36)
        painter.drawPath(right_ear)

        # Draw Face
        self.draw_face(painter, cx, cy - h * 0.35, w, pet_state, blinking)

    def draw_face(
        self,
        painter: QPainter,
        cx: float,
        eye_y: float,
        eye_spacing: float,
        pet_state: str,
        blinking: bool,
    ) -> None:
        """Render facial features based on current mood state."""
        # Eye configuration
        eye_offset = eye_spacing * 0.25
        left_eye_x = cx - eye_offset
        right_eye_x = cx + eye_offset

        # 1. Render Eyes
        painter.setPen(QPen(QColor("#2d3748"), 2.5))
        painter.setBrush(QColor("#2d3748"))

        if blinking:
            # Drawn as blinking lines
            painter.drawLine(int(left_eye_x - 6), int(eye_y), int(left_eye_x + 6), int(eye_y))
            painter.drawLine(int(right_eye_x - 6), int(eye_y), int(right_eye_x + 6), int(eye_y))
        elif pet_state == "success":
            # Arc eyes ^ ^
            path = QPainterPath()
            path.moveTo(left_eye_x - 6, eye_y + 2)
            path.quadTo(left_eye_x, eye_y - 4, left_eye_x + 6, eye_y + 2)
            path.moveTo(right_eye_x - 6, eye_y + 2)
            path.quadTo(right_eye_x, eye_y - 4, right_eye_x + 6, eye_y + 2)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawPath(path)
        elif pet_state == "error":
            # Cross eyes X X
            painter.drawLine(int(left_eye_x - 5), int(eye_y - 5), int(left_eye_x + 5), int(eye_y + 5))
            painter.drawLine(int(left_eye_x - 5), int(eye_y + 5), int(left_eye_x + 5), int(eye_y - 5))
            painter.drawLine(int(right_eye_x - 5), int(eye_y - 5), int(right_eye_x + 5), int(eye_y + 5))
            painter.drawLine(int(right_eye_x - 5), int(eye_y + 5), int(right_eye_x + 5), int(eye_y - 5))
        else:
            # Standard oval eyes
            painter.drawEllipse(QRectF(left_eye_x - 4, eye_y - 6, 8, 12))
            painter.drawEllipse(QRectF(right_eye_x - 4, eye_y - 6, 8, 12))

            # Eye specular spots (gleam)
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(QColor("#ffffff"))
            painter.drawEllipse(QRectF(left_eye_x - 2, eye_y - 4, 3, 3))
            painter.drawEllipse(QRectF(right_eye_x - 2, eye_y - 4, 3, 3))

        # 2. Render Blush cheeks
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QColor(255, 100, 150, 100))
        painter.drawEllipse(QRectF(left_eye_x - 14, eye_y + 6, 12, 6))
        painter.drawEllipse(QRectF(right_eye_x + 2, eye_y + 6, 12, 6))

        # 3. Render Mouth
        painter.setPen(QPen(QColor("#2d3748"), 2))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        mouth_x = cx
        mouth_y = eye_y + 8

        if pet_state == "eating":
            # Oval mouth
            painter.setBrush(QColor("#f03e3e"))
            painter.drawEllipse(QRectF(mouth_x - 4, mouth_y - 2, 8, 8))
        elif pet_state == "error":
            # Wavy mouth
            path = QPainterPath()
            path.moveTo(mouth_x - 6, mouth_y)
            path.quadTo(mouth_x - 3, mouth_y + 2, mouth_x, mouth_y)
            path.quadTo(mouth_x + 3, mouth_y - 2, mouth_x + 6, mouth_y)
            painter.drawPath(path)
        else:
            # Smile mouth
            path = QPainterPath()
            path.moveTo(mouth_x - 5, mouth_y)
            path.quadTo(mouth_x, mouth_y + 4, mouth_x + 5, mouth_y)
            painter.drawPath(path)
