#!/usr/bin/env python3
"""
AgentSoul · 路径兼容性模块 v1.0

功能：
- 提供 /xiaonuan/ 到 /agent/ 的路径别名转换
- 支持新旧路径的自动回退逻辑
- 实现透明路径解析

用法：
    from src.path_compat import resolve_path, PathResolver

    # 基本用法
    resolved = resolve_path("/xiaonuan/data/memory_bank/day/2024-01-01.md")

    # 完整解析（带回退）
    resolver = PathResolver(project_root)
    result = resolver.resolve("memory_bank/memory_day/2024-01-01.md")
"""

from pathlib import Path
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass

from common import get_project_root


@dataclass
class PathMapping:
    old_prefix: str
    new_prefix: str
    priority: int = 0
    description: str = ""


@dataclass
class ResolveResult:
    resolved_path: Path
    source_path: str
    found: bool
    is_legacy: bool
    fallback_used: bool = False


class PathResolver:
    # Default mappings sorted by priority (higher priority first)
    DEFAULT_MAPPINGS: list[PathMapping] = sorted([
        PathMapping("/xiaonuan/", "/agent/", 100, "核心路径映射"),
        PathMapping("/home/node/.openclaw/workspace/xiaonuan/", "/agent/", 90, "OpenClaw容器路径"),
        PathMapping("xiaonuan/data/", "agent/data/", 80, "相对路径映射"),
        PathMapping("xiaonuan/config/", "agent/config/", 80, "配置路径映射"),
        PathMapping("xiaonuan/src/", "agent/src/", 80, "源码路径映射"),
    ], key=lambda m: m.priority, reverse=True)

    def __init__(
        self,
        project_root: Optional[Path] = None,
        mappings: Optional[list[PathMapping]] = None,
    ):
        self.project_root = project_root or get_project_root()
        self.mappings = mappings if mappings is not None else self.DEFAULT_MAPPINGS
        # Only sort if custom mappings provided, default is already sorted
        if mappings is not None:
            self.mappings.sort(key=lambda m: m.priority, reverse=True)
        self._cache: dict[str, ResolveResult] = {}

    def _apply_mapping(self, path: str) -> Tuple[str, PathMapping]:
        normalized = path.replace("\\", "/")

        for mapping in self.mappings:
            if normalized.startswith(mapping.old_prefix):
                new_path = mapping.new_prefix + normalized[len(mapping.old_prefix):]
                return new_path, mapping

        return path, PathMapping("", "", -1, "无映射")

    def _get_legacy_physical_path(self, legacy_path: str) -> Path:
        normalized = legacy_path.replace("\\", "/")
        for mapping in self.mappings:
            if normalized.startswith(mapping.old_prefix):
                physical_path = self.project_root / (mapping.old_prefix.lstrip("/") + normalized[len(mapping.old_prefix):])
                return physical_path
        return self.project_root / normalized.lstrip("/")

    def resolve(
        self,
        path: str,
        check_existence: bool = True
    ) -> ResolveResult:
        if path in self._cache:
            return self._cache[path]

        normalized = path.replace("\\", "/")
        new_path, mapping = self._apply_mapping(normalized)

        is_legacy_path = mapping.priority > 0 and mapping.old_prefix != mapping.new_prefix

        if check_existence:
            new_physical = self.project_root / new_path.lstrip("/")
            if new_physical.exists():
                result = ResolveResult(
                    resolved_path=new_physical,
                    source_path=new_path,
                    found=True,
                    is_legacy=False,
                    fallback_used=False
                )
                self._cache[path] = result
                return result

            if is_legacy_path:
                legacy_physical = self._get_legacy_physical_path(normalized)
                if legacy_physical.exists():
                    result = ResolveResult(
                        resolved_path=legacy_physical,
                        source_path=normalized,
                        found=True,
                        is_legacy=True,
                        fallback_used=True
                    )
                    self._cache[path] = result
                    return result

            result = ResolveResult(
                resolved_path=new_physical,
                source_path=new_path,
                found=False,
                is_legacy=is_legacy_path,
                fallback_used=False
            )
            # Don't cache negative results - file may be created later
        else:
            if Path(new_path).is_absolute():
                resolved_path = Path(new_path)
            else:
                resolved_path = self.project_root / new_path

            result = ResolveResult(
                resolved_path=resolved_path,
                source_path=new_path,
                found=True,
                is_legacy=is_legacy_path,
                fallback_used=False
            )

        # Only cache positive results (found=True)
        # Negative results (found=False) are not cached because file may be created later
        if result.found:
            self._cache[path] = result

        return result

    def resolve_many(self, paths: List[str]) -> Dict[str, ResolveResult]:
        return {p: self.resolve(p) for p in paths}

    def clear_cache(self):
        self._cache.clear()


def resolve_path(
    path: str,
    project_root: Optional[Path] = None,
    check_existence: bool = True
) -> ResolveResult:
    resolver = PathResolver(project_root)
    return resolver.resolve(path, check_existence)


def convert_legacy_path(path: str) -> str:
    resolver = PathResolver()
    result = resolver.resolve(path, check_existence=False)
    return result.source_path


def is_legacy_path(path: str) -> bool:
    resolver = PathResolver()
    result = resolver.resolve(path, check_existence=False)
    return result.is_legacy


if __name__ == "__main__":
    resolver = PathResolver()

    test_paths = [
        "/xiaonuan/data/memory_bank/memory_day/2024-01-01.md",
        "/xiaonuan/master/master_basic/profile.md",
        "/agent/data/memory_bank/memory_day/2024-01-01.md",
        "xiaonuan/config/persona.yaml",
        "memory_bank/memory_day/2024-01-01.md",
    ]

    print("路径兼容性测试")
    print("=" * 60)

    for path in test_paths:
        result = resolver.resolve(path)
        status = "✅" if result.found else "❌"
        legacy = " [LEGACY]" if result.is_legacy else ""
        fallback = " [FALLBACK]" if result.fallback_used else ""
        print(f"{status} {path}")
        print(f"   → {result.source_path}{legacy}{fallback}")
        print()
