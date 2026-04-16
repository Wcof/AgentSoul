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
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import yaml

PROJECT_ROOT = Path(__file__).parent
PROJECT_MARKER_FILES = ("AGENTS.md", "AGENT.md", "CLAUDE.md", "TRAE.md")

try:
    from common import get_default_pad_state, initialize_identity, log
    from src.config_loader import DEFAULT_PERSONA_DATA, ConfigLoader, create_default_persona
    from src.config_manager.validator import ConfigValidator
except ImportError:
    sys.path.insert(0, str(PROJECT_ROOT))
    from common import get_default_pad_state, initialize_identity, log
    from src.config_loader import DEFAULT_PERSONA_DATA, ConfigLoader, create_default_persona
    from src.config_manager.validator import ConfigValidator

# Import defaults from config_loader
# Defaults are read from DEFAULT_PERSONA_DATA directly at point of use
# to avoid duplication and keep in sync with source of truth

# Reuse constants from ConfigValidator to avoid duplication
ALLOWED_TONES = ConfigValidator.ALLOWED_TONES
ALLOWED_LANGUAGES = ConfigValidator.ALLOWED_LANGUAGES
ALLOWED_EMOJI_FREQS = ConfigValidator.ALLOWED_EMOJI_FREQS


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
    memories_dir = project_root / "data" / "memories"
    created_parent = False
    if not memories_dir.parent.exists():
        created_parent = True
    memories_dir.mkdir(parents=True, exist_ok=True)
    if created_parent:
        tracker.track_created_dir(memories_dir.parent)
    tracker.track_created_dir(memories_dir)
    log("已初始化记忆存储目录", "OK")

    # Initialize adaptive learning directories
    learning_dir = project_root / "data" / "learning"
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



