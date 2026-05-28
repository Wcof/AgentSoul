"""
AgentSoul · Pet Renderers Factory
=================================

Factory for obtaining BasePetPainter instances based on species/character type.
"""
from __future__ import annotations

from .base import BasePetPainter
from .slime import SlimePainter
from .cat import CatPainter


class PainterFactory:
    """Factory to get the painter delegate for a given species name."""

    @staticmethod
    def get_painter(species: str) -> BasePetPainter:
        """
        Returns the appropriate BasePetPainter for the given species name.
        Defaults to SlimePainter if unknown.
        """
        spec = species.lower()
        if "cat" in spec:
            return CatPainter()
        return SlimePainter()


__all__ = [
    "BasePetPainter",
    "PainterFactory",
]
