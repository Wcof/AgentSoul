#!/usr/bin/env python3
"""
AgentSoul · 隐私敏感信息扫描脚本 v1.0

功能：
- 全仓扫描敏感关键词（姓名、昵称、联系方式等）
- 生成影响清单报告
- 支持自定义关键词库

用法：
    python3 scripts/scan_privacy.py                    # 扫描原项目
    python3 scripts/scan_privacy.py --output report.md  # 指定输出报告
"""

import re
import argparse
from pathlib import Path
from typing import Dict, List, Set
from dataclasses import dataclass, field
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
DEFAULT_SCAN_TARGET = Path("/Users/ldh/Downloads/project/xiaonuan")

SENSITIVE_PATTERNS = {
    "个人姓名": [
        r"李燈辉", r"李燈輝", r"LiDenghui", r"lidenghui",
        r"邓辉", r"燈辉", r"燈輝"
    ],
    "昵称/称呼": [
        r"辉辉", r"宝宝", r"小暖", r"xiaonuan", r"XiaoNuan",
        r"小暖人", r"暖宝宝"
    ],
    "联系方式": [
        r"lixiaonuan96@foxmail\.com",
        r"\d{11}",  # 手机号简单匹配（需人工确认）
    ],
    "私人信息": [
        r"体重\s*[:：]?\s*\d+[\.。]\d+\s*kg",
        r"身高\s*[:：]?\s*\d+\s*cm",
        r"体脂\s*[:：]?\s*\d+[\.。]?\d*%",
    ],
    "项目名称": [
        r"xiaonuan", r"XiaoNuan", r"李小暖",
    ],
}

HIGH_RISK_FILES = [
    "data/identity/self/李小暖.md",
    "data/identity/master/李燈辉.md",
    "data/identity/master/profile.md",
    "data/identity/self/profile.md",
    "config/persona.yaml",
    "src/master_base.md",
    "install.py",
]

FILE_EXTENSIONS = {".py", ".yaml", ".yml", ".md", ".json", ".ts", ".js", ".sh"}


@dataclass
class ScanResult:
    file_path: str
    line_number: int
    line_content: str
    pattern_name: str
    matched_text: str
    risk_level: str = "medium"


@dataclass
class FileScanResult:
    file_path: Path
    total_lines: int
    findings: List[ScanResult] = field(default_factory=list)
    is_high_risk: bool = False


class PrivacyScanner:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.compiled_patterns: Dict[str, List[re.Pattern]] = {}
        self.results: List[FileScanResult] = []
        self._compile_patterns()

    def _compile_patterns(self):
        for category, patterns in SENSITIVE_PATTERNS.items():
            self.compiled_patterns[category] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

    def _get_risk_level(self, file_path: str, pattern_name: str) -> str:
        if any(hr in file_path for hr in HIGH_RISK_FILES):
            return "high"
        if pattern_name in ["个人姓名", "私人信息"]:
            return "high"
        return "medium"

    def scan_file(self, file_path: Path) -> FileScanResult:
        result = FileScanResult(file_path=file_path, total_lines=0)

        if file_path.suffix not in FILE_EXTENSIONS:
            return result

        if any(hr in str(file_path) for hr in HIGH_RISK_FILES):
            result.is_high_risk = True

        try:
            content = file_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            return result

        lines = content.split("\n")
        result.total_lines = len(lines)

        for category, patterns in self.compiled_patterns.items():
            for line_num, line in enumerate(lines, start=1):
                for pattern in patterns:
                    match = pattern.search(line)
                    if match:
                        finding = ScanResult(
                            file_path=str(file_path.relative_to(self.project_root)),
                            line_number=line_num,
                            line_content=line.strip()[:200],
                            pattern_name=category,
                            matched_text=match.group(),
                            risk_level=self._get_risk_level(str(file_path), category),
                        )
                        result.findings.append(finding)

        return result

    def scan_project(self, target_path: Path) -> Dict:
        all_results: List[FileScanResult] = []

        for file_path in target_path.rglob("*"):
            if file_path.is_file() and ".git" not in str(file_path):
                result = self.scan_file(file_path)
                if result.findings:
                    all_results.append(result)

        all_results.sort(
            key=lambda x: (
                not x.is_high_risk,
                -len(x.findings),
                str(x.file_path),
            )
        )

        return self._generate_report(all_results)

    def _generate_report(self, results: List[FileScanResult]) -> Dict:
        high_risk_count = sum(1 for r in results if r.is_high_risk)
        total_findings = sum(len(r.findings) for r in results)

        category_stats = {}
        for result in results:
            for finding in result.findings:
                cat = finding.pattern_name
                category_stats[cat] = category_stats.get(cat, 0) + 1

        return {
            "scan_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "project_path": str(self.project_root),
            "total_files_scanned": len(results),
            "total_findings": total_findings,
            "high_risk_files": high_risk_count,
            "category_stats": category_stats,
            "detailed_results": [
                {
                    "file": str(r.file_path.relative_to(self.project_root)),
                    "is_high_risk": r.is_high_risk,
                    "total_lines": r.total_lines,
                    "findings_count": len(r.findings),
                    "findings": [
                        {
                            "line": f.line_number,
                            "category": f.pattern_name,
                            "matched": f.matched_text,
                            "risk": f.risk_level,
                            "content": f.line_content,
                        }
                        for f in r.findings
                    ],
                }
                for r in results
            ],
        }


