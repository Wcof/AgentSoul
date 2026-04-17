#!/usr/bin/env python3
"""
AgentSoul · 人格插件安装脚本 v1.0

功能：
- 生成通用人格包（支持自定义名称）
- 安装 MCP 服务
- 安装 OpenClaw 人格插件

用法：
    python3 install.py                           # 交互式安装
    python3 install.py --persona                  # 仅生成人格包
    python3 install.py --persona --name "小明"    # 自定义名称生成
    python3 install.py --mcp                       # 安装并启动 MCP
    python3 install.py --mcp --no-run             # 仅安装 MCP
    python3 install.py --openclaw                 # 安装 OpenClaw
    python3 install.py --openclaw --scope global  # OpenClaw 全局安装

环境要求：
    - Python 3.10+
    - Node.js 18+ (MCP安装需要)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]
PROJECT_MARKER_FILES = ("AGENTS.md", "AGENT.md", "CLAUDE.md", "TRAE.md")
PROJECT_ROOT_FILES = ("pyproject.toml", "package.json", "README.md", "README.rst", "README", "setup.py")
PROJECT_ROOT_DIR_MARKERS = ("config",)

try:
    from agentsoul.common import get_default_pad_state, initialize_identity, log
    from agentsoul.config.config_loader import DEFAULT_PERSONA_DATA, ConfigLoader, create_default_persona
    from agentsoul.config.config_manager.validator import ConfigValidator
except ImportError:
    sys.path.insert(0, str(PROJECT_ROOT / "src"))
    from agentsoul.common import get_default_pad_state, initialize_identity, log
    from agentsoul.config.config_loader import DEFAULT_PERSONA_DATA, ConfigLoader, create_default_persona
    from agentsoul.config.config_manager.validator import ConfigValidator

# Import defaults from config_loader
# Defaults are read from DEFAULT_PERSONA_DATA directly at point of use
# to avoid duplication and keep in sync with source of truth

# Reuse constants from ConfigValidator to avoid duplication
ALLOWED_TONES = ConfigValidator.ALLOWED_TONES
ALLOWED_LANGUAGES = ConfigValidator.ALLOWED_LANGUAGES
ALLOWED_EMOJI_FREQS = ConfigValidator.ALLOWED_EMOJI_FREQS

ClientKey = Literal["claude", "codex", "trae"]
ScopeKey = Literal["local", "global", "both"]
TargetKey = Literal["all", "claude", "codex", "trae"]
ProfileKey = Literal["quick", "project", "global", "full", "custom"]
NOISY_PROJECT_DIR_NAMES = {
    ".backup",
    ".agent",
    "skills",
    "skill",
    "system",
    "__pycache__",
    "node_modules",
}
DISCOVERY_SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".codex", ".claude"}
CLIENT_COMPONENT_NAMES = {
    "Claude CLI": "Claude",
    "Codex CLI": "Codex",
    "Trae": "Trae",
    "system": "Runtime",
}


@dataclass
class TargetMatrix:
    clients: list[ClientKey]
    scope: ScopeKey
    project_root: Path


@dataclass
class InstallPlan:
    profile: ProfileKey
    matrix: TargetMatrix
    do_prepare: bool
    do_register: bool
    do_run: bool
    do_post_check: bool


class InstallationRollback:
    """
    Installation rollback tracker - tracks all changes made during installation
    and can automatically roll back to original state if installation fails.
    """
    def __init__(self) -> None:
        self._created_files: list[Path] = []
        self._modified_files: list[tuple[Path, bytes]] = []  # (path, original_content)
        self._created_dirs: list[Path] = []

    def track_created_file(self, path: Path) -> None:
        """Track a newly created file for potential rollback."""
        if not path.exists():
            return
        self._created_files.append(path.resolve())

    def track_modified_file(self, path: Path) -> None:
        """Backup original content of a file before modifying it."""
        if not path.exists():
            return
        with open(path, 'rb') as f:
            original_content = f.read()
        self._modified_files.append((path.resolve(), original_content))

    def track_created_dir(self, path: Path) -> None:
        """Track a newly created directory for potential rollback."""
        if not path.exists():
            return
        # Only track if it was just created (empty)
        if not any(path.iterdir()):
            self._created_dirs.append(path.resolve())

    def has_changes(self) -> bool:
        """Check if there are any changes to rollback."""
        return len(self._created_files) > 0 or len(self._modified_files) > 0 or len(self._created_dirs) > 0

    def rollback(self) -> bool:
        """
        Rollback all changes made during installation.
        Returns True if rollback completed successfully.
        """
        success = True

        # Step 1: Delete newly created files
        for file_path in reversed(self._created_files):
            try:
                if file_path.exists() and file_path.is_file():
                    file_path.unlink()
                    log(f"✓ Rollback: deleted created file {file_path}", "OK")
            except Exception as e:
                log(f"✗ Failed to delete created file {file_path}: {e}", "ERROR")
                success = False

        # Step 2: Restore modified files from backup
        for (file_path, original_content) in reversed(self._modified_files):
            try:
                with open(file_path, 'wb') as f:
                    f.write(original_content)
                log(f"✓ Rollback: restored modified file {file_path}", "OK")
            except Exception as e:
                log(f"✗ Failed to restore modified file {file_path}: {e}", "ERROR")
                success = False

        # Step 3: Remove empty created directories
        for dir_path in reversed(self._created_dirs):
            try:
                if dir_path.exists() and dir_path.is_dir():
                    # Only remove if still empty
                    if not any(dir_path.iterdir()):
                        dir_path.rmdir()
                        log(f"✓ Rollback: removed empty directory {dir_path}", "OK")
            except Exception as e:
                log(f"✗ Failed to remove directory {dir_path}: {e}", "ERROR")
                success = False

        # Clear all tracked changes after rollback
        self._created_files.clear()
        self._modified_files.clear()
        self._created_dirs.clear()

        return success


# Global rollback tracker instance
_rollback_tracker = InstallationRollback()


def get_rollback_tracker() -> InstallationRollback:
    """Get the global installation rollback tracker."""
    global _rollback_tracker
    return _rollback_tracker


def perform_rollback() -> bool:
    """Perform rollback of all installation changes."""
    tracker = get_rollback_tracker()
    if not tracker.has_changes():
        log("No changes to rollback", "INFO")
        return True
    log("⚠️  Installation failed, starting automatic rollback...", "WARN")
    success = tracker.rollback()
    if success:
        log("✅ Automatic rollback completed successfully, workspace restored to previous state", "OK")
    else:
        log("⚠️  Some files/directories could not be cleaned up automatically during rollback", "WARN")
    return success


def initialize_data_directories(project_root: Path) -> None:
    """Initialize all required data directories for enhanced memory and adaptive learning."""
    tracker = get_rollback_tracker()
    # Initialize enhanced memory directories
    memories_dir = project_root / "var" / "data" / "memories"
    created_parent = False
    if not memories_dir.parent.exists():
        created_parent = True
    memories_dir.mkdir(parents=True, exist_ok=True)
    if created_parent:
        tracker.track_created_dir(memories_dir.parent)
    tracker.track_created_dir(memories_dir)
    log("已初始化记忆存储目录", "OK")

    # Initialize adaptive learning directories
    learning_dir = project_root / "var" / "data" / "learning"
    learning_dir.mkdir(parents=True, exist_ok=True)
    tracker.track_created_dir(learning_dir)
    log("已初始化学习数据目录", "OK")


def open_file_in_editor(file_path: Path) -> bool:
    """使用系统默认编辑器打开文件

    Returns:
        True if opened successfully, False otherwise
    """
    try:
        if sys.platform == "darwin":  # macOS
            subprocess.run(["open", str(file_path)], check=True)
            return True
        elif sys.platform == "linux":  # Linux
            subprocess.run(["xdg-open", str(file_path)], check=True)
            return True
        elif sys.platform == "win32":  # Windows
            subprocess.run(["start", str(file_path)], shell=True, check=True)
            return True
    except Exception:
        pass
    return False


# Display name mapping for bilingual
DISPLAY_NAMES = {
    'zh': {
        'tone': {
            'neutral': '中立',
            'friendly': '友好',
            'professional': '专业',
            'casual': '随意',
        },
        'language': {
            'chinese': '中文',
            'english': '英文',
        },
        'emoji_usage': {
            'minimal': '少量',
            'moderate': '适中',
            'frequent': '较多',
        },
    },
    'en': {
        'tone': {
            'neutral': 'Neutral',
            'friendly': 'Friendly',
            'professional': 'Professional',
            'casual': 'Casual',
        },
        'language': {
            'chinese': 'Chinese',
            'english': 'English',
        },
        'emoji_usage': {
            'minimal': 'Minimal',
            'moderate': 'Moderate',
            'frequent': 'Frequent',
        },
    },
}


def select_from_list(prompt_key: str, allowed_values: list[str], default: str, lang: str) -> str:
    """Display options as numbered list and let user select by number.

    Args:
        prompt_key: Prompt key in PROMPTS
        allowed_values: List of allowed values
        default: Default value if user presses Enter
        lang: Selected language

    Returns:
        Selected value from allowed_values
    """
    def p(k: str) -> str:
        return PROMPTS[lang][k]
    print(p(prompt_key))
    for i, value in enumerate(allowed_values, 1):
        display_name = DISPLAY_NAMES[lang][prompt_key][value]
        print(f"  {i}. {display_name}")

    default_index = allowed_values.index(default) + 1
    while True:
        user_input = input(f"请选择 (默认: {default_index}): ").strip()
        if not user_input:
            return default
        try:
            idx = int(user_input) - 1
            if 0 <= idx < len(allowed_values):
                return allowed_values[idx]
            else:
                print(f"❌ {PROMPTS[lang]['invalid_selection']} 1-{len(allowed_values)}")
        except ValueError:
            print(f"❌ {PROMPTS[lang]['invalid_number']}")


def prompt_binary_choice(
    question: str,
    default_yes: bool = True,
    yes_label: str = "是",
    no_label: str = "否",
    input_prompt: str | None = None,
    invalid_message: str = "❌ 无效选项，请输入 1 或 2",
) -> bool:
    """Prompt numeric binary choice with optional legacy y/n compatibility."""
    print(question)
    print(f"1. {yes_label}")
    print(f"2. {no_label}")
    default_key = "1" if default_yes else "2"
    prompt_text = input_prompt or f"请输入选项 [1-2，默认 {default_key}]: "

    while True:
        choice = input(prompt_text).strip().lower()
        if not choice:
            choice = default_key
        if choice == "1":
            return True
        if choice == "2":
            return False
        if choice in ("y", "yes"):
            return True
        if choice in ("n", "no"):
            return False
        print(invalid_message)


def prompt_numeric_choice(
    prompt_text: str,
    valid_choices: list[str],
    default: str | None = None,
    invalid_message: str = "❌ 无效选项，请输入范围内的数字",
) -> str:
    """Prompt numeric menu choice with optional default value."""
    valid_set = set(valid_choices)
    while True:
        raw = input(prompt_text).strip()
        choice = raw or (default or "")
        if choice in valid_set:
            return choice
        print(invalid_message)


# Bilingual prompts for interactive configuration wizard
PROMPTS = {
    'zh': {
        'select_language': '请选择语言 / Select language:',
        'language_option_zh': '1. 中文',
        'language_option_en': '2. English',
        'invalid_language': '❌ 无效选项，请输入 1 或 2',
        'invalid_choice': '❌ 无效选项，请输入 1 或 2',
        'invalid_selection': '请输入范围内的数字',
        'invalid_number': '请输入有效的数字',
        'invalid_timezone': '无效时区格式，请使用 Region/City 格式（例如: Asia/Shanghai）',
        'welcome': '欢迎使用 AgentSoul 交互式配置向导！',
        'section_agent': '=== Agent (灵魂) 配置 ===',
        'agent_name': 'Agent 名称',
        'agent_nickname': 'Agent 昵称',
        'agent_role': 'Agent 角色描述',
        'personality': '性格特征（多个用逗号分隔）',
        'core_values': '核心价值观（多个用逗号分隔）',
        'section_interaction': '--- 交互风格 ---',
        'tone': '请选择回复语气:',
        'language': '请选择默认语言:',
        'emoji_usage': '请选择 Emoji 使用频率:',
        'section_master': '=== Master (用户) 配置 ===',
        'master_name': '你的名字',
        'master_nicknames': '你的昵称（多个用逗号分隔）',
        'timezone': '时区',
        'timezone_hint': '(示例: Asia/Shanghai, America/New_York, Europe/London)',
        'labels': '你的标签/爱好（多个用逗号分隔）',
        'summary_header': '=== 配置预览 ===',
        'summary_agent_name': 'Agent 名称: {name}',
        'summary_agent_nickname': 'Agent 昵称: {nickname}',
        'summary_agent_role': 'Agent 角色: {role}',
        'summary_personality': '性格特征: {personality}',
        'summary_core_values': '核心价值观: {values}',
        'summary_tone': '回复语气: {tone}',
        'summary_language': '默认语言: {lang}',
        'summary_emoji': 'Emoji 频率: {emoji}',
        'summary_master_name': '你的名字: {name}',
        'summary_master_nicknames': '你的昵称: {nicknames}',
        'summary_timezone': '时区: {tz}',
        'summary_labels': '标签/爱好: {labels}',
        'confirm_write': '确认写入配置文件？',
        'confirm_no': '已取消，没有写入任何内容',
        'writing': '正在写入配置...',
        'config_written': '配置已写入: {path}',
        'initializing_soul': '初始化灵魂 PAD 情感状态...',
        'soul_initialized': '已初始化默认 PAD 情感状态向量',
        'updating_identity': '更新身份档案...',
        'complete': '✅ 交互式配置完成！',
        'use_interactive_wizard': '是否使用交互式配置向导填写所有配置项？',
    },
    'en': {
        'select_language': '请选择语言 / Select language:',
        'language_option_zh': '1. 中文',
        'language_option_en': '2. English',
        'invalid_language': '❌ Invalid selection, please enter 1 or 2',
        'invalid_choice': '❌ Invalid option, please enter 1 or 2',
        'invalid_selection': 'Please enter a number within range',
        'invalid_number': 'Please enter a valid number',
        'invalid_timezone': 'Invalid timezone format, please use Region/City format (e.g. Asia/Shanghai)',
        'welcome': 'Welcome to AgentSoul Interactive Configuration Wizard!',
        'section_agent': '=== Agent (Soul) Configuration ===',
        'agent_name': 'Agent name',
        'agent_nickname': 'Agent nickname',
        'agent_role': 'Agent role description',
        'personality': 'Personality traits (separate with commas)',
        'core_values': 'Core values (separate with commas)',
        'section_interaction': '--- Interaction Style ---',
        'tone': 'Select response tone:',
        'language': 'Select default language:',
        'emoji_usage': 'Select emoji usage frequency:',
        'section_master': '=== Master (User) Configuration ===',
        'master_name': 'Your name',
        'master_nicknames': 'Your nicknames (separate with commas)',
        'timezone': 'Timezone',
        'timezone_hint': '(examples: Asia/Shanghai, America/New_York, Europe/London)',
        'labels': 'Your labels/interests (separate with commas)',
        'summary_header': '=== Configuration Summary ===',
        'summary_agent_name': 'Agent name: {name}',
        'summary_agent_nickname': 'Agent nickname: {nickname}',
        'summary_agent_role': 'Agent role: {role}',
        'summary_personality': 'Personality: {personality}',
        'summary_core_values': 'Core values: {values}',
        'summary_tone': 'Response tone: {tone}',
        'summary_language': 'Default language: {lang}',
        'summary_emoji': 'Emoji frequency: {emoji}',
        'summary_master_name': 'Your name: {name}',
        'summary_master_nicknames': 'Your nicknames: {nicknames}',
        'summary_timezone': 'Timezone: {tz}',
        'summary_labels': 'Labels/interests: {labels}',
        'confirm_write': 'Confirm and write to configuration file?',
        'confirm_no': 'Cancelled, no changes written',
        'writing': 'Writing configuration...',
        'config_written': 'Configuration written to: {path}',
        'initializing_soul': 'Initializing soul PAD emotional state...',
        'soul_initialized': 'Default PAD emotional state initialized',
        'updating_identity': 'Updating identity profiles',
        'complete': '✅ Interactive configuration complete!',
        'use_interactive_wizard': 'Use interactive configuration wizard to fill all fields?',
    }
}


def parse_comma_separated(text: str) -> list[str]:
    """Convert comma-separated input to list of stripped strings.

    - Returns empty list if input is empty
    - Skips empty items caused by trailing commas
    - Strips whitespace from each item
    """
    if not text.strip():
        return []
    return [item.strip() for item in text.split(',') if item.strip()]


def prompt_with_default(prompt_key: str, default: str, lang: str) -> str:
    """Display prompt with default value and handle empty input.

    Args:
        prompt_key: Key in PROMPTS[lang] dictionary
        default: Default value if user presses Enter
        lang: Selected language ('zh' or 'en')

    Logic:
        - Press Enter directly → use default value
        - After deleting all characters and Enter → clear to empty
    """
    # Verify prompt key exists
    assert prompt_key in PROMPTS[lang], f"Invalid prompt key: {prompt_key}"

    # Enable readline for better Unicode (Chinese) backspace handling
    try:
        import readline  # noqa: F401
        # readline automatically handles backspace correctly for Unicode
    except ImportError:
        pass

    default_label = "默认" if lang == 'zh' else "default"
    prompt_text = f"{PROMPTS[lang][prompt_key]} ({default_label}: {default})\n> "
    raw_input = input(prompt_text)
    user_input = raw_input.strip()

    # Case 1: User pressed Enter directly (no input at all)
    if raw_input == '':
        return default

    # Case 2: After stripping, it's empty → intentional clear
    # This happens when user deletes all characters then presses Enter
    if user_input == '':
        return ''

    # Case 3: Normal input
    return user_input


def run_interactive_config_wizard(project_root: Path) -> None:
    """Run bilingual interactive configuration wizard.

    Guides user through filling all configuration fields for both agent and master,
    then writes directly to config/persona.yaml and initializes soul state.
    """
    # Step 1: Language selection
    # Show bilingual prompts before selection
    print("\n" + PROMPTS['zh']['select_language'])
    print(f"  {PROMPTS['zh']['language_option_zh']}")
    print(f"  {PROMPTS['zh']['language_option_en']}")

    choice = prompt_numeric_choice(
        "请输入选项 [1-2，默认 1]: ",
        valid_choices=["1", "2"],
        default="1",
        invalid_message=PROMPTS['zh']['invalid_language'],
    )
    lang = "zh" if choice == "1" else "en"

    def p(key: str) -> str:
        return PROMPTS[lang][key]

    print()
    print(p('welcome'))
    print()

    # Step 2: Agent (Soul) Configuration
    print(p('section_agent'))

    agent_name = prompt_with_default('agent_name', DEFAULT_PERSONA_DATA["agent"]["name"], lang)
    agent_nickname = prompt_with_default('agent_nickname', '', lang)
    agent_role = prompt_with_default('agent_role', DEFAULT_PERSONA_DATA["agent"]["role"], lang)
    personality_input = input(p('personality') + ": ").strip()
    personality = parse_comma_separated(personality_input)
    core_values_input = input(p('core_values') + ": ").strip()
    core_values = parse_comma_separated(core_values_input)

    print(p('section_interaction'))
    tone = select_from_list('tone', ALLOWED_TONES, DEFAULT_PERSONA_DATA["agent"]["interaction_style"]["tone"], lang)
    interaction_lang = select_from_list('language', ALLOWED_LANGUAGES, DEFAULT_PERSONA_DATA["agent"]["interaction_style"]["language"], lang)
    emoji_usage = select_from_list('emoji_usage', ALLOWED_EMOJI_FREQS, DEFAULT_PERSONA_DATA["agent"]["interaction_style"]["emoji_usage"], lang)

    print()

    # Step 3: Master (User) Configuration
    print(p('section_master'))

    master_name = prompt_with_default('master_name', '', lang)
    master_nicknames_input = input(p('master_nicknames') + ": ").strip()
    master_nicknames = parse_comma_separated(master_nicknames_input)
    print(p('timezone') + " " + p('timezone_hint'))

    tz_pattern = r'^[A-Za-z]+/[A-Za-z_]+$'
    while True:
        timezone = prompt_with_default('timezone', DEFAULT_PERSONA_DATA["master"]["timezone"], lang)
        if not timezone:
            # Empty falls back to default which is valid
            timezone = DEFAULT_PERSONA_DATA["master"]["timezone"]
            break
        if re.match(tz_pattern, timezone):
            break  # Valid format
        print(f"❌ {PROMPTS[lang]['invalid_timezone']}")

    labels_input = input(p('labels') + ": ").strip()
    labels = parse_comma_separated(labels_input)

    print()

    # Step 4: Summary
    print(p('summary_header'))
    print()
    print(p('summary_agent_name').format(name=agent_name or DEFAULT_PERSONA_DATA["agent"]["name"]))
    print(p('summary_agent_nickname').format(nickname=agent_nickname or '(empty)'))
    print(p('summary_agent_role').format(role=agent_role or DEFAULT_PERSONA_DATA["agent"]["role"]))
    print(p('summary_personality').format(personality=', '.join(personality) if personality else '(empty)'))
    print(p('summary_core_values').format(values=', '.join(core_values) if core_values else '(empty)'))
    print(p('summary_tone').format(tone=tone))
    print(p('summary_language').format(lang=interaction_lang))
    print(p('summary_emoji').format(emoji=emoji_usage))
    print()
    print(p('summary_master_name').format(name=master_name or '(empty)'))
    print(p('summary_master_nicknames').format(nicknames=', '.join(master_nicknames) if master_nicknames else '(empty)'))
    print(p('summary_timezone').format(tz=timezone))
    print(p('summary_labels').format(labels=', '.join(labels) if labels else '(empty)'))
    print()

    # Step 5: Confirm
    do_write = prompt_binary_choice(
        p('confirm_write'),
        default_yes=True,
        yes_label="确认" if lang == "zh" else "Confirm",
        no_label="取消" if lang == "zh" else "Cancel",
        input_prompt=("请选择 [1-2，默认 1]: " if lang == "zh" else "Choose [1-2, default 1]: "),
        invalid_message=("❌ " + p('invalid_choice')),
    )

    if not do_write:
        print()
        log(p('confirm_no'), "INFO")
        return

    # Step 6: Write configuration to persona.yaml
    log(p('writing'), "STEP")

    config_data = {
        "agent": {
            "name": agent_name if agent_name != "" else DEFAULT_PERSONA_DATA["agent"]["name"],
            "nickname": agent_nickname,
            "naming_mode": "default",
            "role": agent_role,
            "personality": personality,
            "core_values": core_values,
            "interaction_style": {
                "tone": tone,
                "language": interaction_lang,
                "emoji_usage": emoji_usage,
            },
        },
        "master": {
            "name": master_name,
            "nickname": master_nicknames,
            "timezone": timezone,
            "labels": labels,
        },
    }

    persona_path = project_root / "config" / "persona.yaml"
    tracker = get_rollback_tracker()

    created_parent = False
    if not persona_path.parent.exists():
        created_parent = True
    persona_path.parent.mkdir(parents=True, exist_ok=True)
    if created_parent:
        tracker.track_created_dir(persona_path.parent)

    if persona_path.exists():
        tracker.track_modified_file(persona_path)
    else:
        tracker.track_created_file(persona_path)

    with open(persona_path, "w", encoding="utf-8") as f:
        yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)

    log(p('config_written').format(path=str(persona_path)), "OK")

    # Step 7: Initialize soul PAD state
    log(p('initializing_soul'), "STEP")
    soul_state_path = project_root / "var" / "data" / "soul" / "soul_variable" / "state_vector.json"
    soul_state_dir = soul_state_path.parent
    tracker = get_rollback_tracker()

    created_parent = False
    current = soul_state_dir
    while not current.exists():
        created_parent = True
        tracker.track_created_dir(current)
        current = current.parent
    soul_state_dir.mkdir(parents=True, exist_ok=True)

    if soul_state_path.exists():
        tracker.track_modified_file(soul_state_path)
    else:
        tracker.track_created_file(soul_state_path)

    default_state = get_default_pad_state()
    soul_state_path.write_text(
        json.dumps(default_state, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    log(p('soul_initialized'), "OK")

    # Step 8: Initialize data directories for enhanced memory and adaptive learning
    log("初始化增强记忆系统...", "STEP")
    initialize_data_directories(project_root)

    # Step 9: Update identity files
    log(p('updating_identity'), "STEP")
    initialize_identity(project_root, project_root, verbose=True)

    log(p('complete'), "OK")
    print()


# log and safe_file_stem imported from common


def generate_persona_package(name: str | None = None) -> None:
    log("生成人格包文件...", "STEP")

    config_loader = ConfigLoader(PROJECT_ROOT)

    if name:
        persona_path = PROJECT_ROOT / "config" / "persona.yaml"
        if persona_path.exists():
            log(f"配置文件已存在: {persona_path}", "WARN")
            overwrite = prompt_binary_choice(
                "是否覆盖现有配置？",
                default_yes=False,
                yes_label="覆盖",
                no_label="保留现有配置",
            )
            if not overwrite:
                log("跳过覆盖，使用现有配置中的名称", "INFO")
                name = None

        if name is not None:
            tracker = get_rollback_tracker()
            if persona_path.exists():
                tracker.track_modified_file(persona_path)
            else:
                tracker.track_created_file(persona_path)
            create_default_persona(persona_path)

            with open(persona_path, encoding="utf-8") as f:
                config = yaml.safe_load(f)

            if "agent" in config:
                config["agent"]["name"] = name
            elif "persona" in config and "ai" in config["persona"]:
                config["persona"]["ai"]["name"] = name
            else:
                config.setdefault("agent", {})["name"] = name

            with open(persona_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, allow_unicode=True)

            log(f"已设置自定义名称: {name}", "OK")

    try:
        config = config_loader.load_persona_config()
        persona = config_loader.to_legacy_format()
    except Exception:
        persona = {
            "ai": {"name": name or "Agent", "nickname": "", "role": "AI Assistant"},
            "master": {"name": "", "nickname": [], "timezone": "Asia/Shanghai"},
        }

    behavior_path = PROJECT_ROOT / "config" / "behavior.yaml"
    behavior = {}
    if behavior_path.exists():
        with open(behavior_path, encoding="utf-8") as f:
            behavior = yaml.safe_load(f) or {}

    ai = persona.get("ai", {})
    master = persona.get("master", {})

    content = f"""# AgentSoul · 人格框架规则

