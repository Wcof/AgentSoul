"""
AgentSoul · 通用 TTL 缓存模块
提供可复用的基于时间的缓存失效基类
"""
from __future__ import annotations

import time
from typing import Generic, TypeVar

T = TypeVar('T')


class TTLCacheBase:
    """Base class for TTL-based caching.

    Provides common cache validation, invalidation, and TTL management
    that can be inherited by any class needing timed caching.
    """

    def __init__(self, default_ttl: int = 300):
        """Initialize the TTL cache.

        Args:
            default_ttl: Default cache TTL in seconds (default: 300 = 5 minutes)
        """
        super().__init__()
        self._cache_timestamp: float | None = None
        self._cache_ttl = max(1, default_ttl)

    def _cache_is_valid(self) -> bool:
        """Check if the cached data is still valid based on TTL."""
        if self._cache_timestamp is None:
            return False
        return (time.time() - self._cache_timestamp) < self._cache_ttl

    def invalidate_cache(self) -> None:
        """Invalidate the cache - force reload on next access."""
        self._cache_timestamp = None

    def set_cache_ttl(self, ttl_seconds: int) -> None:
        """Set cache TTL in seconds."""
        self._cache_ttl = max(1, ttl_seconds)

    def _update_cache_timestamp(self) -> None:
        """Update cache timestamp after successful reload."""
        self._cache_timestamp = time.time()


class CachedValue(Generic[T], TTLCacheBase):
    """A single cached value with TTL expiration.

    Generic wrapper for any single value that needs TTL caching.
    """

    def __init__(self, default_ttl: int = 300):
        super().__init__(default_ttl)
        self._value: T | None = None

    def get(self) -> T | None:
        """Get the cached value if still valid."""
        if self._cache_is_valid() and self._value is not None:
            return self._value
        return None

    def set(self, value: T) -> None:
        """Set a new cached value and update timestamp."""
        self._value = value
        self._update_cache_timestamp()

    def invalidate_cache(self) -> None:
        """Invalidate both the cache timestamp and the stored value."""
        super().invalidate_cache()
        self._value = None
