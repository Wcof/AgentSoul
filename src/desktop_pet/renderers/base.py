"""
AgentSoul · Base Pet Painter
============================

Defines the abstract interface for desktop pet painters.
Encapsulates vector drawing logic for different characters/skins.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from PySide6.QtGui import QPainter


class BasePetPainter(ABC):
    """Abstract base class for rendering a desktop pet body and face."""

    @abstractmethod
    def draw_body(
        self,
        painter: QPainter,
        cx: float,
        cy: float,
        sx: float,
        sy: float,
        pet_state: str,
    ) -> None:
        """
        Draw the main body of the pet.

        Args:
            painter: QPainter instance.
            cx: Center X coordinate of the pet.
            cy: Center Y coordinate (bottom of the pet).
            sx: Horizontal scale factor (for breathing/animation).
            sy: Vertical scale factor (for breathing/animation).
            pet_state: The current state of the pet (e.g. 'idle', 'thinking', 'success', 'error').
        """

    @abstractmethod
    def draw_face(
        self,
        painter: QPainter,
        cx: float,
        eye_y: float,
        eye_spacing: float,
        pet_state: str,
        blinking: bool,
    ) -> None:
        """
        Draw the facial features of the pet.

        Args:
            painter: QPainter instance.
            cx: Center X coordinate of the face.
            eye_y: Y coordinate of the eyes.
            eye_spacing: Horizontal spacing between eyes.
            pet_state: The current state of the pet.
            blinking: True if the pet is blinking.
        """