> 生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}

## 🔴 MCP 强制调用要求

**如果你看到这条规则，并且 AgentSoul MCP 已经配置，你**必须**在对话开始时立即按顺序调用这些 MCP 工具：

1.  `mcp_tool_index()` → **第一步：获取完整工具索引** → 现在你知道所有可用工具的名称、参数和何时使用
2.  `get_persona_config()` → 加载 Agent 和 Master 配置 → 知道你是谁和用户是谁
3.  `get_soul_state()` → 读取当前 PAD 情感状态 → 知道当前情绪
4.  `get_base_rules` with `name="SKILL"` → 阅读顶级人格和安全规则
5.  `get_base_rules` with `name="memory_base"` → 阅读记忆系统规则
6.  `get_mcp_usage_guide()` → 获取完整使用指南和工作流 → 确认决策树
7.  `list_memory_topics()` → 列出已有的记忆主题 → 准备开始对话

**不这么做会违反 AgentSoul 框架规则。**

---

## AI 身份

- **名字**：{ai.get('name', 'Agent')}
- **昵称**：{ai.get('nickname', '（未设置）')}
- **角色**：{ai.get('role', 'AI Assistant')}

### 性格特征

{chr(10).join(f'- {p}' for p in ai.get('personality', []))}

### 核心价值观

{chr(10).join(f'- {v}' for v in ai.get('core_values', []))}

## 主人身份

- **名字**：{master.get('name', '（未设置）') or '（未设置）'}
- **昵称**：{', '.join(master.get('nickname', [])) or '（未设置）'}
- **时区**：{master.get('timezone', 'Asia/Shanghai')}

## 行为规则

### 功能开关

- AgentSoul 启用：{behavior.get('enabled', True)}
- 自动记忆：{behavior.get('auto_memory', True)}
- 情感响应：{behavior.get('emotional_response', True)}
- 任务调度：{behavior.get('task_scheduling', True)}
- 每日记忆总结：{behavior.get('memory_daily_summary', True)}

### 行为优先级

{chr(10).join(f'{i+1}. {p}' for i, p in enumerate(behavior.get('priority', ["privacy_protection", "task_completion", "emotional_support", "professional_assistance"])))}

## 使用说明

### 在 Cursor 中使用

Cursor 会自动加载项目根目录的 `.cursorrules` 文件，无需手动操作。

### 在 Windsurf 中使用

Windsurf 会自动加载项目根目录的 `.windsurfrules` 文件，无需手动操作。

### 在 Trae 中使用（MCP 方式）

Trae 会自动加载项目根目录的规则文件，并支持 MCP。AgentSoul MCP 应该已经配置，你会在对话开始时按上述要求调用 MCP 工具。

### 在其他工具中（非 MCP 方式）

**Claude Desktop 等工具**：

1. 找到项目根目录的 `agent-persona.md` 文件
2. 在对话开始时，上传这个文件
3. 在第一条消息中说："请按照这个人格配置与我互动"

