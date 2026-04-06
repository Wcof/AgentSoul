"""
Unit tests for health visualization module
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from src.health_visualization import HealthChartExporter


class TestHealthVisualization:
    """Tests for health chart exporter"""

    def test_parse_empty_file(self):
        """Test parsing empty file returns empty list"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.close()
            exporter = HealthChartExporter(Path(f.name))
            records = exporter.parse_history()
            assert len(records) == 0
            Path(f.name).unlink()

    def test_parse_valid_records(self):
        """Test parsing valid health records"""
        content = """[2026-04-06 10:00:00] | 迭代[10] | 健康度:[95] | 通过率:[100%] | 模式:[normal] | test description
[2026-04-06 11:00:00] | 迭代[11] | 健康度:[100] | 通过率:[100%] | 模式:[normal] | another description
"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write(content)
            f.close()
            exporter = HealthChartExporter(Path(f.name))
            records = exporter.parse_history()
            assert len(records) == 2
            assert records[0].iteration == 10
            assert records[0].health == 95
            assert records[0].pass_rate == 100.0
            assert records[0].mode == "normal"
            Path(f.name).unlink()

    def test_export_json(self):
        """Test exporting JSON"""
        content = """[2026-04-06 10:00:00] | 迭代[10] | 健康度:[95] | 通过率:[100%] | 模式:[normal] | test description
"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write(content)
            f.close()
            exporter = HealthChartExporter(Path(f.name))
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as out:
                out.close()
                result = exporter.export_json(Path(out.name))
                assert result.exists()
                assert result.stat().st_size > 0
                Path(f.name).unlink()
                Path(out.name).unlink()

    def test_export_svg(self):
        """Test exporting SVG"""
        import tempfile
        content = """[2026-04-06 10:00:00] | 迭代[1] | 健康度:[80] | 通过率:[100%] | 模式:[normal] | first
[2026-04-06 11:00:00] | 迭代[2] | 健康度:[90] | 通过率:[100%] | 模式:[normal] | second
"""
        temp_dir = tempfile.mkdtemp()
        input_path = Path(temp_dir) / "input.txt"
        output_path = Path(temp_dir) / "output.svg"
        with open(input_path, "w") as f:
            f.write(content)
        exporter = HealthChartExporter(input_path)
        result = exporter.export_svg(output_path, width=400, height=200)
        assert result.exists()
        assert result.stat().st_size > 0
        # Check it contains SVG opening tag
        with open(result) as f:
            svg_content = f.read()
            assert '<svg' in svg_content
            assert '</svg>' in svg_content
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir)

    def test_get_summary(self):
        """Test getting summary statistics"""
        content = """[2026-04-06 10:00:00] | 迭代[1] | 健康度:[80] | 通过率:[100%] | 模式:[normal] | test
[2026-04-06 11:00:00] | 迭代[2] | 健康度:[90] | 通过率:[100%] | 模式:[normal] | test
[2026-04-06 12:00:00] | 迭代[3] | 健康度:[100] | 通过率:[100%] | 模式:[normal] | test
"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write(content)
            f.close()
            exporter = HealthChartExporter(Path(f.name))
            summary = exporter.get_summary()
            assert summary['total_iterations'] == 3
            assert summary['current_health'] == 100
            assert summary['avg_health'] == 90.0
            assert summary['min_health'] == 80
            assert summary['max_health'] == 100
            Path(f.name).unlink()

    def test_cli_module_importable(self):
        """Test that CLI module can be imported"""
        # Just test import - main guarded by if __name__ == '__main__'
        from src.health_visualization import cli
        assert cli is not None
        assert hasattr(cli, 'main')
