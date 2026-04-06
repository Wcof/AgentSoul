"""
AgentSoul · 测试 health_visualization/cli.py
=============================

单元测试用于 health_visualization CLI 模块
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def test_module_importable():
    """测试模块可导入"""
    from src.health_visualization import cli
    assert cli is not None
    assert hasattr(cli, "main")


def test_HealthChartExporter_importable():
    """测试 HealthChartExporter 可导入"""
    from src.health_visualization.health_chart import HealthChartExporter
    exporter = HealthChartExporter()
    assert exporter is not None
    assert hasattr(exporter, "export_svg")
    assert hasattr(exporter, "export_json")
    assert hasattr(exporter, "get_summary")