def format_markdown_report(report: Dict) -> str:
    lines = [
        "# 隐私敏感信息扫描报告",
        "",
        f"**扫描时间**: {report['scan_time']}",
        f"**扫描路径**: {report['project_path']}",
        "",
        "---",
        "",
        "## 统计摘要",
        "",
        f"| 指标 | 数值 |",
        f"|------|------|",
        f"| 扫描文件数 | {report['total_files_scanned']} |",
        f"| 发现问题数 | {report['total_findings']} |",
        f"| 高风险文件数 | {report['high_risk_files']} |",
        "",
        "### 按类别统计",
        "",
    ]

    for cat, count in report["category_stats"].items():
        lines.append(f"- **{cat}**: {count} 处")

    lines.extend(["", "---", "", "## 详细发现", ""])

    for item in report["detailed_results"]:
        risk_marker = "🔴" if item["is_high_risk"] else "🟡"
        lines.append(
            f"{risk_marker} **{item['file']}** (高风险: {item['is_high_risk']}, "
            f"发现问题: {item['findings_count']}处)"
        )
        lines.append("")

        for finding in item["findings"]:
            risk_icon = "🔴" if finding["risk"] == "high" else "🟡"
            lines.append(
                f"  {risk_icon} L{finding['line']} [{finding['category']}] "
                f"匹配: `{finding['matched']}`"
            )

        lines.append("")

    lines.extend(
        [
            "---",
            "",
            "## 修复优先级建议",
            "",
            "### P0 - 必须修复",
            "",
            "以下文件包含真实个人信息，发布前必须脱敏：",
            "",
        ]
    )

    high_risk_files = [
        r["file"] for r in report["detailed_results"] if r["is_high_risk"]
    ]
    for f in high_risk_files:
        lines.append(f"- `{f}`")

    lines.extend(
        [
            "",
            "### P1 - 建议修复",
            "",
            "以下配置文件需要审查并改为通用配置：",
            "",
            "- `config/persona.yaml` - AI名称和主人信息",
            "- `data/identity/*/profile.md` - 身份档案模板",
            "- `install.py` - 硬编码的默认名称",
            "",
            "---",
            "",
            "## 附录：扫描规则",
            "",
            "当前扫描的敏感模式：",
            "",
        ]
    )

    for category, patterns in SENSITIVE_PATTERNS.items():
        lines.append(f"### {category}")
        for p in patterns:
            lines.append(f"- `{p}`")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="AgentSoul 隐私扫描工具")
    parser.add_argument(
        "--target", type=str, default=str(DEFAULT_SCAN_TARGET),
        help="扫描目标路径"
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="输出报告路径 (.md)"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="输出JSON格式"
    )

    args = parser.parse_args()
    target = Path(args.target)

    if not target.exists():
        print(f"错误: 路径不存在: {target}")
        return 1

    print(f"🔍 开始扫描: {target}")

    scanner = PrivacyScanner(target)
    report = scanner.scan_project(target)

    if args.json:
        import json
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        md_report = format_markdown_report(report)
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(md_report, encoding="utf-8")
            print(f"✅ 报告已生成: {output_path}")
        else:
            print(md_report)

    print(f"\n📊 扫描完成: 发现 {report['total_findings']} 处敏感信息")
    return 0


if __name__ == "__main__":
    exit(main())