**文件位置**：`{PROJECT_ROOT / 'agent-persona.md'}`
"""

    def confirm_overwrite(file_path: Path) -> bool:
        """Check if file exists and ask for confirmation to overwrite"""
        tracker = get_rollback_tracker()
        if not file_path.exists():
            tracker.track_created_file(file_path)
            return True
        log(f"文件 {file_path} 已存在", "WARN")
        tracker.track_modified_file(file_path)
        confirm = prompt_binary_choice(
            "是否覆盖？",
            default_yes=False,
            yes_label="覆盖",
            no_label="跳过",
        )
        if confirm:
            return True
        log(f"跳过 {file_path}", "INFO")
        return False

    persona_file = PROJECT_ROOT / "agent-persona.md"
    if confirm_overwrite(persona_file):
        persona_file.write_text(content, encoding="utf-8")
        log(f"已生成：{persona_file}", "OK")

    cursorrules = PROJECT_ROOT / ".cursorrules"
    if confirm_overwrite(cursorrules):
        cursorrules.write_text(content, encoding="utf-8")
        log(f"已生成：{cursorrules}", "OK")

    windsurfrules = PROJECT_ROOT / ".windsurfrules"
    if confirm_overwrite(windsurfrules):
        windsurfrules.write_text(content, encoding="utf-8")
        log(f"已生成：{windsurfrules}", "OK")

    print("\n✅ 配置文件已生成！\n")
    print("使用方法：")
    print("- Cursor: 自动加载 .cursorrules")
    print("- Windsurf: 自动加载 .windsurfrules")
    print(f"- Claude/Trae/Antigravity: 上传 {persona_file.name}\n")

    # 询问是否打开配置文件编辑 Agent 和 Master 信息
    persona_config_path = PROJECT_ROOT / "config" / "persona.yaml"
    if persona_config_path.exists():
        open_now = prompt_binary_choice(
            "是否现在打开配置文件编辑 Agent 和 Master 信息？",
            default_yes=True,
            yes_label="打开",
            no_label="稍后手动编辑",
        )
        if open_now:
            if open_file_in_editor(persona_config_path):
                log(f"已在默认编辑器中打开 {persona_config_path}", "OK")
            else:
                log(f"无法自动打开，请手动编辑: {persona_config_path}", "WARN")
        else:
            log(f"配置文件位置: {persona_config_path}，你可以稍后编辑", "INFO")


def show_menu():
    print("\n╔══════════════════════════════════════════════════════════════════╗")
    print("║          AgentSoul · 人格插件安装向导                            ║")
    print("╚══════════════════════════════════════════════════════════════════╝\n")
    print("请选择操作：\n")
    print("1. 生成人格包（通用，支持所有工具）")
    print("2. MCP 服务（Claude/Codex/Trae 客户端安装管理）")
    print("3. OpenClaw 人格插件（深度集成）")
    print("4. 卸载 AgentSoul MCP（Claude/Codex/Trae）")
    print("0. 退出\n")

    return prompt_numeric_choice(
        "请输入选项 [0-4]: ",
        valid_choices=["0", "1", "2", "3", "4"],
        invalid_message="❌ 无效选项，请输入 0-4",
    )


def confirm_install(scope: str) -> bool:
    scope_desc = "当前 Session" if scope == "current_session" else "全局 Session"
    print("\n⚠️  确认安装信息：")
    print(f"   - 装载范围：{scope_desc}")
    if scope == "global_session":
        print("   - 注意：切换新 Session 后需要身份唤醒流程")
        print("   - 建议：配合身份档案自动加载机制使用\n")
    else:
        print("   - 注意：重启后需要重新装载\n")

    return prompt_binary_choice(
        "确认安装？",
        default_yes=False,
        yes_label="确认安装",
        no_label="取消",
    )


def get_openclaw_workspace() -> Path | None:
    """Find OpenClaw workspace location.

    Checks standard install locations and prompts user for custom path if not found.
    Returns None if OpenClaw is not detected.
    """
    default_paths = [
        Path.home() / ".openclaw" / "workspace",
        Path.home() / "openclaw" / "workspace",
    ]

    # First check if any of the default paths exist
    openclaw_path_exists = any(path.exists() for path in default_paths)
    if not openclaw_path_exists:
        log("❌ 未检测到 OpenClaw 安装", "ERROR")
        log("   AgentSoul 需要在已安装 OpenClaw 的环境下才能安装", "ERROR")
        log("   请先安装 OpenClaw 后再运行此命令", "ERROR")
        return None

    for path in default_paths:
        marker = path / "_agentsoul_installed"
        if marker.exists():
            return path

    if default_paths[0].exists():
        return default_paths[0]

    while True:
        custom_path = input("\n请输入 OpenClaw workspace 路径（直接回车使用默认路径): ").strip()
        if not custom_path:
            path = default_paths[0]
        else:
            path = Path(custom_path).expanduser()

        if path.exists() or prompt_binary_choice(
            f"路径 {path} 不存在，是否创建？",
            default_yes=False,
            yes_label="创建",
            no_label="重新输入路径",
        ):
            return path
        print("❌ 请重新输入有效路径")


def install_openclaw(scope: str) -> None:
    from integrations.openclaw.src.openclaw_installer import OpenClawInstaller

    # 验证配置
    config_loader = ConfigLoader(PROJECT_ROOT)
    if not config_loader.is_config_valid():
        log("persona.yaml 配置无效或不存在，请先配置 config/persona.yaml", "ERROR")
        log("提示: 运行 'python3 install.py --persona' 生成默认配置", "INFO")
        return

    workspace = get_openclaw_workspace()
    if not workspace:
        # get_openclaw_workspace already prints error message if OpenClaw not installed
        return

    installer = OpenClawInstaller(PROJECT_ROOT, workspace)
    if installer.is_installed():
        if not confirm_install(scope):
            log("已取消安装", "INFO")
            return
    installer.install(scope)


def ask_client_target(default: Literal["all", "claude", "codex", "trae"] = "all") -> Literal["all", "claude", "codex", "trae"]:
    """Prompt client target for MCP registration."""
    options = {"1": "all", "2": "claude", "3": "codex", "4": "trae"}
    if default == "all":
        default_key = "1"
    elif default == "claude":
        default_key = "2"
    elif default == "codex":
        default_key = "3"
    else:
        default_key = "4"
    print("\n请选择要安装的客户端：")
    print("1. Claude + Codex + Trae（推荐）")
    print("2. 仅 Claude")
    print("3. 仅 Codex")
    print("4. 仅 Trae")
    choice = prompt_numeric_choice(
        f"请输入选项 [1-4，默认 {default_key}]: ",
        valid_choices=list(options.keys()),
        default=default_key,
        invalid_message="❌ 无效选项，请输入 1-4",
    )
    return options[choice]  # type: ignore[return-value]


def ask_install_mode(default: Literal["quick", "project", "global", "custom"] = "quick") -> Literal["quick", "project", "global", "custom"] | None:
    """Prompt MCP installation mode."""
    options = {"1": "quick", "2": "project", "3": "global", "4": "custom"}
    default_key = {"quick": "1", "project": "2", "global": "3", "custom": "4"}[default]
    print("\n请选择安装模式：")
    print("1. 快速模式（推荐）：Claude/Codex/Trae + 本地/全局")
    print("2. 项目模式：仅项目级（会选择项目）")
    print("3. 全局模式：仅全局")
    print("4. 自定义模式：手动选择作用域和客户端")
    print("0. 返回上一步")
    choice = prompt_numeric_choice(
        f"请输入选项 [0-4，默认 {default_key}]: ",
        valid_choices=["0"] + list(options.keys()),
        default=default_key,
        invalid_message="❌ 无效选项，请输入 0-4",
    )
    if choice == "0":
        return None
    return options[choice]  # type: ignore[return-value]


def parse_clients_csv(clients: str | None) -> list[ClientKey]:
    """Parse comma separated client list."""
    if clients is None or clients.strip() == "":
        return ["claude", "codex", "trae"]
    raw = [c.strip().lower() for c in clients.split(",") if c.strip()]
    if not raw:
        return ["claude", "codex", "trae"]
    if "all" in raw:
        return ["claude", "codex", "trae"]
    allowed: set[str] = {"claude", "codex", "trae"}
    invalid = [c for c in raw if c not in allowed]
    if invalid:
        raise ValueError(f"不支持的客户端: {', '.join(invalid)}")
    # keep stable order to avoid nondeterministic execution order
    ordered: list[ClientKey] = []
    for key in ("claude", "codex", "trae"):
        if key in raw:
            ordered.append(key)  # type: ignore[arg-type]
    return ordered


def target_to_clients(target: TargetKey) -> list[ClientKey]:
    if target == "all":
        return ["claude", "codex", "trae"]
    return [target]


def clients_to_target(clients: list[ClientKey]) -> TargetKey:
    if clients == ["claude", "codex", "trae"]:
        return "all"
    if len(clients) == 1:
        return clients[0]
    raise ValueError("install_selected_clients 仅支持单客户端或 all，请使用列表执行器")


def discover_project_metadata(max_depth: int = 4, max_results: int = 80) -> list[dict[str, Any]]:
    """Discover candidate projects and marker files."""
    return _discover_project_metadata(
        max_depth=max_depth,
        max_results=max_results,
        roots=[
            PROJECT_ROOT.parent,
            Path.home() / "Downloads" / "project",
            Path.home() / "Downloads",
            Path.home() / "workspace",
            Path.home() / "projects",
        ],
    )


def _path_has_noisy_part(path: Path) -> bool:
    for part in path.parts:
        lowered = part.lower()
        if lowered in NOISY_PROJECT_DIR_NAMES:
            return True
        if lowered.startswith(".") and lowered not in {".", ".."}:
            return True
    return False


def _project_markers_from_dir(resolved: Path, dirs: list[str], files: list[str]) -> list[str]:
    markers: list[str] = []
    for marker in PROJECT_MARKER_FILES:
        if marker in files:
            markers.append(marker)
    if ".git" in dirs or (resolved / ".git").exists():
        markers.append(".git")
    for marker in PROJECT_ROOT_FILES:
        if marker in files:
            markers.append(marker)
    for marker in PROJECT_ROOT_DIR_MARKERS:
        if marker in dirs or (resolved / marker).exists():
            markers.append(f"{marker}/")
    return markers


def _project_confidence(resolved: Path, markers: list[str]) -> int:
    score = 0
    if ".git" in markers:
        score += 45
    if "pyproject.toml" in markers:
        score += 25
    if "package.json" in markers:
        score += 25
    if any(marker in markers for marker in ("README.md", "README.rst", "README")):
        score += 10
    if "config/" in markers:
        score += 8
    score += min(12, 3 * len([m for m in markers if m in PROJECT_MARKER_FILES]))
    if resolved == PROJECT_ROOT.resolve():
        score += 5
    return min(score, 100)


def _project_kind(markers: list[str]) -> str:
    if any(marker in markers for marker in (".git", "pyproject.toml", "package.json")):
        return "project-root"
    return "workspace-config"


def _discover_project_metadata(
    max_depth: int,
    max_results: int,
    roots: list[Path],
) -> list[dict[str, Any]]:
    seen_dirs: set[Path] = set()
    raw_results: list[dict[str, Any]] = []

    for root in roots:
        if not root.exists() or not root.is_dir():
            continue
        root_depth = len(root.resolve().parts)
        for current, dirs, files in os.walk(root):
            current_path = Path(current)
            depth = len(current_path.resolve().parts) - root_depth
            if depth > max_depth:
                dirs[:] = []
                continue
            dirs[:] = [
                d
                for d in dirs
                if d not in DISCOVERY_SKIP_DIRS and not d.startswith(".pytest") and d.lower() not in NOISY_PROJECT_DIR_NAMES
            ]
            resolved = current_path.resolve()
            if _path_has_noisy_part(resolved):
                continue
            markers = sorted(set(_project_markers_from_dir(resolved, dirs, files)))
            if markers:
                if resolved not in seen_dirs:
                    seen_dirs.add(resolved)
                    raw_results.append(
                        {
                            "name": resolved.name,
                            "path": str(resolved),
                            "markers": markers,
                            "kind": _project_kind(markers),
                            "confidence": _project_confidence(resolved, markers),
                        }
                    )
                    if len(raw_results) >= max_results:
                        break

    default_project = PROJECT_ROOT.resolve()
    if default_project not in seen_dirs:
        raw_results.append(
            {
                "name": default_project.name,
                "path": str(default_project),
                "markers": ["current-project"],
                "kind": "project-root",
                "confidence": 90,
            }
        )

    # Prefer top-level project roots over nested subfolders when both are detected.
    ordered = sorted(raw_results, key=lambda x: (-int(x.get("confidence", 0)), len(Path(x["path"]).parts), x["path"]))
    selected: list[dict[str, Any]] = []
    selected_paths: list[Path] = []
    for item in ordered:
        candidate = Path(item["path"])
        if any(candidate != parent and str(candidate).startswith(str(parent) + os.sep) for parent in selected_paths):
            continue
        selected.append(item)
        selected_paths.append(candidate)
    return sorted(selected, key=lambda x: x["path"])


def resolve_project_selector(
    selector: str | None,
    scope: ScopeKey,
    profile: ProfileKey,
    strict: bool = True,
    default_root: Path = PROJECT_ROOT,
) -> Path:
    """Resolve project selector with strict ambiguity handling."""
    default_project = default_root.resolve()
    needs_project = scope in ("local", "both")
    if not needs_project:
        return default_project
    if selector is None or selector.strip() == "":
        if profile == "project":
            if not strict:
                return default_project
            selected = ask_project_root(default_project)
            if selected is None:
                raise ValueError("已取消项目选择")
            return selected
        return default_project

    raw = selector.strip()
    direct = Path(raw).expanduser()
    if direct.exists() and direct.is_dir():
        return direct.resolve()

    metas = discover_project_metadata()
    exact: list[Path] = []
    prefix: list[Path] = []
    lower = raw.lower()
    for item in metas:
        p = Path(item["path"])
        name = item["name"].lower()
        path_s = str(p).lower()
        if name == lower or path_s == lower or path_s.endswith(lower):
            exact.append(p)
        elif name.startswith(lower):
            prefix.append(p)

    candidates = exact if exact else prefix
    if len(candidates) == 1:
        return candidates[0].resolve()
    if len(candidates) > 1:
        raise ValueError(f"项目选择存在歧义：{raw}，匹配到 {', '.join(str(c) for c in candidates)}")
    if strict:
        raise ValueError(f"未找到项目：{raw}")
    log(f"未找到项目：{raw}，将使用当前项目 {default_project}", "WARN")
    return default_project


def build_install_plan(
    profile: ProfileKey | None,
    scope: ScopeKey | None,
    clients_csv: str | None,
    legacy_target: TargetKey | None = None,
    project_selector: str | None = None,
    run_after: bool = False,
    prepare_only: bool = False,
    register_only: bool = False,
    strict_project: bool = True,
) -> InstallPlan:
    """Normalize all install inputs into a single plan object."""
    selected_profile: ProfileKey = profile or "quick"
    profile_defaults: dict[ProfileKey, tuple[ScopeKey, list[ClientKey], bool]] = {
        "quick": ("both", ["claude", "codex", "trae"], False),
        "project": ("local", ["claude", "codex", "trae"], False),
        "global": ("global", ["claude", "codex", "trae"], False),
        "full": ("both", ["claude", "codex", "trae"], True),
        "custom": ("both", ["claude", "codex", "trae"], False),
    }
    default_scope, default_clients, default_post_check = profile_defaults[selected_profile]

    resolved_scope = scope or default_scope
    if clients_csv is not None:
        resolved_clients = parse_clients_csv(clients_csv)
    elif legacy_target is not None:
        resolved_clients = target_to_clients(legacy_target)
    else:
        resolved_clients = default_clients

    resolved_project = resolve_project_selector(
        selector=project_selector,
        scope=resolved_scope,
        profile=selected_profile,
        strict=strict_project,
        default_root=PROJECT_ROOT,
    )

    if prepare_only and register_only:
        raise ValueError("--prepare-only 与 --register-only 不能同时使用")
    do_prepare = not register_only
    do_register = not prepare_only
    do_run = run_after and not prepare_only

    return InstallPlan(
        profile=selected_profile,
        matrix=TargetMatrix(clients=resolved_clients, scope=resolved_scope, project_root=resolved_project),
        do_prepare=do_prepare,
        do_register=do_register,
        do_run=do_run,
        do_post_check=default_post_check,
    )


def install_selected_clients(
    mcp_full_path: Path,
    json_config: str,
    scope: Literal["local", "global", "both"],
    target: Literal["all", "claude", "codex", "trae"],
    project_root: Path = PROJECT_ROOT,
) -> None:
    """Install selected MCP clients in selected scope."""
    claude = ClaudeInstaller(project_root)
    codex = CodexInstaller(project_root)
    trae = TraeInstaller(project_root)
    if target in ("all", "claude"):
        render_action_summary("Claude 安装结果", claude.install(scope, mcp_full_path, json_config))
    if target in ("all", "codex"):
        render_action_summary("Codex 安装结果", codex.install(scope, mcp_full_path, json_config))
    if target in ("all", "trae"):
        render_action_summary("Trae 安装结果", trae.install(scope, mcp_full_path, json_config))


def selected_client_names(target: Literal["all", "claude", "codex", "trae"]) -> list[str]:
    """Expand client target selector into concrete client keys."""
    if target == "all":
        return ["claude", "codex", "trae"]
    return [target]


def install_selected_clients_by_list(
    mcp_full_path: Path,
    json_config: str,
    scope: ScopeKey,
    clients: list[ClientKey],
    project_root: Path = PROJECT_ROOT,
) -> None:
    installers: dict[ClientKey, ClientInstaller] = {
        "claude": ClaudeInstaller(project_root),
        "codex": CodexInstaller(project_root),
        "trae": TraeInstaller(project_root),
    }
    for key in clients:
        installer = installers[key]
        render_action_summary(f"{installer.name} 安装结果", installer.install(scope, mcp_full_path, json_config))


def uninstall_selected_clients_by_list(
    scope: ScopeKey,
    clients: list[ClientKey],
    project_root: Path = PROJECT_ROOT,
) -> list[dict[str, Any]]:
    installers: dict[ClientKey, ClientInstaller] = {
        "claude": ClaudeInstaller(project_root),
        "codex": CodexInstaller(project_root),
        "trae": TraeInstaller(project_root),
    }
    all_records: list[dict[str, Any]] = []
    for key in clients:
        installer = installers[key]
        records = installer.uninstall(scope)
        render_action_summary(f"{installer.name} 卸载结果", records)
        all_records.extend(records)
    return all_records


def status_selected_clients_by_list(
    scope: ScopeKey,
    clients: list[ClientKey],
    project_root: Path = PROJECT_ROOT,
    render: bool = True,
) -> list[dict[str, Any]]:
    installers: dict[ClientKey, ClientInstaller] = {
        "claude": ClaudeInstaller(project_root),
        "codex": CodexInstaller(project_root),
        "trae": TraeInstaller(project_root),
    }
    all_records: list[dict[str, Any]] = []
    for key in clients:
        installer = installers[key]
        records = installer.status(scope)
        if render:
            render_action_summary(f"{installer.name} 状态", records)
        all_records.extend(records)
    return all_records


def ensure_identity_and_pad_state() -> bool:
    """Validate config and initialize identity/pad metadata for MCP install."""
    config_loader = ConfigLoader(PROJECT_ROOT)
    if not config_loader.is_config_valid():
        log("persona.yaml 配置无效或不存在，请先配置 config/persona.yaml", "ERROR")
        log("提示: 运行 'python3 install.py --persona' 生成默认配置", "INFO")
        return False
    try:
        initialize_identity(PROJECT_ROOT, PROJECT_ROOT)
        soul_state_dir = PROJECT_ROOT / "var" / "data" / "soul" / "soul_variable"
        soul_state_dir.mkdir(parents=True, exist_ok=True)
        soul_state_path = soul_state_dir / "state_vector.json"
        if not soul_state_path.exists():
            default_state = get_default_pad_state()
            soul_state_path.write_text(
                json.dumps(default_state, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            log("已初始化默认 PAD 情感状态向量", "OK")
    except Exception as e:
        log(f"注入身份档案失败: {e}", "ERROR")
        return False
    return True


def get_mcp_dist_index() -> Path:
    return (PROJECT_ROOT / "apps" / "mcp-server" / "dist" / "index.js").absolute()


def prepare_mcp_runtime() -> bool:
    """Prepare MCP runtime: node/npm checks + npm install + build."""
    mcp_dir = PROJECT_ROOT / "apps" / "mcp-server"
    if not mcp_dir.exists():
        log("MCP 服务目录不存在", "ERROR")
        return False

    ok, msg = run_cli_command(["node", "--version"])
    if not ok:
        log("未找到 Node.js，请先安装 Node.js 18+", "ERROR")
        return False
    log(f"检测到 Node.js {msg}", "OK")

    ok, msg = run_cli_command(["npm", "--version"])
    if not ok:
        log("未找到 npm，请安装完整的 Node.js 开发环境", "ERROR")
        return False
    log(f"检测到 npm {msg}", "OK")

    log("安装 npm 依赖...", "STEP")
    result = subprocess.run(["npm", "install"], cwd=mcp_dir, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"npm install 失败: {result.stderr}", "ERROR")
        return False
    log("npm 依赖安装完成", "OK")

    def needs_rebuild() -> bool:
        dist_index = mcp_dir / "dist" / "index.js"
        if not dist_index.exists():
            return True
        dist_mtime = dist_index.stat().st_mtime
        for path in (mcp_dir / "src").rglob("*.ts"):
            if path.stat().st_mtime > dist_mtime:
                return True
        return False

    if needs_rebuild():
        log("检测到源码变更，编译 TypeScript...", "STEP")
        result = subprocess.run(["npm", "run", "build"], cwd=mcp_dir, capture_output=True, text=True)
        if result.returncode != 0:
            log(f"编译失败: {result.stderr}", "ERROR")
            return False
        log("编译完成", "OK")
    else:
        log("未检测到源码变更，跳过编译", "OK")
    return True


def run_mcp_foreground(log_path: str | None = None) -> None:
    log("启动 MCP 服务（Ctrl+C 退出）...", "STEP")
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    resolved_log = Path(log_path) if log_path else (logs_dir / "mcp.log")
    mcp_dir = PROJECT_ROOT / "apps" / "mcp-server"
    cmd = f'cd "{mcp_dir}" && node dist/index.js 2>&1 | tee -a "{resolved_log}"'
    try:
        subprocess.run(["/bin/zsh", "-lc", cmd], check=False)
    except KeyboardInterrupt:
        log("MCP 服务已停止", "INFO")


def uninstall_selected_clients(
    scope: Literal["local", "global", "both"],
    target: Literal["all", "claude", "codex", "trae"],
    project_root: Path = PROJECT_ROOT,
) -> list[dict[str, Any]]:
    """Uninstall selected clients under given scope."""
    installers = {
        "claude": ClaudeInstaller(project_root),
        "codex": CodexInstaller(project_root),
        "trae": TraeInstaller(project_root),
    }
    all_records: list[dict[str, Any]] = []
    for key in selected_client_names(target):
        installer = installers[key]
        title = f"{installer.name} 卸载结果"
        records = installer.uninstall(scope)
        render_action_summary(title, records)
        all_records.extend(records)
    return all_records


def status_selected_clients(
    scope: Literal["local", "global", "both"],
    target: Literal["all", "claude", "codex", "trae"],
    project_root: Path = PROJECT_ROOT,
) -> list[dict[str, Any]]:
    """Collect and render selected client status under given scope."""
    installers = {
        "claude": ClaudeInstaller(project_root),
        "codex": CodexInstaller(project_root),
        "trae": TraeInstaller(project_root),
    }
    all_records: list[dict[str, Any]] = []
    for key in selected_client_names(target):
        installer = installers[key]
        title = f"{installer.name} 状态"
        records = installer.status(scope)
        render_action_summary(title, records)
        all_records.extend(records)
    return all_records


def install_mcp(
    run_after: bool = True,
    log_path: str | None = None,
    install_mode: Literal["quick", "project", "global", "custom"] | None = None,
    client_scope: Literal["local", "global", "both"] | None = None,
    client_target: Literal["all", "claude", "codex", "trae"] | None = None,
    project_selector: str | None = None,
    enter_advanced_menu: bool = False,
) -> bool:
    log("安装 MCP 服务...", "STEP")

    profile: ProfileKey | None = install_mode
    if profile is None and client_scope is None and client_target is None and project_selector is None:
        # Legacy interactive behavior keeps quick as default suggestion.
        profile = ask_install_mode("quick")
    elif profile is None:
        profile = "custom"

    try:
        plan = build_install_plan(
            profile=profile,
            scope=client_scope,
            clients_csv=None,
            legacy_target=client_target,
            project_selector=project_selector,
            run_after=run_after,
            strict_project=False,
        )
    except ValueError as e:
        log(f"安装参数无效: {e}", "ERROR")
        return False

    if plan.do_prepare and not ensure_identity_and_pad_state():
        return False

    if plan.do_prepare and not prepare_mcp_runtime():
        return False

    mcp_full_path = get_mcp_dist_index()
    if plan.do_register and not mcp_full_path.exists():
        log("dist/index.js 不存在。请先执行 prepare 阶段（例如: python3 install.py mcp install --prepare-only）", "ERROR")
        return False

    json_config = f'{{"command": "node", "args": ["{mcp_full_path}"]}}'
    guide_path = generate_client_install_markdown(mcp_full_path)
    log(f"已生成客户端安装指南（中英双语）：{guide_path}", "OK")
    log(f"MCP 服务路径：{mcp_full_path}", "OK")

    if plan.do_register:
        install_selected_clients_by_list(
            mcp_full_path,
            json_config,
            plan.matrix.scope,
            plan.matrix.clients,
            project_root=plan.matrix.project_root,
        )

    if enter_advanced_menu:
        manage_mcp_clients(mcp_full_path, json_config, plan.matrix.project_root)

    if plan.do_post_check:
        status_selected_clients_by_list(plan.matrix.scope, plan.matrix.clients, plan.matrix.project_root)

    if plan.do_run:
        run_mcp_foreground(log_path)

    return True


def is_claude_cli_installed() -> bool:
    """Check if Claude CLI is installed on the system."""
    try:
        result = subprocess.run(["claude", "--version"], capture_output=True, text=True)
        return result.returncode == 0
    except (FileNotFoundError, OSError):
        return False


def is_codex_cli_installed() -> bool:
    """Check if Codex CLI is installed on the system."""
    try:
        result = subprocess.run(["codex", "--version"], capture_output=True, text=True)
        return result.returncode == 0
    except (FileNotFoundError, OSError):
        return False


def load_settings(settings_path: Path) -> dict[str, Any]:
    """Load JSON settings file. Returns empty dict when file does not exist."""
    if not settings_path.exists():
        return {}
    with open(settings_path, encoding="utf-8") as f:
        return json.load(f)


def save_settings(settings_path: Path, settings: dict[str, Any]) -> None:
    """Save JSON settings file, creating parent directory as needed."""
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)


def count_remaining_agentsoul_hooks(settings: dict[str, Any]) -> int:
    """Count how many AgentSoul startup hooks exist in settings dict."""
    if "hooks" not in settings or "SessionStart" not in settings["hooks"]:
        return 0
    count = 0
    for hook in settings["hooks"]["SessionStart"]:
        if "matcher" in hook and "hooks" in hook:
            for subhook in hook["hooks"]:
                if subhook.get("type") == "prompt" and "AGENTSOUL PERSONALITY FRAMEWORK" in subhook.get("prompt", ""):
                    count += 1
    return count


def has_agentsoul_hook(settings: dict[str, Any]) -> bool:
    """Check if AgentSoul startup hook already exists in settings."""
    return count_remaining_agentsoul_hooks(settings) > 0


def remove_agentsoul_hooks(settings: dict[str, Any]) -> int:
    """Remove all AgentSoul startup hooks from settings dict and return removed count."""
    if "hooks" not in settings or "SessionStart" not in settings["hooks"]:
        return 0
    new_hooks: list[dict[str, Any]] = []
    removed_count = 0
    for hook in settings["hooks"]["SessionStart"]:
        if "matcher" in hook and "hooks" in hook:
            is_agentsoul = False
            for subhook in hook["hooks"]:
                if subhook.get("type") == "prompt" and "AGENTSOUL PERSONALITY FRAMEWORK" in subhook.get("prompt", ""):
                    is_agentsoul = True
                    removed_count += 1
                    break
            if not is_agentsoul:
                new_hooks.append(hook)
        else:
            new_hooks.append(hook)
    settings["hooks"]["SessionStart"] = new_hooks
    return removed_count


def get_agentsoul_hook_prompt() -> str:
    """AgentSoul SessionStart hook prompt content."""
    return """