# Bilingual prompts for interactive configuration wizard
PROMPTS = {
    'zh': {
        'select_language': '请选择语言 / Select language:',
        'language_option_zh': '1. 中文',
        'language_option_en': '2. English',
        'invalid_language': '❌ 无效选项，请输入 1 或 2',
        'invalid_choice': '❌ 无效选项，请输入 y 或 n',
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
        'confirm_write': '确认写入配置文件？[Y/n]: ',
        'confirm_no': '已取消，没有写入任何内容',
        'writing': '正在写入配置...',
        'config_written': '配置已写入: {path}',
        'initializing_soul': '初始化灵魂 PAD 情感状态...',
        'soul_initialized': '已初始化默认 PAD 情感状态向量',
        'updating_identity': '更新身份档案...',
        'complete': '✅ 交互式配置完成！',
        'use_interactive_wizard': '是否使用交互式配置向导填写所有配置项？[Y/n]: ',
    },
    'en': {
        'select_language': '请选择语言 / Select language:',
        'language_option_zh': '1. 中文',
        'language_option_en': '2. English',
        'invalid_language': '❌ Invalid selection, please enter 1 or 2',
        'invalid_choice': '❌ Invalid option, please enter y or n',
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
        'confirm_write': 'Confirm and write to configuration file? [Y/n]: ',
        'confirm_no': 'Cancelled, no changes written',
        'writing': 'Writing configuration...',
        'config_written': 'Configuration written to: {path}',
        'initializing_soul': 'Initializing soul PAD emotional state...',
        'soul_initialized': 'Default PAD emotional state initialized',
        'updating_identity': 'Updating identity profiles',
        'complete': '✅ Interactive configuration complete!',
        'use_interactive_wizard': 'Use interactive configuration wizard to fill all fields? [Y/n]: ',
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

    while True:
        choice = input("Please enter choice [1/2]: ").strip()
        if choice == '1':
            lang = 'zh'
            break
        elif choice == '2':
            lang = 'en'
            break
        else:
            # Use Chinese for error messages before language is selected
            print(PROMPTS['zh']['invalid_language'])

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
    while True:
        answer = input(p('confirm_write')).strip().lower()
        if answer in ['', 'y', 'yes']:
            do_write = True
            break
        elif answer in ['n', 'no']:
            do_write = False
            break
        else:
            print("❌ " + p('invalid_choice'))

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
    soul_state_path = project_root / "data" / "soul" / "soul_variable" / "state_vector.json"
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
            while True:
                confirm = input("是否覆盖现有配置？[y/N]: ").strip().lower()
                if confirm in ["y", "yes"]:
                    break
                elif confirm in ["n", "no", ""]:
                    log("跳过覆盖，使用现有配置中的名称", "INFO")
                    name = None
                    break
                else:
                    print("❌ 无效选项，请输入 y 或 n")

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
        while True:
            confirm = input("是否覆盖？[y/N]: ").strip().lower()
            if confirm in ["y", "yes"]:
                return True
            elif confirm in ["n", "no", ""]:
                log(f"跳过 {file_path}", "INFO")
                return False
            print("❌ 无效选项，请输入 y 或 n")

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
        while True:
            answer = input("是否现在打开配置文件编辑 Agent 和 Master 信息？[Y/n]: ").strip().lower()
            if answer in ["", "y", "yes"]:
                if open_file_in_editor(persona_config_path):
                    log(f"已在默认编辑器中打开 {persona_config_path}", "OK")
                else:
                    log(f"无法自动打开，请手动编辑: {persona_config_path}", "WARN")
                break
            elif answer in ["n", "no"]:
                log(f"配置文件位置: {persona_config_path}，你可以稍后编辑", "INFO")
                break
            else:
                print("❌ 无效选项，请输入 y 或 n")


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

    while True:
        choice = input("请输入选项 [0-4]: ").strip()
        if choice in ["0", "1", "2", "3", "4"]:
            return choice
        print("❌ 无效选项，请重新输入")


def confirm_install(scope: str) -> bool:
    scope_desc = "当前 Session" if scope == "current_session" else "全局 Session"
    print("\n⚠️  确认安装信息：")
    print(f"   - 装载范围：{scope_desc}")
    if scope == "global_session":
        print("   - 注意：切换新 Session 后需要身份唤醒流程")
        print("   - 建议：配合身份档案自动加载机制使用\n")
    else:
        print("   - 注意：重启后需要重新装载\n")

    while True:
        confirm = input("确认安装？[y/N]: ").strip().lower()
        if confirm in ["y", "yes"]:
            return True
        elif confirm in ["n", "no", ""]:
            return False
        print("❌ 无效选项，请输入 y 或 n")


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

        if path.exists() or input(f"路径 {path} 不存在，是否创建？[y/N]: ").strip().lower() in ["y", "yes"]:
            return path
        print("❌ 请重新输入有效路径")


def install_openclaw(scope: str) -> None:
    from openclaw_server.src.openclaw_installer import OpenClawInstaller

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
    while True:
        choice = input(f"请输入选项 [1-4，默认 {default_key}]: ").strip() or default_key
        if choice in options:
            return options[choice]  # type: ignore[return-value]
        print("❌ 无效选项，请重新输入")


def ask_install_mode(default: Literal["quick", "project", "global", "custom"] = "quick") -> Literal["quick", "project", "global", "custom"]:
    """Prompt MCP installation mode."""
    options = {"1": "quick", "2": "project", "3": "global", "4": "custom"}
    default_key = {"quick": "1", "project": "2", "global": "3", "custom": "4"}[default]
    print("\n请选择安装模式：")
    print("1. 快速模式（推荐）：Claude/Codex/Trae + 本地/全局")
    print("2. 项目模式：仅项目级（会选择项目）")
    print("3. 全局模式：仅全局")
    print("4. 自定义模式：手动选择作用域和客户端")
    while True:
        choice = input(f"请输入选项 [1-4，默认 {default_key}]: ").strip() or default_key
        if choice in options:
            return options[choice]  # type: ignore[return-value]
        print("❌ 无效选项，请重新输入")


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


def install_mcp(
    run_after: bool = True,
    log_path: str | None = None,
    install_mode: Literal["quick", "project", "global", "custom"] | None = None,
    client_scope: Literal["local", "global", "both"] | None = None,
    client_target: Literal["all", "claude", "codex", "trae"] | None = None,
    project_selector: str | None = None,
) -> bool:
    log("安装 MCP 服务...", "STEP")

    config_loader = ConfigLoader(PROJECT_ROOT)
    if not config_loader.is_config_valid():
        log("persona.yaml 配置无效或不存在，请先配置 config/persona.yaml", "ERROR")
        log("提示: 运行 'python3 install.py --persona' 生成默认配置", "INFO")
        return False

    try:
        initialize_identity(PROJECT_ROOT, PROJECT_ROOT)

        # 创建默认 PAD 情感状态文件
        soul_state_dir = PROJECT_ROOT / "data" / "soul" / "soul_variable"
        soul_state_dir.mkdir(parents=True, exist_ok=True)
        soul_state_path = soul_state_dir / "state_vector.json"
        if not soul_state_path.exists():
            import json
            default_state = get_default_pad_state()
            soul_state_path.write_text(
                json.dumps(default_state, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            log("已初始化默认 PAD 情感状态向量", "OK")
    except Exception as e:
        log(f"注入身份档案失败: {e}", "ERROR")
        return False

    mcp_dir = PROJECT_ROOT / "mcp_server"
    if not mcp_dir.exists():
        log("MCP 服务目录不存在", "ERROR")
        return False

    import subprocess
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        log(f"检测到 Node.js {result.stdout.strip()}", "OK")
    except FileNotFoundError:
        log("未找到 Node.js，请先安装 Node.js 18+", "ERROR")
        return False

    # 检查 npm 是否存在
    try:
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
        log(f"检测到 npm {result.stdout.strip()}", "OK")
    except FileNotFoundError:
        log("未找到 npm，请安装完整的 Node.js 开发环境", "ERROR")
        return False

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

    print("\n✅ MCP 服务安装完成！\n")
    print("配置说明：")
    mcp_full_path = (mcp_dir / "dist" / "index.js").absolute()
    print(f"MCP 服务路径：{mcp_full_path}\n")

    # Pre-compute JSON config once - reuse everywhere
    json_config = f'{{"command": "node", "args": ["{mcp_full_path}"]}}'

    # Generate bilingual Markdown install guide and enter client management menu
    guide_path = generate_client_install_markdown(mcp_full_path)
    log(f"已生成客户端安装指南（中英双语）：{guide_path}", "OK")

    print("\n手动配置方式（复制到对应 MCP 客户端配置文件）：")
    print(f"""
{{
  "mcpServers": {{
    "agentsoul": {json_config}
  }}
}}
""")
    print("Claude CLI 注册命令：")
    print(f"claude mcp add-json agentsoul '{json_config}'")
    print(f"claude mcp add-json --scope user agentsoul '{json_config}'\n")

    # Install client registration right away during MCP setup.
    selected_mode = install_mode
    if selected_mode is None and client_scope is None and client_target is None and project_selector is None:
        selected_mode = ask_install_mode("quick")
    elif selected_mode is None:
        selected_mode = "custom"

    if selected_mode == "quick":
        resolved_scope: Literal["local", "global", "both"] = "both"
        resolved_target: Literal["all", "claude", "codex", "trae"] = "all"
    elif selected_mode == "project":
        resolved_scope = "local"
        resolved_target = "all"
    elif selected_mode == "global":
        resolved_scope = "global"
        resolved_target = "all"
    else:
        resolved_scope = client_scope if client_scope is not None else ask_scope("both")
        resolved_target = client_target if client_target is not None else ask_client_target("all")

    selected_project_root = PROJECT_ROOT.resolve()
    if resolved_scope in ("local", "both"):
        if project_selector:
            found = find_project_by_name(project_selector)
            if found is None:
                log(f"未找到项目：{project_selector}，将使用当前项目 {PROJECT_ROOT}", "WARN")
            else:
                selected_project_root = found
                log(f"本地作用域目标项目：{selected_project_root}", "OK")
        elif selected_mode in ("project", "custom") and client_scope is None:
            selected_project_root = ask_project_root(PROJECT_ROOT)
            log(f"本地作用域目标项目：{selected_project_root}", "OK")
    install_selected_clients(
        mcp_full_path,
        json_config,
        resolved_scope,
        resolved_target,
        project_root=selected_project_root,
    )

    # Optional advanced client management menu.
    while True:
        answer = input("\n是否继续进入 MCP 客户端高级管理菜单？[y/N]: ").strip().lower()
        if answer in ("", "n", "no"):
            break
        if answer in ("y", "yes"):
            manage_mcp_clients(mcp_full_path, json_config, selected_project_root)
            break
        print("❌ 无效选项，请输入 y 或 n")

    if not run_after:
        return True

    log("启动 MCP 服务（Ctrl+C 退出）...", "STEP")
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    resolved_log = Path(log_path) if log_path else (logs_dir / "mcp.log")

    cmd = f'cd "{mcp_dir}" && node dist/index.js 2>&1 | tee -a "{resolved_log}"'
    try:
        subprocess.run(["/bin/zsh", "-lc", cmd], check=False)
    except KeyboardInterrupt:
        log("MCP 服务已停止", "INFO")
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
        paths.append(Path.home() / ".codex" / "config.toml")
    if scope in ("local", "both"):
        paths.append(project_root / ".codex" / "config.toml")
    return paths


def codex_startup_md_paths(scope: Literal["local", "global", "both"], project_root: Path = PROJECT_ROOT) -> list[Path]:
    """Get Codex startup markdown paths for selected scope."""
    paths: list[Path] = []
    if scope in ("global", "both"):
        paths.append(Path.home() / ".codex" / "agentsoul-startup.md")
    if scope in ("local", "both"):
        paths.append(project_root / ".codex" / "agentsoul-startup.md")
    return paths


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
    if scope in ("local", "both"):
        paths.append(project_root / ".trae" / "mcp.json")
    return paths


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


def _upsert_mcp_server_in_json(path: Path, server_name: str, config: dict[str, Any]) -> None:
    """Upsert MCP server entry in JSON object with mcpServers map."""
    data = _load_json_obj(path)
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
    data = _load_json_obj(path)
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
            records.append({"client": self.name, "scope": "global", "action": "install", "success": ok, "detail": msg or "registered"})

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
            records.append({"client": self.name, "scope": "local", "action": "install", "success": ok, "detail": msg or "registered"})
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
            records.append({"client": self.name, "scope": "global", "action": "uninstall", "success": ok and remaining == 0, "removed_hooks": removed, "remaining_hooks": remaining, "detail": msg or "removed"})

        if scope in ("local", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "remove", "agentsoul"],
                ["claude", "mcp", "remove", "agentsoul", "-s", "local"],
            ])
            local_settings = self.project_root / ".claude" / "settings.json"
            removed, remaining = remove_agentsoul_hook_file(local_settings, force=True)
            local_claude_dir = self.project_root / ".claude"
            if local_claude_dir.exists():
                try:
                    if not any(local_claude_dir.iterdir()):
                        local_claude_dir.rmdir()
                except Exception:
                    pass
            records.append({"client": self.name, "scope": "local", "action": "uninstall", "success": ok and remaining == 0, "removed_hooks": removed, "remaining_hooks": remaining, "detail": msg or "removed"})
        return records

    def status(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        if scope in ("global", "both"):
            # Some Claude CLI versions don't support scope on `mcp get`.
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "get", "agentsoul", "-s", "user"],
                ["claude", "mcp", "get", "--scope", "user", "agentsoul"],
            ])
            if not ok:
                ok = has_claude_user_mcp_server("agentsoul")
                msg = str(Path.home() / ".claude.json")
            settings = load_settings(Path.home() / ".claude" / "settings.json")
            records.append({"client": self.name, "scope": "global", "registered": ok, "hook_count": count_remaining_agentsoul_hooks(settings), "detail": msg})
        if scope in ("local", "both"):
            ok, msg = run_cli_command_with_fallback([
                ["claude", "mcp", "get", "agentsoul", "-s", "local"],
                ["claude", "mcp", "get", "agentsoul"],
            ])
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
            records.append({"client": self.name, "scope": path_scope_label(cfg, Path.home() / ".codex" / "config.toml"), "action": "install", "success": True, "detail": f"updated {cfg}"})

        for md in codex_startup_md_paths(scope, self.project_root):
            md.parent.mkdir(parents=True, exist_ok=True)
            md.write_text(codex_startup_markdown(), encoding="utf-8")
            records.append({"client": self.name, "scope": path_scope_label(md, Path.home() / ".codex" / "agentsoul-startup.md"), "action": "startup_fallback", "success": True, "detail": f"generated {md}"})

        for agents_md in codex_agents_md_paths(scope, self.project_root):
            upsert_managed_block(agents_md, codex_agents_markdown(), AGENTSOUL_AGENTS_BEGIN, AGENTSOUL_AGENTS_END)
            records.append({"client": self.name, "scope": "local", "action": "agents_md", "success": True, "detail": f"updated {agents_md}"})
        return records

    def uninstall(self, scope: Literal["local", "global", "both"]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for cfg in codex_scope_paths(scope, self.project_root):
            changed = remove_managed_block(cfg, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END)
            records.append({"client": self.name, "scope": path_scope_label(cfg, Path.home() / ".codex" / "config.toml"), "action": "uninstall", "success": True, "detail": f"{'removed' if changed else 'not found'} {cfg}"})
        for md in codex_startup_md_paths(scope, self.project_root):
            if md.exists():
                md.unlink()
                records.append({"client": self.name, "scope": path_scope_label(md, Path.home() / ".codex" / "agentsoul-startup.md"), "action": "startup_fallback_remove", "success": True, "detail": f"removed {md}"})
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
            sc = path_scope_label(cfg, Path.home() / ".codex" / "config.toml")
            records.append({
                "client": self.name,
                "scope": sc,
                "registered": has_managed_block(cfg, AGENTSOUL_BLOCK_BEGIN, AGENTSOUL_BLOCK_END),
                "startup_fallback": (Path.home() / ".codex" / "agentsoul-startup.md").exists() if sc == "global" else (self.project_root / ".codex" / "agentsoul-startup.md").exists(),
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
                "scope": path_scope_label(cfg, Path.home() / ".trae" / "mcp.json"),
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
                "scope": path_scope_label(cfg, Path.home() / ".trae" / "mcp.json"),
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
                "scope": path_scope_label(cfg, Path.home() / ".trae" / "mcp.json"),
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


def ask_scope(default: Literal["local", "global", "both"] = "both") -> Literal["local", "global", "both"]:
    """Prompt scope selection for client install/uninstall."""
    options = {"1": "local", "2": "global", "3": "both"}
    default_key = "3" if default == "both" else ("1" if default == "local" else "2")
    print("\n请选择作用域：")
    print("1. 项目本地")
    print("2. 用户全局")
    print("3. 同时（本地+全局）")
    while True:
        choice = input(f"请输入选项 [1-3，默认 {default_key}]: ").strip() or default_key
        if choice in options:
            return options[choice]  # type: ignore[return-value]
        print("❌ 无效选项，请重新输入")


def discover_project_candidates(max_depth: int = 4, max_results: int = 80) -> list[Path]:
    """Discover project folders by marker files."""
    roots = [
        PROJECT_ROOT.parent,
        Path.home() / "Downloads" / "project",
        Path.home() / "Downloads",
        Path.home() / "workspace",
        Path.home() / "projects",
    ]
    seen_dirs: set[Path] = set()
    results: list[Path] = []
    skip_dirs = {".git", "node_modules", ".venv", "venv", "__pycache__", ".codex", ".claude"}

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
            dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".pytest")]
            if any(marker in files for marker in PROJECT_MARKER_FILES):
                resolved = current_path.resolve()
                if resolved not in seen_dirs:
                    seen_dirs.add(resolved)
                    results.append(resolved)
                    if len(results) >= max_results:
                        return sorted(results)
    if PROJECT_ROOT.resolve() not in seen_dirs:
        results.append(PROJECT_ROOT.resolve())
    return sorted(results)


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
    for c in candidates:
        if c.name.lower() == lower or str(c).lower().endswith(lower):
            return c
    return None


def ask_project_root(default_root: Path = PROJECT_ROOT) -> Path:
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
    default_idx = 1
    while True:
        choice = input(f"请输入选项 [1-{len(ordered)}，默认 {default_idx}]: ").strip()
        if choice == "":
            return ordered[default_idx - 1]
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(ordered):
                return ordered[idx - 1]
        print("❌ 无效选项，请重新输入")


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
        choice = input("请输入选项 [0-10]: ").strip()
        if choice == "0":
            return
        if choice == "10":
            selected_project = ask_project_root(selected_project)
            log(f"已切换本地目标项目：{selected_project}", "OK")
            continue
        scope = ask_scope("both")
        if choice == "1":
            render_action_summary("Claude 安装结果", claude.install(scope, mcp_full_path, json_config))
        elif choice == "2":
            render_action_summary("Claude 卸载结果", claude.uninstall(scope))
        elif choice == "3":
            render_action_summary("Codex 安装结果", codex.install(scope, mcp_full_path, json_config))
        elif choice == "4":
            render_action_summary("Codex 卸载结果", codex.uninstall(scope))
        elif choice == "5":
            render_action_summary("Trae 安装结果", trae.install(scope, mcp_full_path, json_config))
        elif choice == "6":
            render_action_summary("Trae 卸载结果", trae.uninstall(scope))
        elif choice == "7":
            render_action_summary("Claude 安装结果", claude.install(scope, mcp_full_path, json_config))
            render_action_summary("Codex 安装结果", codex.install(scope, mcp_full_path, json_config))
            render_action_summary("Trae 安装结果", trae.install(scope, mcp_full_path, json_config))
        elif choice == "8":
            render_action_summary("Claude 卸载结果", claude.uninstall(scope))
            render_action_summary("Codex 卸载结果", codex.uninstall(scope))
            render_action_summary("Trae 卸载结果", trae.uninstall(scope))
        elif choice == "9":
            render_action_summary("Claude 状态", claude.status(scope))
            render_action_summary("Codex 状态", codex.status(scope))
            render_action_summary("Trae 状态", trae.status(scope))
        else:
            print("❌ 无效选项，请重新输入")


def uninstall_mcp(project_root: Path = PROJECT_ROOT) -> bool:
    """Uninstall AgentSoul MCP from Claude/Codex/Trae."""
    log("卸载 Claude/Codex/Trae 中的 AgentSoul MCP...", "STEP")
    claude = ClaudeInstaller(project_root)
    codex = CodexInstaller(project_root)
    trae = TraeInstaller(project_root)
    render_action_summary("Claude 卸载结果", claude.uninstall("both"))
    render_action_summary("Codex 卸载结果", codex.uninstall("both"))
    render_action_summary("Trae 卸载结果", trae.uninstall("both"))
    status_ok = claude.status("both") + codex.status("both") + trae.status("both")
    ok = all(not rec.get("registered", False) for rec in status_ok if "registered" in rec)
    if ok:
        log("✅ MCP 卸载完成", "OK")
    else:
        log("⚠️  卸载完成但存在失败项，请查看上方详情", "WARN")
    return ok


def check_and_initialize_configs(project_root: Path) -> None:
    """Check for existing soul and master configs and prompt for initialization.

    - First-time install: force initialization
    - Existing configs: ask user if they want to reset
    - Always re-creates defaults if user agrees
    """
    config_loader = ConfigLoader(project_root)
    persona_path = project_root / "config" / "persona.yaml"
    soul_state_path = project_root / "data" / "soul" / "soul_variable" / "state_vector.json"

    # Check existence
    has_master_config = persona_path.exists() and config_loader.is_config_valid()
    has_soul_state = soul_state_path.exists()

    if not has_master_config and not has_soul_state:
        log("检测到首次安装，开始初始化配置...", "STEP")
        do_initialize = True
    else:
        # Build dynamic prompt based on what exists
        if has_master_config and has_soul_state:
            prompt = "检测到已存在的灵魂状态和用户配置，是否要重新初始化？[y/N]: "
        elif not has_soul_state:
            prompt = "检测到已存在用户配置，但缺少灵魂状态，是否初始化灵魂状态？[y/N]: "
        else:
            prompt = "检测到已存在灵魂状态，但缺少用户配置，是否重新初始化？[y/N]: "

        while True:
            answer = input(prompt).strip().lower()
            if answer in ["y", "yes"]:
                do_initialize = True
                break
            elif answer in ["n", "no", ""]:
                do_initialize = False
                break
            else:
                print("❌ 无效选项，请输入 y 或 n")

    if not do_initialize:
        if has_master_config and has_soul_state:
            log("保留现有配置，继续安装", "INFO")
        elif not has_soul_state:
            log("跳过灵魂状态初始化，继续安装\n提示：后续可重新运行安装脚本初始化", "INFO")
        else:
            log("跳过用户配置初始化，继续安装\n提示：后续可重新运行安装脚本初始化", "INFO")
        return

    # Ask whether to use interactive configuration wizard
    while True:
        answer = input(PROMPTS['zh']['use_interactive_wizard']).strip().lower()
        if answer in ["", "y", "yes"]:
            # Run interactive wizard
            run_interactive_config_wizard(project_root)
            return
        elif answer in ["n", "no"]:
            # Use traditional method: create default and open editor
            break
        else:
            print("❌ 无效选项，请输入 y 或 n")

    # Step 1: Initialize master configuration (traditional method)
    log("初始化用户配置 (master)...", "STEP")
    tracker = get_rollback_tracker()
    if persona_path.exists():
        tracker.track_modified_file(persona_path)
    else:
        tracker.track_created_file(persona_path)
    create_default_persona(persona_path)

    # Ask to open editor
    while True:
        answer = input("是否现在打开编辑器配置用户信息？[Y/n]: ").strip().lower()
        if answer in ["", "y", "yes"]:
            if open_file_in_editor(persona_path):
                log(f"已在默认编辑器中打开 {persona_path}", "OK")
            else:
                log(f"无法自动打开，请手动编辑: {persona_path}", "WARN")
            break
        elif answer in ["n", "no"]:
            log(f"配置文件位置: {persona_path}，你可以稍后编辑", "INFO")
            break
        else:
            print("❌ 无效选项，请输入 y 或 n")

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


def main():
    epilog = """
示例用法:
  python3 install.py                         # 交互式安装
  python3 install.py --persona               # 仅生成人格包
  python3 install.py --persona --name "小明" # 自定义 Agent 名称生成
  python3 install.py --mcp                   # 安装并启动 MCP 服务
  python3 install.py --mcp --no-run         # 仅安装 MCP，不启动
  python3 install.py --mcp --install-mode quick  # 快速模式：三端 + 本地/全局
  python3 install.py --mcp --install-mode project  # 项目模式：仅项目级并选择项目
  python3 install.py --mcp --client-scope both --client-target all  # 安装到 Claude/Codex/Trae 的项目级+全局
  python3 install.py --mcp --client-scope local --project my-app     # 指定项目名执行本地安装
  python3 install.py --openclaw             # 安装 OpenClaw 人格插件
  python3 install.py --openclaw --scope global  # OpenClaw 全局安装
  python3 install.py --uninstall            # 卸载 Claude/Codex/Trae 中的 AgentSoul MCP
  python3 install.py --status               # 查看 Claude/Codex/Trae MCP 注册状态
  python3 install.py --rollback            # 列出最近安装尝试并手动回滚
"""
    parser = argparse.ArgumentParser(
        description="AgentSoul 人格插件安装脚本",
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--persona", action="store_true", help="仅生成人格包")
    parser.add_argument("--name", type=str, help="自定义 Agent 名称")
    parser.add_argument("--mcp", action="store_true", help="安装并启动 MCP 服务")
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
        help="MCP 客户端注册作用域（项目级/全局/同时），仅用于 --mcp",
    )
    parser.add_argument(
        "--client-target",
        type=str,
        choices=["all", "claude", "codex", "trae"],
        help="MCP 客户端类型（Claude/Codex/Trae/全部），仅用于 --mcp",
    )
    parser.add_argument(
        "--project",
        type=str,
        help="本地作用域目标项目（支持项目名或路径），用于 --mcp/--status/--uninstall",
    )
    parser.add_argument("--openclaw", action="store_true", help="安装 OpenClaw 人格插件")
    parser.add_argument("--scope", type=str, choices=["current", "global"], help="OpenClaw 装载范围")
    parser.add_argument("--uninstall", action="store_true", help="卸载 Claude/Codex/Trae 中的 AgentSoul MCP")
    parser.add_argument("--status", action="store_true", help="查看 Claude/Codex/Trae MCP 客户端注册状态")
    parser.add_argument("--rollback", action="store_true", help="列出最近安装尝试并手动回滚")

    args = parser.parse_args()

    if args.persona:
        check_and_initialize_configs(PROJECT_ROOT)
        generate_persona_package(name=args.name)
        return

    if args.mcp:
        check_and_initialize_configs(PROJECT_ROOT)
        install_mcp(
            run_after=not args.no_run,
            log_path=args.log,
            install_mode=args.install_mode,
            client_scope=args.client_scope,
            client_target=args.client_target,
            project_selector=args.project,
        )
        return

    if args.openclaw:
        check_and_initialize_configs(PROJECT_ROOT)
        scope = "global_session" if args.scope == "global" else "current_session"
        install_openclaw(scope)
        return

    if args.uninstall:
        target_project = find_project_by_name(args.project) if args.project else PROJECT_ROOT
        uninstall_mcp(target_project or PROJECT_ROOT)
        return

    if args.status:
        scope = "both"
        target_project = find_project_by_name(args.project) if args.project else PROJECT_ROOT
        claude = ClaudeInstaller(target_project or PROJECT_ROOT)
        codex = CodexInstaller(target_project or PROJECT_ROOT)
        trae = TraeInstaller(target_project or PROJECT_ROOT)
        render_action_summary("Claude 状态", claude.status(scope))
        render_action_summary("Codex 状态", codex.status(scope))
        render_action_summary("Trae 状态", trae.status(scope))
        return

    if args.rollback:
        list_and_perform_rollback()
        return

    # Interactive install mode requires configuration initialization.
    check_and_initialize_configs(PROJECT_ROOT)

    choice = show_menu()

    if choice == "0":
        log("已取消安装", "INFO")
        return

    if choice == "1":
        generate_persona_package()
    elif choice == "2":
        install_mcp()
    elif choice == "3":
        scope = ask_session_scope()
        if not confirm_install(scope):
            return
        install_openclaw(scope)
    elif choice == "4":
        target_project = ask_project_root(PROJECT_ROOT)
        log(f"本地卸载目标项目：{target_project}", "OK")
        uninstall_mcp(target_project)


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
        choice = input(f"请选择要回滚的安装 [1-{len(history)}, 输入 0 取消]: ").strip()
        if not choice:
            log("已取消回滚", "INFO")
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

    while True:
        confirm = input("确认执行回滚？[y/N]: ").strip().lower()
        if confirm in ["y", "yes"]:
            break
        elif confirm in ["n", "no", ""]:
            log("已取消回滚", "INFO")
            return
        else:
            print("❌ 无效选项，请输入 y 或 n")

    # Perform rollback
    success = rollback_from_record(record)

    if success:
        # Remove the record from history after successful rollback
        remove_record_from_history(idx)


def ask_session_scope() -> str:
    print("\n请选择装载范围：\n")
    print("1. 当前 Session（仅本次会话，重启后需重新装载）")
    print("2. 全局 Session（永久生效，但切换新 Session 时需要身份唤醒）\n")

    while True:
        choice = input("请输入选项 [1-2]: ").strip()
        if choice in ["1", "2"]:
            return "current_session" if choice == "1" else "global_session"
        print("❌ 无效选项，请重新输入")


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
