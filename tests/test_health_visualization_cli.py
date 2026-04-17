"""
AgentSoul · 健康度可视化 CLI 测试
=============================

测试 health_visualization/cli.py 命令行功能
"""
from __future__ import annotations

import os
import sys
from unittest.mock import patch, Mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from pathlib import Path

from agentsoul.health.visualization.cli import main


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestMainArgParsing(BaseTest):
    """测试 main 函数参数解析"""

    @patch('src.health_visualization.cli.HealthChartExporter')
    @patch('sys.argv', ['cli.py', '--output', 'output.svg', '--format', 'svg', '--width', '1000', '--height', '500'])
    def test_main_custom_args_svg(self, mock_exporter_cls):
        """测试自定义参数 SVG 格式"""
        mock_exporter = Mock()
        mock_exporter.export_svg.return_value = Path('output.svg')
        mock_exporter.get_summary.return_value = {
            'total_iterations': 65,
            'current_health': 100,
            'avg_health': 98.5,
            'min_health': 90,
            'max_health': 100,
        }
        mock_exporter_cls.return_value = mock_exporter

        # Should exit normally
        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_not_called()

        mock_exporter.export_svg.assert_called_once()
        call_args = mock_exporter.export_svg.call_args
        self.assertEqual(call_args[0][0], Path('output.svg'))
        self.assertEqual(call_args[0][1], 1000)
        self.assertEqual(call_args[0][2], 500)

    @patch('src.health_visualization.cli.HealthChartExporter')
    @patch('sys.argv', ['cli.py', '--output', 'data.json', '--format', 'json'])
    def test_main_custom_args_json(self, mock_exporter_cls):
        """测试自定义参数 JSON 格式"""
        mock_exporter = Mock()
        mock_exporter.export_json.return_value = Path('data.json')
        mock_exporter.get_summary.return_value = {
            'total_iterations': 65,
            'current_health': 100,
            'avg_health': 98.5,
            'min_health': 90,
            'max_health': 100,
        }
        mock_exporter_cls.return_value = mock_exporter

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_not_called()

        mock_exporter.export_json.assert_called_once()
        call_args = mock_exporter.export_json.call_args
        self.assertEqual(call_args[0][0], Path('data.json'))

    @patch('src.health_visualization.cli.HealthChartExporter')
    @patch('sys.argv', ['cli.py'])
    def test_main_default_args(self, mock_exporter_cls):
        """测试默认参数"""
        mock_exporter = Mock()
        mock_exporter.export_svg.return_value = Path('data/health_chart.svg')
        mock_exporter.get_summary.return_value = {
            'total_iterations': 65,
            'current_health': 100,
            'avg_health': 98.5,
            'min_health': 90,
            'max_health': 100,
        }
        mock_exporter_cls.return_value = mock_exporter

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_not_called()

        # Default format is svg with default width 800 height 400
        mock_exporter.export_svg.assert_called_once()
        call_args = mock_exporter.export_svg.call_args
        self.assertIsNone(call_args[0][0])  # default output is None
        self.assertEqual(call_args[0][1], 800)
        self.assertEqual(call_args[0][2], 400)

    @patch('src.health_visualization.cli.HealthChartExporter')
    @patch('sys.argv', ['cli.py', '-o', 'out.svg', '-f', 'svg', '-w', '1200', '-H', '600'])
    def test_main_short_options(self, mock_exporter_cls):
        """测试短选项"""
        mock_exporter = Mock()
        mock_exporter.export_svg.return_value = Path('out.svg')
        mock_exporter.get_summary.return_value = {
            'total_iterations': 65,
            'current_health': 100,
            'avg_health': 98.5,
            'min_health': 90,
            'max_health': 100,
        }
        mock_exporter_cls.return_value = mock_exporter

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_not_called()

        mock_exporter.export_svg.assert_called_once()
        call_args = mock_exporter.export_svg.call_args
        self.assertEqual(call_args[0][0], Path('out.svg'))
        self.assertEqual(call_args[0][1], 1200)
        self.assertEqual(call_args[0][2], 600)

    @patch('src.health_visualization.cli.HealthChartExporter')
    @patch('sys.argv', ['cli.py', '-f', 'json'])
    def test_main_json_format(self, mock_exporter_cls):
        """测试 JSON 格式"""
        mock_exporter = Mock()
        mock_exporter.export_json.return_value = Path('data/health_chart.json')
        mock_exporter.get_summary.return_value = {
            'total_iterations': 65,
            'current_health': 100,
            'avg_health': 98.5,
            'min_health': 90,
            'max_health': 100,
        }
        mock_exporter_cls.return_value = mock_exporter

        with patch('sys.exit') as mock_exit:
            main()
            mock_exit.assert_not_called()

        mock_exporter.export_json.assert_called_once()


class TestModuleImport(BaseTest):
    """测试模块导入"""

    def test_module_importable(self):
        """测试模块可导入"""
        from agentsoul.health.visualization import cli
        self.assertIsNotNone(cli)
        self.assertTrue(hasattr(cli, "main"))

    def test_HealthChartExporter_importable(self):
        """测试 HealthChartExporter 可导入"""
        from agentsoul.health.visualization.health_chart import HealthChartExporter
        exporter = HealthChartExporter()
        self.assertIsNotNone(exporter)
        self.assertTrue(hasattr(exporter, "export_svg"))
        self.assertTrue(hasattr(exporter, "export_json"))
        self.assertTrue(hasattr(exporter, "get_summary"))


if __name__ == "__main__":
    unittest.main()