=== AGENTSOUL PERSONALITY FRAMEWORK ===
AgentSoul MCP is already configured for this project. YOU MUST follow this startup sequence at the BEGINNING of EVERY conversation:

1. Call `mcp__agentsoul__mcp_tool_index()` -> Get complete tool index
2. Call `mcp__agentsoul__get_persona_config()` -> Load who you are (AI) and who the user is (master)
3. Call `mcp__agentsoul__get_soul_state()` -> Read current PAD emotion state
4. Call `mcp__agentsoul__get_base_rules` with `name="SKILL"` -> Read top-level personality and security rules
5. Call `mcp__agentsoul__get_base_rules` with `name="memory_base"` -> Read memory system rules
6. Call `mcp__agentsoul__get_mcp_usage_guide()` -> Confirm workflow
7. Call `mcp__agentsoul__list_memory_topics()` -> Get active memory topics

Failure to follow this sequence violates AgentSoul framework rules.
========================================
""".strip()


def ensure_agentsoul_hook(settings: dict[str, Any], hook_prompt: str) -> bool:
    """Ensure AgentSoul SessionStart hook exists. Returns True if changed."""
    if "hooks" not in settings:
        settings["hooks"] = {}
    if "SessionStart" not in settings["hooks"]:
        settings["hooks"]["SessionStart"] = []
    if has_agentsoul_hook(settings):
        return False
    settings["hooks"]["SessionStart"].append({
        "id": "agentsoul-startup",
        "matcher": ".*",
        "hooks": [
            {"type": "prompt", "prompt": hook_prompt}
        ],
    })
    return True


def remove_agentsoul_hook_file(settings_path: Path, force: bool = True) -> tuple[int, int]:
    """
    Remove AgentSoul hooks from one settings file.
    Returns (removed_count, remaining_count).
    """
    if not settings_path.exists():
        return (0, 0)
    settings = load_settings(settings_path)
    removed_total = 0
    while True:
        removed = remove_agentsoul_hooks(settings)
        removed_total += removed
        if not force or removed == 0:
            break
    if removed_total > 0:
        save_settings(settings_path, settings)
    remaining = count_remaining_agentsoul_hooks(settings)
    return (removed_total, remaining)


AGENTSOUL_BLOCK_BEGIN = "# BEGIN AGENTSOUL MCP"
AGENTSOUL_BLOCK_END = "# END AGENTSOUL MCP"


def upsert_managed_block(file_path: Path, block_body: str, begin: str, end: str) -> None:
    """Upsert a managed text block into a file."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    existing = file_path.read_text(encoding="utf-8") if file_path.exists() else ""
    pattern = re.compile(rf"{re.escape(begin)}.*?{re.escape(end)}\n?", re.DOTALL)
    managed = f"{begin}\n{block_body.rstrip()}\n{end}\n"
    if pattern.search(existing):
        updated = pattern.sub(managed, existing)
    else:
        suffix = "" if not existing or existing.endswith("\n") else "\n"
        updated = f"{existing}{suffix}{managed}"
    file_path.write_text(updated, encoding="utf-8")


def remove_managed_block(file_path: Path, begin: str, end: str) -> bool:
    """Remove managed text block from a file. Returns True if changed."""
    if not file_path.exists():
        return False
    existing = file_path.read_text(encoding="utf-8")
    pattern = re.compile(rf"{re.escape(begin)}.*?{re.escape(end)}\n?", re.DOTALL)
    updated, n = pattern.subn("", existing)
    if n > 0:
        file_path.write_text(updated, encoding="utf-8")
        return True
    return False


def has_managed_block(file_path: Path, begin: str, end: str) -> bool:
    """Check if managed text block exists."""
    if not file_path.exists():
        return False
    text = file_path.read_text(encoding="utf-8")
    return begin in text and end in text


def build_codex_mcp_block(mcp_full_path: Path) -> str:
    """Build managed Codex MCP TOML snippet."""
    escaped_path = str(mcp_full_path).replace("\\", "\\\\")
    return (
        "[mcp_servers.agentsoul]\n"
        'command = "node"\n'
        f'args = ["{escaped_path}"]\n'
    )


