"""
AgentSoul · 通用 TTL 缓存模块测试
=============================

测试 src/common/cache.py TTLCacheBase 和 CachedValue
"""
from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.common.cache import (
    TTLCacheBase,
    CachedValue,
)


class TestTTLCacheBase:
    """测试 TTLCacheBase 基类"""

    def test_construction_default_ttl(self):
        """测试默认 TTL 初始化"""
        cache = TTLCacheBase()
        assert cache._cache_ttl == 300
        assert cache._cache_timestamp is None

    def test_construction_custom_ttl(self):
        """测试自定义 TTL 初始化"""
        cache = TTLCacheBase(default_ttl=60)
        assert cache._cache_ttl == 60

    def test_construction_ttl_clamped(self):
        """测试 TTL 最小为 1"""
        cache = TTLCacheBase(default_ttl=0)
        assert cache._cache_ttl == 1

        cache = TTLCacheBase(default_ttl=-10)
        assert cache._cache_ttl == 1

    def test_cache_is_valid_none_timestamp(self):
        """测试没有时间戳时返回 False"""
        cache = TTLCacheBase()
        assert not cache._cache_is_valid()

    def test_cache_is_valid_when_fresh(self):
        """测试缓存未过期时返回 True"""
        cache = TTLCacheBase()
        cache._update_cache_timestamp()
        assert cache._cache_is_valid()

    def test_invalidate_cache(self):
        """测试使缓存失效"""
        cache = TTLCacheBase()
        cache._update_cache_timestamp()
        assert cache._cache_is_valid()

        cache.invalidate_cache()
        assert cache._cache_timestamp is None
        assert not cache._cache_is_valid()

    def test_set_cache_ttl(self):
        """测试设置新的 TTL"""
        cache = TTLCacheBase()
        cache.set_cache_ttl(120)
        assert cache._cache_ttl == 120

    def test_set_cache_ttl_clamped(self):
        """测试设置 TTL 最小为 1"""
        cache = TTLCacheBase()
        cache.set_cache_ttl(0)
        assert cache._cache_ttl == 1

        cache.set_cache_ttl(-5)
        assert cache._cache_ttl == 1

    def test_update_cache_timestamp(self):
        """测试更新缓存时间戳"""
        cache = TTLCacheBase()
        before = time.time()
        cache._update_cache_timestamp()
        after = time.time()

        assert cache._cache_timestamp is not None
        assert before <= cache._cache_timestamp <= after


class TestCachedValue:
    """测试 CachedValue 泛型包装"""

    def test_construction(self):
        """测试初始化"""
        cached = CachedValue[str](default_ttl=300)
        assert cached.get() is None

    def test_set_and_get_valid(self):
        """测试设置和获取有效值"""
        cached = CachedValue[int](default_ttl=300)
        cached.set(42)
        assert cached.get() == 42

    def test_get_returns_none_after_invalidate(self):
        """测试失效后返回 None"""
        cached = CachedValue[str](default_ttl=300)
        cached.set("test")
        assert cached.get() == "test"

        cached.invalidate_cache()
        assert cached.get() is None

    def test_expired_returns_none(self):
        """测试过期后返回 None"""
        cached = CachedValue[int](default_ttl=1)  # 1 second TTL
        cached.set(100)
        assert cached.get() == 100

        # Wait for expiration
        time.sleep(1.2)

        assert cached.get() is None

    def test_none_value_returns_none(self):
        """测试存储 None 也返回 None"""
        cached = CachedValue[None](default_ttl=300)
        cached.set(None)
        # Even if cache is valid, value is None so returns None
        assert cached.get() is None

    def test_custom_ttl_change_works(self):
        """测试修改 TTL 生效"""
        cached = CachedValue[str](default_ttl=300)
        cached.set("test")
        cached.set_cache_ttl(1)

        assert cached.get() == "test"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
