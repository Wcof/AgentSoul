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
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent

try:
    from src.config_loader import ConfigLoader, create_default_persona
except ImportError:
    sys.path.insert(0, str(PROJECT_ROOT))
    from src.config_loader import ConfigLoader, create_default_persona


def log(message: str, level: str = "INFO") -> None:
    symbols = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERROR": "❌", "STEP": "🔧"}
    symbol = symbols.get(level, "")
    print(f"{symbol} {message}")


def _safe_file_stem(value: str, fallback: str) -> str:
    """生成安全的文件名，去除路径分隔符"""
    normalized = value.replace("/", "").replace("\\", "").strip()
    return normalized or fallback


def _initialize_identity_data(project_root: Path) -> None:
    """使用 ConfigLoader 初始化身份档案数据
    从 config/persona.yaml 加载配置并生成 profile 文件
    """
    from src.config_loader import ConfigLoader

    loader = ConfigLoader(project_root)
    config = loader.load_persona_config()

    ai = config.ai
    master = config.master

    ai_name = ai.name or "Agent"
    ai_nickname = ai.nickname or ""
    ai_role = ai.role or "AI Assistant"
    ai_traits = ai.personality or []
    ai_core_values = ai.core_values or []

    master_name = master.name or ""
    master_nicknames = master.nickname or []
    master_timezone = master.timezone or "Asia/Shanghai"
    master_labels = master.labels or []

    identity_root = project_root / "data" / "identity"
    self_dir = identity_root / "self"
    master_dir = identity_root / "master"
    others_dir = identity_root / "others"

    for directory in [self_dir, master_dir, others_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    ai_profile = f"""# AI Identity Profile

- **Name**: {ai_name}
- **Nickname**: {ai_nickname or '（未设置）'}
- **Role**: {ai_role}

## Personality Traits
{chr(10).join(f'- {item}' for item in ai_traits) if ai_traits else '- （未配置）'}

## Core Values
{chr(10).join(f'- {item}' for item in ai_core_values) if ai_core_values else '- （未配置）'}
"""

    master_profile = f"""# Master Identity Profile

- **Name**: {master_name or '（未设置）'}
- **Nicknames**: {', '.join(master_nicknames) if master_nicknames else '（未设置）'}
- **Timezone**: {master_timezone}

## Labels
{chr(10).join(f'- {item}' for item in master_labels) if master_labels else '- （未配置）'}
"""

    files_to_write: list[tuple[Path, str]] = [
        (self_dir / "profile.md", ai_profile),
        (self_dir / f"{_safe_file_stem(ai_name, 'agent')}.md", ai_profile),
    ]

    if master_name:
        files_to_write.extend([
            (master_dir / "profile.md", master_profile),
            (master_dir / f"{_safe_file_stem(master_name, 'master')}.md", master_profile),
        ])

    for file_path, content in files_to_write:
        file_path.write_text(content, encoding="utf-8")
        log(f"已注入身份档案: {file_path.relative_to(project_root)}", "OK")


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

    generated_time = datetime.now().strftime("%Y-%m-%d %H:%M")

    content = f"""# AgentSoul · 人格配置

> 生成时间：{generated_time}

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

### 在其他工具中使用

**Claude Desktop / Trae / Antigravity 等工具**：

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
    from src.openclaw_installer import OpenClawInstaller

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
        _initialize_identity_data(PROJECT_ROOT)

        # 创建默认 PAD 情感状态文件
        soul_state_dir = PROJECT_ROOT / "data" / "soul" / "soul_variable"
        soul_state_dir.mkdir(parents=True, exist_ok=True)
        soul_state_path = soul_state_dir / "state_vector.json"
        if not soul_state_path.exists():
            import json
            # 默认 baseline PAD 值: Pleasure=0.3, Arousal=0.2, Dominance=0.3
            default_state = {
                "pleasure": 0.3,
                "arousal": 0.2,
                "dominance": 0.3,
                "last_updated": None,
                "history": [],
            }
            soul_state_path.write_text(
                json.dumps(default_state, indent=2, ensure_ascii=False),
                encoding="utf-8"
            )
            log("已初始化默认 PAD 情感状态向量", "OK")
    except Exception as e:
        log(f"注入身份档案失败: {e}", "ERROR")
        return False

    mcp_dir = PROJECT_ROOT / "mcp-server"
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
    main()