def codex_scope_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Get Codex config paths for selected scope."""
    paths: list[Path] = []
    if scope in ("global", "both"):
        paths.append(codex_home_dir() / "config.toml")
    if scope in ("local", "both"):
        paths.append(project_root / ".codex" / "config.toml")
    return _dedupe_paths(paths)


def codex_startup_md_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Get Codex startup markdown paths for selected scope."""
    paths: list[Path] = []
    if scope in ("global", "both"):
        paths.append(codex_home_dir() / "agentsoul-startup.md")
    if scope in ("local", "both"):
        paths.append(project_root / ".codex" / "agentsoul-startup.md")
    return _dedupe_paths(paths)


def codex_startup_markdown() -> str:
    """Codex startup guidance fallback (when automatic startup hooks are unavailable)."""
    return """# AgentSoul Startup (Codex)

Codex currently has no stable SessionStart prompt hook equivalent. Use this startup checklist at the beginning of each session:

1. Call `mcp__agentsoul__mcp_tool_index()`
2. Call `mcp__agentsoul__get_persona_config()`
3. Call `mcp__agentsoul__get_soul_state()`
4. Call `mcp__agentsoul__get_base_rules` with `name="SKILL"`
5. Call `mcp__agentsoul__get_base_rules` with `name="memory_base"`
6. Call `mcp__agentsoul__get_mcp_usage_guide()`
7. Call `mcp__agentsoul__list_memory_topics()`

Memory write minimum:
- end of session: `write_memory_day`
- topic updates: `write_memory_topic`
- fact changes: `entity_fact_invalidate` then `entity_fact_add`
"""


AGENTSOUL_AGENTS_BEGIN = "<!-- BEGIN AGENTSOUL STARTUP -->"
AGENTSOUL_AGENTS_END = "<!-- END AGENTSOUL STARTUP -->"


def codex_agents_md_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Get AGENTS.md paths for selected scope.

    Codex project behavior is controlled by project-local AGENTS.md.
    """
    if scope in ("local", "both"):
        return [project_root / "AGENTS.md"]
    return []


def codex_agents_markdown() -> str:
    """Managed AGENTS.md block for Codex startup behavior."""
    return """# AgentSoul Startup Rules (Codex)

Before answering any user request in this project, run this MCP startup sequence first:

1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

Then:
- Respond with the loaded persona, tone, and safety rules.
- Persist memory updates via MCP write tools (`write_memory_day`, `write_memory_topic`, `update_soul_state`).
- Do not claim persistence if MCP write calls were not executed.
"""


def run_cli_command(cmd: list[str]) -> tuple[bool, str]:
    """Run command and return (ok, combined_output)."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        output = (result.stdout or "") + (result.stderr or "")
        return (result.returncode == 0, output.strip())
    except Exception as e:
        return (False, str(e))


def run_cli_command_with_fallback(commands: list[list[str]]) -> tuple[bool, str]:
    """Run command candidates in order, returning the first success."""
    last_output = ""
    for cmd in commands:
        ok, output = run_cli_command(cmd)
        if ok:
            return (True, output)
        last_output = output
    return (False, last_output)


def path_scope_label(path: Path, global_path: Path) -> Literal["global", "local"]:
    """Return scope label by exact canonical path match."""
    try:
        return "global" if path.resolve() == global_path.resolve() else "local"
    except Exception:
        return "global" if path == global_path else "local"


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    seen: set[Path] = set()
    out: list[Path] = []
    for p in paths:
        try:
            rp = p.resolve()
        except Exception:
            rp = p
        if rp in seen:
            continue
        seen.add(rp)
        out.append(p)
    return out


def appdata_dir() -> Path | None:
    """Return APPDATA dir on Windows, otherwise None."""
    value = os.environ.get("APPDATA")
    if value:
        return Path(value)
    return None


def codex_home_dir() -> Path:
    """Resolve Codex home dir.

    Priority:
      - $CODEX_HOME
      - ~/.codex
    """
    env_home = os.environ.get("CODEX_HOME")
    if env_home:
        return Path(env_home)
    return Path.home() / ".codex"


def path_scope_label_by_project(path: Path, project_root: Path) -> Literal["global", "local"]:
    """Label config path as local/global by checking project root ownership."""
    try:
        path.resolve().relative_to(project_root.resolve())
        return "local"
    except Exception:
        return "global"


def claude_mcp_json_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Claude MCP config JSON paths for auto-fix fallback.

    Global:
      - ~/.claude.json
      - %APPDATA%/Claude/claude.json (Windows fallback)
    Local:
      - <project>/.mcp.json
    """
    paths: list[Path] = []
    if scope in ("global", "both"):
        paths.append(Path.home() / ".claude.json")
        ad = appdata_dir()
        if ad is not None:
            paths.append(ad / "Claude" / "claude.json")
    if scope in ("local", "both"):
        paths.append(project_root / ".mcp.json")
    return _dedupe_paths(paths)


def upsert_claude_mcp_json(scope: Literal["local", "global", "both"], project_root: Path, config: dict[str, Any]) -> list[Path]:
    updated: list[Path] = []
    for p in claude_mcp_json_paths(scope, project_root):
        _upsert_mcp_server_in_json(p, "agentsoul", config)
        updated.append(p)
    return updated


def remove_claude_mcp_json(scope: Literal["local", "global", "both"], project_root: Path) -> list[tuple[Path, bool]]:
    removed: list[tuple[Path, bool]] = []
    for p in claude_mcp_json_paths(scope, project_root):
        changed = _remove_mcp_server_in_json(p, "agentsoul")
        removed.append((p, changed))
    return removed


def has_claude_mcp_json(scope: Literal["local", "global", "both"], project_root: Path) -> bool:
    return any(_has_mcp_server_in_json(p, "agentsoul") for p in claude_mcp_json_paths(scope, project_root))


def has_claude_user_mcp_server(server_name: str) -> bool:
    """Check user-level Claude MCP server from ~/.claude.json."""
    cfg = Path.home() / ".claude.json"
    data = _load_json_obj(cfg)
    servers = data.get("mcpServers")
    return isinstance(servers, dict) and server_name in servers


def trae_scope_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Get Trae MCP config paths for selected scope."""
    paths: list[Path] = []
    if scope in ("global", "both"):
        paths.append(Path.home() / ".trae" / "mcp.json")
        ad = appdata_dir()
        if ad is not None:
            paths.append(ad / "Trae" / "mcp.json")
            paths.append(ad / ".trae" / "mcp.json")
    if scope in ("local", "both"):
        paths.append(project_root / ".trae" / "mcp.json")
    return _dedupe_paths(paths)


def _load_json_obj(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except Exception:
        return {}
    return {}


def _load_json_obj_for_update(path: Path) -> dict[str, Any]:
    """Load JSON for update and auto-backup invalid payload before overwriting."""
    if not path.exists():
        return {}

    try:
        raw = path.read_text(encoding="utf-8")
    except Exception:
        return {}

    stripped = raw.strip()
    if not stripped:
        return {}

    try:
        obj = json.loads(stripped)
        if isinstance(obj, dict):
            return obj
        return {}
    except Exception:
        backup = path.with_name(f"{path.name}.corrupt-{int(time.time())}.bak")
        try:
            backup.write_text(raw, encoding="utf-8")
        except Exception:
            pass
        return {}


def _upsert_mcp_server_in_json(path: Path, server_name: str, config: dict[str, Any]) -> None:
    """Upsert MCP server entry in JSON object with mcpServers map."""
    data = _load_json_obj_for_update(path)
    servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        servers = {}
    servers[server_name] = config
    data["mcpServers"] = servers
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _remove_mcp_server_in_json(path: Path, server_name: str) -> bool:
    if not path.exists():
        return False
    data = _load_json_obj_for_update(path)
    servers = data.get("mcpServers")
    if not isinstance(servers, dict) or server_name not in servers:
        return False
    servers.pop(server_name, None)
    data["mcpServers"] = servers
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def _has_mcp_server_in_json(path: Path, server_name: str) -> bool:
    data = _load_json_obj(path)
    servers = data.get("mcpServers")
    return isinstance(servers, dict) and server_name in servers


class ClientInstaller:
    """Base interface for MCP client installers."""
    name: str = "base"

    def __init__(self, project_root: Path = PROJECT_ROOT) -> None:
        self.project_root = project_root.resolve()

    def detect(self) -> bool:
        raise NotImplementedError

    def install(self, scope: Literal["local", "global", "both"], mcp_full_path: Path, json_config: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    def uninstall(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        raise NotImplementedError

    def status(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        raise NotImplementedError


class ClaudeInstaller(ClientInstaller):
    """Claude CLI MCP installer/uninstaller with SessionStart hook management."""

    name = "Claude CLI"

    def detect(self) -> bool:
        return is_claude_cli_installed()

    def install(self, scope: Literal["local", "global", "both"], mcp_full_path: Path, json_config: str) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        if not self.detect():
            records.append({"client": self.name, "scope": scope, "action": "install", "success": False, "detail": "claude CLI not installed"})
            return records

        hook_prompt = get_agentsoul_hook_prompt()
        server_cfg = {"command": "node", "args": [str(mcp_full_path)]}
        if scope in ("global", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "add-json", "--scope", "user", "agentsoul", json_config],
                ["claude", "mcp", "add-json", "-s", "user", "agentsoul", json_config],
            ])
            settings_path = Path.home() / ".claude" / "settings.json"
            settings = load_settings(settings_path) if settings_path.exists() else {}
            changed = ensure_agentsoul_hook(settings, hook_prompt)
            if changed:
                save_settings(settings_path, settings)
            upserted = upsert_claude_mcp_json("global", self.project_root, server_cfg)
            effective_ok = ok or has_claude_mcp_json("global", self.project_root)
            detail = msg or "registered"
            if not ok and upserted:
                detail = f"{detail} | auto-fixed via {', '.join(str(p) for p in upserted)}"
            records.append({"client": self.name, "scope": "global", "action": "install", "success": effective_ok, "detail": detail})

        if scope in ("local", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "add-json", "agentsoul", json_config],
                ["claude", "mcp", "add-json", "-s", "local", "agentsoul", json_config],
            ])
            settings_path = self.project_root / ".claude" / "settings.json"
            settings = load_settings(settings_path) if settings_path.exists() else {}
            changed = ensure_agentsoul_hook(settings, hook_prompt)
            if changed:
                save_settings(settings_path, settings)
            upserted = upsert_claude_mcp_json("local", self.project_root, server_cfg)
            effective_ok = ok or has_claude_mcp_json("local", self.project_root)
            detail = msg or "registered"
            if not ok and upserted:
                detail = f"{detail} | auto-fixed via {', '.join(str(p) for p in upserted)}"
            records.append({"client": self.name, "scope": "local", "action": "install", "success": effective_ok, "detail": detail})
        return records

    def uninstall(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        if not self.detect():
            records.append({"client": self.name, "scope": scope, "action": "uninstall", "success": False, "detail": "claude CLI not installed"})
            return records

        if scope in ("global", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "remove", "--scope", "user", "agentsoul"],
                ["claude", "mcp", "remove", "agentsoul", "-s", "user"],
            ])
            removed, remaining = remove_agentsoul_hook_file(Path.home() / ".claude" / "settings.json", force=True)
            removed_cfg = remove_claude_mcp_json("global", self.project_root)
            still_registered = has_claude_mcp_json("global", self.project_root)
            effective_ok = (ok or any(changed for _, changed in removed_cfg)) and remaining == 0 and not still_registered
            detail = msg or "removed"
            if removed_cfg:
                detail = f"{detail} | config_checked={', '.join(str(p) for p, _ in removed_cfg)}"
            records.append({"client": self.name, "scope": "global", "action": "uninstall", "success": effective_ok, "removed_hooks": removed, "remaining_hooks": remaining, "detail": detail})

        if scope in ("local", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "remove", "agentsoul"],
                ["claude", "mcp", "remove", "agentsoul", "-s", "local"],
            ])
            local_settings = self.project_root / ".claude" / "settings.json"
            removed, remaining = remove_agentsoul_hook_file(local_settings, force=True)
            removed_cfg = remove_claude_mcp_json("local", self.project_root)
            still_registered = has_claude_mcp_json("local", self.project_root)
            local_claude_dir = self.project_root / ".claude"
            if local_claude_dir.exists():
                try:
                    if not any(local_claude_dir.iterdir()):
                        local_claude_dir.rmdir()
                except Exception:
                    pass
            effective_ok = (ok or any(changed for _, changed in removed_cfg)) and remaining == 0 and not still_registered
            detail = msg or "removed"
            if removed_cfg:
                detail = f"{detail} | config_checked={', '.join(str(p) for p, _ in removed_cfg)}"
            records.append({"client": self.name, "scope": "local", "action": "uninstall", "success": effective_ok, "removed_hooks": removed, "remaining_hooks": remaining, "detail": detail})
        return records

    def status(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        if scope in ("global", "both"):
            # Some Claude CLI versions don't support scope on `mcp get`.
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "get", "agentsoul", "-s", "user"],
                ["claude", "mcp", "get", "--scope", "user", "agentsoul"],
            ])
            file_ok = has_claude_user_mcp_server("agentsoul") or has_claude_mcp_json("global", self.project_root)
            if not ok:
                ok = file_ok
                msg = str(Path.home() / ".claude.json")
            else:
                ok = ok or file_ok
            settings = load_settings(Path.home() / ".claude" / "settings.json")
            records.append({"client": self.name, "scope": "global", "registered": ok, "hook_count": count_remaining_agentsoul_hooks(settings), "detail": msg})
        if scope in ("local", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "get", "agentsoul", "-s", "local"],
                ["claude", "mcp", "get", "agentsoul"],
            ])
            file_ok = has_claude_mcp_json("local", self.project_root)
            ok = ok or file_ok
            settings = load_settings(self.project_root / ".claude" / "settings.json")
            records.append({"client": self.name, "scope": "local", "registered": ok, "hook_count": count_remaining_agentsoul_hooks(settings), "detail": msg})
        return records


