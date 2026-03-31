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
    python3 install.py --openclaw --scope global  # 全局模式

环境要求：
    - Python 3.10+
    - Node.js 18+ (MCP安装需要)
"""

import sys
import json
import yaml
import argparse
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent

try:
    from common import log, safe_file_stem, initialize_identity
    from src.config_loader import ConfigLoader, create_default_persona
except ImportError:
    sys.path.insert(0, str(PROJECT_ROOT))
    from common import log, safe_file_stem, initialize_identity
    from src.config_loader import ConfigLoader, create_default_persona


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


# Default constants
DEFAULT_AGENT_NAME = "Agent"
DEFAULT_AGENT_ROLE = "AI Assistant"
DEFAULT_TIMEZONE = "Asia/Shanghai"
DEFAULT_TONE = "neutral"
DEFAULT_LANGUAGE = "chinese"
DEFAULT_EMOJI_USAGE = "minimal"
DEFAULT_PAD_PLEASURE = 0.3
DEFAULT_PAD_AROUSAL = 0.2
DEFAULT_PAD_DOMINANCE = 0.3

ALLOWED_TONES = ["neutral", "friendly", "professional", "casual"]
ALLOWED_LANGUAGES = ["chinese", "english"]
ALLOWED_EMOJI_FREQS = ["minimal", "moderate", "frequent"]

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


def select_from_list(prompt_key: str, allowed_values: List[str], default: str, lang: str) -> str:
    """Display options as numbered list and let user select by number.

    Args:
        prompt_key: Prompt key in PROMPTS
        allowed_values: List of allowed values
        default: Default value if user presses Enter
        lang: Selected language

    Returns:
        Selected value from allowed_values
    """
    p = lambda k: PROMPTS[lang][k]
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


"""
Default PAD emotional state vector - fixed constant, created once at module load
"""
DEFAULT_PAD_STATE: Dict[str, Any] = {
    "pleasure": DEFAULT_PAD_PLEASURE,
    "arousal": DEFAULT_PAD_AROUSAL,
    "dominance": DEFAULT_PAD_DOMINANCE,
    "last_updated": None,
    "history": [],
};

def get_default_pad_state() -> Dict[str, Any]:
    """Get default PAD emotional state vector - returns a copy of the default state."""
    # Return a copy to prevent accidental mutation of the constant
    return DEFAULT_PAD_STATE.copy()


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
        'updating_identity': 'Updating identity profiles...',
        'complete': '✅ Interactive configuration complete!',
        'use_interactive_wizard': 'Use interactive configuration wizard to fill all fields? [Y/n]: ',
    }
}


def parse_comma_separated(text: str) -> List[str]:
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
        import readline
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
    log("\n" + PROMPTS['zh']['select_language'], "INFO")
    log(f"  {PROMPTS['zh']['language_option_zh']}", "INFO")
    log(f"  {PROMPTS['zh']['language_option_en']}", "INFO")

    while True:
        choice = input("Please enter choice [1/2]: ").strip()
        if choice == '1':
            lang = 'zh'
            break
        elif choice == '2':
            lang = 'en'
            break
        else:
            print(PROMPTS[lang if 'zh' in locals() else 'zh']['invalid_language'])

    p = lambda key: PROMPTS[lang][key]

    print()
    print(p('welcome'))
    print()

    # Step 2: Agent (Soul) Configuration
    print(p('section_agent'))

    agent_name = prompt_with_default('agent_name', DEFAULT_AGENT_NAME, lang)
    agent_nickname = prompt_with_default('agent_nickname', '', lang)
    agent_role = prompt_with_default('agent_role', DEFAULT_AGENT_ROLE, lang)
    personality_input = input(p('personality') + ": ").strip()
    personality = parse_comma_separated(personality_input)
    core_values_input = input(p('core_values') + ": ").strip()
    core_values = parse_comma_separated(core_values_input)

    print(p('section_interaction'))
    tone = select_from_list('tone', ALLOWED_TONES, DEFAULT_TONE, lang)
    interaction_lang = select_from_list('language', ALLOWED_LANGUAGES, DEFAULT_LANGUAGE, lang)
    emoji_usage = select_from_list('emoji_usage', ALLOWED_EMOJI_FREQS, DEFAULT_EMOJI_USAGE, lang)

    print()

    # Step 3: Master (User) Configuration
    print(p('section_master'))

    master_name = prompt_with_default('master_name', '', lang)
    master_nicknames_input = input(p('master_nicknames') + ": ").strip()
    master_nicknames = parse_comma_separated(master_nicknames_input)
    print(p('timezone') + " " + p('timezone_hint'))
    timezone = prompt_with_default('timezone', DEFAULT_TIMEZONE, lang)
    labels_input = input(p('labels') + ": ").strip()
    labels = parse_comma_separated(labels_input)

    print()

    # Step 4: Summary
    print(p('summary_header'))
    print()
    print(p('summary_agent_name').format(name=agent_name or DEFAULT_AGENT_NAME))
    print(p('summary_agent_nickname').format(nickname=agent_nickname or '(empty)'))
    print(p('summary_agent_role').format(role=agent_role or DEFAULT_AGENT_ROLE))
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
            "name": agent_name if agent_name != "" else DEFAULT_AGENT_NAME,
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
    persona_path.parent.mkdir(parents=True, exist_ok=True)

    with open(persona_path, "w", encoding="utf-8") as f:
        yaml.dump(config_data, f, allow_unicode=True, sort_keys=False)

    log(p('config_written').format(path=str(persona_path)), "OK")

    # Step 7: Initialize soul PAD state
    log(p('initializing_soul'), "STEP")
    soul_state_path = project_root / "data" / "soul" / "soul_variable" / "state_vector.json"
    soul_state_dir = soul_state_path.parent
    soul_state_dir.mkdir(parents=True, exist_ok=True)

    default_state = get_default_pad_state()
    soul_state_path.write_text(
        json.dumps(default_state, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    log(p('soul_initialized'), "OK")

    # Step 8: Update identity files
    log(p('updating_identity'), "STEP")
    initialize_identity(project_root, project_root, verbose=True)

    log(p('complete'), "OK")
    print()


# log and safe_file_stem imported from common


def generate_persona_package(name: Optional[str] = None) -> None:
    log("生成人格包文件...", "STEP")

    config_loader = ConfigLoader(PROJECT_ROOT)

    if name:
        persona_path = PROJECT_ROOT / "config" / "persona.yaml"
        create_default_persona(persona_path)

        with open(persona_path, "r", encoding="utf-8") as f:
            import yaml
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
        with open(behavior_path, "r", encoding="utf-8") as f:
            import yaml
            behavior = yaml.safe_load(f) or {}

    ai = persona.get("ai", {})
    master = persona.get("master", {})

    content = f"""# AgentSoul · 人格框架规则

