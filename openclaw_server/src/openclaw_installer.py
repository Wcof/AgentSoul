#!/usr/bin/env python3
"""
AgentSoul · OpenClaw 安装器 v1.0

功能：
- 自动检测 OpenClaw workspace 位置
- 复制基础规则文件到 OpenClaw workspace
- 创建符合 SKILL.md 规范的目录结构
- 支持 current_session（临时）和 global_session（永久）安装
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from common import safe_file_stem, initialize_identity
from src.config_loader import ConfigLoader


# Default PAD emotional state vector - created once at module load
# Default baseline values: Pleasure=0.3, Arousal=0.2, Dominance=0.3
_DEFAULT_PAD_STATE: Dict[str, Any] = {
    "pleasure": 0.3,
    "arousal": 0.2,
    "dominance": 0.3,
    "last_updated": None,
    "history": [],
}


def _get_default_pad_state() -> Dict[str, Any]:
    """Get a copy of the default PAD emotional state.

    Returns a copy to prevent accidental mutation of the module-level constant.
    """
    return _DEFAULT_PAD_STATE.copy()


class OpenClawInstaller:
    """OpenClaw 人格注入安装器"""

    INSTALL_MARKER = "_agentsoul_installed"
    AGENT_DIR = "agent"
    RULE_FILES = [
        "SKILL.md",
        "soul_base.md",
        "memory_base.md",
        "master_base.md",
        "secure_base.md",
        "skills_base.md",
        "tasks_base.md",
    ]

    def __init__(self, agentsoul_root: Path, openclaw_workspace: Path):
        """
        初始化安装器

        Args:
            agentsoul_root: AgentSoul 项目根目录
            openclaw_workspace: OpenClaw workspace 目录
        """
        self.agentsoul_root = agentsoul_root
        self.openclaw_workspace = openclaw_workspace
        self.agent_path = openclaw_workspace / self.AGENT_DIR

    def is_installed(self) -> bool:
        """检查是否已安装"""
        marker = self.openclaw_workspace / self.INSTALL_MARKER
        return marker.exists()

    def _create_directory_structure(self, scope: str) -> None:
        """创建所需目录结构 - 遵循 OpenClaw 官方规范"""
        directories = [
            self.agent_path,
            self.agent_path / "base_rules",
            self.agent_path / "data",
            self.agent_path / "data" / "identity",
            self.agent_path / "data" / "identity" / "self",
            self.agent_path / "data" / "identity" / "master",
            self.agent_path / "data" / "identity" / "others",
            self.agent_path / "data" / "soul",
            self.agent_path / "data" / "soul" / "soul_variable",
            self.agent_path / "data" / "memory",
            self.agent_path / "data" / "memory" / "day",
            self.agent_path / "data" / "memory" / "topic",
            self.agent_path / "data" / "memory" / "topic" / "archive",
            self.agent_path / "config",
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    def _create_entry_files(self) -> None:
        """创建 OpenClaw 官方要求的入口文件 Agent.md 和 soul.md"""
        # Agent.md - 人格入口，指向完整规则
        agent_md = self.agent_path / "Agent.md"
        agent_content = """# AgentSoul - Agent 人格入口

完整规则系统位于 `base_rules/` 目录：

- `base_rules/SKILL.md` - 核心启动规则与安全策略
- `base_rules/soul_base.md` - PAD 情感计算引擎
- `base_rules/memory_base.md` - 记忆系统规则
- `base_rules/master_base.md` - 用户档案规则
- `base_rules/secure_base.md` - 安全协议
- `base_rules/skills_base.md` - 技能系统规则
- `base_rules/tasks_base.md` - 任务调度规则

## 快速启动

按照 `base_rules/SKILL.md` 中的初始化流程执行即可。
"""
        agent_md.write_text(agent_content, encoding="utf-8")

        # soul.md - 灵魂状态入口，指向存储位置
        soul_md = self.agent_path / "soul.md"
        soul_content = """# AgentSoul - Soul 状态

情感状态向量存储位于：
`data/soul/soul_variable/state_vector.json`

格式：PAD 三维情感空间模型
- pleasure (愉悦度): [-1, 1]
- arousal (唤醒度): [-1, 1]
- dominance (支配度): [-1, 1]

详见 `base_rules/soul_base.md`。
"""
        soul_md.write_text(soul_content, encoding="utf-8")

    def _copy_rule_files(self) -> list[str]:
        """复制基础规则文件
        Returns:
            缺失的文件名列表
        """
        src_dir = self.agentsoul_root / "src"
        dest_dir = self.agent_path / "base_rules"
        dest_dir.mkdir(parents=True, exist_ok=True)

        copied = []
        missing = []
        for filename in self.RULE_FILES:
            src_path = src_dir / filename
            if src_path.exists():
                dest_path = dest_dir / filename
                shutil.copy2(src_path, dest_path)
                copied.append(filename)
            else:
                missing.append(filename)

        # 创建 OpenClaw 官方要求的入口文件
        self._create_entry_files()

        return missing

    def _write_marker(self, scope: str) -> None:
        """写入安装标记"""
        marker_path = self.openclaw_workspace / self.INSTALL_MARKER
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content = f"""AgentSoul Installation Marker
Installed at: {timestamp}
Scope: {scope}
"""
        marker_path.write_text(content, encoding="utf-8")

    def _initialize_identity(self) -> None:
        """从 AgentSoul config/persona.yaml 初始化身份档案到 OpenClaw"""
        initialize_identity(
            agentsoul_root=self.agentsoul_root,
            output_root=self.agent_path,
            verbose=False
        )

    def _create_default_soul_state(self) -> None:
        """创建默认 PAD 情感状态向量"""
        state_dir = self.agent_path / "data" / "soul" / "soul_variable"
        state_path = state_dir / "state_vector.json"

        # Only write if not exists to avoid overwriting user modifications
        if not state_path.exists():
            default_state = _get_default_pad_state()
            state_path.write_text(json.dumps(default_state, indent=2, ensure_ascii=False), encoding="utf-8")

    def install(self, scope: str) -> None:
        """
        执行安装

        Args:
            scope: 安装范围 - "current_session" 或 "global_session"
        """
        print("\n🔧 开始安装 AgentSoul 到 OpenClaw...")

        # 创建目录结构
        self._create_directory_structure(scope)
        print("✅ 目录结构创建完成")

        # 复制规则文件
        missing_files = self._copy_rule_files()
        if missing_files:
            print(f"⚠️  警告: 以下规则文件缺失，已跳过: {', '.join(missing_files)}")
        else:
            print("✅ 基础规则文件复制完成")

        # 从 AgentSoul config/persona.yaml 初始化身份档案到 OpenClaw
        self._initialize_identity()
        print("✅ 身份档案初始化完成")

        # 写入安装标记
        self._write_marker(scope)
        print("✅ 安装标记写入完成")

        # 创建默认 PAD 状态文件
        self._create_default_soul_state()
        print("✅ 默认情感状态初始化完成")

        print(f"\n🎉 AgentSoul 已成功安装到 OpenClaw ({scope})！")
        print(f"   安装位置: {self.agent_path}")
        print("\n使用说明:")
        if scope == "current_session":
            print("   - 当前会话已生效，重启 OpenClaw 后需要重新安装")
        else:
            print("   - 全局安装完成，下次启动自动加载")
            print("   - 切换新 Session 后需要进行身份唤醒")
