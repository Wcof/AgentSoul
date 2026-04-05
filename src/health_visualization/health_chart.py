"""
AgentSoul · 健康度图表导出
导出 .soul_health.md 中的健康度历史为 SVG 图表
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from common import get_project_root, log


@dataclass
class HealthRecord:
    """单条健康度记录"""
    timestamp: datetime
    iteration: int
    health: int
    pass_rate: float
    mode: str
    description: str


class HealthChartExporter:
    """健康度图表导出器"""

    def __init__(self, health_file: Optional[Path] = None):
        if health_file is None:
            health_file = get_project_root() / ".soul_health.md"
        self.health_file = health_file

    def parse_history(self) -> List[HealthRecord]:
        """解析健康度历史"""
        records: List[HealthRecord] = []

        if not self.health_file.exists():
            return records

        with open(self.health_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                # 格式: [timestamp] | 迭代[N] | 健康度:[N] | 通过率:[%] | 模式:[X] | 描述
                try:
                    parts = line.split("|")
                    if len(parts) < 6:
                        continue

                    timestamp_str = parts[0].strip().strip("[]")
                    iteration = int(parts[1].split("[")[1].split("]")[0])
                    health = int(parts[2].split("[")[1].split("]")[0])
                    pass_rate_str = parts[3].split("[")[1].split("]")[0].replace("%", "")
                    pass_rate = float(pass_rate_str)
                    mode = parts[4].split("[")[1].split("]")[0]
                    description = parts[5].strip()

                    # 解析时间戳
                    try:
                        dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        dt = datetime.now()

                    records.append(HealthRecord(
                        timestamp=dt,
                        iteration=iteration,
                        health=health,
                        pass_rate=pass_rate,
                        mode=mode,
                        description=description
                    ))
                except Exception:
                    # Skip malformed lines
                    continue

        # Sort by iteration
        records.sort(key=lambda r: r.iteration)
        return records

    def export_json(self, output_path: Optional[Path] = None) -> Path:
        """导出健康度历史为 JSON"""
        if output_path is None:
            output_path = get_project_root() / "data" / "health_history.json"

        records = self.parse_history()
        data = []
        for r in records:
            data.append({
                "timestamp": r.timestamp.isoformat(),
                "iteration": r.iteration,
                "health": r.health,
                "pass_rate": r.pass_rate,
                "mode": r.mode,
                "description": r.description
            })

        output_path.parent.mkdir(parents=True, exist_ok=True)
        import json
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        log(f"健康度历史已导出 JSON: {output_path}", "OK")
        return output_path

    def export_svg(self, output_path: Optional[Path] = None, width: int = 800, height: int = 400) -> Path:
        """导出健康度历史为 SVG 折线图"""
        if output_path is None:
            output_path = get_project_root() / "data" / "health_chart.svg"

        records = self.parse_history()
        if len(records) < 2:
            log("至少需要 2 条记录才能生成图表", "WARN")
            output_path.touch()
            return output_path

        # SVG dimensions and margins
        margin = 50
        plot_width = width - 2 * margin
        plot_height = height - 2 * margin

        # Find ranges
        min_iter = min(r.iteration for r in records)
        max_iter = max(r.iteration for r in records)
        min_health = max(0, min(r.health for r in records) - 5)
        max_health = 100

        def x_coord(iteration: int) -> float:
            if max_iter == min_iter:
                return margin
            ratio = (iteration - min_iter) / (max_iter - min_iter)
            return margin + ratio * plot_width

        def y_coord(health: int) -> float:
            ratio = (health - min_health) / (max_health - min_health)
            # Y is reversed in SVG
            return height - margin - ratio * plot_height

        # Generate SVG
        svg_lines = [
            f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">',
            f'  <rect width="100%" height="100%" fill="white"/>',
            f'  <text x="{width//2}" y="20" text-anchor="middle" font-size="16" font-family="sans-serif">AgentSoul 健康度成长曲线</text>',
        ]

        # Grid lines - Y axis
        for y_val in [0, 20, 40, 60, 80, 100]:
            y = y_coord(y_val)
            svg_lines.append(f'  <line x1="{margin}" y1="{y}" x2="{width - margin}" y2="{y}" stroke="#e0e0e0" stroke-width="1"/>')
            svg_lines.append(f'  <text x="{margin - 10}" y="{y + 4}" text-anchor="end" font-size="10" font-family="sans-serif" fill="#666">{y_val}</text>')

        # Grid lines - X axis (every 5 iterations)
        if max_iter - min_iter > 10:
            step = 5
        else:
            step = 1

        for it in range(min_iter, max_iter + 1, step):
            x = x_coord(it)
            svg_lines.append(f'  <line x1="{x}" y1="{margin}" x2="{x}" y2="{height - margin}" stroke="#e0e0e0" stroke-width="1"/>')
            svg_lines.append(f'  <text x="{x}" y="{height - margin + 15}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#666">{it}</text>')

        # Create the polyline for the health curve
        points_str = " ".join(f"{x_coord(r.iteration)},{y_coord(r.health)}" for r in records)
        svg_lines.append(f'  <polyline points="{points_str}" fill="none" stroke="#2196F3" stroke-width="3" stroke-linecap="round"/>')

        # Add circles at each point with color based on health
        for r in records:
            x = x_coord(r.iteration)
            y = y_coord(r.health)
            color = "#4CAF50" if r.health >= 80 else "#FF9800" if r.health >= 60 else "#F44336"
            svg_lines.append(f'  <circle cx="{x}" cy="{y}" r="4" fill="{color}"/>')

        # Legend
        svg_lines.append(f'  <rect x="{width - 150}" y="{height - 40}" width="12" height="12" fill="#4CAF50"/>')
        svg_lines.append(f'  <text x="{width - 130}" y="{height - 30}" font-size="10" font-family="sans-serif" fill="#333"> ≥ 80 健康</text>')

        svg_lines.append('</svg>')

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(svg_lines))

        log(f"健康度图表已导出 SVG: {output_path}", "OK")
        return output_path

    def get_summary(self) -> dict:
        """获取健康度统计摘要"""
        records = self.parse_history()
        if not records:
            return {
                "total_iterations": 0,
                "current_health": 0,
                "avg_health": 0,
                "min_health": 0,
                "max_health": 0,
            }

        health_values = [r.health for r in records]
        return {
            "total_iterations": len(records),
            "current_health": health_values[-1],
            "avg_health": sum(health_values) / len(health_values),
            "min_health": min(health_values),
            "max_health": max(health_values),
        }
