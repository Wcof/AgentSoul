#!/usr/bin/env python3
"""
AgentSoul 基础使用示例
演示如何使用配置管理模块
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from agentsoul.config.config_manager.templates import TemplateManager
from agentsoul.config.config_manager.validator import ConfigValidator
from agentsoul.common import log


def example_list_templates():
    """示例：列出所有模板"""
    print("=" * 60)
    print("示例 1: 列出所有配置模板")
    print("=" * 60)

    manager = TemplateManager()
    templates = manager.list_templates()

    log(f"找到 {len(templates)} 个配置模板:", "INFO")
    print()
    for i, template in enumerate(templates, 1):
        print(f"  {i}. {template.name}")
        print(f"     {template.description}")
    print()


def example_preview_template():
    """示例：预览模板"""
    print("=" * 60)
    print("示例 2: 预览 'friendly' 模板")
    print("=" * 60)

    manager = TemplateManager()
    preview = manager.preview_template("friendly")
    print()
    print(preview)
    print()


def example_validate_config():
    """示例：验证配置"""
    print("=" * 60)
    print("示例 3: 验证当前配置")
    print("=" * 60)

    from agentsoul.config.config_loader import ConfigLoader

    loader = ConfigLoader()
    config = loader.to_legacy_format()

    validator = ConfigValidator()
    errors = validator.validate(config)

    print()
    validator.print_errors(errors)

    if validator.is_valid(config):
        log("配置验证通过！", "OK")
    else:
        log("配置存在问题", "ERROR")
    print()


def example_apply_template():
    """示例：应用模板（带提示）"""
    print("=" * 60)
    print("示例 4: 应用模板")
    print("=" * 60)
    print()
    print("注意：此示例不会实际修改配置文件")
    print("要实际应用模板，请使用命令行工具：")
    print("  python -m agentsoul.config_manager.cli apply-template professional")
    print()


def main():
    """运行所有示例"""
    print("\n" + "=" * 60)
    print("AgentSoul 基础使用示例")
    print("=" * 60 + "\n")

    try:
        example_list_templates()
        example_preview_template()
        example_validate_config()
        example_apply_template()

        print("=" * 60)
        print("所有示例运行完成！")
        print("=" * 60)
        print()
        print("更多信息请参考：")
        print("  - API 文档: docs/api-reference.md")
        print("  - 快速入门: docs/tutorials/01-getting-started.md")
        print()

    except Exception as e:
        log(f"示例运行失败: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