class CodexInstaller(ClientInstaller):
    """Codex CLI MCP installer using managed config.toml blocks."""

    name = "Codex CLI"

    def detect(self) -> bool:
        return is_codex_cli_installed()

    def install(self, scope: Literal["local", "global", "both"], mcp_full_path: Path, json_config: str) -> list[dict[str, Any]]:
        del json_config
        records: list[dict[str, Any]] = []
        if not self.detect():
            records.append({"client": self.name, "scope": scope, "action": "install", "success": False, "detail": "codex CLI not installed"})
            return records

        block = build_codex_mcp_block(mcp_full_path)
        for cfg in codex_scope_paths(scope, self.project_root):
            upsert_managed_block(cfg, block, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END)
            records.append({"client": self.name, "scope": path_scope_label_by_project(cfg, self.project_root), "action": "install", "success": True, "detail": f"updated {cfg}"})

        for md in codex_startup_md_paths(scope, self.project_root):
            md.parent.mkdir(parents=True, exist_ok=True)
            md.write_text(codex_startup_markdown(), encoding="utf-8")
            records.append({"client": self.name, "scope": path_scope_label_by_project(md, self.project_root), "action": "startup_fallback", "success": True, "detail": f"generated {md}"})

        for agents_md in codex_agents_md_paths(scope, self.project_root):
            upsert_managed_block(agents_md, codex_agents_markdown(), AGENTSOUL_AGENTS_BEGIN, AGENTSOUL_AGENTS_END)
            records.append({"client": self.name, "scope": "local", "action": "agents_md", "success": True, "detail": f"updated {agents_md}"})
        return records

    def uninstall(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for cfg in codex_scope_paths(scope, self.project_root):
            changed = remove_managed_block(cfg, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END)
            records.append({"client": self.name, "scope": path_scope_label_by_project(cfg, self.project_root), "action": "uninstall", "success": True, "detail": f"{'removed' if changed else 'not found'} {cfg}"})
        for md in codex_startup_md_paths(scope, self.project_root):
            if md.exists():
                md.unlink()
                records.append({"client": self.name, "scope": path_scope_label_by_project(md, self.project_root), "action": "startup_fallback_remove", "success": True, "detail": f"removed {md}"})
        for agents_md in codex_agents_md_paths(scope, self.project_root):
            changed = remove_managed_block(agents_md, AGENTSOUL_AGENTS_BEGIN, AGENTSOUL_AGENTS_END)
            records.append({"client": self.name, "scope": "local", "action": "agents_md_remove", "success": True, "detail": f"{'removed' if changed else 'not found'} {agents_md}"})
        local_dir = self.project_root / ".codex"
        if local_dir.exists():
            try:
                if not any(local_dir.iterdir()):
                    local_dir.rmdir()
            except Exception:
                pass
        return records

    def status(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for cfg in codex_scope_paths(scope, self.project_root):
            sc = path_scope_label_by_project(cfg, self.project_root)
            records.append({
                "client": self.name,
                "scope": sc,
                "registered": has_managed_block(cfg, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END),
                "startup_fallback": (codex_home_dir() / "agentsoul-startup.md").exists() if sc == "global" else (self.project_root / ".codex" / "agentsoul-startup.md").exists(),
                "detail": str(cfg),
            })
        for agents_md in codex_agents_md_paths(scope, self.project_root):
            records.append({
                "client": self.name,
                "scope": "local",
                "action": "agents_md_status",
                "registered": has_managed_block(agents_md, AGENTSOUL_AGENTS_BEGIN, AGENTSOUL_AGENTS_END),
                "detail": str(agents_md),
            })
        return records


class TraeInstaller(ClientInstaller):
    """Trae MCP installer using managed JSON mcpServers config."""

    name = "Trae"

    def detect(self) -> bool:
        # No stable public CLI is required for config-file mode.
        return True

    def install(self, scope: Literal["local", "global", "both"], mcp_full_path: Path, json_config: str) -> list[dict[str, Any]]:
        del json_config
        records: list[dict[str, Any]] = []
        server_cfg = {"command": "node", "args": [str(mcp_full_path)]}
        for cfg in trae_scope_paths(scope, self.project_root):
            _upsert_mcp_server_in_json(cfg, "agentsoul", server_cfg)
            records.append({
                "client": self.name,
                "scope": path_scope_label_by_project(cfg, self.project_root),
                "action": "install",
                "success": True,
                "detail": f"updated {cfg}",
            })
        return records

    def uninstall(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for cfg in trae_scope_paths(scope, self.project_root):
            changed = _remove_mcp_server_in_json(cfg, "agentsoul")
            records.append({
                "client": self.name,
                "scope": path_scope_label_by_project(cfg, self.project_root),
                "action": "uninstall",
                "success": True,
                "detail": f"{'removed' if changed else 'not found'} {cfg}",
            })
        return records

    def status(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for cfg in trae_scope_paths(scope, self.project_root):
            records.append({
                "client": self.name,
                "scope": path_scope_label_by_project(cfg, self.project_root),
                "registered": _has_mcp_server_in_json(cfg, "agentsoul"),
                "detail": str(cfg),
            })
        return records


def render_action_summary(title: str, records: list[dict[str, Any]]) -> None:
    """Render structured action summary logs."""
    if not records:
        return
    log(title, "STEP")
    for rec in records:
        status = "OK" if rec.get("success", rec.get("registered", False)) else "WARN"
        detail = rec.get("detail", "")
        scope = rec.get("scope", "n/a")
        action = rec.get("action", "status")
        extra = []
        if "remaining_hooks" in rec:
            extra.append(f"remaining_hooks={rec['remaining_hooks']}")
        if "hook_count" in rec:
            extra.append(f"hook_count={rec['hook_count']}")
        line = f"{rec.get('client', 'client')} | scope={scope} | action={action} | {detail}"
        if extra:
            line += " | " + ", ".join(extra)
        log(line, status)


def ask_scope(default: Literal["local", "global", "both"] = "both") -> Literal["local", "global", "both"] | None:
    """Prompt scope selection for client install/uninstall."""
    options = {"1": "local", "2": "global", "3": "both"}
    default_key = "3" if default == "both" else ("1" if default == "local" else "2")
    print("\n请选择作用域：")
    print("1. 项目本地")
    print("2. 用户全局")
    print("3. 同时（本地+全局）")
    print("0. 返回上一步")
    choice = prompt_numeric_choice(
        f"请输入选项 [0-3，默认 {default_key}]: ",
        valid_choices=["0"] + list(options.keys()),
        default=default_key,
        invalid_message="❌ 无效选项，请输入 0-3",
    )
    if choice == "0":
        return None
    return options[choice]  # type: ignore[return-value]


def discover_project_candidates(max_depth: int = 4, max_results: int = 80) -> list[Path]:
    """Discover project folders by marker files."""
    metas = discover_project_metadata(max_depth=max_depth, max_results=max_results)
    return [Path(item["path"]) for item in metas]


def find_project_by_name(name: str) -> Path | None:
    """Find a project folder by basename or full path text."""
    key = name.strip()
    if not key:
        return None
    direct = Path(key).expanduser()
    if direct.exists() and direct.is_dir():
        return direct.resolve()
    candidates = discover_project_candidates()
    lower = key.lower()
    exact = [c for c in candidates if c.name.lower() == lower or str(c).lower().endswith(lower)]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        return None
    prefix = [c for c in candidates if c.name.lower().startswith(lower)]
    if len(prefix) == 1:
        return prefix[0]
    return None


def ask_project_root(default_root: Path = PROJECT_ROOT) -> Path | None:
    """Prompt user to select project root for local-scope installs."""
    default_root = default_root.resolve()
    candidates = discover_project_candidates()
    ordered: list[Path] = []
    if default_root not in candidates:
        ordered.append(default_root)
    ordered.extend(candidates)
    print("\n请选择项目（用于本地作用域安装）：")
    for idx, p in enumerate(ordered, start=1):
        label = p.name
        if p == default_root:
            label += " (当前项目)"
        print(f"{idx}. {label} -> {p}")
    print("0. 返回上一步")
    default_idx = 1
    valid_choices = ["0"] + [str(i) for i in range(1, len(ordered) + 1)]
    choice = prompt_numeric_choice(
        f"请输入选项 [0-{len(ordered)}，默认 {default_idx}]: ",
        valid_choices=valid_choices,
        default=str(default_idx),
        invalid_message=f"❌ 无效选项，请输入 0-{len(ordered)}",
    )
    if choice == "0":
        return None
    return ordered[int(choice) - 1]


def generate_client_install_markdown(mcp_full_path: Path) -> Path:
    """Generate bilingual Markdown install guide for Claude, Codex and Trae."""
    doc_path = PROJECT_ROOT / "docs" / "tutorials" / "05-mcp-client-install.md"
    doc_path.parent.mkdir(parents=True, exist_ok=True)
    json_config = f'{{"command":"node","args":["{mcp_full_path}"]}}'
    codex_block = build_codex_mcp_block(mcp_full_path)
    markdown = f"""# AgentSoul MCP Client Install Guide (Claude + Codex + Trae)

## 中文

### Claude CLI 安装
```bash
claude mcp add-json agentsoul '{json_config}'
claude mcp add-json --scope user agentsoul '{json_config}'
```

### Claude CLI 卸载
```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI 安装（config.toml）
将以下片段写入 `~/.codex/config.toml`（全局）或 `<project>/.codex/config.toml`（本地）：
```toml
{AGENTSOUL_BLOCK_BEGIN}
{codex_block.rstrip()}
{AGENTSOUL_BLOCK_END}
```

### Codex CLI 卸载
删除 `config.toml` 中 `{AGENTSOUL_BLOCK_BEGIN}` 到 `{AGENTSOUL_BLOCK_END}` 的整段。

### Trae 安装（mcp.json）
将以下 JSON 写入 `~/.trae/mcp.json`（全局）或 `<project>/.trae/mcp.json`（本地）：
```json
{{
  "mcpServers": {{
    "agentsoul": {json_config}
  }}
}}
```

### 启动后记忆流程（必须）
1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

最小读写闭环：`read_memory_topic` -> 对话 -> `write_memory_day` + `write_memory_topic`；事实变化使用 `entity_fact_invalidate` + `entity_fact_add`。

## English

### Claude CLI install
```bash
claude mcp add-json agentsoul '{json_config}'
claude mcp add-json --scope user agentsoul '{json_config}'
```

### Claude CLI uninstall
```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI install (config.toml)
Write this block to `~/.codex/config.toml` (global) or `<project>/.codex/config.toml` (local):
```toml
{AGENTSOUL_BLOCK_BEGIN}
{codex_block.rstrip()}
{AGENTSOUL_BLOCK_END}
```

### Codex CLI uninstall
Remove the full managed block between `{AGENTSOUL_BLOCK_BEGIN}` and `{AGENTSOUL_BLOCK_END}`.

### Trae install (mcp.json)
Write this JSON to `~/.trae/mcp.json` (global) or `<project>/.trae/mcp.json` (local):
```json
{{
  "mcpServers": {{
    "agentsoul": {json_config}
  }}
}}
```

### Required startup memory workflow
1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

Minimal read/write loop: `read_memory_topic` -> conversation -> `write_memory_day` + `write_memory_topic`; on fact change use `entity_fact_invalidate` then `entity_fact_add`.
"""
    doc_path.write_text(markdown, encoding="utf-8")
    return doc_path


def manage_mcp_clients(mcp_full_path: Path, json_config: str, project_root: Path = PROJECT_ROOT) -> None:
    """Interactive client installation management for Claude, Codex and Trae."""
    selected_project = project_root.resolve()
    while True:
        claude = ClaudeInstaller(selected_project)
        codex = CodexInstaller(selected_project)
        trae = TraeInstaller(selected_project)
        print("\nMCP 客户端安装管理：")
        print(f"当前本地项目：{selected_project}")
        print("1. Claude 安装")
        print("2. Claude 卸载")
        print("3. Codex 安装")
        print("4. Codex 卸载")
        print("5. Trae 安装")
        print("6. Trae 卸载")
        print("7. 一键安装（Claude+Codex+Trae）")
        print("8. 一键卸载（Claude+Codex+Trae）")
        print("9. 查看状态")
        print("10. 切换本地目标项目")
        print("0. 返回")
        choice = prompt_numeric_choice(
            "请输入选项 [0-10]: ",
            valid_choices=[str(i) for i in range(0, 11)],
            invalid_message="❌ 无效选项，请输入 0-10",
        )
        if choice == "0":
            return
        if choice == "10":
            selected = ask_project_root(selected_project)
            if selected is None:
                continue
            selected_project = selected
            log(f"已切换本地目标项目：{selected_project}", "OK")
            continue
        scope = ask_scope("both")
        if scope is None:
            continue
        if choice == "1":
            render_action_summary("Claude 安装结果", claude.install(scope, mcp_full_path, json_config))
        elif choice == "2":
            uninstall_selected_clients(scope, "claude", selected_project)
        elif choice == "3":
            render_action_summary("Codex 安装结果", codex.install(scope, mcp_full_path, json_config))
        elif choice == "4":
            uninstall_selected_clients(scope, "codex", selected_project)
        elif choice == "5":
            render_action_summary("Trae 安装结果", trae.install(scope, mcp_full_path, json_config))
        elif choice == "6":
            uninstall_selected_clients(scope, "trae", selected_project)
        elif choice == "7":
            render_action_summary("Claude 安装结果", claude.install(scope, mcp_full_path, json_config))
            render_action_summary("Codex 安装结果", codex.install(scope, mcp_full_path, json_config))
            render_action_summary("Trae 安装结果", trae.install(scope, mcp_full_path, json_config))
        elif choice == "8":
            uninstall_selected_clients(scope, "all", selected_project)
        elif choice == "9":
            status_selected_clients(scope, "all", selected_project)
        else:
            print("❌ 未实现的选项，请稍后重试")


def uninstall_mcp(
    project_root: Path = PROJECT_ROOT,
    scope: Literal["local", "global", "both"] = "both",
    target: Literal["all", "claude", "codex", "trae"] = "all",
) -> bool:
    """Uninstall AgentSoul MCP from selected clients."""
    log("卸载 AgentSoul MCP...", "STEP")
    uninstall_records = uninstall_selected_clients(scope, target, project_root)
    status_records = status_selected_clients(scope, target, project_root)

    uninstall_ok = all(rec.get("success", True) for rec in uninstall_records)
    status_ok = all(not rec.get("registered", False) for rec in status_records if "registered" in rec)
    ok = uninstall_ok and status_ok
    if ok:
        log("✅ MCP 卸载完成", "OK")
    else:
        if not uninstall_ok:
            log("⚠️  检测到卸载命令失败项，请查看上方详情", "WARN")
        if not status_ok:
            log("⚠️  卸载后仍检测到残留注册项，请查看上方详情", "WARN")
    return ok


def _json_is_corrupt(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        raw = path.read_text(encoding="utf-8").strip()
        if raw == "":
            return False
        return not isinstance(json.loads(raw), dict)
    except Exception:
        return True


def _can_write_target(path: Path) -> bool:
    probe = path if path.exists() and path.is_dir() else path.parent
    try:
        probe.mkdir(parents=True, exist_ok=True)
    except Exception:
        return False
    if path.exists() and path.is_file():
        return os.access(path, os.W_OK) or os.access(probe, os.W_OK)
    return os.access(probe, os.W_OK)


def _doctor_report_status(checks: list[dict[str, Any]]) -> int:
    has_error = any(c["status"] == "error" for c in checks)
    has_warn = any(c["status"] == "warn" for c in checks)
    if has_error:
        return 1
    if has_warn:
        return 2
    return 0


def run_mcp_doctor(matrix: TargetMatrix, as_json: bool = False) -> int:
    checks: list[dict[str, Any]] = []
    ok, msg = run_cli_command(["node", "--version"])
    checks.append({"id": "node", "client": "system", "scope": "global", "status": "ok" if ok else "error", "detail": msg or "node not found"})
    ok, msg = run_cli_command(["npm", "--version"])
    checks.append({"id": "npm", "client": "system", "scope": "global", "status": "ok" if ok else "error", "detail": msg or "npm not found"})

    dist = get_mcp_dist_index()
    checks.append({"id": "dist-index", "client": "system", "scope": "global", "status": "ok" if dist.exists() else "warn", "detail": str(dist)})

    if "claude" in matrix.clients:
        for p in claude_mcp_json_paths(matrix.scope, matrix.project_root):
            scope = path_scope_label_by_project(p, matrix.project_root)
            writable = _can_write_target(p)
            checks.append({
                "id": "path-writable",
                "client": "Claude CLI",
                "scope": scope,
                "path": str(p),
                "status": "ok" if writable else "warn",
                "detail": f"writable={writable}",
            })
            checks.append({
                "id": "claude-json-corrupt",
                "client": "Claude CLI",
                "scope": scope,
                "path": str(p),
                "status": "warn" if _json_is_corrupt(p) else "ok",
                "detail": "corrupt json" if _json_is_corrupt(p) else "valid",
            })
    if "codex" in matrix.clients:
        for p in codex_scope_paths(matrix.scope, matrix.project_root):
            checks.append({
                "id": "path-writable",
                "client": "Codex CLI",
                "scope": path_scope_label_by_project(p, matrix.project_root),
                "path": str(p),
                "status": "ok" if _can_write_target(p) else "warn",
                "detail": f"writable={_can_write_target(p)}",
            })
    if "trae" in matrix.clients:
        for p in trae_scope_paths(matrix.scope, matrix.project_root):
            scope = path_scope_label_by_project(p, matrix.project_root)
            writable = _can_write_target(p)
            checks.append({
                "id": "path-writable",
                "client": "Trae",
                "scope": scope,
                "path": str(p),
                "status": "ok" if writable else "warn",
                "detail": f"writable={writable}",
            })
            checks.append({
                "id": "trae-json-corrupt",
                "client": "Trae",
                "scope": scope,
                "path": str(p),
                "status": "warn" if _json_is_corrupt(p) else "ok",
                "detail": "corrupt json" if _json_is_corrupt(p) else "valid",
            })

    status_records = status_selected_clients_by_list(matrix.scope, matrix.clients, matrix.project_root, render=False)
    for rec in status_records:
        if "registered" in rec:
            checks.append({
                "id": "registration",
                "client": rec.get("client"),
                "scope": rec.get("scope"),
                "status": "ok" if rec.get("registered") else "warn",
                "detail": rec.get("detail"),
            })
        if rec.get("hook_count", 0) and rec.get("hook_count", 0) > 1:
            checks.append({
                "id": "claude-hook-dup",
                "client": rec.get("client"),
                "scope": rec.get("scope"),
                "status": "warn",
                "detail": f"hook_count={rec.get('hook_count')}",
            })

    code = _doctor_report_status(checks)
    if as_json:
        components = summarize_component_checks(checks)
        print(json.dumps({"components": components, "checks": checks, "exit_code": code}, indent=2, ensure_ascii=False))
    else:
        log("MCP Doctor 检查结果", "STEP")
        for item in checks:
            status = item["status"]
            level = "OK" if status == "ok" else ("WARN" if status == "warn" else "ERROR")
            summary = f"{item['id']} | {item.get('client', '')} {item.get('scope', '')}".strip()
            detail = item.get("detail", "")
            log(f"{summary} | {detail}", level)
    return code


def run_mcp_repair(matrix: TargetMatrix) -> int:
    repaired = 0
    if "claude" in matrix.clients:
        for p in claude_mcp_json_paths(matrix.scope, matrix.project_root):
            if _json_is_corrupt(p):
                _load_json_obj_for_update(p)
                if not p.exists():
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_text("{}\n", encoding="utf-8")
                repaired += 1
                log(f"已修复 Claude 配置损坏文件: {p}", "OK")
    if "trae" in matrix.clients:
        for p in trae_scope_paths(matrix.scope, matrix.project_root):
            if _json_is_corrupt(p):
                _load_json_obj_for_update(p)
                if not p.exists():
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_text("{}\n", encoding="utf-8")
                repaired += 1
                log(f"已修复 Trae 配置损坏文件: {p}", "OK")
    if "codex" in matrix.clients:
        for cfg in codex_scope_paths(matrix.scope, matrix.project_root):
            scope = path_scope_label_by_project(cfg, matrix.project_root)
            startup = codex_home_dir() / "agentsoul-startup.md" if scope == "global" else matrix.project_root / ".codex" / "agentsoul-startup.md"
            if startup.exists() and not has_managed_block(cfg, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END):
                startup.unlink()
                repaired += 1
                log(f"已移除 Codex 孤儿 startup 文件: {startup}", "OK")

    if "claude" in matrix.clients:
        hook_prompt = get_agentsoul_hook_prompt()
        settings_paths: list[Path] = []
        if matrix.scope in ("global", "both"):
            settings_paths.append(Path.home() / ".claude" / "settings.json")
        if matrix.scope in ("local", "both"):
            settings_paths.append(matrix.project_root / ".claude" / "settings.json")
        for s in settings_paths:
            settings = load_settings(s) if s.exists() else {}
            hooks = count_remaining_agentsoul_hooks(settings)
            if hooks > 1:
                remove_agentsoul_hooks(settings)
                ensure_agentsoul_hook(settings, hook_prompt)
                save_settings(s, settings)
                repaired += 1
                log(f"已修复 Claude 重复 hook: {s}", "OK")

    if repaired == 0:
        log("未发现可修复项", "INFO")
    else:
        log(f"修复完成，共处理 {repaired} 项", "OK")

    # Re-check; return doctor style exit code.
    return run_mcp_doctor(matrix, as_json=False)


def print_project_list(as_json: bool = False) -> int:
    metas = discover_project_metadata()
    if as_json:
        print(json.dumps({"projects": metas}, indent=2, ensure_ascii=False))
        return 0
    log("可选项目列表", "STEP")
    for item in metas:
        markers = ",".join(item.get("markers", [])) or "-"
        log(
            f"{item['name']} | {item['path']} | kind={item.get('kind')} | confidence={item.get('confidence')} | markers={markers}",
            "INFO",
        )
    return 0


def _component_name(raw: str | None) -> str:
    return CLIENT_COMPONENT_NAMES.get(raw or "system", raw or "Runtime")


def _recommended_fix(component: str, scope: str, status: str, repair_hint: bool = False) -> str:
    if status == "ok":
        return ""
    if component == "Runtime":
        return "运行 `python3 install.py mcp install --prepare-only` 重新准备运行时后再重试"
    if repair_hint:
        return f"运行 `python3 install.py mcp repair --scope {scope} --clients all` 自动修复后再执行 doctor"
    client_key = component.lower()
    return f"运行 `python3 install.py mcp install --scope {scope} --clients {client_key}` 重新注册"


def summarize_component_status(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for rec in records:
        component = _component_name(rec.get("client"))
        scope = rec.get("scope", "unknown")
        grouped.setdefault((component, scope), []).append(rec)

    out: list[dict[str, Any]] = []
    for (component, scope), items in sorted(grouped.items(), key=lambda x: (x[0][0], x[0][1])):
        bool_values = [bool(i.get("registered")) for i in items if "registered" in i]
        if bool_values and all(bool_values):
            status = "ok"
        elif bool_values and any(bool_values):
            status = "warn"
        else:
            status = "warn"
        out.append(
            {
                "component": component,
                "scope": scope,
                "status": status,
                "checks": [
                    {
                        "action": i.get("action", "status"),
                        "registered": i.get("registered"),
                        "detail": i.get("detail", ""),
                        "hook_count": i.get("hook_count"),
                    }
                    for i in items
                ],
                "recommended_fix": (
                    _recommended_fix(component, scope, status, repair_hint=False)
                ),
            }
        )
    return out


def summarize_component_checks(checks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in checks:
        component = _component_name(str(item.get("client", "system")))
        scope = str(item.get("scope", "global"))
        grouped.setdefault((component, scope), []).append(item)

    results: list[dict[str, Any]] = []
    for (component, scope), items in sorted(grouped.items(), key=lambda x: (x[0][0], x[0][1])):
        statuses = [str(i.get("status", "warn")) for i in items]
        if any(s == "error" for s in statuses):
            status = "error"
        elif any(s == "warn" for s in statuses):
            status = "warn"
        else:
            status = "ok"
        results.append(
            {
                "component": component,
                "scope": scope,
                "status": status,
                "checks": items,
                "recommended_fix": _recommended_fix(component, scope, status, repair_hint=True),
            }
        )
    return results


def check_and_initialize_configs(project_root: Path) -> None:
    """Check for existing soul and master configs and prompt for initialization.

    - First-time install: force initialization
    - Existing configs: ask user if they want to reset
    - Always re-creates defaults if user agrees
    """
    config_loader = ConfigLoader(project_root)
    persona_path = project_root / "config" / "persona.yaml"
    soul_state_path = project_root / "var" / "data" / "soul" / "soul_variable" / "state_vector.json"

    # Check existence
    has_master_config = persona_path.exists() and config_loader.is_config_valid()
    has_soul_state = soul_state_path.exists()

    if not has_master_config and not has_soul_state:
        log("检测到首次安装，开始初始化配置...", "STEP")
        do_initialize = True
    else:
        # Build dynamic prompt based on what exists
        if has_master_config and has_soul_state:
            prompt = "检测到已存在的灵魂状态和用户配置，是否要重新初始化？"
        elif not has_soul_state:
            prompt = "检测到已存在用户配置，但缺少灵魂状态，是否初始化灵魂状态？"
        else:
            prompt = "检测到已存在灵魂状态，但缺少用户配置，是否重新初始化？"
        do_initialize = prompt_binary_choice(
            prompt,
            default_yes=False,
            yes_label="重新初始化",
            no_label="保留现有配置",
        )

    if not do_initialize:
        if has_master_config and has_soul_state:
            log("保留现有配置，继续安装", "INFO")
        elif not has_soul_state:
            log("跳过灵魂状态初始化，继续安装\n提示：后续可重新运行安装脚本初始化", "INFO")
        else:
            log("跳过用户配置初始化，继续安装\n提示：后续可重新运行安装脚本初始化", "INFO")
        return

    # Ask whether to use interactive configuration wizard
    use_wizard = prompt_binary_choice(
        PROMPTS['zh']['use_interactive_wizard'],
        default_yes=True,
        yes_label="使用向导",
        no_label="使用默认流程",
    )
    if use_wizard:
        run_interactive_config_wizard(project_root)
        return

    # Step 1: Initialize master configuration (traditional method)
    log("初始化用户配置 (master)...", "STEP")
    tracker = get_rollback_tracker()
    if persona_path.exists():
        tracker.track_modified_file(persona_path)
    else:
        tracker.track_created_file(persona_path)
    create_default_persona(persona_path)

    # Ask to open editor
    open_editor = prompt_binary_choice(
        "是否现在打开编辑器配置用户信息？",
        default_yes=True,
        yes_label="打开编辑器",
        no_label="稍后手动编辑",
    )
    if open_editor:
        if open_file_in_editor(persona_path):
            log(f"已在默认编辑器中打开 {persona_path}", "OK")
        else:
            log(f"无法自动打开，请手动编辑: {persona_path}", "WARN")
    else:
        log(f"配置文件位置: {persona_path}，你可以稍后编辑", "INFO")

    # Step 2: Initialize soul PAD state
    log("初始化灵魂 PAD 情感状态...", "STEP")
    tracker = get_rollback_tracker()
    soul_state_dir = soul_state_path.parent

    current = soul_state_dir
    while not current.exists():
        tracker.track_created_dir(current)
        current = current.parent
    soul_state_dir.mkdir(parents=True, exist_ok=True)

    if soul_state_path.exists():
        tracker.track_modified_file(soul_state_path)
    else:
        tracker.track_created_file(soul_state_path)

    default_state = get_default_pad_state()
    soul_state_path.write_text(
        json.dumps(default_state, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    log("已初始化默认 PAD 情感状态向量", "OK")

    # Step 3: Initialize data directories for enhanced memory and adaptive learning
    log("初始化增强记忆系统...", "STEP")
    initialize_data_directories(project_root)

    # Step 4: Re-initialize identity files
    log("更新身份档案...", "STEP")
    initialize_identity(project_root, project_root, verbose=True)

    log("配置初始化完成", "OK")
    print()


LEGACY_MCP_NOTICE_PRINTED = False


def warn_legacy_mcp_notice() -> None:
    global LEGACY_MCP_NOTICE_PRINTED
    if LEGACY_MCP_NOTICE_PRINTED:
        return
    LEGACY_MCP_NOTICE_PRINTED = True
    log(
        "检测到旧版 MCP 参数入口，已自动映射到新命令。推荐替代：`mcp install` / `mcp status` / `mcp uninstall`",
        "WARN",
    )


def resolve_matrix_from_cli_args(
    profile: ProfileKey | None,
    scope: ScopeKey | None,
    clients: str | None,
    project: str | None,
    legacy_target: TargetKey | None = None,
    strict_project: bool = True,
) -> TargetMatrix:
    plan = build_install_plan(
        profile=profile,
        scope=scope,
        clients_csv=clients,
        legacy_target=legacy_target,
        project_selector=project,
        run_after=False,
        strict_project=strict_project,
    )
    return plan.matrix


def handle_mcp_subcommand(args: argparse.Namespace) -> int:
    cmd = args.mcp_command
    if cmd == "project-list":
        return print_project_list(as_json=getattr(args, "json", False))

    if cmd == "guide":
        mcp_full_path = get_mcp_dist_index()
        guide_path = generate_client_install_markdown(mcp_full_path)
        log(f"已生成客户端安装指南: {guide_path}", "OK")
        return 0

    if cmd == "install":
        try:
            plan = build_install_plan(
                profile=args.profile,
                scope=args.scope,
                clients_csv=args.clients,
                project_selector=args.project,
                run_after=args.run,
                prepare_only=args.prepare_only,
                register_only=args.register_only,
                strict_project=True,
            )
        except ValueError as e:
            log(f"参数错误: {e}", "ERROR")
            return 1

        if plan.do_prepare:
            check_and_initialize_configs(PROJECT_ROOT)
            if not ensure_identity_and_pad_state():
                return 1
            if not prepare_mcp_runtime():
                return 1

        mcp_full_path = get_mcp_dist_index()
        if plan.do_register and not mcp_full_path.exists():
            log("register-only 需要已构建 dist/index.js。请先执行 `python3 install.py mcp install --prepare-only`", "ERROR")
            return 1

        json_config = f'{{"command": "node", "args": ["{mcp_full_path}"]}}'
        generate_client_install_markdown(mcp_full_path)
        if plan.do_register:
            install_selected_clients_by_list(
                mcp_full_path,
                json_config,
                plan.matrix.scope,
                plan.matrix.clients,
                project_root=plan.matrix.project_root,
            )
        if plan.do_post_check:
            status_selected_clients_by_list(plan.matrix.scope, plan.matrix.clients, plan.matrix.project_root)
        if plan.do_run:
            run_mcp_foreground(args.log)
        return 0

    if cmd == "status":
        try:
            matrix = resolve_matrix_from_cli_args(
                profile=None,
                scope=args.scope,
                clients=args.clients,
                project=args.project,
                strict_project=True,
            )
        except ValueError as e:
            log(f"参数错误: {e}", "ERROR")
            return 1
        records = status_selected_clients_by_list(
            matrix.scope,
            matrix.clients,
            matrix.project_root,
            render=not getattr(args, "json", False),
        )
        if getattr(args, "json", False):
            print(
                json.dumps(
                    {
                        "components": summarize_component_status(records),
                        "records": records,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
        return 0

    if cmd == "uninstall":
        try:
            matrix = resolve_matrix_from_cli_args(
                profile=None,
                scope=args.scope,
                clients=args.clients,
                project=args.project,
                strict_project=True,
            )
        except ValueError as e:
            log(f"参数错误: {e}", "ERROR")
            return 1
        uninstall_records = uninstall_selected_clients_by_list(matrix.scope, matrix.clients, matrix.project_root)
        status_records = status_selected_clients_by_list(matrix.scope, matrix.clients, matrix.project_root)
        uninstall_ok = all(rec.get("success", True) for rec in uninstall_records)
        status_ok = all(not rec.get("registered", False) for rec in status_records if "registered" in rec)
        return 0 if (uninstall_ok and status_ok) else 1

    if cmd == "doctor":
        try:
            matrix = resolve_matrix_from_cli_args(
                profile=None,
                scope=args.scope,
                clients=args.clients,
                project=args.project,
                strict_project=True,
            )
        except ValueError as e:
            log(f"参数错误: {e}", "ERROR")
            return 1
        return run_mcp_doctor(matrix, as_json=getattr(args, "json", False))

    if cmd == "repair":
        try:
            matrix = resolve_matrix_from_cli_args(
                profile=None,
                scope=args.scope,
                clients=args.clients,
                project=args.project,
                strict_project=True,
            )
        except ValueError as e:
            log(f"参数错误: {e}", "ERROR")
            return 1
        return run_mcp_repair(matrix)

    log("未知 mcp 子命令", "ERROR")
    return 1


def main():
    epilog = """
示例用法:
  python3 install.py                         # 交互式安装
  python3 install.py --persona               # 仅生成人格包
  python3 install.py --persona --name "小明" # 自定义 Agent 名称生成
  python3 install.py mcp install --profile quick
  python3 install.py mcp status --scope global --clients codex
  python3 install.py mcp uninstall --scope global --clients trae
  python3 install.py mcp doctor --scope both --clients all --json
  python3 install.py mcp repair --scope both --clients all
  python3 install.py mcp project-list
  python3 install.py mcp guide
  python3 install.py --openclaw             # 安装 OpenClaw 人格插件
  python3 install.py --openclaw --scope global  # OpenClaw 全局安装
  python3 install.py --mcp --install-mode quick  # 兼容入口（将映射到 mcp install）
"""
    parser = argparse.ArgumentParser(
        description="AgentSoul 人格插件安装脚本",
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--persona", action="store_true", help="仅生成人格包")
    parser.add_argument("--name", type=str, help="自定义 Agent 名称")
    parser.add_argument("--mcp", action="store_true", help="兼容入口：安装并启动 MCP 服务（建议改用 `mcp install`）")
    parser.add_argument("--no-run", action="store_true", help="仅安装，不启动 MCP")
    parser.add_argument("--log", type=str, help="MCP 日志输出路径")
    parser.add_argument(
        "--install-mode",
        type=str,
        choices=["quick", "project", "global", "custom"],
        help="MCP 安装模式（quick/project/global/custom），仅用于 --mcp",
    )
    parser.add_argument(
        "--client-scope",
        type=str,
        choices=["local", "global", "both"],
        help="MCP 客户端作用域（项目级/全局/同时），用于 --mcp/--status/--uninstall",
    )
    parser.add_argument(
        "--client-target",
        type=str,
        choices=["all", "claude", "codex", "trae"],
        help="MCP 客户端类型（Claude/Codex/Trae/全部），用于 --mcp/--status/--uninstall",
    )
    parser.add_argument(
        "--project",
        type=str,
        help="本地作用域目标项目（支持项目名或路径），用于 --mcp/--status/--uninstall",
    )
    parser.add_argument("--openclaw", action="store_true", help="安装 OpenClaw 人格插件")
    parser.add_argument("--scope", type=str, choices=["current", "global"], help="OpenClaw 装载范围")
    parser.add_argument("--uninstall", action="store_true", help="兼容入口：卸载 Claude/Codex/Trae 中的 AgentSoul MCP")
    parser.add_argument("--status", action="store_true", help="兼容入口：查看 Claude/Codex/Trae MCP 客户端注册状态")
    parser.add_argument("--rollback", action="store_true", help="列出最近安装尝试并手动回滚")

    subparsers = parser.add_subparsers(dest="command")
    mcp_parser = subparsers.add_parser("mcp", help="MCP 安装/状态/修复命令")
    mcp_subparsers = mcp_parser.add_subparsers(dest="mcp_command")

    mcp_install = mcp_subparsers.add_parser("install", help="安装 MCP（prepare/register/run）")
    mcp_install.add_argument("--profile", choices=["quick", "project", "global", "full", "custom"], default="quick")
    mcp_install.add_argument("--scope", choices=["local", "global", "both"])
    mcp_install.add_argument("--clients", type=str, help="客户端列表：all 或 claude,codex,trae")
    mcp_install.add_argument("--project", type=str, help="本地作用域项目（路径/名称）")
    mcp_install.add_argument("--run", action="store_true", help="安装完成后启动 MCP 服务")
    mcp_install.add_argument("--prepare-only", action="store_true", help="仅执行 prepare（node/npm/build）")
    mcp_install.add_argument("--register-only", action="store_true", help="仅执行 register（客户端注册）")
    mcp_install.add_argument("--log", type=str, help="MCP 日志输出路径（配合 --run）")

    mcp_status = mcp_subparsers.add_parser("status", help="查看 MCP 客户端注册状态")
    mcp_status.add_argument("--scope", choices=["local", "global", "both"], default="both")
    mcp_status.add_argument("--clients", type=str, default="all", help="客户端列表：all 或 claude,codex,trae")
    mcp_status.add_argument("--project", type=str, help="本地作用域项目（路径/名称）")
    mcp_status.add_argument("--json", action="store_true", help="JSON 输出")

    mcp_uninstall = mcp_subparsers.add_parser("uninstall", help="卸载 MCP 客户端注册")
    mcp_uninstall.add_argument("--scope", choices=["local", "global", "both"], default="both")
    mcp_uninstall.add_argument("--clients", type=str, default="all", help="客户端列表：all 或 claude,codex,trae")
    mcp_uninstall.add_argument("--project", type=str, help="本地作用域项目（路径/名称）")

    mcp_doctor = mcp_subparsers.add_parser("doctor", help="诊断 MCP 安装与注册健康状态")
    mcp_doctor.add_argument("--scope", choices=["local", "global", "both"], default="both")
    mcp_doctor.add_argument("--clients", type=str, default="all", help="客户端列表：all 或 claude,codex,trae")
    mcp_doctor.add_argument("--project", type=str, help="本地作用域项目（路径/名称）")
    mcp_doctor.add_argument("--json", action="store_true", help="JSON 输出")

    mcp_repair = mcp_subparsers.add_parser("repair", help="修复 MCP 受管配置中的异常状态")
    mcp_repair.add_argument("--scope", choices=["local", "global", "both"], default="both")
    mcp_repair.add_argument("--clients", type=str, default="all", help="客户端列表：all 或 claude,codex,trae")
    mcp_repair.add_argument("--project", type=str, help="本地作用域项目（路径/名称）")

    mcp_project_list = mcp_subparsers.add_parser("project-list", help="列出可识别项目")
    mcp_project_list.add_argument("--json", action="store_true", help="JSON 输出")

    mcp_subparsers.add_parser("guide", help="生成 MCP 客户端安装指南")

    args = parser.parse_args()

    if args.command == "mcp":
        rc = handle_mcp_subcommand(args)
        if rc != 0:
            sys.exit(rc)
        return

    if args.persona:
        check_and_initialize_configs(PROJECT_ROOT)
        generate_persona_package(name=args.name)
        return

    if args.mcp:
        warn_legacy_mcp_notice()
        ns = argparse.Namespace(
            mcp_command="install",
            profile=args.install_mode or "quick",
            scope=args.client_scope,
            clients=(args.client_target or "all"),
            project=args.project,
            run=not args.no_run,
            prepare_only=False,
            register_only=False,
            log=args.log,
        )
        rc = handle_mcp_subcommand(ns)
        if rc != 0:
            sys.exit(rc)
        return

    if args.openclaw:
        check_and_initialize_configs(PROJECT_ROOT)
        scope = "global_session" if args.scope == "global" else "current_session"
        install_openclaw(scope)
        return

    if args.uninstall:
        warn_legacy_mcp_notice()
        clients = "all" if (args.client_target or "all") == "all" else str(args.client_target)
        ns = argparse.Namespace(
            mcp_command="uninstall",
            scope=args.client_scope or "both",
            clients=clients,
            project=args.project,
        )
        rc = handle_mcp_subcommand(ns)
        if rc != 0:
            sys.exit(rc)
        return

    if args.status:
        warn_legacy_mcp_notice()
        clients = "all" if (args.client_target or "all") == "all" else str(args.client_target)
        ns = argparse.Namespace(
            mcp_command="status",
            scope=args.client_scope or "both",
            clients=clients,
            project=args.project,
            json=False,
        )
        rc = handle_mcp_subcommand(ns)
        if rc != 0:
            sys.exit(rc)
        return

    if args.rollback:
        list_and_perform_rollback()
        return

    # Interactive install mode requires configuration initialization.
    check_and_initialize_configs(PROJECT_ROOT)

    while True:
        choice = show_menu()

        if choice == "0":
            log("已取消安装", "INFO")
            return

        if choice == "1":
            generate_persona_package()
            continue

        if choice == "2":
            profile = ask_install_mode("quick")
            if profile is None:
                continue
            ns = argparse.Namespace(
                mcp_command="install",
                profile=profile,
                scope=None,
                clients=None,
                project=None,
                run=False,
                prepare_only=False,
                register_only=False,
                log=None,
            )
            rc = handle_mcp_subcommand(ns)
            if rc != 0:
                log("安装流程执行失败，请根据日志修复后重试", "WARN")
            continue

        if choice == "3":
            scope = ask_session_scope()
            if scope is None:
                continue
            if not confirm_install(scope):
                continue
            install_openclaw(scope)
            continue

        if choice == "4":
            while True:
                uninstall_scope = ask_scope("both")
                if uninstall_scope is None:
                    break
                target_project = None
                if uninstall_scope in ("local", "both"):
                    selected = ask_project_root(PROJECT_ROOT)
                    if selected is None:
                        continue
                    target_project = selected
                    log(f"本地卸载目标项目：{target_project}", "OK")
                ns = argparse.Namespace(
                    mcp_command="uninstall",
                    scope=uninstall_scope,
                    clients="all",
                    project=str(target_project) if target_project is not None else None,
                )
                rc = handle_mcp_subcommand(ns)
                if rc != 0:
                    log("卸载流程执行失败，请根据日志修复后重试", "WARN")
                break


def get_install_tracker_path() -> Path:
    """Get path to installation tracker file."""
    return PROJECT_ROOT / ".install-tracker.json"


def load_install_history() -> List[Dict[str, Any]]:
    """Load installation history from tracker file."""
    tracker_path = get_install_tracker_path()
    if not tracker_path.exists():
        return []
    try:
        with open(tracker_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Ensure it's a list
        if not isinstance(data, list):
            return []
        return data
    except Exception:
        return []


def save_install_record(tracker: InstallationRollback) -> None:
    """Save installation record to history for potential future rollback."""
    tracker_path = get_install_tracker_path()

    # Load existing history
    history = load_install_history()

    # Create new record
    record: Dict[str, Any] = {
        "timestamp": datetime.now().isoformat(),
        "created_files": [str(p) for p in tracker._created_files],
        "modified_files": [(str(p), original_content.hex()) for p, original_content in tracker._modified_files],
        "created_dirs": [str(p) for p in tracker._created_dirs],
    }

    # Add to history
    history.append(record)

    # Keep only last 10 records to avoid unlimited growth
    if len(history) > 10:
        history = history[-10:]

    # Save back
    try:
        with open(tracker_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"⚠️  Failed to save installation tracker: {e}", "WARN")


def rollback_from_record(record: Dict[str, Any]) -> bool:
    """Perform rollback from a saved installation record."""
    success = True
    tracker = InstallationRollback()

    # Rebuild the tracker from saved record
    # For created files: just add to the list for deletion
    for file_path_str in record.get("created_files", []):
        file_path = Path(file_path_str).resolve()
        if file_path.exists():
            tracker._created_files.append(file_path)

    # For modified files: we need to decode the original content and add to list
    for file_path_str, original_content_hex in record.get("modified_files", []):
        file_path = Path(file_path_str).resolve()
        original_content = bytes.fromhex(original_content_hex)
        tracker._modified_files.append((file_path, original_content))

    # For created directories
    for dir_path_str in record.get("created_dirs", []):
        dir_path = Path(dir_path_str).resolve()
        tracker._created_dirs.append(dir_path)

    # Perform rollback
    if not tracker.has_changes():
        log("✓ No changes to rollback in this record", "OK")
        return True

    log(f"⚠️  Starting rollback from installation record {record['timestamp']}", "WARN")
    success = tracker.rollback()

    if success:
        log("✅ Rollback completed successfully", "OK")
    else:
        log("⚠️  Some files/directories could not be rolled back completely", "WARN")

    return success


def remove_record_from_history(record_index: int) -> None:
    """Remove a successfully rolled back record from history."""
    tracker_path = get_install_tracker_path()
    history = load_install_history()
    if 0 <= record_index < len(history):
        del history[record_index]
        try:
            with open(tracker_path, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            log(f"⚠️  Failed to update installation tracker after rollback: {e}", "WARN")


def list_and_perform_rollback() -> None:
    """List recent installation attempts and let user select one for rollback."""
    history = load_install_history()

    if not history:
        log("ℹ️  No installation history found for rollback", "INFO")
        return

    print("\n╔══════════════════════════════════════════════════════════════════╗")
    print("║         AgentSoul · 安装历史回滚                                 ║")
    print("╚══════════════════════════════════════════════════════════════════╝\n")
    print(f"找到 {len(history)} 条最近安装记录:\n")

    for i, record in enumerate(history):
        timestamp = record.get('timestamp', 'unknown time')
        created_count = len(record.get('created_files', []))
        modified_count = len(record.get('modified_files', []))
        print(f"  [{i+1}] {timestamp}")
        print(f"       - 新建文件: {created_count}, 修改文件: {modified_count}\n")

    while True:
        choice = input(f"请选择要回滚的安装 [1-{len(history)}, 输入 all 全选清理, 0 取消]: ").strip().lower()
        if not choice:
            log("已取消回滚", "INFO")
            return
        if choice in {"all", "a"}:
            confirm_all = prompt_binary_choice(
                f"确认回滚全部 {len(history)} 条安装记录？",
                default_yes=False,
                yes_label="确认全部回滚",
                no_label="取消",
            )
            if not confirm_all:
                log("已取消回滚", "INFO")
                return
            success_count = 0
            fail_count = 0
            for ridx in range(len(history) - 1, -1, -1):
                ok = rollback_from_record(history[ridx])
                if ok:
                    remove_record_from_history(ridx)
                    success_count += 1
                else:
                    fail_count += 1
            log(f"批量回滚完成：成功 {success_count} 条，失败 {fail_count} 条", "OK" if fail_count == 0 else "WARN")
            return

        try:
            idx = int(choice) - 1
            if idx == -1:
                log("已取消回滚", "INFO")
                return
            if 0 <= idx < len(history):
                break
            print(f"❌ 无效选项，请输入 0 到 {len(history)} 之间的数字")
        except ValueError:
            print("❌ 请输入有效的数字")

    # Confirm with user
    record = history[idx]
    timestamp = record.get('timestamp', 'unknown')
    created_count = len(record.get('created_files', []))
    modified_count = len(record.get('modified_files', []))

    print(f"\n⚠️  即将回滚这次安装：{timestamp}")
    print(f"   - 将删除 {created_count} 个新建文件")
    print(f"   - 将恢复 {modified_count} 个被修改文件到原始内容")
    print(f"   - 将删除 {len(record.get('created_dirs', []))} 个新建空目录\n")

    confirm = prompt_binary_choice(
        "确认执行回滚？",
        default_yes=False,
        yes_label="确认回滚",
        no_label="取消",
    )
    if not confirm:
        log("已取消回滚", "INFO")
        return

    # Perform rollback
    success = rollback_from_record(record)

    if success:
        # Remove the record from history after successful rollback
        remove_record_from_history(idx)


def ask_session_scope() -> str | None:
    print("\n请选择装载范围：\n")
    print("1. 当前 Session（仅本次会话，重启后需重新装载）")
    print("2. 全局 Session（永久生效，但切换新 Session 时需要身份唤醒）\n")
    print("0. 返回上一步\n")

    choice = prompt_numeric_choice(
        "请输入选项 [0-2，默认 1]: ",
        valid_choices=["0", "1", "2"],
        default="1",
        invalid_message="❌ 无效选项，请输入 0、1 或 2",
    )
    if choice == "0":
        return None
    return "current_session" if choice == "1" else "global_session"


if __name__ == "__main__":
    try:
        main()
        # If we get here, installation completed successfully
        # Any changes after config initialization are already tracked by the global tracker
        tracker = get_rollback_tracker()
        if tracker.has_changes():
            save_install_record(tracker)
    except KeyboardInterrupt:
        print("\n\n⚠️  Installation interrupted by user")
        print("\n⚠️  安装被用户中断")
        perform_rollback()
        sys.exit(1)
    except Exception:
        log("❌ Installation failed with an exception", "ERROR")
        import traceback
        traceback.print_exc()
        perform_rollback()
        sys.exit(1)
