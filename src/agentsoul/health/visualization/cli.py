#!/usr/bin/env python3
"""
AgentSoul 健康度可视化 CLI
命令行入口
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from .health_chart import HealthChartExporter


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AgentSoul 健康度历史图表导出工具",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--output", "-o",
        help="输出文件路径 (默认: data/health_chart.svg)",
        default=None
    )
    parser.add_argument(
        "--format", "-f",
        choices=["svg", "json"],
        default="svg",
        help="输出格式 (默认: svg)"
    )
    parser.add_argument(
        "--width", "-w",
        type=int,
        default=800,
        help="图表宽度 (默认: 800)"
    )
    parser.add_argument(
        "--height", "-H",
        type=int,
        default=400,
        help="图表高度 (默认: 400)"
    )

    args = parser.parse_args()

    exporter = HealthChartExporter()

    if args.format == "svg":
        output_path = Path(args.output) if args.output else None
        result = exporter.export_svg(output_path, args.width, args.height)
        print(f"\n✅ SVG 图表已保存到: {result}")
    else:
        output_path = Path(args.output) if args.output else None
        result = exporter.export_json(output_path)
        print(f"\n✅ JSON 数据已保存到: {result}")

    summary = exporter.get_summary()
    print("\n📊 健康度统计摘要:")
    print(f"   总迭代次数: {summary['total_iterations']}")
    print(f"   当前健康度: {summary['current_health']}")
    print(f"   平均健康度: {summary['avg_health']:.1f}")
    print(f"   最低健康度: {summary['min_health']}")
    print(f"   最高健康度: {summary['max_health']}")


if __name__ == "__main__":
    main()