> 生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}

## 🔴 MCP 强制调用要求

**如果你看到这条规则，并且 AgentSoul MCP 已经配置，你**必须**在对话开始时立即按顺序调用这些 MCP 工具：

1.  `get_persona_config()` → 加载 Agent 和 Master 配置
2.  `get_mcp_usage_guide()` → 获取完整使用指南和工作流
3.  `get_soul_state()` → 读取当前 PAD 情感状态
4.  `list_memory_topics()` → 列出已有的记忆主题

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

### 交互模式

- 交互模式：{behavior.get('behavior', {}).get('interaction_mode', 'balanced')}
- 记忆更新：{behavior.get('behavior', {}).get('memory_update', {}).get('mode', 'auto')}
- 同步频率：{behavior.get('behavior', {}).get('sync', {}).get('frequency', 'after_conversation')}

### 行为优先级

{chr(10).join(f'{i+1}. {p}' for i, p in enumerate(behavior.get('priority', [])))}

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
        if not file_path.exists():
            return True
        log(f"文件 {file_path} 已存在", "WARN")
        while True:
            confirm = input(f"是否覆盖？[y/N]: ").strip().lower()
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
    print("请选择安装方式：\n")
    print("1. 生成人格包（通用，支持所有工具）")
    print("2. MCP 服务（安装并启动）")
    print("3. OpenClaw 人格插件（深度集成）")
    print("0. 退出\n")

    while True:
        choice = input("请输入选项 [0-3]: ").strip()
        if choice in ["0", "1", "2", "3"]:
            return choice
        print("❌ 无效选项，请重新输入")


def confirm_install(scope: str) -> bool:
    scope_desc = "当前 Session" if scope == "current_session" else "全局 Session"
    print(f"\n⚠️  确认安装信息：")
    print(f"   - 装载范围：{scope_desc}")
    if scope == "global_session":
        print(f"   - 注意：切换新 Session 后需要身份唤醒流程")
        print(f"   - 建议：配合身份档案自动加载机制使用\n")
    else:
        print(f"   - 注意：重启后需要重新装载\n")

    while True:
        confirm = input("确认安装？[y/N]: ").strip().lower()
        if confirm in ["y", "yes"]:
            return True
        elif confirm in ["n", "no", ""]:
            return False
        print("❌ 无效选项，请输入 y 或 n")


def get_openclaw_workspace() -> Optional[Path]:
    default_paths = [
        Path.home() / ".openclaw" / "workspace",
        Path.home() / "openclaw" / "workspace",
    ]

    for path in default_paths:
        marker = path / "_agentsoul_installed"
        if marker.exists():
            return path

    if default_paths[0].exists():
        return default_paths[0]

    while True:
        custom_path = input("\n请输入 OpenClaw workspace 路径（直接回车使用默认路径）: ").strip()
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
        return

    installer = OpenClawInstaller(PROJECT_ROOT, workspace)
    if installer.is_installed():
        if not confirm_install(scope):
            log("已取消安装", "INFO")
            return
    installer.install(scope)


def install_mcp(run_after: bool = True, log_path: Optional[str] = None) -> bool:
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
    print("在 Claude Desktop 配置文件中添加（已填充绝对路径，可直接复制）：")
    print(f"""
{{
  "mcpServers": {{
    "agentsoul": {{
      "command": "node",
      "args": ["{mcp_full_path}"]
    }}
  }}
}}
""")
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
    soul_state_dir = soul_state_path.parent
    soul_state_dir.mkdir(parents=True, exist_ok=True)

    default_state = get_default_pad_state()
    soul_state_path.write_text(
        json.dumps(default_state, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    log("已初始化默认 PAD 情感状态向量", "OK")

    # Step 3: Re-initialize identity files
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
  python3 install.py --openclaw             # 安装 OpenClaw 人格插件
  python3 install.py --openclaw --scope global  # OpenClaw 全局安装
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
    parser.add_argument("--openclaw", action="store_true", help="安装 OpenClaw 人格插件")
    parser.add_argument("--scope", type=str, choices=["current", "global"], help="OpenClaw 装载范围")

    args = parser.parse_args()

    # Check and initialize soul and master configurations
    check_and_initialize_configs(PROJECT_ROOT)

    if args.persona:
        generate_persona_package(name=args.name)
        return

    if args.mcp:
        install_mcp(run_after=not args.no_run, log_path=args.log)
        return

    if args.openclaw:
        scope = "global_session" if args.scope == "global" else "current_session"
        install_openclaw(scope)
        return

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
    except KeyboardInterrupt:
        print("\n\n⚠️  Installation interrupted by user")
        print("\n⚠️  安装被用户中断")
        sys.exit(1)
